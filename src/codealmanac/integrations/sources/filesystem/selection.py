from enum import StrEnum
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text


class FilesystemDirectoryListingSource(StrEnum):
    GIT = "git"
    WALK = "walk"


class FilesystemDirectoryFileState(StrEnum):
    CHANGED = "changed"
    UNCHANGED = "unchanged"


class FilesystemDirectorySelectionPolicy(StrEnum):
    CHANGED_FIRST = "changed_first"
    PATH_ORDER = "path_order"


class FilesystemDirectoryCandidate(CodeAlmanacModel):
    path: Path
    display_path: str
    state: FilesystemDirectoryFileState = FilesystemDirectoryFileState.UNCHANGED
    git_status: str | None = None

    @field_validator("display_path")
    @classmethod
    def require_display_path(cls, value: str) -> str:
        return required_text(value, "filesystem directory candidate")

    @field_validator("git_status")
    @classmethod
    def validate_git_status(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if len(value) != 2:
            raise ValueError("filesystem directory git status must be two characters")
        return value


SOURCE_SUFFIXES = frozenset(
    {
        ".c",
        ".cc",
        ".cpp",
        ".cs",
        ".css",
        ".go",
        ".h",
        ".hpp",
        ".html",
        ".java",
        ".js",
        ".jsx",
        ".kt",
        ".mjs",
        ".php",
        ".py",
        ".rb",
        ".rs",
        ".scss",
        ".sh",
        ".sql",
        ".swift",
        ".ts",
        ".tsx",
        ".vue",
    }
)
STRUCTURED_SUFFIXES = frozenset(
    {
        ".cfg",
        ".ini",
        ".json",
        ".md",
        ".toml",
        ".yaml",
        ".yml",
    }
)
LOW_VALUE_FILENAMES = frozenset(
    {
        ".gitkeep",
        "__init__.py",
    }
)


def ranked_directory_candidates(
    candidates: tuple[FilesystemDirectoryCandidate, ...],
) -> tuple[FilesystemDirectoryCandidate, ...]:
    return tuple(sorted(candidates, key=directory_candidate_key))


def directory_candidate_key(
    candidate: FilesystemDirectoryCandidate,
) -> tuple[int, int, int, str]:
    changed_rank = 0
    content_rank = 0
    if candidate.state == FilesystemDirectoryFileState.UNCHANGED:
        changed_rank = 1
        content_rank = unchanged_content_rank(candidate.path)
    return (
        changed_rank,
        content_rank,
        path_depth(candidate.display_path),
        candidate.display_path.casefold(),
    )


def unchanged_content_rank(path: Path) -> int:
    if path.name in LOW_VALUE_FILENAMES:
        return 3
    suffix = path.suffix.casefold()
    if suffix in SOURCE_SUFFIXES:
        return 0
    if suffix in STRUCTURED_SUFFIXES:
        return 1
    return 2


def path_depth(display_path: str) -> int:
    return display_path.count("/")
