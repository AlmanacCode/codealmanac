from datetime import timedelta
from pathlib import Path

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.automation.defaults import (
    DEFAULT_GARDEN_INTERVAL,
    DEFAULT_SYNC_INTERVAL,
    DEFAULT_UPDATE_INTERVAL,
)
from codealmanac.services.config.models import DEFAULT_HARNESS, DEFAULT_HARNESS_MODEL
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.setup.models import SetupTarget

DEFAULT_SETUP_TARGETS = (SetupTarget.CODEX, SetupTarget.CLAUDE, SetupTarget.OPENCODE)


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
    sync_every: timedelta = DEFAULT_SYNC_INTERVAL
    sync_off: bool = False
    garden_every: timedelta = DEFAULT_GARDEN_INTERVAL
    garden_off: bool = False
    update_every: timedelta = DEFAULT_UPDATE_INTERVAL
    env_path: str | None = None
    codealmanac_executable: Path | None = None

    @field_validator("targets")
    @classmethod
    def validate_targets(
        cls,
        value: tuple[SetupTarget, ...],
    ) -> tuple[SetupTarget, ...]:
        return unique_non_empty_targets(value)

    @field_validator("model")
    @classmethod
    def require_model(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("setup model is required")
        return value

    @field_validator("sync_every", "garden_every", "update_every")
    @classmethod
    def non_negative_duration(
        cls,
        value: timedelta,
    ) -> timedelta:
        if value.total_seconds() <= 0:
            raise ValueError("setup automation duration must be greater than zero")
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
