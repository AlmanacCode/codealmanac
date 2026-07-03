import os
import sys
from collections.abc import Sequence
from datetime import timedelta
from pathlib import Path

from codealmanac.core.paths import home_dir, normalize_path, state_dir_for
from codealmanac.services.automation.defaults import (
    AUTOMATION_SYNC_CLAIM_OWNER,
    AUTOMATION_SYNC_MAX_FAILED_ATTEMPTS,
    AUTOMATION_SYNC_PENDING_TIMEOUT,
    DEFAULT_GARDEN_INTERVAL,
    DEFAULT_SYNC_INTERVAL,
    LAUNCHD_FALLBACK_PATHS,
    duration_text,
)
from codealmanac.services.automation.definitions import (
    AutomationTaskDefinition,
    task_definition,
)
from codealmanac.services.automation.models import (
    AutomationTask,
    AutomationWorkingDirectory,
    EnvironmentVariable,
    ScheduledJob,
)
from codealmanac.services.automation.requests import InstallAutomationRequest
from codealmanac.services.config.models import DEFAULT_SYNC_QUIET
from codealmanac.wiki.workspaces.service import WorkspacesService


class AutomationJobFactory:
    def __init__(self, workspaces: WorkspacesService):
        self.workspaces = workspaces

    def job_for_task(
        self,
        task: AutomationTask,
        request: InstallAutomationRequest,
        explicit_tasks: bool,
        resolve_working_directory: bool,
    ) -> ScheduledJob:
        definition = task_definition(task)
        home = normalize_path(request.home or home_dir())
        logs_dir = state_dir_for(home) / "logs"
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


def interval_for(
    task: AutomationTask,
    request: InstallAutomationRequest,
    explicit_tasks: bool,
) -> timedelta:
    if task == AutomationTask.SYNC:
        return request.every if request.every is not None else DEFAULT_SYNC_INTERVAL
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
        quiet = request.quiet if request.quiet is not None else DEFAULT_SYNC_QUIET
        return (
            *base,
            "sync",
            "--quiet",
            duration_text(quiet),
            "--claim-owner",
            AUTOMATION_SYNC_CLAIM_OWNER,
            "--pending-timeout",
            duration_text(AUTOMATION_SYNC_PENDING_TIMEOUT),
            "--max-failed-attempts",
            str(AUTOMATION_SYNC_MAX_FAILED_ATTEMPTS),
        )
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
