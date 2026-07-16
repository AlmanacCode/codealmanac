from datetime import datetime
from enum import StrEnum
from typing import Annotated

from pydantic import StringConstraints, field_validator, model_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessKind,
    HarnessTranscriptRef,
)

RUN_ID_PATTERN = r"^[A-Za-z0-9_-]+$"
RunId = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, pattern=RUN_ID_PATTERN),
]


class RunKind(StrEnum):
    BUILD = "build"
    INGEST = "ingest"
    GARDEN = "garden"


class RunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RunFailureCategory(StrEnum):
    HARNESS_READINESS = "harness_readiness"
    PROVIDER_EXECUTION = "provider_execution"
    MUTATION_SAFETY = "mutation_safety"
    WIKI_VALIDATION = "wiki_validation"
    INDEXING = "indexing"
    INTERNAL_ERROR = "internal_error"


class RunEventKind(StrEnum):
    STATUS = "status"
    MESSAGE = "message"
    TOOL = "tool"
    OUTPUT = "output"
    ERROR = "error"


class RunWorkerIdleHandoffOutcome(StrEnum):
    WORK_AVAILABLE = "work_available"
    RELEASED = "released"
    OWNERSHIP_LOST = "ownership_lost"


class PageChangeSet(CodeAlmanacModel):
    created: tuple[str, ...] = ()
    updated: tuple[str, ...] = ()
    deleted: tuple[str, ...] = ()


class RunExecutionRef(CodeAlmanacModel):
    execution_id: str
    pid: int
    process_started_at: datetime

    @field_validator("execution_id")
    @classmethod
    def require_execution_id(cls, value: str) -> str:
        return required_text(value, "run execution id")

    @field_validator("pid")
    @classmethod
    def positive_pid(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("run execution pid must be positive")
        return value


class RunRecord(CodeAlmanacModel):
    run_id: RunId
    repository_id: str
    kind: RunKind
    status: RunStatus
    title: str | None
    summary: str | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    page_changes: PageChangeSet | None = None
    harness_transcript: HarnessTranscriptRef | None = None
    execution: RunExecutionRef | None = None
    cancellation_requested_at: datetime | None = None

    @field_validator("repository_id")
    @classmethod
    def require_repository_id(cls, value: str) -> str:
        return required_text(value, "repository_id")


class RunLogEvent(CodeAlmanacModel):
    run_id: RunId
    sequence: int
    timestamp: datetime
    kind: RunEventKind
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


TERMINAL_RUN_STATUSES = frozenset(
    (RunStatus.DONE, RunStatus.FAILED, RunStatus.CANCELLED)
)


class RunCancelResult(CodeAlmanacModel):
    record: RunRecord
    changed: bool


class RunCancellationPlan(CodeAlmanacModel):
    record: RunRecord
    changed: bool
    execution: RunExecutionRef | None = None


class RunAttachSnapshot(CodeAlmanacModel):
    record: RunRecord
    events: tuple[RunLogEvent, ...]
    terminal: bool


class RunAttachUpdate(CodeAlmanacModel):
    record: RunRecord
    events: tuple[RunLogEvent, ...]
    terminal: bool


class RunSpec(CodeAlmanacModel):
    version: int = 1
    kind: RunKind
    harness: HarnessKind
    model: str
    inputs: tuple[str, ...] = ()
    title: str | None = None
    guidance: str | None = None
    auto_commit: bool = True

    @field_validator("inputs")
    @classmethod
    def require_ingest_input_text(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        for item in value:
            required_text(item, "run spec input")
        return value

    @field_validator("model", "title", "guidance")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "run spec text")

    @model_validator(mode="after")
    def validate_kind_payload(self) -> "RunSpec":
        if self.version != 1:
            raise ValueError("run spec version must be 1")
        if self.kind == RunKind.INGEST:
            if len(self.inputs) == 0:
                raise ValueError("ingest run spec requires inputs")
            return self
        if len(self.inputs) > 0:
            raise ValueError(f"{self.kind.value} run spec does not accept inputs")
        return self


class QueuedRun(CodeAlmanacModel):
    record: RunRecord
    spec: RunSpec | None


class RunWorkerLockOwner(CodeAlmanacModel):
    owner: str
    pid: int
    acquired_at: datetime

    @field_validator("owner")
    @classmethod
    def require_owner(cls, value: str) -> str:
        return required_text(value, "run worker lock owner")

    @field_validator("pid")
    @classmethod
    def positive_pid(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("worker lock pid must be positive")
        return value


class RunWorkerSpawnResult(CodeAlmanacModel):
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


class RunQueueDrainResult(CodeAlmanacModel):
    lock_acquired: bool
    processed: tuple[RunRecord, ...] = ()
