from datetime import datetime
from enum import StrEnum
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text


class RunOperation(StrEnum):
    BUILD = "build"
    INGEST = "ingest"
    SYNC = "sync"
    GARDEN = "garden"


class RunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RunEventKind(StrEnum):
    STATUS = "status"
    MESSAGE = "message"
    TOOL = "tool"
    OUTPUT = "output"
    ERROR = "error"


class PageChangeSet(CodeAlmanacModel):
    created: tuple[str, ...] = ()
    updated: tuple[str, ...] = ()
    archived: tuple[str, ...] = ()
    deleted: tuple[str, ...] = ()


class RunRecord(CodeAlmanacModel):
    run_id: str
    workspace_id: str
    operation: RunOperation
    status: RunStatus
    title: str | None
    summary: str | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    log_path: Path
    page_changes: PageChangeSet | None = None

    @field_validator("run_id")
    @classmethod
    def require_run_id(cls, value: str) -> str:
        return required_text(value, "run_id")

    @field_validator("workspace_id")
    @classmethod
    def require_workspace_id(cls, value: str) -> str:
        return required_text(value, "workspace_id")


class RunLogEvent(CodeAlmanacModel):
    run_id: str
    sequence: int
    timestamp: datetime
    kind: RunEventKind
    message: str

    @field_validator("run_id")
    @classmethod
    def require_run_id(cls, value: str) -> str:
        return required_text(value, "run_id")

    @field_validator("message")
    @classmethod
    def require_message(cls, value: str) -> str:
        return required_text(value, "message")

    @field_validator("sequence")
    @classmethod
    def positive_sequence(cls, value: int) -> int:
        if value < 1:
            raise ValueError("sequence must be positive")
        return value
