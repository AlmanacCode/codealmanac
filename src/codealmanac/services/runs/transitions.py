from datetime import datetime

from codealmanac.core.errors import ConflictError
from codealmanac.services.harnesses.models import HarnessTranscriptRef
from codealmanac.services.runs.models import (
    TERMINAL_RUN_STATUSES,
    RunCancelResult,
    RunKind,
    RunRecord,
    RunStatus,
)


def queued_message(kind: RunKind) -> str:
    return f"queued {kind.value}"


def start_run(record: RunRecord, now: datetime) -> RunRecord:
    if record.status == RunStatus.RUNNING:
        return record
    if record.status != RunStatus.QUEUED:
        raise ConflictError(
            f"run {record.run_id} cannot start from {record.status.value}"
        )
    return record.model_copy(
        update={
            "status": RunStatus.RUNNING,
            "updated_at": now,
            "started_at": now,
        }
    )


def attach_harness_transcript(
    record: RunRecord,
    transcript: HarnessTranscriptRef,
    now: datetime,
) -> RunRecord:
    return record.model_copy(
        update={
            "harness_transcript": transcript,
            "updated_at": now,
        }
    )


def finish_run(
    record: RunRecord,
    status: RunStatus,
    summary: str | None,
    error: str | None,
    now: datetime,
) -> RunRecord:
    if record.status == RunStatus.CANCELLED:
        return record
    return record.model_copy(
        update={
            "status": status,
            "summary": summary,
            "error": error,
            "updated_at": now,
            "finished_at": now,
        }
    )


def cancel_run(record: RunRecord, now: datetime) -> RunCancelResult:
    if record.status in TERMINAL_RUN_STATUSES:
        return RunCancelResult(record=record, changed=False)
    cancelled = record.model_copy(
        update={
            "status": RunStatus.CANCELLED,
            "updated_at": now,
            "finished_at": now,
            "summary": record.summary,
            "error": record.error,
        }
    )
    return RunCancelResult(record=cancelled, changed=True)
