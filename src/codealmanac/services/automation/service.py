from pathlib import Path

from codealmanac.core.errors import ExecutionFailed
from codealmanac.services.automation.jobs import (
    AutomationJobFactory,
    default_job_for_task,
    job_from_reconcile_request,
)
from codealmanac.services.automation.models import (
    AutomationRemoveResult,
    AutomationStatusReport,
    AutomationTask,
    AutomationTaskApplyResult,
    ScheduledJobStatus,
)
from codealmanac.services.automation.ports import SchedulerAdapter
from codealmanac.services.automation.requests import (
    AutomationStatusRequest,
    ReconcileAutomationTaskRequest,
    RemoveAllAutomationRequest,
)
from codealmanac.services.automation.selection import (
    status_task_selection,
)


class AutomationService:
    def __init__(
        self,
        scheduler: SchedulerAdapter,
    ):
        self.scheduler = scheduler
        self.jobs = AutomationJobFactory()

    def reconcile_task(
        self,
        request: ReconcileAutomationTaskRequest,
    ) -> AutomationTaskApplyResult:
        job = job_from_reconcile_request(self.jobs, request)
        reason = self.scheduler.unavailable_reason()
        if reason is not None:
            raise ExecutionFailed(f"cannot apply scheduled automation: {reason}")
        if request.enabled:
            self.scheduler.install(job)
            changed = True
        else:
            changed = self.scheduler.uninstall(job)
        return AutomationTaskApplyResult(
            task=request.task,
            enabled=request.enabled,
            interval=request.every,
            plist_path=job.plist_path,
            changed=changed,
        )

    def remove_all(
        self,
        request: RemoveAllAutomationRequest,
    ) -> AutomationRemoveResult:
        tasks = tuple(AutomationTask)
        if self.scheduler.unavailable_reason() is not None:
            return AutomationRemoveResult(tasks=tasks, removed=())
        removed: list[Path] = []
        for task in tasks:
            job = default_job_for_task(
                self.jobs,
                task,
                home=request.home,
                env_path=request.env_path,
                codealmanac_executable=request.codealmanac_executable,
            )
            if self.scheduler.uninstall(job):
                removed.append(job.plist_path)
        return AutomationRemoveResult(tasks=tasks, removed=tuple(removed))

    def status(self, request: AutomationStatusRequest) -> AutomationStatusReport:
        tasks = status_task_selection(request)
        statuses: list[ScheduledJobStatus] = []
        for task in tasks:
            job = default_job_for_task(
                self.jobs,
                task,
                home=request.home,
            )
            statuses.append(self.scheduler.status(job))
        return AutomationStatusReport(statuses=tuple(statuses))
