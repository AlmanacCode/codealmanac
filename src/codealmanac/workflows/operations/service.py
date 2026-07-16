from collections.abc import Iterator
from contextlib import contextmanager, suppress
from pathlib import Path

from codealmanac.core.errors import error_summary
from codealmanac.services.harnesses.models import HarnessEvent, HarnessRunResult
from codealmanac.services.harnesses.requests import RunHarnessRequest
from codealmanac.services.harnesses.service import (
    HarnessesService,
    HarnessEventSinkFailed,
)
from codealmanac.services.health.service import HealthService
from codealmanac.services.index.service import IndexService
from codealmanac.services.repositories.models import Repository, RepositoryName
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.runs.models import (
    RunEventKind,
    RunFailureCategory,
    RunStatus,
)
from codealmanac.services.runs.requests import (
    FinishRunRequest,
    MarkRunRunningRequest,
    RecordRunEventRequest,
    RecordRunHarnessTranscriptRequest,
)
from codealmanac.services.runs.service import RunsService
from codealmanac.workflows.operations.harness import (
    harness_events,
    harness_run_event_kind,
    should_record_harness_event,
    validate_harness_result,
)
from codealmanac.workflows.operations.models import OperationContext, OperationResult
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
    ):
        self.repositories = repositories
        self.harnesses = harnesses
        self.runs = runs
        self.index = index
        self.health = health

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
        repository = request.context.repository
        emitted_events: list[HarnessEvent] = []

        def record_live_event(event: HarnessEvent) -> None:
            emitted_events.append(event)
            self.record_harness_event(request.context, event)

        with self.failure_phase(
            request.context,
            RunFailureCategory.INTERNAL_ERROR,
        ):
            harness_request = RunHarnessRequest(
                kind=request.harness,
                model=request.model,
                agent=request.agent,
                cwd=repository.root_path,
                prompt=request.prompt,
                title=request.title,
            )

        try:
            self.harnesses.ensure_ready(request.harness)
        except Exception as error:
            self.fail(
                request.context,
                error,
                RunFailureCategory.HARNESS_READINESS,
            )
            raise

        try:
            harness = self.harnesses.run_ready(
                harness_request,
                on_event=record_live_event,
            )
        except HarnessEventSinkFailed as error:
            self.fail(
                request.context,
                error.error,
                RunFailureCategory.INTERNAL_ERROR,
            )
            raise error.error from error
        except Exception as error:
            self.fail(
                request.context,
                error,
                RunFailureCategory.PROVIDER_EXECUTION,
            )
            raise

        with self.failure_phase(
            request.context,
            RunFailureCategory.INTERNAL_ERROR,
        ):
            self.record_harness_transcript(request.context, harness)
            if len(emitted_events) == 0:
                self.record_harness_events(request.context, harness)

        with self.failure_phase(
            request.context,
            RunFailureCategory.PROVIDER_EXECUTION,
        ):
            validate_harness_result(harness)

        with self.failure_phase(request.context, RunFailureCategory.INDEXING):
            index = self.index.ensure_fresh(repository.repository_id)

        with self.failure_phase(
            request.context,
            RunFailureCategory.WIKI_VALIDATION,
        ):
            self.health.ensure_valid(repository)

        with self.failure_phase(
            request.context,
            RunFailureCategory.INTERNAL_ERROR,
        ):
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
            index=index,
        )

    def fail(
        self,
        context: OperationContext,
        error: Exception,
        category: RunFailureCategory,
    ) -> None:
        message = error_summary(error)
        with suppress(Exception):
            self.record(
                RecordOperationEventRequest(
                    context=context,
                    kind=RunEventKind.ERROR,
                    message=message,
                )
            )
        with suppress(Exception):
            self.runs.finish(
                FinishRunRequest(
                    run_id=context.run_id,
                    status=RunStatus.FAILED,
                    error=message,
                    failure_category=category,
                )
            )

    @contextmanager
    def failure_phase(
        self,
        context: OperationContext,
        category: RunFailureCategory,
    ) -> Iterator[None]:
        try:
            yield
        except Exception as error:
            self.fail(context, error, category)
            raise

    def resolve_repository(
        self,
        cwd: Path,
        repository_name: RepositoryName | None,
    ) -> Repository:
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
            self.record_harness_event(context, event)

    def record_harness_event(
        self,
        context: OperationContext,
        event: HarnessEvent,
    ) -> None:
        if not should_record_harness_event(event):
            return
        self.record(
            RecordOperationEventRequest(
                context=context,
                kind=harness_run_event_kind(event),
                message=event.message,
                harness_event=event,
            )
        )
