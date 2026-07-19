from datetime import datetime
from enum import StrEnum
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text


class SourceKind(StrEnum):
    PATH_FILE = "path.file"
    PATH_DIRECTORY = "path.directory"
    PATH_UNKNOWN = "path.unknown"
    GITHUB_PULL_REQUEST = "github.pull_request"
    GITHUB_ISSUE = "github.issue"
    WEB_URL = "web.url"
    GIT_RANGE = "git.range"
    GIT_DIFF = "git.diff"
    TRANSCRIPT = "transcript"


class SourceProvenanceKind(StrEnum):
    FILE = "file"
    DIRECTORY = "directory"
    MISSING_PATH = "missing_path"
    PR = "pr"
    ISSUE = "issue"
    URL = "url"
    GIT = "git"
    TRANSCRIPT = "transcript"


class SourceRuntimeStatus(StrEnum):
    AVAILABLE = "available"
    SKIPPED = "skipped"
    UNAVAILABLE = "unavailable"


class TranscriptApp(StrEnum):
    CLAUDE = "claude"
    CODEX = "codex"
    OPENCODE = "opencode"


class SourceAddress(CodeAlmanacModel):
    raw: str

    @field_validator("raw")
    @classmethod
    def require_raw(cls, value: str) -> str:
        return required_text(value, "source address")


class SourceRef(CodeAlmanacModel):
    raw: str
    kind: SourceKind
    identity: str
    path: Path | None = None
    url: str | None = None
    repository: str | None = None
    number: int | None = None
    revision_range: str | None = None
    transcript: str | None = None
    exists: bool | None = None
    fingerprint: str | None = None

    @field_validator("raw", "identity")
    @classmethod
    def require_text_fields(cls, value: str) -> str:
        return required_text(value, "source reference")

    @field_validator("number")
    @classmethod
    def positive_number(cls, value: int | None) -> int | None:
        if value is not None and value < 1:
            raise ValueError("source number must be positive")
        return value


class SourceBrief(CodeAlmanacModel):
    ref: SourceRef
    title: str
    provenance_kind: SourceProvenanceKind
    prompt_hint: str

    @field_validator("title", "prompt_hint")
    @classmethod
    def require_brief_text(cls, value: str) -> str:
        return required_text(value, "source brief")


class SourceRuntime(CodeAlmanacModel):
    ref: SourceRef
    status: SourceRuntimeStatus
    title: str
    content: str | None = None
    diagnostics: tuple[str, ...] = ()
    truncated: bool = False

    @field_validator("title")
    @classmethod
    def require_title(cls, value: str) -> str:
        return required_text(value, "source runtime title")


class TranscriptCandidate(CodeAlmanacModel):
    app: TranscriptApp
    session_id: str
    transcript_path: Path
    cwd: Path
    modified_at: datetime
    size_bytes: int

    @field_validator("session_id")
    @classmethod
    def require_session_id(cls, value: str) -> str:
        return required_text(value, "transcript session id")

    @field_validator("size_bytes")
    @classmethod
    def non_negative_size(cls, value: int) -> int:
        if value < 0:
            raise ValueError("transcript size must be non-negative")
        return value
