from contextlib import suppress
from pathlib import Path

from codealmanac.core.errors import ValidationFailed
from codealmanac.services.harnesses.models import HarnessRunResult
from codealmanac.services.harnesses.requests import RunHarnessRequest
from codealmanac.services.harnesses.service import HarnessesService
from codealmanac.services.runs.models import RunEventKind, RunStatus
from codealmanac.services.runs.requests import (
    FinishRunRequest,
    MarkRunRunningRequest,
    RecordRunEventRequest,
    RecordRunHarnessTranscriptRequest,
)
from codealmanac.services.runs.service import RunsService
from codealmanac.wiki.index.service import IndexService
from codealmanac.wiki.workspaces.models import Workspace
from codealmanac.wiki.workspaces.requests import SelectWorkspaceRequest
from codealmanac.wiki.workspaces.service import WorkspacesService
from codealmanac.workflows.lifecycle import (
    LifecycleMutationPolicy,
    LifecycleMutationPreflight,
    first_line,
    harness_events,
    harness_run_event_kind,
    validate_harness_result,
)
from codealmanac.workflows.page_run.models import PageRunContext, PageRunResult
from codealmanac.workflows.page_run.requests import (
    PageRunBeginRequest,
    PageRunExecuteRequest,
    PageRunRecordEventRequest,
)


class PageRunWorkflow:
    def __init__(
        self,
        workspaces: WorkspacesService,
        harnesses: HarnessesService,
        runs: RunsService,
        index: IndexService,
        mutation_policy: LifecycleMutationPolicy,
    ):
        self.workspaces = workspaces
        self.harnesses = harnesses
        self.runs = runs
        self.index = index
        self.mutation_policy = mutation_policy

    def begin(self, request: PageRunBeginRequest) -> PageRunContext:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        self.runs.mark_running(
            MarkRunRunningRequest(
                cwd=request.cwd,
                wiki=request.wiki,
                run_id=request.run_id,
            )
        )
        return PageRunContext(
            cwd=request.cwd,
            wiki=request.wiki,
            run_id=request.run_id,
            workspace=workspace,
        )

    def preflight(self, context: PageRunContext) -> PageRunContext:
        preflight = self.mutation_policy.preflight(context.workspace)
        self.record(
            PageRunRecordEventRequest(
                context=context,
                kind=RunEventKind.MESSAGE,
                message=self.mutation_policy.preflight_message(context.workspace),
            )
        )
        return context.model_copy(update={"preflight": preflight})

    def record(self, request: PageRunRecordEventRequest) -> None:
        self.runs.record_event(
            RecordRunEventRequest(
                cwd=request.context.cwd,
                wiki=request.context.wiki,
                run_id=request.context.run_id,
                kind=request.kind,
                message=request.message,
                harness_event=request.harness_event,
            )
        )

    def execute(self, request: PageRunExecuteRequest) -> PageRunResult:
        preflight = require_preflight(request.context)
        workspace = request.context.workspace
        harness = self.harnesses.run(
            RunHarnessRequest(
                kind=request.harness,
                cwd=workspace.root_path,
                prompt=request.prompt,
                title=request.title,
            )
        )
        self.record_harness_transcript(request.context, harness)
        self.record_harness_events(request.context, harness)
        safety = self.mutation_policy.validate(
            preflight,
            workspace,
            harness.changed_files,
        )
        validate_harness_result(harness)
        index = self.index.ensure_fresh(workspace.workspace_id)
        finished = self.runs.finish(
            FinishRunRequest(
                cwd=request.context.cwd,
                wiki=request.context.wiki,
                run_id=request.context.run_id,
                status=RunStatus.DONE,
                summary=harness.summary or request.success_summary,
            )
        )
        return PageRunResult(
            run=finished,
            harness=harness,
            safety=safety,
            index=index,
        )

    def fail(self, context: PageRunContext, error: Exception) -> None:
        message = first_line(str(error)) or error.__class__.__name__
        with suppress(Exception):
            self.record(
                PageRunRecordEventRequest(
                    context=context,
                    kind=RunEventKind.ERROR,
                    message=message,
                )
            )
            self.runs.finish(
                FinishRunRequest(
                    cwd=context.cwd,
                    wiki=context.wiki,
                    run_id=context.run_id,
                    status=RunStatus.FAILED,
                    error=message,
                )
            )

    def resolve_workspace(self, cwd: Path, wiki: str | None) -> Workspace:
        if wiki is None:
            return self.workspaces.resolve(cwd)
        return self.workspaces.select(
            SelectWorkspaceRequest(selector=wiki, base_path=cwd)
        )

    def record_harness_transcript(
        self,
        context: PageRunContext,
        harness: HarnessRunResult,
    ) -> None:
        if harness.transcript is None:
            return
        self.runs.record_harness_transcript(
            RecordRunHarnessTranscriptRequest(
                cwd=context.cwd,
                wiki=context.wiki,
                run_id=context.run_id,
                transcript=harness.transcript,
            )
        )

    def record_harness_events(
        self,
        context: PageRunContext,
        harness: HarnessRunResult,
    ) -> None:
        for event in harness_events(harness):
            self.record(
                PageRunRecordEventRequest(
                    context=context,
                    kind=harness_run_event_kind(event),
                    message=event.message,
                    harness_event=event,
                )
            )


def require_preflight(context: PageRunContext) -> LifecycleMutationPreflight:
    if context.preflight is None:
        raise ValidationFailed("page run requires mutation preflight before harness")
    return context.preflight
