from datetime import timedelta
from pathlib import Path

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.automation.models import AutomationTask
from codealmanac.services.config.models import DEFAULT_HARNESS, DEFAULT_HARNESS_MODEL
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.setup.models import SetupTarget

DEFAULT_SETUP_TARGETS = (SetupTarget.CODEX, SetupTarget.CLAUDE)


class RunSetupRequest(CodeAlmanacModel):
    cwd: Path = Field(default_factory=Path.cwd)
    targets: tuple[SetupTarget, ...] = DEFAULT_SETUP_TARGETS
    harness: HarnessKind = DEFAULT_HARNESS
    model: str = DEFAULT_HARNESS_MODEL
    yes: bool = False
    auto_commit: bool = True
    auto_update: bool = True
    skip_instructions: bool = False
    home: Path | None = None
    automation_tasks: tuple[AutomationTask, ...] = ()
    sync_every: timedelta | None = None
    sync_off: bool = False
    garden_every: timedelta | None = None
    garden_off: bool = False
    env_path: str | None = None
    codealmanac_executable: Path | None = None

    @field_validator("targets")
    @classmethod
    def validate_targets(
        cls,
        value: tuple[SetupTarget, ...],
    ) -> tuple[SetupTarget, ...]:
        return unique_non_empty_targets(value)

    @field_validator("automation_tasks")
    @classmethod
    def validate_automation_tasks(
        cls,
        value: tuple[AutomationTask, ...],
    ) -> tuple[AutomationTask, ...]:
        return unique_tasks(value)

    @field_validator("model")
    @classmethod
    def require_model(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("setup model is required")
        return value

    @field_validator("sync_every", "garden_every")
    @classmethod
    def non_negative_duration(
        cls,
        value: timedelta | None,
    ) -> timedelta | None:
        if value is not None and value.total_seconds() < 0:
            raise ValueError("setup automation duration must be non-negative")
        return value


class RunUninstallRequest(CodeAlmanacModel):
    yes: bool = False
    home: Path | None = None


def unique_non_empty_targets(
    targets: tuple[SetupTarget, ...],
) -> tuple[SetupTarget, ...]:
    unique: list[SetupTarget] = []
    for target in targets:
        if target not in unique:
            unique.append(target)
    if len(unique) == 0:
        raise ValueError("at least one setup target is required")
    return tuple(unique)


def unique_tasks(tasks: tuple[AutomationTask, ...]) -> tuple[AutomationTask, ...]:
    unique: list[AutomationTask] = []
    for task in tasks:
        if task not in unique:
            unique.append(task)
    return tuple(unique)
