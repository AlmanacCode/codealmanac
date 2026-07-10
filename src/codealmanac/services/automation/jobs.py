import os
import shutil
import sys
from collections.abc import Sequence
from datetime import timedelta
from pathlib import Path

from codealmanac.core.paths import home_dir, logs_dir_for, normalize_path
from codealmanac.services.automation.defaults import (
    DEFAULT_GARDEN_INTERVAL,
    DEFAULT_SYNC_INTERVAL,
    DEFAULT_UPDATE_INTERVAL,
    LAUNCHD_FALLBACK_PATHS,
)
from codealmanac.services.automation.definitions import task_definition
from codealmanac.services.automation.models import (
    AutomationTask,
    EnvironmentVariable,
    ScheduledJob,
)
from codealmanac.services.automation.requests import InstallAutomationRequest


class AutomationJobFactory:
    def job_for_task(
        self,
        task: AutomationTask,
        request: InstallAutomationRequest,
        explicit_tasks: bool,
    ) -> ScheduledJob:
        definition = task_definition(task)
        home = normalize_path(request.home or home_dir())
        logs_dir = logs_dir_for(home)
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
        )


def interval_for(
    task: AutomationTask,
    request: InstallAutomationRequest,
    explicit_tasks: bool,
) -> timedelta:
    if task == AutomationTask.SYNC:
        return request.every if request.every is not None else DEFAULT_SYNC_INTERVAL
    if task == AutomationTask.UPDATE:
        if update_is_only_explicit_task(request, explicit_tasks):
            return request.every
        return DEFAULT_UPDATE_INTERVAL
    if request.garden_every is not None:
        return request.garden_every
    if explicit_tasks and request.every is not None:
        return request.every
    return DEFAULT_GARDEN_INTERVAL


def update_is_only_explicit_task(
    request: InstallAutomationRequest,
    explicit_tasks: bool,
) -> bool:
    return (
        explicit_tasks
        and request.tasks == (AutomationTask.UPDATE,)
        and request.every is not None
    )


def program_arguments_for(
    task: AutomationTask,
    request: InstallAutomationRequest,
) -> tuple[str, ...]:
    executable = codealmanac_executable(request)
    base = (str(executable),)
    if task == AutomationTask.SYNC:
        return (*base, "sync")
    if task == AutomationTask.UPDATE:
        return (*base, "update", "--scheduled")
    return (*base, "__garden-scheduler")


def codealmanac_executable(request: InstallAutomationRequest) -> Path:
    if request.codealmanac_executable is not None:
        return request.codealmanac_executable
    invoked = Path(sys.argv[0])
    if invoked.name == "codealmanac":
        return invoked.resolve()
    discovered = shutil.which("codealmanac")
    if discovered is not None:
        return Path(discovered).resolve()
    return Path(sys.executable).with_name("codealmanac")


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
