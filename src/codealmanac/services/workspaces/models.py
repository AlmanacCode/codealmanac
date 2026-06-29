from datetime import datetime
from enum import StrEnum
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text


class Workspace(CodeAlmanacModel):
    workspace_id: str
    name: str
    description: str
    root_path: Path
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


class WorkspaceRegistryEntry(CodeAlmanacModel):
    name: str
    description: str = ""
    path: Path
    registered_at: datetime
    workspace_id: str

    @field_validator("name")
    @classmethod
    def require_name(cls, value: str) -> str:
        return required_text(value, "workspace name")

    def to_workspace(self) -> Workspace:
        return Workspace(
            workspace_id=self.workspace_id,
            name=self.name,
            description=self.description,
            root_path=self.path,
            almanac_path=self.path / ".almanac",
            registered_at=self.registered_at,
        )


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
