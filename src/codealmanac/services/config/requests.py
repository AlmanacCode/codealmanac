from pathlib import Path

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.config.models import ConfigKey


class LoadConfigRequest(CodeAlmanacModel):
    cwd: Path
    repository_name: str | None = Field(
        default=None,
        description="None means use config for the current repository root.",
    )

    @field_validator("repository_name")
    @classmethod
    def require_repository_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "repository name")


class SetConfigValueRequest(CodeAlmanacModel):
    key: ConfigKey
    value: str

    @field_validator("value")
    @classmethod
    def require_value(cls, value: str) -> str:
        return required_text(value, "config value")


class GetConfigValueRequest(CodeAlmanacModel):
    key: ConfigKey
