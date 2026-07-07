from enum import StrEnum
from pathlib import Path
from typing import Protocol

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text


class RepositoryPathState(StrEnum):
    ADDED = "added"
    COPIED = "copied"
    DELETED = "deleted"
    MODIFIED = "modified"
    RENAMED = "renamed"
    TYPE_CHANGED = "type_changed"
    UNMERGED = "unmerged"
    UNTRACKED = "untracked"
    UNKNOWN = "unknown"


class RepositoryPathChange(CodeAlmanacModel):
    path: Path
    state: RepositoryPathState
    status: str
    fingerprint: str | None = None

    @field_validator("status")
    @classmethod
    def require_status(cls, value: str) -> str:
        return required_text(value, "repository path status")


class RepositoryChangeSnapshot(CodeAlmanacModel):
    root_path: Path
    available: bool
    changes: tuple[RepositoryPathChange, ...] = ()
    unavailable_reason: str | None = None


class RepositoryChangeProbe(Protocol):
    def snapshot(self, root_path: Path) -> RepositoryChangeSnapshot:
        """Return the current observable local change state for a repository."""
