from datetime import datetime
from enum import StrEnum
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.repositories.models import Repository
from codealmanac.services.sources.models import TranscriptApp, TranscriptCandidate


class SyncMode(StrEnum):
    STATUS = "status"
    SYNC = "sync"


class SyncState(CodeAlmanacModel):
    last_completed_at: datetime | None = None


class SyncReady(CodeAlmanacModel):
    repository_id: str
    repository_name: str
    repository_root: Path
    transcript_count: int
    transcript_paths: tuple[Path, ...]

    @field_validator("repository_id", "repository_name")
    @classmethod
    def require_repository_text(cls, value: str) -> str:
        return required_text(value, "sync repository")


class SyncStarted(CodeAlmanacModel):
    repository_id: str
    repository_name: str
    repository_root: Path
    run_id: str
    transcript_count: int
    transcript_paths: tuple[Path, ...]

    @field_validator("repository_id", "repository_name", "run_id")
    @classmethod
    def require_started_text(cls, value: str) -> str:
        return required_text(value, "sync started")


class SyncSkipped(CodeAlmanacModel):
    transcript_path: Path
    reason: str
    app: TranscriptApp | None = None
    session_id: str | None = None
    cwd: Path | None = None

    @field_validator("reason")
    @classmethod
    def require_reason(cls, value: str) -> str:
        return required_text(value, "sync skip reason")


class SyncSummary(CodeAlmanacModel):
    mode: SyncMode
    since: datetime
    completed_at: datetime | None = None
    scanned: int
    eligible: int
    ready: tuple[SyncReady, ...] = ()
    started: tuple[SyncStarted, ...] = ()
    skipped: tuple[SyncSkipped, ...] = ()


class SyncRepositoryIngest(CodeAlmanacModel):
    repository: Repository
    transcripts: tuple[TranscriptCandidate, ...]


class SyncEvaluation(CodeAlmanacModel):
    summary: SyncSummary
    repository_ingests: tuple[SyncRepositoryIngest, ...]


class SyncQueueResult(CodeAlmanacModel):
    started: tuple[SyncStarted, ...]
    skipped: tuple[SyncSkipped, ...]
