from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.runs.models import RunEventKind, RunOperation, RunStatus


class ListRunsRequest(CodeAlmanacModel):
    cwd: Path
    wiki: str | None = None
    limit: int | None = None

    @field_validator("limit")
    @classmethod
    def non_negative_limit(cls, value: int | None) -> int | None:
        if value is not None and value < 0:
            raise ValueError("limit must be non-negative")
        return value


class ShowRunRequest(CodeAlmanacModel):
    cwd: Path
    run_id: str
    wiki: str | None = None


class ReadRunLogRequest(CodeAlmanacModel):
    cwd: Path
    run_id: str
    wiki: str | None = None


class StartRunRequest(CodeAlmanacModel):
    cwd: Path
    operation: RunOperation
    wiki: str | None = None
    title: str | None = None


class RecordRunEventRequest(CodeAlmanacModel):
    cwd: Path
    run_id: str
    kind: RunEventKind
    message: str
    wiki: str | None = None


class FinishRunRequest(CodeAlmanacModel):
    cwd: Path
    run_id: str
    status: RunStatus
    wiki: str | None = None
    summary: str | None = None
    error: str | None = None

    @field_validator("status")
    @classmethod
    def terminal_status(cls, value: RunStatus) -> RunStatus:
        if value not in {RunStatus.DONE, RunStatus.FAILED, RunStatus.CANCELLED}:
            raise ValueError("finish status must be done, failed, or cancelled")
        return value

