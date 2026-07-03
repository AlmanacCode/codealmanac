from datetime import datetime, timedelta

from codealmanac.core.paths import normalize_path
from codealmanac.engine.sources.models import TranscriptCandidate
from codealmanac.jobs.ledger.models import JobRecord, JobStatus
from codealmanac.workflows.sync.entries import (
    cleared_pending_fields,
    needs_attention_entry,
    pending_cursor_complete,
)
from codealmanac.workflows.sync.identity import job_record
from codealmanac.workflows.sync.models import (
    SyncCursorDecision,
    SyncDecisionKind,
    SyncLedgerEntry,
    SyncLedgerStatus,
    SyncSkipped,
    TranscriptSnapshot,
)
from codealmanac.workflows.sync.reporting import skip
from codealmanac.workflows.sync.requests import SyncSelectionRequest
from codealmanac.workflows.sync.snapshots import sha256_bytes


def quiet_window_skip(
    candidate: TranscriptCandidate,
    request: SyncSelectionRequest,
    now: datetime,
) -> SyncSkipped | None:
    if now - candidate.modified_at < request.quiet:
        return skip(candidate, "quiet-window")
    return None


def is_internal_transcript(
    candidate: TranscriptCandidate,
    records: tuple[JobRecord, ...],
) -> bool:
    candidate_path = normalize_path(candidate.transcript_path)
    for record in records:
        ref = record.harness_transcript
        if ref is None or ref.kind.value != candidate.app.value:
            continue
        if ref.session_id == candidate.session_id:
            return True
        if (
            ref.transcript_path is not None
            and normalize_path(ref.transcript_path) == candidate_path
        ):
            return True
    return False


def evaluate_cursor(
    entry: SyncLedgerEntry,
    snapshot: TranscriptSnapshot,
    now: datetime,
    pending_timeout: timedelta,
    max_failed_attempts: int,
) -> SyncCursorDecision:
    if entry.status == SyncLedgerStatus.NEEDS_ATTENTION:
        return SyncCursorDecision(
            kind=SyncDecisionKind.NEEDS_ATTENTION,
            reason=entry.last_error or "sync-needs-attention",
        )
    if (
        entry.status == SyncLedgerStatus.FAILED
        and entry.failed_attempts >= max_failed_attempts
    ):
        return SyncCursorDecision(
            kind=SyncDecisionKind.NEEDS_ATTENTION,
            reason="sync-retry-budget-exhausted",
        )
    if entry.status == SyncLedgerStatus.PENDING:
        if pending_is_stale(entry, now, pending_timeout):
            return SyncCursorDecision(
                kind=SyncDecisionKind.NEEDS_ATTENTION,
                reason="sync-pending-stale",
            )
        return SyncCursorDecision(
            kind=SyncDecisionKind.SKIP,
            reason="sync-already-pending",
        )
    if snapshot.current_size <= entry.last_absorbed_size:
        return SyncCursorDecision(kind=SyncDecisionKind.SKIP, reason="unchanged")
    prefix_hash = sha256_bytes(snapshot.content[: entry.last_absorbed_size])
    if prefix_hash != entry.last_absorbed_prefix_hash:
        return SyncCursorDecision(
            kind=SyncDecisionKind.NEEDS_ATTENTION,
            reason="prefix-mismatch",
        )
    return SyncCursorDecision(
        kind=SyncDecisionKind.READY,
        from_line=entry.last_absorbed_line + 1,
        to_line=snapshot.current_line,
    )


def pending_is_stale(
    entry: SyncLedgerEntry,
    now: datetime,
    pending_timeout: timedelta,
) -> bool:
    if entry.pending_started_at is None:
        return True
    return now - entry.pending_started_at > pending_timeout


def evaluate_pending_run(
    entry: SyncLedgerEntry,
    records: tuple[JobRecord, ...],
) -> SyncCursorDecision | None:
    if entry.status != SyncLedgerStatus.PENDING or entry.pending_job_id is None:
        return None
    record = job_record(records, entry.pending_job_id)
    if record is None:
        return None
    if record.status in {JobStatus.QUEUED, JobStatus.RUNNING}:
        return SyncCursorDecision(
            kind=SyncDecisionKind.SKIP,
            reason="sync-pending-run-active",
        )
    if record.status == JobStatus.DONE:
        return SyncCursorDecision(
            kind=SyncDecisionKind.NEEDS_ATTENTION,
            reason="sync-pending-run-done",
        )
    return SyncCursorDecision(
        kind=SyncDecisionKind.NEEDS_ATTENTION,
        reason="sync-pending-run-failed",
    )


def reconcile_pending_entry(
    entry: SyncLedgerEntry,
    records: tuple[JobRecord, ...],
    now: datetime,
) -> SyncLedgerEntry:
    if entry.status != SyncLedgerStatus.PENDING or entry.pending_job_id is None:
        return entry
    record = job_record(records, entry.pending_job_id)
    if record is None or record.status in {JobStatus.QUEUED, JobStatus.RUNNING}:
        return entry
    if record.status == JobStatus.DONE:
        if not pending_cursor_complete(entry):
            return needs_attention_entry(
                entry,
                "sync-pending-missing-cursor",
                record.job_id,
            )
        return entry.model_copy(
            update={
                "status": SyncLedgerStatus.DONE,
                "last_absorbed_size": entry.pending_to_size,
                "last_absorbed_line": entry.pending_to_line,
                "last_absorbed_prefix_hash": entry.pending_prefix_hash,
                "last_absorbed_at": record.finished_at or now,
                "last_job_id": record.job_id,
                "last_error": None,
                **cleared_pending_fields(),
            }
        )
    return entry.model_copy(
        update={
            "status": SyncLedgerStatus.FAILED,
            "last_job_id": record.job_id,
            "last_error": record.error or f"sync-pending-run-{record.status.value}",
            "failed_attempts": entry.failed_attempts + 1,
            **cleared_pending_fields(),
        }
    )

