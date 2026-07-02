from codealmanac.core.errors import ValidationFailed
from codealmanac.core.text import required_text
from codealmanac.services.control.models import (
    ControlRunStatus,
    TriggerEventKind,
)
from codealmanac.services.control.requests import (
    ListControlRunsRequest,
    RecordTriggerEventRequest,
)
from codealmanac.services.control.service import ControlService
from codealmanac.workflows.local_status.models import LocalStatusResult
from codealmanac.workflows.local_status.requests import ReadLocalStatusRequest
from codealmanac.workflows.local_status.service import LocalStatusWorkflow
from codealmanac.workflows.local_update.models import LocalUpdateResult
from codealmanac.workflows.local_update.requests import RunLocalUpdateRequest
from codealmanac.workflows.local_worker.requests import RunNextLocalWorkerRequest
from codealmanac.workflows.local_worker.service import LocalWorkerWorkflow


class LocalUpdateWorkflow:
    def __init__(
        self,
        control: ControlService,
        local_status: LocalStatusWorkflow,
        local_worker: LocalWorkerWorkflow,
    ):
        self.control = control
        self.local_status = local_status
        self.local_worker = local_worker

    def update(self, request: RunLocalUpdateRequest) -> LocalUpdateResult:
        status = self.local_status.status(ReadLocalStatusRequest(cwd=request.cwd))
        require_configured_status(status)
        repository = status.repository
        branch = status.branch
        if repository is None or branch is None:
            raise ValidationFailed(
                "current checkout is not configured; run codealmanac local setup"
            )
        active = self.control.list_runs(
            ListControlRunsRequest(
                branch_id=branch.id,
                statuses=(ControlRunStatus.QUEUED, ControlRunStatus.RUNNING),
                limit=1,
            )
        )
        if active:
            return LocalUpdateResult(
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
            return LocalUpdateResult(
                started=False,
                reason=trigger.reason or "manual_trigger_not_recorded",
                status=status,
            )
        worker = self.local_worker.run_next(
            RunNextLocalWorkerRequest(
                repository_id=repository.id,
                branch_id=branch.id,
                harness=request.harness,
            )
        )
        return LocalUpdateResult(
            started=worker.processed,
            reason=worker.reason,
            status=status,
            trigger=trigger.event,
            worker=worker,
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
