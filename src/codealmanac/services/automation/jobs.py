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
    LINUX_FALLBACK_PATHS,
    MACOS_FALLBACK_PATHS,
)
from codealmanac.services.automation.definitions import task_definition
from codealmanac.services.automation.models import (
    AutomationTask,
    EnvironmentVariable,
    ScheduledJob,
)
from codealmanac.services.automation.requests import ReconcileAutomationTaskRequest


class AutomationJobFactory:
    def job_for_task(
        self,
        task: AutomationTask,
        interval: timedelta,
        home: Path | None = None,
        env_path: str | None = None,
        codealmanac_executable: Path | None = None,
    ) -> ScheduledJob:
        definition = task_definition(task)
        resolved_home = normalize_path(home or home_dir())
        logs_dir = logs_dir_for(resolved_home)
        return ScheduledJob(
            task=task,
            label=definition.label,
            manifest_path=manifest_path_for(task, resolved_home),
            program_arguments=program_arguments_for(task, codealmanac_executable),
            interval=interval,
            environment=(
                EnvironmentVariable(
                    name="PATH",
                    value=launch_path(resolved_home, env_path),
                ),
            ),
            stdout_path=logs_dir / definition.stdout_log_name,
            stderr_path=logs_dir / definition.stderr_log_name,
        )


def program_arguments_for(
    task: AutomationTask,
    executable: Path | None,
) -> tuple[str, ...]:
    base = (str(codealmanac_executable(executable)),)
    if task == AutomationTask.SYNC:
        return (*base, "sync")
    if task == AutomationTask.UPDATE:
        return (*base, "update", "--scheduled")
    return (*base, "__garden-scheduler")


def codealmanac_executable(explicit: Path | None) -> Path:
    if explicit is not None:
        return explicit
    invoked = Path(sys.argv[0])
    if invoked.name == "codealmanac":
        return invoked.resolve()
    discovered = shutil.which("codealmanac")
    if discovered is not None:
        return Path(discovered).resolve()
    return Path(sys.executable).with_name("codealmanac")


def job_from_reconcile_request(
    factory: AutomationJobFactory,
    request: ReconcileAutomationTaskRequest,
) -> ScheduledJob:
    return factory.job_for_task(
        request.task,
        request.every,
        home=request.home,
        env_path=request.env_path,
        codealmanac_executable=request.codealmanac_executable,
    )


def default_job_for_task(
    factory: AutomationJobFactory,
    task: AutomationTask,
    home: Path | None = None,
    env_path: str | None = None,
    codealmanac_executable: Path | None = None,
) -> ScheduledJob:
    return factory.job_for_task(
        task,
        default_interval(task),
        home=home,
        env_path=env_path,
        codealmanac_executable=codealmanac_executable,
    )


def default_interval(task: AutomationTask) -> timedelta:
    if task == AutomationTask.SYNC:
        return DEFAULT_SYNC_INTERVAL
    if task == AutomationTask.GARDEN:
        return DEFAULT_GARDEN_INTERVAL
    return DEFAULT_UPDATE_INTERVAL


def manifest_path_for(
    task: AutomationTask,
    home: Path,
    platform: str | None = None,
    config_home: str | None = None,
) -> Path:
    definition = task_definition(task)
    if is_linux(platform):
        return systemd_user_dir(home, config_home) / f"{definition.label}.timer"
    return home / "Library/LaunchAgents" / f"{definition.label}.plist"


def systemd_user_dir(home: Path, config_home: str | None = None) -> Path:
    raw = config_home if config_home is not None else os.environ.get("XDG_CONFIG_HOME")
    if raw and os.path.isabs(raw):
        return Path(raw) / "systemd" / "user"
    return home / ".config" / "systemd" / "user"


def launch_path(home: Path, env_path: str | None, platform: str | None = None) -> str:
    values = [
        item.strip()
        for item in (env_path or os.environ.get("PATH", "")).split(":")
        if item.strip()
    ]
    values.extend([str(home / ".local/bin"), str(home / ".bun/bin")])
    values.extend(fallback_paths(platform))
    return ":".join(unique(values))


def fallback_paths(platform: str | None) -> tuple[str, ...]:
    if is_linux(platform):
        return LINUX_FALLBACK_PATHS
    return MACOS_FALLBACK_PATHS


def is_linux(platform: str | None) -> bool:
    return (platform or sys.platform).startswith("linux")


def unique(values: Sequence[str]) -> tuple[str, ...]:
    seen: list[str] = []
    for value in values:
        if value not in seen:
            seen.append(value)
    return tuple(seen)
