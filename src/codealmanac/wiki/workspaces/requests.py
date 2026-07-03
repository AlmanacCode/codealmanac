from pathlib import Path

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.wiki.workspaces.roots import (
    DEFAULT_ALMANAC_ROOT,
    validate_almanac_root_field,
)


class RegisterWorkspaceRequest(CodeAlmanacModel):
    root_path: Path
    almanac_root: Path = Field(default=DEFAULT_ALMANAC_ROOT)
    name: str | None = Field(
        default=None,
        description="None means derive the registry name from the root path.",
    )
    description: str = ""

    @field_validator("name")
    @classmethod
    def require_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "workspace name")

    @field_validator("almanac_root")
    @classmethod
    def validate_almanac_root(cls, value: Path) -> Path:
        return validate_almanac_root_field(value)


class InitializeWorkspaceRequest(CodeAlmanacModel):
    path: Path
    almanac_root: Path | None = None
    name: str | None = Field(
        default=None,
        description="None means derive the registry name from the workspace path.",
    )
    description: str = ""

    @field_validator("name")
    @classmethod
    def require_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "workspace name")

    @field_validator("almanac_root")
    @classmethod
    def validate_almanac_root(cls, value: Path | None) -> Path | None:
        if value is None:
            return None
        return validate_almanac_root_field(value)


class SelectWorkspaceRequest(CodeAlmanacModel):
    selector: str
    base_path: Path | None = Field(
        default=None,
        description="None means relative path selectors are not resolved.",
    )

    @field_validator("selector")
    @classmethod
    def require_selector(cls, value: str) -> str:
        return required_text(value, "workspace selector")


class DropWorkspaceRequest(CodeAlmanacModel):
    selector: str
    base_path: Path | None = Field(
        default=None,
        description="None means relative path selectors are not resolved.",
    )

    @field_validator("selector")
    @classmethod
    def require_selector(cls, value: str) -> str:
        return required_text(value, "workspace selector")
