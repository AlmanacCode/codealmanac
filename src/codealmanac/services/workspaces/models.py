from datetime import datetime
from enum import StrEnum
from pathlib import Path

from pydantic import Field, field_validator, model_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.workspaces.roots import (
    DEFAULT_ALMANAC_ROOT,
    validate_almanac_root_field,
)


class Workspace(CodeAlmanacModel):
    workspace_id: str
    name: str
    description: str
    root_path: Path
    almanac_root: Path = Field(default=DEFAULT_ALMANAC_ROOT)
    almanac_path: Path
    registered_at: datetime

    @field_validator("workspace_id")
    @classmethod
    def require_workspace_id(cls, value: str) -> str:
        return required_text(value, "workspace_id")

    @field_validator("name")
    @classmethod
    def require_name(cls, value: str) -> str:
        return required_text(value, "workspace name")

    @field_validator("almanac_root")
    @classmethod
    def validate_almanac_root(cls, value: Path) -> Path:
        return validate_almanac_root_field(value)

    @model_validator(mode="after")
    def validate_almanac_path_matches_root(self) -> "Workspace":
        expected = self.root_path / self.almanac_root
        if self.almanac_path != expected:
            raise ValueError("workspace almanac_path must match root_path/almanac_root")
        return self


class WorkspaceRegistryEntry(CodeAlmanacModel):
    name: str
    description: str = ""
    path: Path
    almanac_root: Path = Field(default=DEFAULT_ALMANAC_ROOT)
    registered_at: datetime
    workspace_id: str

    @field_validator("name")
    @classmethod
    def require_name(cls, value: str) -> str:
        return required_text(value, "workspace name")

    @field_validator("almanac_root")
    @classmethod
    def validate_almanac_root(cls, value: Path) -> Path:
        return validate_almanac_root_field(value)

    def to_workspace(self) -> Workspace:
        return Workspace(
            workspace_id=self.workspace_id,
            name=self.name,
            description=self.description,
            root_path=self.path,
            almanac_root=self.almanac_root,
            almanac_path=self.path / self.almanac_root,
            registered_at=self.registered_at,
        )


class WorkspaceRegistryStatus(StrEnum):
    AVAILABLE = "available"
    MISSING_REPO = "missing_repo"
    MISSING_ALMANAC = "missing_almanac"


class WorkspaceListItem(CodeAlmanacModel):
    workspace: Workspace
    status: WorkspaceRegistryStatus


class WorkspaceListResult(CodeAlmanacModel):
    items: tuple[WorkspaceListItem, ...]


class DropWorkspaceResult(CodeAlmanacModel):
    dropped: tuple[Workspace, ...]


class WorkspacePathState(StrEnum):
    ADDED = "added"
    COPIED = "copied"
    DELETED = "deleted"
    MODIFIED = "modified"
    RENAMED = "renamed"
    TYPE_CHANGED = "type_changed"
    UNMERGED = "unmerged"
    UNTRACKED = "untracked"
    UNKNOWN = "unknown"


class WorkspacePathChange(CodeAlmanacModel):
    path: Path
    state: WorkspacePathState
    status: str
    fingerprint: str | None = None

    @field_validator("status")
    @classmethod
    def require_status(cls, value: str) -> str:
        return required_text(value, "workspace path status")


class WorkspaceChangeSnapshot(CodeAlmanacModel):
    root_path: Path
    available: bool
    changes: tuple[WorkspacePathChange, ...] = ()
    unavailable_reason: str | None = None
