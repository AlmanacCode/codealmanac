import os
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

from codealmanac.core.errors import ValidationFailed
from codealmanac.core.paths import home_dir, normalize_path
from codealmanac.services.automation.models import (
    AutomationInstallResult,
    AutomationStatusReport,
    AutomationTask,
    AutomationUninstallResult,
    AutomationWorkingDirectory,
    EnvironmentVariable,
    ScheduledJob,
    ScheduledJobStatus,
)
from codealmanac.services.automation.ports import SchedulerAdapter
from codealmanac.services.automation.requests import (
    AutomationSelectionRequest,
    AutomationStatusRequest,
    InstallAutomationRequest,
    UninstallAutomationRequest,
)
from codealmanac.services.workspaces.service import WorkspacesService

DEFAULT_SYNC_INTERVAL = timedelta(hours=5)
DEFAULT_SYNC_QUIET = timedelta(minutes=45)
DEFAULT_GARDEN_INTERVAL = timedelta(hours=4)

SYNC_LABEL = "com.codealmanac.sync"
GARDEN_LABEL = "com.codealmanac.garden"

LAUNCHD_FALLBACK_PATHS = (
    "/usr/local/bin",
    "/opt/homebrew/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
)


@dataclass(frozen=True)
class AutomationTaskDefinition:
    task: AutomationTask
    label: str
    default_interval: timedelta
    stdout_log_name: str
    stderr_log_name: str
    working_directory: AutomationWorkingDirectory


DEFAULT_INSTALL_TASKS = (AutomationTask.SYNC, AutomationTask.GARDEN)
DEFAULT_STATUS_TASKS = (AutomationTask.SYNC, AutomationTask.GARDEN)


class AutomationService:
    def __init__(
        self,
        workspaces: WorkspacesService,
        scheduler: SchedulerAdapter,
    ):
        self.workspaces = workspaces
        self.scheduler = scheduler

    def install(self, request: InstallAutomationRequest) -> AutomationInstallResult:
        explicit_tasks = len(request.tasks) > 0
        tasks = selected_tasks(request.tasks, DEFAULT_INSTALL_TASKS)
        if explicit_tasks and request.garden_off:
            raise ValidationFailed(
                "--garden-off can only be used with the default automation install"
            )
        if explicit_tasks and len(tasks) > 1 and request.every is not None:
            raise ValidationFailed(
                "--every can only target one explicit automation task at a time"
            )
        if request.quiet is not None and request.quiet.total_seconds() < 0:
            raise ValidationFailed("quiet window must be zero or greater")

        selected = tuple(
            task
            for task in tasks
            if not (task == AutomationTask.GARDEN and request.garden_off)
        )
        jobs = tuple(
            self._job_for_task(
                task,
                request,
                explicit_tasks,
                resolve_working_directory=True,
            )
            for task in selected
        )
        for job in jobs:
            self.scheduler.install(job)

        disabled: tuple[ScheduledJob, ...] = ()
        if not explicit_tasks and request.garden_off:
            garden = self._job_for_task(
                AutomationTask.GARDEN,
                request,
                explicit_tasks,
                resolve_working_directory=False,
            )
            self.scheduler.uninstall(garden)
            disabled = (garden,)

        return AutomationInstallResult(jobs=jobs, disabled=disabled)

    def uninstall(
        self,
        request: UninstallAutomationRequest,
    ) -> AutomationUninstallResult:
        tasks = selected_tasks(request.tasks, DEFAULT_STATUS_TASKS)
        removed: list[Path] = []
        for task in tasks:
            job = self._job_for_task(
                task,
                base_request(request),
                explicit_tasks=True,
                resolve_working_directory=False,
            )
            if self.scheduler.uninstall(job):
                removed.append(job.plist_path)
        return AutomationUninstallResult(tasks=tasks, removed=tuple(removed))

    def status(self, request: AutomationStatusRequest) -> AutomationStatusReport:
        tasks = selected_tasks(request.tasks, DEFAULT_STATUS_TASKS)
        statuses: list[ScheduledJobStatus] = []
        for task in tasks:
            job = self._job_for_task(
                task,
                base_request(request),
                explicit_tasks=True,
                resolve_working_directory=False,
            )
            statuses.append(self.scheduler.status(job))
        return AutomationStatusReport(statuses=tuple(statuses))

    def _job_for_task(
        self,
        task: AutomationTask,
        request: InstallAutomationRequest,
        explicit_tasks: bool,
        resolve_working_directory: bool,
    ) -> ScheduledJob:
        definition = task_definition(task)
        home = normalize_path(request.home or home_dir())
        logs_dir = home / ".almanac/logs"
        return ScheduledJob(
            task=task,
            label=definition.label,
            plist_path=plist_path_for(task, home),
            program_arguments=program_arguments_for(task, request),
            interval=interval_for(task, request, explicit_tasks),
            environment=(
                EnvironmentVariable(
                    name="PATH",
                    value=launch_path(home, request.env_path),
                ),
            ),
            stdout_path=logs_dir / definition.stdout_log_name,
            stderr_path=logs_dir / definition.stderr_log_name,
            working_directory=self._working_directory(definition, request.cwd)
            if resolve_working_directory
            else None,
        )

    def _working_directory(
        self,
        definition: AutomationTaskDefinition,
        cwd: Path,
    ) -> Path | None:
        if definition.working_directory == AutomationWorkingDirectory.NONE:
            return None
        return self.workspaces.resolve(cwd).root_path


def base_request(
    request: AutomationSelectionRequest,
) -> InstallAutomationRequest:
    return InstallAutomationRequest(
        cwd=Path.cwd(),
        tasks=request.tasks,
        home=request.home,
    )


def task_definition(task: AutomationTask) -> AutomationTaskDefinition:
    if task == AutomationTask.SYNC:
        return AutomationTaskDefinition(
            task=AutomationTask.SYNC,
            label=SYNC_LABEL,
            default_interval=DEFAULT_SYNC_INTERVAL,
            stdout_log_name="sync.out.log",
            stderr_log_name="sync.err.log",
            working_directory=AutomationWorkingDirectory.NONE,
        )
    return AutomationTaskDefinition(
        task=AutomationTask.GARDEN,
        label=GARDEN_LABEL,
        default_interval=DEFAULT_GARDEN_INTERVAL,
        stdout_log_name="garden.out.log",
        stderr_log_name="garden.err.log",
        working_directory=AutomationWorkingDirectory.CURRENT_WIKI,
    )


def selected_tasks(
    requested: Sequence[AutomationTask],
    defaults: tuple[AutomationTask, ...],
) -> tuple[AutomationTask, ...]:
    tasks = tuple(requested) if len(requested) > 0 else defaults
    selected: list[AutomationTask] = []
    for task in tasks:
        if task not in selected:
            selected.append(task)
    return tuple(selected)


def interval_for(
    task: AutomationTask,
    request: InstallAutomationRequest,
    explicit_tasks: bool,
) -> timedelta:
    if task == AutomationTask.SYNC:
        return request.every or DEFAULT_SYNC_INTERVAL
    if request.garden_every is not None:
        return request.garden_every
    if explicit_tasks and request.every is not None:
        return request.every
    return DEFAULT_GARDEN_INTERVAL


def program_arguments_for(
    task: AutomationTask,
    request: InstallAutomationRequest,
) -> tuple[str, ...]:
    executable = request.python_executable or Path(sys.executable)
    base = (str(executable), "-m", "codealmanac.cli.main")
    if task == AutomationTask.SYNC:
        quiet = request.quiet or DEFAULT_SYNC_QUIET
        return (*base, "sync", "--quiet", duration_text(quiet))
    return (*base, "garden")


def plist_path_for(task: AutomationTask, home: Path) -> Path:
    definition = task_definition(task)
    return home / "Library/LaunchAgents" / f"{definition.label}.plist"


def launch_path(home: Path, env_path: str | None) -> str:
    values = [
        item.strip()
        for item in (env_path or os.environ.get("PATH", "")).split(":")
        if item.strip()
    ]
    values.extend([str(home / ".local/bin"), str(home / ".bun/bin")])
    values.extend(LAUNCHD_FALLBACK_PATHS)
    return ":".join(unique(values))


def unique(values: Sequence[str]) -> tuple[str, ...]:
    seen: list[str] = []
    for value in values:
        if value not in seen:
            seen.append(value)
    return tuple(seen)


def duration_text(value: timedelta) -> str:
    seconds = int(value.total_seconds())
    if seconds % 3600 == 0:
        return f"{seconds // 3600}h"
    if seconds % 60 == 0:
        return f"{seconds // 60}m"
    return f"{seconds}s"
