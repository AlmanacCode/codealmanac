from datetime import datetime

from codealmanac.engine.sources.models import TranscriptCandidate
from codealmanac.workflows.sync.models import (
    SyncLedgerEntry,
    SyncLedgerStatus,
    SyncWorkItem,
    TranscriptSnapshot,
)
from codealmanac.workflows.sync.snapshots import EMPTY_SHA256, sha256_bytes


def fresh_ledger_entry(candidate: TranscriptCandidate) -> SyncLedgerEntry:
    return SyncLedgerEntry(
        app=candidate.app,
        session_id=candidate.session_id,
        transcript_path=candidate.transcript_path,
        status=SyncLedgerStatus.DONE,
        last_absorbed_size=0,
        last_absorbed_line=0,
        last_absorbed_prefix_hash=EMPTY_SHA256,
    )


def absorbed_entry(
    entry: SyncLedgerEntry,
    snapshot: TranscriptSnapshot,
    job_id: str,
    now: datetime,
) -> SyncLedgerEntry:
    return entry.model_copy(
        update={
            "status": SyncLedgerStatus.DONE,
            "last_absorbed_size": snapshot.current_size,
            "last_absorbed_line": snapshot.current_line,
            "last_absorbed_prefix_hash": sha256_bytes(snapshot.content),
            "last_absorbed_at": now,
            "last_job_id": job_id,
            "last_error": None,
            "failed_attempts": 0,
            "pending_started_at": None,
            "pending_owner": None,
            "pending_job_id": None,
            "pending_to_size": None,
            "pending_prefix_hash": None,
            "pending_from_line": None,
            "pending_to_line": None,
        }
    )


def failed_entry(
    entry: SyncLedgerEntry,
    error: Exception,
    job_id: str | None = None,
) -> SyncLedgerEntry:
    return entry.model_copy(
        update={
            "status": SyncLedgerStatus.FAILED,
            "last_error": first_error_line(error),
            "last_job_id": job_id or entry.pending_job_id or entry.last_job_id,
            "failed_attempts": entry.failed_attempts + 1,
            "pending_started_at": None,
            "pending_owner": None,
            "pending_job_id": None,
            "pending_to_size": None,
            "pending_prefix_hash": None,
            "pending_from_line": None,
            "pending_to_line": None,
        }
    )


def pending_entry(
    entry: SyncLedgerEntry,
    item: SyncWorkItem,
    now: datetime,
    owner: str,
    job_id: str,
) -> SyncLedgerEntry:
    return entry.model_copy(
        update={
            "status": SyncLedgerStatus.PENDING,
            "last_error": None,
            "pending_started_at": now,
            "pending_owner": owner,
            "pending_job_id": job_id,
            "pending_to_size": item.snapshot.current_size,
            "pending_prefix_hash": sha256_bytes(item.snapshot.content),
            "pending_from_line": item.from_line,
            "pending_to_line": item.to_line,
        }
    )


def first_error_line(error: Exception) -> str:
    message = str(error).strip()
    if message == "":
        return error.__class__.__name__
    return message.splitlines()[0]


def pending_cursor_complete(entry: SyncLedgerEntry) -> bool:
    return (
        entry.pending_to_size is not None
        and entry.pending_to_line is not None
        and entry.pending_prefix_hash is not None
    )


def needs_attention_entry(
    entry: SyncLedgerEntry,
    reason: str,
    job_id: str,
) -> SyncLedgerEntry:
    return entry.model_copy(
        update={
            "status": SyncLedgerStatus.NEEDS_ATTENTION,
            "last_job_id": job_id,
            "last_error": reason,
            **cleared_pending_fields(),
        }
    )


def cleared_pending_fields() -> dict[str, None]:
    return {
        "pending_started_at": None,
        "pending_owner": None,
        "pending_job_id": None,
        "pending_to_size": None,
        "pending_prefix_hash": None,
        "pending_from_line": None,
        "pending_to_line": None,
    }
