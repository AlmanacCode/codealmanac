from datetime import datetime
from enum import StrEnum
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.engine.sources.models import TranscriptApp, TranscriptCandidate


class SyncMode(StrEnum):
    STATUS = "status"
    SYNC = "sync"


class SyncExecution(StrEnum):
    FOREGROUND = "foreground"
    BACKGROUND = "background"


class SyncLedgerStatus(StrEnum):
    DONE = "done"
    PENDING = "pending"
    FAILED = "failed"
    NEEDS_ATTENTION = "needs_attention"


class SyncDecisionKind(StrEnum):
    SKIP = "skip"
    NEEDS_ATTENTION = "needs_attention"
    READY = "ready"


class SyncLedgerEntry(CodeAlmanacModel):
    app: TranscriptApp
    session_id: str
    transcript_path: Path
    status: SyncLedgerStatus
    last_absorbed_size: int
    last_absorbed_line: int
    last_absorbed_prefix_hash: str
    last_absorbed_at: datetime | None = None
    last_job_id: str | None = None
    last_error: str | None = None
    failed_attempts: int = 0
    pending_started_at: datetime | None = None
    pending_owner: str | None = None
    pending_job_id: str | None = None
    pending_to_size: int | None = None
    pending_prefix_hash: str | None = None
    pending_from_line: int | None = None
    pending_to_line: int | None = None

    @field_validator("session_id", "last_absorbed_prefix_hash")
    @classmethod
    def require_text(cls, value: str) -> str:
        return required_text(value, "sync ledger entry")

    @field_validator("pending_owner", "pending_job_id", "pending_prefix_hash")
    @classmethod
    def require_optional_pending_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "sync pending value")

    @field_validator("last_absorbed_size", "last_absorbed_line")
    @classmethod
    def non_negative_cursor(cls, value: int) -> int:
        if value < 0:
            raise ValueError("sync cursor must be non-negative")
        return value

    @field_validator("failed_attempts")
    @classmethod
    def non_negative_failed_attempts(cls, value: int) -> int:
        if value < 0:
            raise ValueError("sync failed attempts must be non-negative")
        return value

    @field_validator("pending_to_size", "pending_from_line", "pending_to_line")
    @classmethod
    def non_negative_pending_cursor(cls, value: int | None) -> int | None:
        if value is not None and value < 0:
            raise ValueError("sync pending cursor must be non-negative")
        return value


class SyncLedger(CodeAlmanacModel):
    version: int
    updated_at: datetime
    sessions: dict[str, SyncLedgerEntry]


class SyncReady(CodeAlmanacModel):
    app: TranscriptApp
    session_id: str
    transcript_path: Path
    repo_root: Path
    from_line: int
    to_line: int


class SyncStarted(CodeAlmanacModel):
    app: TranscriptApp
    session_id: str
    transcript_path: Path
    repo_root: Path
    job_id: str
    from_line: int
    to_line: int


class SyncSkipped(CodeAlmanacModel):
    transcript_path: Path
    reason: str
    app: TranscriptApp | None = None
    session_id: str | None = None
    repo_root: Path | None = None

    @field_validator("reason")
    @classmethod
    def require_reason(cls, value: str) -> str:
        return required_text(value, "sync skip reason")


class SyncSummary(CodeAlmanacModel):
    mode: SyncMode
    scanned: int
    eligible: int
    ready: tuple[SyncReady, ...] = ()
    started: tuple[SyncStarted, ...] = ()
    skipped: tuple[SyncSkipped, ...] = ()
    needs_attention: tuple[SyncSkipped, ...] = ()


class TranscriptSnapshot(CodeAlmanacModel):
    content: bytes
    current_size: int
    current_line: int


class SyncCursorDecision(CodeAlmanacModel):
    kind: SyncDecisionKind
    reason: str = ""
    from_line: int = 0
    to_line: int = 0


class SyncWorkItem(CodeAlmanacModel):
    candidate: TranscriptCandidate
    ledger_key: str
    entry: SyncLedgerEntry
    snapshot: TranscriptSnapshot
    from_line: int
    to_line: int


class SyncEvaluation(CodeAlmanacModel):
    summary: SyncSummary
    work_items: tuple[SyncWorkItem, ...]
    ledgers: dict[Path, SyncLedger]
