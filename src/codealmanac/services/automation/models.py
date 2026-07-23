from datetime import timedelta
from enum import StrEnum
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text


class AutomationTask(StrEnum):
    SYNC = "sync"
    GARDEN = "garden"
    UPDATE = "update"


class ScheduledJobState(StrEnum):
    RUNNING = "running"
    IDLE = "idle"
    UNKNOWN = "unknown"


class EnvironmentVariable(CodeAlmanacModel):
    name: str
    value: str

    @field_validator("name")
    @classmethod
    def require_name(cls, value: str) -> str:
        return required_text(value, "environment variable name")


class ScheduledJob(CodeAlmanacModel):
    task: AutomationTask
    label: str
    plist_path: Path
    program_arguments: tuple[str, ...]
    interval: timedelta
    environment: tuple[EnvironmentVariable, ...]
    stdout_path: Path
    stderr_path: Path

    @field_validator("label")
    @classmethod
    def require_label(cls, value: str) -> str:
        return required_text(value, "scheduled job label")

    @field_validator("program_arguments")
    @classmethod
    def require_program_arguments(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if len(value) == 0:
            raise ValueError("scheduled job program arguments are required")
        return value

    @field_validator("interval")
    @classmethod
    def positive_interval(cls, value: timedelta) -> timedelta:
        if value.total_seconds() <= 0:
            raise ValueError("scheduled job interval must be greater than zero")
        return value


class ScheduledJobStatus(CodeAlmanacModel):
    task: AutomationTask
    label: str
    plist_path: Path
    installed: bool
    loaded: bool
    interval: timedelta | None = None
    state: ScheduledJobState | None = None
    run_count: int | None = None
    last_exit_code: int | None = None
    pid: int | None = None


class AutomationTaskApplyResult(CodeAlmanacModel):
    task: AutomationTask
    enabled: bool
    interval: timedelta
    plist_path: Path
    changed: bool
    # Whether the scheduler backend actually activated the job. Diverges from
    # `enabled` on platforms without a scheduler (the config records intent but
    # nothing is scheduled), letting render describe what really happened.
    scheduled: bool = False


class AutomationRemoveResult(CodeAlmanacModel):
    tasks: tuple[AutomationTask, ...]
    removed: tuple[Path, ...]


class AutomationStatusReport(CodeAlmanacModel):
    statuses: tuple[ScheduledJobStatus, ...]
