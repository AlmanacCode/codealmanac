from datetime import datetime
from pathlib import Path
from uuid import uuid4

from codealmanac.core.paths import normalize_path
from codealmanac.engine.sources.models import TranscriptCandidate
from codealmanac.jobs.ledger.models import JobRecord
from codealmanac.wiki.workspaces.models import Workspace
from codealmanac.workflows.sync.entries import fresh_ledger_entry
from codealmanac.workflows.sync.models import SyncLedger, SyncLedgerEntry


def same_workspace(repo_root: Path, workspace: Workspace) -> bool:
    return normalize_path(repo_root) == normalize_path(workspace.root_path)


def ledger_key(candidate: TranscriptCandidate) -> str:
    return f"{candidate.app.value}:{normalize_path(candidate.transcript_path)}"


def ledger_entry(
    ledger: SyncLedger,
    candidate: TranscriptCandidate,
    key: str,
) -> SyncLedgerEntry:
    entry = ledger.sessions.get(key)
    if entry is not None:
        return entry
    raw_key = raw_ledger_key(candidate)
    if raw_key != key:
        entry = ledger.sessions.get(raw_key)
        if entry is not None:
            return entry
    for stored_entry in ledger.sessions.values():
        if same_ledger_identity(stored_entry, candidate):
            return stored_entry
    return fresh_ledger_entry(candidate)


def raw_ledger_key(candidate: TranscriptCandidate) -> str:
    return f"{candidate.app.value}:{candidate.transcript_path}"


def same_ledger_identity(
    entry: SyncLedgerEntry,
    candidate: TranscriptCandidate,
) -> bool:
    return (
        entry.app == candidate.app
        and entry.session_id == candidate.session_id
        and normalize_path(entry.transcript_path)
        == normalize_path(candidate.transcript_path)
    )


def job_record(records: tuple[JobRecord, ...], job_id: str) -> JobRecord | None:
    for record in records:
        if record.job_id == job_id:
            return record
    return None


def sync_claim_owner(now: datetime) -> str:
    stamp = now.strftime("%Y%m%d%H%M%S")
    return f"sync-{stamp}-{uuid4().hex[:8]}"
