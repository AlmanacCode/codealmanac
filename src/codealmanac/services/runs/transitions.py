from datetime import datetime

from codealmanac.core.errors import ConflictError
from codealmanac.services.harnesses.models import HarnessTranscriptRef
from codealmanac.services.runs.models import (
    TERMINAL_RUN_STATUSES,
    RunCancellationPlan,
    RunCancelResult,
    RunExecutionRef,
    RunFailureCategory,
    RunFinishResult,
    RunKind,
    RunRecord,
    RunStatus,
)


def queued_message(kind: RunKind) -> str:
    return f"queued {kind.value}"


def start_run(
    record: RunRecord,
    now: datetime,
    execution: RunExecutionRef | None = None,
) -> RunRecord:
    if record.status == RunStatus.RUNNING:
        if execution is not None and record.execution != execution:
            raise ConflictError(f"run {record.run_id} already has another executor")
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
            "execution": execution,
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
    failure_category: RunFailureCategory | None,
    now: datetime,
) -> RunFinishResult:
    if record.status in TERMINAL_RUN_STATUSES:
        return RunFinishResult(record=record, changed=False)
    return RunFinishResult(
        record=record.model_copy(
            update={
                "status": status,
                "summary": summary,
                "error": error,
                "failure_category": failure_category,
                "updated_at": now,
                "finished_at": now,
            }
        ),
        changed=True,
    )


def prepare_cancellation(
    record: RunRecord,
    now: datetime,
) -> tuple[RunCancellationPlan, str | None]:
    if record.status in TERMINAL_RUN_STATUSES:
        return RunCancellationPlan(record=record, changed=False), None
    if record.status == RunStatus.QUEUED:
        cancelled = cancelled_run(record, now)
        return RunCancellationPlan(record=cancelled, changed=True), "cancelled"
    if record.execution is None:
        raise ConflictError(f"running run {record.run_id} has no execution identity")
    if record.cancellation_requested_at is not None:
        return RunCancellationPlan(
            record=record,
            changed=False,
            execution=record.execution,
        ), None
    requested = record.model_copy(
        update={
            "cancellation_requested_at": now,
            "updated_at": now,
        }
    )
    return RunCancellationPlan(
        record=requested,
        changed=True,
        execution=requested.execution,
    ), "cancellation requested"


def finish_cancellation(
    record: RunRecord,
    execution_id: str,
    now: datetime,
) -> RunCancelResult:
    if record.status in TERMINAL_RUN_STATUSES:
        return RunCancelResult(record=record, changed=False)
    if record.status != RunStatus.RUNNING:
        raise ConflictError(
            f"run {record.run_id} cannot finish cancellation from "
            f"{record.status.value}"
        )
    if record.execution is None or record.execution.execution_id != execution_id:
        raise ConflictError(
            f"run {record.run_id} execution changed during cancellation"
        )
    if record.cancellation_requested_at is None:
        raise ConflictError(f"run {record.run_id} has no cancellation request")
    return RunCancelResult(record=cancelled_run(record, now), changed=True)


def cancelled_run(record: RunRecord, now: datetime) -> RunRecord:
    cancelled = record.model_copy(
        update={
            "status": RunStatus.CANCELLED,
            "updated_at": now,
            "finished_at": now,
            "summary": record.summary,
            "error": record.error,
        }
    )
    return cancelled
