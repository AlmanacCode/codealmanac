from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.config.models import (
    AutomationConfig,
    ConfigKey,
    HarnessConfig,
)


class SetConfigValueRequest(CodeAlmanacModel):
    key: ConfigKey
    value: str

    @field_validator("value")
    @classmethod
    def require_value(cls, value: str) -> str:
        return required_text(value, "config value")


class GetConfigValueRequest(CodeAlmanacModel):
    key: ConfigKey


class ApplyConfigRequest(CodeAlmanacModel):
    home: Path | None = None
    env_path: str | None = None
    codealmanac_executable: Path | None = None


class UpdateUserConfigRequest(ApplyConfigRequest):
    auto_commit: bool
    harness: HarnessConfig
    automation: AutomationConfig
