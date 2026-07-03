from contextlib import suppress
from pathlib import Path

from codealmanac.core.errors import ValidationFailed
from codealmanac.engine.harnesses.models import HarnessRunResult
from codealmanac.engine.harnesses.requests import RunHarnessRequest
from codealmanac.engine.harnesses.service import HarnessesService
from codealmanac.engine.lifecycle import (
    LifecycleMutationPolicy,
    LifecycleMutationPreflight,
    first_line,
    harness_events,
    harness_run_event_kind,
    validate_harness_result,
)
from codealmanac.engine.page_run.models import PageRunContext, PageRunResult
from codealmanac.engine.page_run.requests import (
    PageJobRecordEventRequest,
    PageRunBeginRequest,
    PageRunExecuteRequest,
)
from codealmanac.jobs.ledger.models import JobEventKind, JobStatus
from codealmanac.jobs.ledger.requests import (
    FinishJobRequest,
    MarkJobRunningRequest,
    RecordJobEventRequest,
    RecordJobHarnessTranscriptRequest,
)
from codealmanac.jobs.ledger.service import JobLedgerService
from codealmanac.wiki.index.service import IndexService
from codealmanac.wiki.workspaces.models import Workspace
from codealmanac.wiki.workspaces.requests import SelectWorkspaceRequest
from codealmanac.wiki.workspaces.service import WorkspacesService


class PageRunWorkflow:
    def __init__(
        self,
        workspaces: WorkspacesService,
        harnesses: HarnessesService,
        jobs: JobLedgerService,
        index: IndexService,
        mutation_policy: LifecycleMutationPolicy,
    ):
        self.workspaces = workspaces
        self.harnesses = harnesses
        self.jobs = jobs
        self.index = index
        self.mutation_policy = mutation_policy

    def begin(self, request: PageRunBeginRequest) -> PageRunContext:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        self.jobs.mark_running(
            MarkJobRunningRequest(
                cwd=request.cwd,
                wiki=request.wiki,
                job_id=request.job_id,
            )
        )
        return PageRunContext(
            cwd=request.cwd,
            wiki=request.wiki,
            job_id=request.job_id,
            workspace=workspace,
        )

    def preflight(self, context: PageRunContext) -> PageRunContext:
        preflight = self.mutation_policy.preflight(context.workspace)
        self.record(
            PageJobRecordEventRequest(
                context=context,
                kind=JobEventKind.MESSAGE,
                message=self.mutation_policy.preflight_message(context.workspace),
            )
        )
        return context.model_copy(update={"preflight": preflight})

    def record(self, request: PageJobRecordEventRequest) -> None:
        self.jobs.record_event(
            RecordJobEventRequest(
                cwd=request.context.cwd,
                wiki=request.context.wiki,
                job_id=request.context.job_id,
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
        finished = self.jobs.finish(
            FinishJobRequest(
                cwd=request.context.cwd,
                wiki=request.context.wiki,
                job_id=request.context.job_id,
                status=JobStatus.DONE,
                summary=harness.summary or request.success_summary,
            )
        )
        return PageRunResult(
            job=finished,
            harness=harness,
            safety=safety,
            index=index,
        )

    def fail(self, context: PageRunContext, error: Exception) -> None:
        message = first_line(str(error)) or error.__class__.__name__
        with suppress(Exception):
            self.record(
                PageJobRecordEventRequest(
                    context=context,
                    kind=JobEventKind.ERROR,
                    message=message,
                )
            )
            self.jobs.finish(
                FinishJobRequest(
                    cwd=context.cwd,
                    wiki=context.wiki,
                    job_id=context.job_id,
                    status=JobStatus.FAILED,
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
        self.jobs.record_harness_transcript(
            RecordJobHarnessTranscriptRequest(
                cwd=context.cwd,
                wiki=context.wiki,
                job_id=context.job_id,
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
                PageJobRecordEventRequest(
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
