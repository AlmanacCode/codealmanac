from contextlib import suppress
from pathlib import Path

from codealmanac.core.errors import ValidationFailed
from codealmanac.services.harnesses.models import HarnessRunResult
from codealmanac.services.harnesses.requests import RunHarnessRequest
from codealmanac.services.harnesses.service import HarnessesService
from codealmanac.services.health.service import HealthService
from codealmanac.services.index.service import IndexService
from codealmanac.services.repositories.models import Repository
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.runs.models import RunEventKind, RunStatus
from codealmanac.services.runs.requests import (
    FinishRunRequest,
    MarkRunRunningRequest,
    RecordRunEventRequest,
    RecordRunHarnessTranscriptRequest,
)
from codealmanac.services.runs.service import RunsService
from codealmanac.workflows.operations.harness import (
    first_line,
    harness_events,
    harness_run_event_kind,
    validate_harness_result,
)
from codealmanac.workflows.operations.models import OperationContext, OperationResult
from codealmanac.workflows.operations.mutation import (
    OperationMutationPolicy,
    OperationMutationPreflight,
)
from codealmanac.workflows.operations.requests import (
    BeginOperationRequest,
    ExecuteOperationRequest,
    RecordOperationEventRequest,
)


class OperationRunner:
    def __init__(
        self,
        repositories: RepositoriesService,
        harnesses: HarnessesService,
        runs: RunsService,
        index: IndexService,
        health: HealthService,
        mutation_policy: OperationMutationPolicy,
    ):
        self.repositories = repositories
        self.harnesses = harnesses
        self.runs = runs
        self.index = index
        self.health = health
        self.mutation_policy = mutation_policy

    def begin(self, request: BeginOperationRequest) -> OperationContext:
        run = self.runs.mark_running(
            MarkRunRunningRequest(
                run_id=request.run_id,
            )
        )
        repository = self.runs.repository_for(run)
        return OperationContext(
            run_id=request.run_id,
            repository=repository,
        )

    def preflight(self, context: OperationContext) -> OperationContext:
        preflight = self.mutation_policy.preflight(context.repository)
        self.record(
            RecordOperationEventRequest(
                context=context,
                kind=RunEventKind.MESSAGE,
                message=(
                    "captured "
                    f"{context.repository.almanac_root.as_posix()} mutation preflight"
                ),
            )
        )
        return context.model_copy(update={"preflight": preflight})

    def record(self, request: RecordOperationEventRequest) -> None:
        self.runs.record_event(
            RecordRunEventRequest(
                run_id=request.context.run_id,
                kind=request.kind,
                message=request.message,
                harness_event=request.harness_event,
            )
        )

    def execute(self, request: ExecuteOperationRequest) -> OperationResult:
        preflight = require_preflight(request.context)
        repository = request.context.repository
        harness = self.harnesses.run(
            RunHarnessRequest(
                kind=request.harness,
                cwd=repository.root_path,
                prompt=request.prompt,
                title=request.title,
            )
        )
        self.record_harness_transcript(request.context, harness)
        self.record_harness_events(request.context, harness)
        safety = self.mutation_policy.validate(
            preflight,
            repository,
            harness.changed_files,
        )
        validate_harness_result(harness)
        index = self.index.ensure_fresh(repository.repository_id)
        self.health.ensure_valid(repository)
        finished = self.runs.finish(
            FinishRunRequest(
                run_id=request.context.run_id,
                status=RunStatus.DONE,
                summary=harness.summary or request.success_summary,
            )
        )
        return OperationResult(
            run=finished,
            harness=harness,
            safety=safety,
            index=index,
        )

    def fail(self, context: OperationContext, error: Exception) -> None:
        message = first_line(str(error)) or error.__class__.__name__
        with suppress(Exception):
            self.record(
                RecordOperationEventRequest(
                    context=context,
                    kind=RunEventKind.ERROR,
                    message=message,
                )
            )
            self.runs.finish(
                FinishRunRequest(
                    run_id=context.run_id,
                    status=RunStatus.FAILED,
                    error=message,
                )
            )

    def resolve_repository(self, cwd: Path, repository_name: str | None) -> Repository:
        return self.repositories.select_for_operation(cwd, repository_name)

    def record_harness_transcript(
        self,
        context: OperationContext,
        harness: HarnessRunResult,
    ) -> None:
        if harness.transcript is None:
            return
        self.runs.record_harness_transcript(
            RecordRunHarnessTranscriptRequest(
                run_id=context.run_id,
                transcript=harness.transcript,
            )
        )

    def record_harness_events(
        self,
        context: OperationContext,
        harness: HarnessRunResult,
    ) -> None:
        for event in harness_events(harness):
            self.record(
                RecordOperationEventRequest(
                    context=context,
                    kind=harness_run_event_kind(event),
                    message=event.message,
                    harness_event=event,
                )
            )


def require_preflight(context: OperationContext) -> OperationMutationPreflight:
    if context.preflight is None:
        raise ValidationFailed("operation requires mutation preflight before harness")
    return context.preflight
