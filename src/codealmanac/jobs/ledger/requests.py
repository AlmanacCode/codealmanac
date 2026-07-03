from datetime import datetime, timedelta
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.engine.harnesses.models import HarnessEvent, HarnessTranscriptRef
from codealmanac.jobs.ledger.models import (
    JobEventKind,
    JobId,
    JobOperation,
    JobSpec,
    JobStatus,
)


class ListJobsRequest(CodeAlmanacModel):
    cwd: Path
    wiki: str | None = None
    limit: int | None = None

    @field_validator("limit")
    @classmethod
    def non_negative_limit(cls, value: int | None) -> int | None:
        if value is not None and value < 0:
            raise ValueError("limit must be non-negative")
        return value


class ShowJobRequest(CodeAlmanacModel):
    cwd: Path
    job_id: JobId
    wiki: str | None = None


class ReadJobLogRequest(CodeAlmanacModel):
    cwd: Path
    job_id: JobId
    wiki: str | None = None


class AttachJobRequest(CodeAlmanacModel):
    cwd: Path
    job_id: JobId
    wiki: str | None = None


class StreamJobAttachRequest(CodeAlmanacModel):
    cwd: Path
    job_id: JobId
    wiki: str | None = None
    poll_interval_seconds: float = 0.5

    @field_validator("poll_interval_seconds")
    @classmethod
    def positive_poll_interval(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("attach poll interval must be positive")
        return value


class CancelJobRequest(CodeAlmanacModel):
    cwd: Path
    job_id: JobId
    wiki: str | None = None


class StartJobRequest(CodeAlmanacModel):
    cwd: Path
    operation: JobOperation
    wiki: str | None = None
    title: str | None = None


class QueueJobRequest(CodeAlmanacModel):
    cwd: Path
    spec: JobSpec
    wiki: str | None = None
    title: str | None = None


class ReadJobSpecRequest(CodeAlmanacModel):
    cwd: Path
    job_id: JobId
    wiki: str | None = None


class NextQueuedJobRequest(CodeAlmanacModel):
    cwd: Path
    wiki: str | None = None


class AcquireJobWorkerLockRequest(CodeAlmanacModel):
    cwd: Path
    wiki: str | None = None
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
        return required_text(value, "job worker lock owner")

    @field_validator("pid")
    @classmethod
    def positive_pid(cls, value: int | None) -> int | None:
        if value is not None and value <= 0:
            raise ValueError("worker lock pid must be positive")
        return value


class SpawnJobWorkerRequest(CodeAlmanacModel):
    cwd: Path
    wiki: str | None = None


class RecordJobEventRequest(CodeAlmanacModel):
    cwd: Path
    job_id: JobId
    kind: JobEventKind
    message: str
    wiki: str | None = None
    harness_event: HarnessEvent | None = None


class MarkJobRunningRequest(CodeAlmanacModel):
    cwd: Path
    job_id: JobId
    wiki: str | None = None


class RecordJobHarnessTranscriptRequest(CodeAlmanacModel):
    cwd: Path
    job_id: JobId
    transcript: HarnessTranscriptRef
    wiki: str | None = None


class FinishJobRequest(CodeAlmanacModel):
    cwd: Path
    job_id: JobId
    status: JobStatus
    wiki: str | None = None
    summary: str | None = None
    error: str | None = None

    @field_validator("status")
    @classmethod
    def terminal_status(cls, value: JobStatus) -> JobStatus:
        if value not in {JobStatus.DONE, JobStatus.FAILED, JobStatus.CANCELLED}:
            raise ValueError("finish status must be done, failed, or cancelled")
        return value
