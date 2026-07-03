from pathlib import Path

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
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

    @field_validator("targets")
    @classmethod
    def validate_targets(
        cls,
        value: tuple[SetupTarget, ...],
    ) -> tuple[SetupTarget, ...]:
        return unique_non_empty_targets(value)

    @field_validator("api_url")
    @classmethod
    def validate_api_url(cls, value: str) -> str:
        return normalize_api_url(value)


class RunUninstallRequest(CodeAlmanacModel):
    targets: tuple[SetupTarget, ...] = DEFAULT_SETUP_TARGETS
    yes: bool = False
    keep_instructions: bool = False
    home: Path | None = None

    @field_validator("targets")
    @classmethod
    def validate_targets(
        cls,
        value: tuple[SetupTarget, ...],
    ) -> tuple[SetupTarget, ...]:
        return unique_non_empty_targets(value)


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
