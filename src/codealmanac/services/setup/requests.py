from datetime import timedelta
from pathlib import Path

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.automation.models import AutomationTask
from codealmanac.services.cloud_auth.models import (
    DEFAULT_CLOUD_API_URL,
    normalize_api_url,
)
from codealmanac.services.setup.models import SetupTarget
from codealmanac.workflows.cloud_login.requests import CloudLoginBrowserMode

DEFAULT_SETUP_TARGETS = (SetupTarget.CODEX, SetupTarget.CLAUDE)


class RunSetupRequest(CodeAlmanacModel):
    cwd: Path = Field(default_factory=Path.cwd)
    targets: tuple[SetupTarget, ...] = DEFAULT_SETUP_TARGETS
    yes: bool = False
    api_url: str = DEFAULT_CLOUD_API_URL
    no_browser: bool = False
    login_browser_mode: CloudLoginBrowserMode = "prompt"
    login_timeout_seconds: float = 120.0
    login_poll_interval_seconds: float = 2.0
    skip_login: bool = False
    skip_instructions: bool = False
    home: Path | None = None
    install_automation: bool = False
    automation_tasks: tuple[AutomationTask, ...] = ()
    sync_every: timedelta | None = None
    sync_quiet: timedelta | None = None
    garden_every: timedelta | None = None
    garden_off: bool = False
    env_path: str | None = None
    python_executable: Path | None = None

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

    @field_validator("api_url")
    @classmethod
    def validate_api_url(cls, value: str) -> str:
        return normalize_api_url(value)

    @field_validator("sync_every", "sync_quiet", "garden_every")
    @classmethod
    def non_negative_duration(
        cls,
        value: timedelta | None,
    ) -> timedelta | None:
        if value is not None and value.total_seconds() < 0:
            raise ValueError("setup automation duration must be non-negative")
        return value


class RunUninstallRequest(CodeAlmanacModel):
    targets: tuple[SetupTarget, ...] = DEFAULT_SETUP_TARGETS
    yes: bool = False
    keep_instructions: bool = False
    keep_automation: bool = False
    home: Path | None = None
    automation_tasks: tuple[AutomationTask, ...] = ()

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
