from pathlib import Path

from charset_normalizer import from_bytes
from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.integrations.sources.filesystem.paths import display_path
from codealmanac.integrations.sources.filesystem.selection import (
    FilesystemDirectoryFileState,
    FilesystemDirectoryListingSource,
    FilesystemDirectorySelectionPolicy,
)


class FilesystemTextDocument(CodeAlmanacModel):
    path: Path
    display_path: str
    size_bytes: int
    encoding: str
    text: str
    selection_state: FilesystemDirectoryFileState = (
        FilesystemDirectoryFileState.UNCHANGED
    )
    git_status: str | None = None
    bytes_truncated: bool = False

    @field_validator("display_path", "encoding", "text")
    @classmethod
    def require_text_fields(cls, value: str) -> str:
        return required_text(value, "filesystem runtime document")

    @field_validator("size_bytes")
    @classmethod
    def non_negative_size(cls, value: int) -> int:
        if value < 0:
            raise ValueError("filesystem runtime file size must be non-negative")
        return value

    @field_validator("git_status")
    @classmethod
    def validate_git_status(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if len(value) != 2:
            raise ValueError("filesystem runtime git status must be two characters")
        return value


class FilesystemDirectoryDocument(CodeAlmanacModel):
    path: Path
    display_path: str
    listing_source: FilesystemDirectoryListingSource
    selection_policy: FilesystemDirectorySelectionPolicy
    changed_count: int = 0
    files: tuple[FilesystemTextDocument, ...]
    skipped_count: int = 0
    file_list_truncated: bool = False

    @field_validator("display_path")
    @classmethod
    def require_display_path(cls, value: str) -> str:
        return required_text(value, "filesystem runtime directory")

    @field_validator("skipped_count")
    @classmethod
    def non_negative_skipped_count(cls, value: int) -> int:
        if value < 0:
            raise ValueError("filesystem runtime skipped count must be non-negative")
        return value

    @field_validator("changed_count")
    @classmethod
    def non_negative_changed_count(cls, value: int) -> int:
        if value < 0:
            raise ValueError("filesystem runtime changed count must be non-negative")
        return value


class UnreadableTextError(Exception):
    pass


def read_text_document(
    path: Path,
    cwd: Path,
    max_file_bytes: int,
    selection_state: FilesystemDirectoryFileState = (
        FilesystemDirectoryFileState.UNCHANGED
    ),
    git_status: str | None = None,
) -> FilesystemTextDocument:
    size_bytes = path.stat().st_size
    with path.open("rb") as file:
        raw = file.read(max_file_bytes + 1)
    bytes_truncated = len(raw) > max_file_bytes
    if bytes_truncated:
        raw = raw[:max_file_bytes]
    if len(raw) == 0:
        return FilesystemTextDocument(
            path=path,
            display_path=display_path(path, cwd),
            size_bytes=size_bytes,
            encoding="utf-8",
            text="(empty file)",
            selection_state=selection_state,
            git_status=git_status,
            bytes_truncated=False,
        )
    match = from_bytes(raw).best()
    if match is None:
        raise UnreadableTextError(
            f"file is not readable text: {display_path(path, cwd)}"
        )
    text = str(match)
    if text.strip() == "":
        text = "(empty file)"
    return FilesystemTextDocument(
        path=path,
        display_path=display_path(path, cwd),
        size_bytes=size_bytes,
        encoding=match.encoding,
        text=text,
        selection_state=selection_state,
        git_status=git_status,
        bytes_truncated=bytes_truncated,
    )
