from datetime import datetime
from enum import StrEnum
from pathlib import Path
from typing import Annotated

from pydantic import StringConstraints, field_validator, model_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.engine.harnesses.models import (
    HarnessEvent,
    HarnessKind,
    HarnessTranscriptRef,
)
from codealmanac.wiki.workspaces.roots import validate_almanac_root_field

JOB_ID_PATTERN = r"^[A-Za-z0-9_-]+$"
JobId = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, pattern=JOB_ID_PATTERN),
]


class JobOperation(StrEnum):
    INIT = "init"
    INGEST = "ingest"
    SYNC = "sync"
    GARDEN = "garden"


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobEventKind(StrEnum):
    STATUS = "status"
    MESSAGE = "message"
    TOOL = "tool"
    OUTPUT = "output"
    ERROR = "error"


class PageChangeSet(CodeAlmanacModel):
    created: tuple[str, ...] = ()
    updated: tuple[str, ...] = ()
    deleted: tuple[str, ...] = ()


class JobRecord(CodeAlmanacModel):
    job_id: JobId
    workspace_id: str
    operation: JobOperation
    status: JobStatus
    title: str | None
    summary: str | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    log_path: Path
    page_changes: PageChangeSet | None = None
    harness_transcript: HarnessTranscriptRef | None = None

    @field_validator("workspace_id")
    @classmethod
    def require_workspace_id(cls, value: str) -> str:
        return required_text(value, "workspace_id")


class JobLogEvent(CodeAlmanacModel):
    job_id: JobId
    sequence: int
    timestamp: datetime
    kind: JobEventKind
    message: str
    harness_event: HarnessEvent | None = None

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


TERMINAL_JOB_STATUSES = frozenset(
    (JobStatus.DONE, JobStatus.FAILED, JobStatus.CANCELLED)
)


class JobCancelResult(CodeAlmanacModel):
    record: JobRecord
    changed: bool


class JobAttachSnapshot(CodeAlmanacModel):
    record: JobRecord
    events: tuple[JobLogEvent, ...]
    terminal: bool


class JobAttachUpdate(CodeAlmanacModel):
    record: JobRecord
    events: tuple[JobLogEvent, ...]
    terminal: bool


class JobSpec(CodeAlmanacModel):
    version: int = 1
    operation: JobOperation
    cwd: Path
    harness: HarnessKind
    wiki: str | None = None
    inputs: tuple[str, ...] = ()
    almanac_root: Path | None = None
    workspace_name: str | None = None
    description: str = ""
    title: str | None = None
    guidance: str | None = None
    force: bool = False

    @field_validator("inputs")
    @classmethod
    def require_ingest_input_text(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        for item in value:
            required_text(item, "job spec input")
        return value

    @field_validator("almanac_root")
    @classmethod
    def validate_almanac_root(cls, value: Path | None) -> Path | None:
        if value is None:
            return None
        return validate_almanac_root_field(value)

    @field_validator("workspace_name", "title", "guidance")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "job spec text")

    @model_validator(mode="after")
    def validate_operation_payload(self) -> "JobSpec":
        if self.version != 1:
            raise ValueError("job spec version must be 1")
        if self.operation == JobOperation.INIT:
            if len(self.inputs) > 0:
                raise ValueError("init job spec does not accept inputs")
            if self.wiki is not None:
                raise ValueError("init job spec does not accept wiki selector")
            return self
        if self.operation == JobOperation.INGEST:
            if len(self.inputs) == 0:
                raise ValueError("ingest job spec requires inputs")
            if self.almanac_root is not None:
                raise ValueError("ingest job spec does not accept almanac_root")
            if self.workspace_name is not None:
                raise ValueError("ingest job spec does not accept workspace_name")
            if self.description:
                raise ValueError("ingest job spec does not accept description")
            if self.force:
                raise ValueError("ingest job spec does not accept force")
            return self
        if self.operation == JobOperation.GARDEN:
            if len(self.inputs) > 0:
                raise ValueError("garden job spec does not accept inputs")
            if self.almanac_root is not None:
                raise ValueError("garden job spec does not accept almanac_root")
            if self.workspace_name is not None:
                raise ValueError("garden job spec does not accept workspace_name")
            if self.description:
                raise ValueError("garden job spec does not accept description")
            if self.force:
                raise ValueError("garden job spec does not accept force")
            return self
        raise ValueError(f"unsupported queued job operation: {self.operation.value}")


class QueuedJob(CodeAlmanacModel):
    record: JobRecord
    spec: JobSpec | None


class JobWorkerLockOwner(CodeAlmanacModel):
    owner: str
    pid: int
    acquired_at: datetime

    @field_validator("owner")
    @classmethod
    def require_owner(cls, value: str) -> str:
        return required_text(value, "job worker lock owner")

    @field_validator("pid")
    @classmethod
    def positive_pid(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("worker lock pid must be positive")
        return value


class JobWorkerSpawnResult(CodeAlmanacModel):
    child_pid: int
    command: tuple[str, ...]

    @field_validator("child_pid")
    @classmethod
    def positive_child_pid(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("worker child pid must be positive")
        return value

    @field_validator("command")
    @classmethod
    def require_command(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if len(value) == 0:
            raise ValueError("worker command must not be empty")
        for part in value:
            required_text(part, "worker command part")
        return value


class JobQueueDrainResult(CodeAlmanacModel):
    lock_acquired: bool
    processed: tuple[JobRecord, ...] = ()
