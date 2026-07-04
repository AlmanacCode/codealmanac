from codealmanac.core.errors import ValidationFailed
from codealmanac.core.text import required_text
from codealmanac.local.control.models import (
    ControlRunStatus,
    TriggerEventKind,
)
from codealmanac.local.control.requests import (
    GetBranchRequest,
    GetControlRunRequest,
    GetRepositoryRequest,
    ListControlRunEventsRequest,
    ListControlRunsRequest,
    RecordTriggerEventRequest,
)
from codealmanac.local.control.service import ControlService
from codealmanac.local.runs.models import (
    LocalRunLogsResult,
    LocalRunStartResult,
    LocalRunSummary,
)
from codealmanac.local.runs.requests import (
    ListLocalRunsRequest,
    ReadLocalRunLogsRequest,
    ShowLocalRunRequest,
    StartLocalRunRequest,
)
from codealmanac.local.runs.worker.requests import RunNextLocalWorkerRequest
from codealmanac.local.runs.worker.service import LocalWorkerWorkflow
from codealmanac.local.status.models import LocalStatusResult
from codealmanac.local.status.requests import ReadLocalStatusRequest
from codealmanac.local.status.service import LocalStatusWorkflow


class LocalRunsWorkflow:
    def __init__(
        self,
        control: ControlService,
        local_status: LocalStatusWorkflow,
        local_worker: LocalWorkerWorkflow,
    ):
        self.control = control
        self.local_status = local_status
        self.local_worker = local_worker

    def start(self, request: StartLocalRunRequest) -> LocalRunStartResult:
        status = self.local_status.status(ReadLocalStatusRequest(cwd=request.cwd))
        require_configured_status(status)
        repository = status.repository
        branch = status.branch
        if repository is None or branch is None:
            raise ValidationFailed(
                "current checkout is not configured; run codealmanac local setup"
            )
        if request.branch_name is not None and request.branch_name != branch.name:
            raise ValidationFailed(
                "local runs can only start for the current checkout branch"
            )
        active = self.control.list_runs(
            ListControlRunsRequest(
                branch_id=branch.id,
                statuses=(ControlRunStatus.QUEUED, ControlRunStatus.RUNNING),
                limit=1,
            )
        )
        if active:
            return LocalRunStartResult(
                started=False,
                reason="active_run_exists",
                status=status,
                active_run=active[0],
            )
        trigger = self.control.record_trigger_event(
            RecordTriggerEventRequest(
                repository_id=repository.id,
                branch_name=branch.name,
                kind=TriggerEventKind.MANUAL,
                head_sha=required_text(status.checkout.head_sha, "current HEAD"),
                allow_duplicate_head=True,
                replace_pending=True,
            )
        )
        if not trigger.recorded or trigger.event is None:
            return LocalRunStartResult(
                started=False,
                reason=trigger.reason or "manual_trigger_not_recorded",
                status=status,
            )
        worker = self.local_worker.run_next(
            RunNextLocalWorkerRequest(
                repository_id=repository.id,
                branch_id=branch.id,
                operation=request.kind.value,
                harness=request.harness,
                title=request.title,
                guidance=request.guidance,
            )
        )
        return LocalRunStartResult(
            started=worker.processed,
            reason=worker.reason,
            status=status,
            trigger=trigger.event,
            worker=worker,
        )

    def list(self, request: ListLocalRunsRequest) -> tuple[LocalRunSummary, ...]:
        runs = self.control.list_runs(
            ListControlRunsRequest(
                repository_id=request.repository_id,
                branch_id=request.branch_id,
                statuses=request.statuses,
                limit=request.limit,
            )
        )
        return tuple(self.summary(run.id) for run in runs)

    def show(self, request: ShowLocalRunRequest) -> LocalRunSummary:
        return self.summary(request.run_id)

    def logs(self, request: ReadLocalRunLogsRequest) -> LocalRunLogsResult:
        run = self.summary(request.run_id)
        events = self.control.list_run_events(
            ListControlRunEventsRequest(run_id=request.run_id)
        )
        return LocalRunLogsResult(run=run, events=events)

    def summary(self, run_id: str) -> LocalRunSummary:
        run = self.control.get_run(GetControlRunRequest(run_id=run_id))
        repository = self.control.get_repository(
            GetRepositoryRequest(repository_id=run.repository_id)
        )
        branch = self.control.get_branch(GetBranchRequest(branch_id=run.branch_id))
        return LocalRunSummary(
            run=run,
            repository=repository,
            branch=branch,
        )


def require_configured_status(status: LocalStatusResult) -> None:
    checkout = status.checkout
    if not checkout.available:
        raise ValidationFailed(
            checkout.unavailable_reason or "local checkout is unavailable"
        )
    if status.repository is None:
        raise ValidationFailed(
            "current checkout is not configured; run codealmanac local setup"
        )
    if status.branch is None:
        raise ValidationFailed(
            "current branch is not configured; run codealmanac local setup"
        )
    if not status.branch.trigger_enabled:
        raise ValidationFailed("current branch trigger is disabled")
