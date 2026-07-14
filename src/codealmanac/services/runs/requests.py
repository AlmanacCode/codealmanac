from datetime import datetime, timedelta
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.harnesses.models import HarnessEvent, HarnessTranscriptRef
from codealmanac.services.repositories.models import RepositoryName
from codealmanac.services.runs.models import (
    RunEventKind,
    RunExecutionRef,
    RunId,
    RunKind,
    RunSpec,
    RunStatus,
    RunWorkerLockOwner,
)


class ListRunsRequest(CodeAlmanacModel):
    repository_name: RepositoryName | None = None
    limit: int | None = None

    @field_validator("limit")
    @classmethod
    def non_negative_limit(cls, value: int | None) -> int | None:
        if value is not None and value < 0:
            raise ValueError("limit must be non-negative")
        return value


class ShowRunRequest(CodeAlmanacModel):
    run_id: RunId
    repository_name: RepositoryName | None = None


class ReadRunLogRequest(CodeAlmanacModel):
    run_id: RunId
    repository_name: RepositoryName | None = None


class AttachRunRequest(CodeAlmanacModel):
    run_id: RunId
    repository_name: RepositoryName | None = None


class StreamRunAttachRequest(CodeAlmanacModel):
    run_id: RunId
    repository_name: RepositoryName | None = None
    poll_interval_seconds: float = 0.5

    @field_validator("poll_interval_seconds")
    @classmethod
    def positive_poll_interval(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("attach poll interval must be positive")
        return value


class CancelRunRequest(CodeAlmanacModel):
    run_id: RunId
    repository_name: RepositoryName | None = None


class StartRunRequest(CodeAlmanacModel):
    repository_id: str
    kind: RunKind
    title: str | None = None

    @field_validator("repository_id")
    @classmethod
    def require_repository_id(cls, value: str) -> str:
        return required_text(value, "repository_id")


class QueueRunRequest(CodeAlmanacModel):
    repository_id: str
    spec: RunSpec
    title: str | None = None

    @field_validator("repository_id")
    @classmethod
    def require_repository_id(cls, value: str) -> str:
        return required_text(value, "repository_id")


class ReadRunSpecRequest(CodeAlmanacModel):
    run_id: RunId
    repository_name: RepositoryName | None = None


class AcquireRunWorkerLockRequest(CodeAlmanacModel):
    owner: str
    pid: int | None = None
    now: datetime | None = None
    stale_after: timedelta = timedelta(minutes=30)

    @field_validator("stale_after")
    @classmethod
    def positive_stale_after(cls, value: timedelta) -> timedelta:
        if value.total_seconds() <= 0:
            raise ValueError("worker lock stale_after must be positive")
        return value

    @field_validator("owner")
    @classmethod
    def require_owner(cls, value: str) -> str:
        return required_text(value, "run worker lock owner")

    @field_validator("pid")
    @classmethod
    def positive_pid(cls, value: int | None) -> int | None:
        if value is not None and value <= 0:
            raise ValueError("worker lock pid must be positive")
        return value


class ReleaseRunWorkerIfIdleRequest(CodeAlmanacModel):
    owner: RunWorkerLockOwner


class SpawnRunWorkerRequest(CodeAlmanacModel):
    cwd: Path


class RecordRunEventRequest(CodeAlmanacModel):
    run_id: RunId
    kind: RunEventKind
    message: str
    harness_event: HarnessEvent | None = None


class MarkRunRunningRequest(CodeAlmanacModel):
    run_id: RunId
    execution: RunExecutionRef | None = None


class FinishRunCancellationRequest(CodeAlmanacModel):
    run_id: RunId
    execution_id: str

    @field_validator("execution_id")
    @classmethod
    def require_execution_id(cls, value: str) -> str:
        return required_text(value, "run execution id")


class RecordRunHarnessTranscriptRequest(CodeAlmanacModel):
    run_id: RunId
    transcript: HarnessTranscriptRef


class FinishRunRequest(CodeAlmanacModel):
    run_id: RunId
    status: RunStatus
    summary: str | None = None
    error: str | None = None

    @field_validator("status")
    @classmethod
    def terminal_status(cls, value: RunStatus) -> RunStatus:
        if value not in {RunStatus.DONE, RunStatus.FAILED, RunStatus.CANCELLED}:
            raise ValueError("finish status must be done, failed, or cancelled")
        return value
