from pathlib import Path

from codealmanac.services.automation.jobs import AutomationJobFactory
from codealmanac.services.automation.models import (
    AutomationInstallResult,
    AutomationStatusReport,
    AutomationTask,
    AutomationUninstallResult,
    ScheduledJob,
    ScheduledJobStatus,
)
from codealmanac.services.automation.ports import SchedulerAdapter
from codealmanac.services.automation.requests import (
    AutomationStatusRequest,
    InstallAutomationRequest,
    UninstallAutomationRequest,
)
from codealmanac.services.automation.selection import (
    base_install_request,
    install_task_selection,
    status_task_selection,
)
from codealmanac.wiki.workspaces.service import WorkspacesService


class AutomationService:
    def __init__(
        self,
        workspaces: WorkspacesService,
        scheduler: SchedulerAdapter,
    ):
        self.scheduler = scheduler
        self.jobs = AutomationJobFactory(workspaces)

    def install(self, request: InstallAutomationRequest) -> AutomationInstallResult:
        selection = install_task_selection(request)
        jobs = tuple(
            self.jobs.job_for_task(
                task,
                request,
                selection.explicit_tasks,
                resolve_working_directory=True,
            )
            for task in selection.tasks
        )
        for job in jobs:
            self.scheduler.install(job)

        disabled: tuple[ScheduledJob, ...] = ()
        if selection.disable_garden:
            garden = self.jobs.job_for_task(
                AutomationTask.GARDEN,
                request,
                selection.explicit_tasks,
                resolve_working_directory=False,
            )
            self.scheduler.uninstall(garden)
            disabled = (garden,)

        return AutomationInstallResult(jobs=jobs, disabled=disabled)

    def uninstall(
        self,
        request: UninstallAutomationRequest,
    ) -> AutomationUninstallResult:
        tasks = status_task_selection(request)
        install_request = base_install_request(request)
        removed: list[Path] = []
        for task in tasks:
            job = self.jobs.job_for_task(
                task,
                install_request,
                explicit_tasks=True,
                resolve_working_directory=False,
            )
            if self.scheduler.uninstall(job):
                removed.append(job.plist_path)
        return AutomationUninstallResult(tasks=tasks, removed=tuple(removed))

    def status(self, request: AutomationStatusRequest) -> AutomationStatusReport:
        tasks = status_task_selection(request)
        install_request = base_install_request(request)
        statuses: list[ScheduledJobStatus] = []
        for task in tasks:
            job = self.jobs.job_for_task(
                task,
                install_request,
                explicit_tasks=True,
                resolve_working_directory=False,
            )
            statuses.append(self.scheduler.status(job))
        return AutomationStatusReport(statuses=tuple(statuses))
