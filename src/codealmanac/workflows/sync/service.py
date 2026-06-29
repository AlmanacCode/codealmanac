from datetime import UTC, datetime, timedelta
from hashlib import sha256
from pathlib import Path
from uuid import uuid4

from codealmanac.core.paths import normalize_path
from codealmanac.services.runs.models import RunRecord
from codealmanac.services.runs.requests import ListRunsRequest
from codealmanac.services.runs.service import RunsService
from codealmanac.services.sources.models import TranscriptCandidate
from codealmanac.services.sources.requests import DiscoverTranscriptsRequest
from codealmanac.services.sources.service import SourcesService
from codealmanac.services.workspaces.models import Workspace
from codealmanac.services.workspaces.requests import SelectWorkspaceRequest
from codealmanac.services.workspaces.service import WorkspacesService
from codealmanac.workflows.ingest.requests import RunIngestRequest
from codealmanac.workflows.ingest.service import IngestWorkflow
from codealmanac.workflows.sync.models import (
    SyncCursorDecision,
    SyncDecisionKind,
    SyncEvaluation,
    SyncLedger,
    SyncLedgerEntry,
    SyncLedgerStatus,
    SyncMode,
    SyncReady,
    SyncSkipped,
    SyncStarted,
    SyncSummary,
    SyncWorkItem,
    TranscriptSnapshot,
)
from codealmanac.workflows.sync.requests import (
    RunSyncRequest,
    RunSyncStatusRequest,
    SyncSelectionRequest,
)
from codealmanac.workflows.sync.store import SyncLedgerStore

EMPTY_SHA256 = f"sha256:{sha256(b'').hexdigest()}"


class SyncWorkflow:
    def __init__(
        self,
        workspaces: WorkspacesService,
        sources: SourcesService,
        runs: RunsService,
        ingest: IngestWorkflow,
        ledger_store: SyncLedgerStore,
    ):
        self.workspaces = workspaces
        self.sources = sources
        self.runs = runs
        self.ingest = ingest
        self.ledger_store = ledger_store

    def status(self, request: RunSyncStatusRequest) -> SyncSummary:
        return self.evaluate(request, SyncMode.STATUS).summary

    def run(self, request: RunSyncRequest) -> SyncSummary:
        now = request.now or datetime.now(UTC)
        evaluation = self.evaluate(request, SyncMode.SYNC, now=now)
        claim_owner = request.claim_owner or sync_claim_owner(now)
        started: list[SyncStarted] = []
        needs_attention = list(evaluation.summary.needs_attention)
        ledgers = dict(evaluation.ledgers)
        for item in evaluation.work_items:
            ledger = ledgers[item.candidate.repo_root]
            pending = pending_entry(item.entry, item, now, claim_owner)
            ledger.sessions[item.ledger_key] = pending
            ledger = self.ledger_store.save(
                item.candidate.repo_root / ".almanac",
                ledger,
                now,
            )
            ledgers[item.candidate.repo_root] = ledger
            item = item.model_copy(update={"entry": pending})
            try:
                result = self.ingest.run(
                    RunIngestRequest(
                        cwd=item.candidate.repo_root,
                        inputs=(f"transcript:{item.candidate.transcript_path}",),
                        harness=request.harness,
                        wiki=request.wiki,
                        title=sync_ingest_title(item.candidate),
                        guidance=sync_ingest_guidance(item),
                    )
                )
            except Exception as error:
                ledger.sessions[item.ledger_key] = failed_entry(item.entry, error)
                self.ledger_store.save(
                    item.candidate.repo_root / ".almanac",
                    ledger,
                    now,
                )
                needs_attention.append(skip(item.candidate, "ingest-failed"))
                continue
            ledger.sessions[item.ledger_key] = absorbed_entry(
                item.entry,
                item.snapshot,
                result.run.run_id,
                now,
            )
            ledgers[item.candidate.repo_root] = self.ledger_store.save(
                item.candidate.repo_root / ".almanac",
                ledger,
                now,
            )
            started.append(
                SyncStarted(
                    app=item.candidate.app,
                    session_id=item.candidate.session_id,
                    transcript_path=item.candidate.transcript_path,
                    repo_root=item.candidate.repo_root,
                    run_id=result.run.run_id,
                    from_line=item.from_line,
                    to_line=item.to_line,
                )
            )
        return evaluation.summary.model_copy(
            update={
                "started": tuple(started),
                "needs_attention": tuple(needs_attention),
            }
        )

    def evaluate(
        self,
        request: SyncSelectionRequest,
        mode: SyncMode,
        now: datetime | None = None,
    ) -> SyncEvaluation:
        current_time = now or request.now or datetime.now(UTC)
        candidates = self.sources.discover_transcripts(
            DiscoverTranscriptsRequest(
                home=normalize_path(request.home or Path.home()),
                apps=request.apps,
            )
        )
        scoped_candidates = self.scope_candidates(request, candidates)
        ready: list[SyncReady] = []
        skipped: list[SyncSkipped] = []
        needs_attention: list[SyncSkipped] = []
        ledgers: dict[Path, SyncLedger] = {}
        work_items: list[SyncWorkItem] = []
        run_records: dict[Path, tuple[RunRecord, ...]] = {}
        for candidate in scoped_candidates:
            quiet_skip = quiet_window_skip(candidate, request, current_time)
            if quiet_skip is not None:
                skipped.append(quiet_skip)
                continue
            records = run_records.setdefault(
                candidate.repo_root,
                self.runs.list(ListRunsRequest(cwd=candidate.repo_root)),
            )
            if is_internal_transcript(candidate, records):
                skipped.append(skip(candidate, "internal-lifecycle-transcript"))
                continue
            ledger = ledgers.setdefault(
                candidate.repo_root,
                self.ledger_store.load(candidate.repo_root / ".almanac"),
            )
            snapshot = read_transcript(candidate)
            if snapshot is None:
                needs_attention.append(skip(candidate, "read-failed"))
                continue
            key = ledger_key(candidate)
            entry = ledger_entry(ledger, candidate, key)
            decision = evaluate_cursor(
                entry,
                snapshot,
                current_time,
                request.pending_timeout,
            )
            if decision.kind == SyncDecisionKind.SKIP:
                skipped.append(skip(candidate, decision.reason))
            elif decision.kind == SyncDecisionKind.NEEDS_ATTENTION:
                needs_attention.append(skip(candidate, decision.reason))
            else:
                if mode == SyncMode.STATUS:
                    ready.append(
                        SyncReady(
                            app=candidate.app,
                            session_id=candidate.session_id,
                            transcript_path=candidate.transcript_path,
                            repo_root=candidate.repo_root,
                            from_line=decision.from_line,
                            to_line=decision.to_line,
                        )
                    )
                work_items.append(
                    SyncWorkItem(
                        candidate=candidate,
                        ledger_key=key,
                        entry=entry,
                        snapshot=snapshot,
                        from_line=decision.from_line,
                        to_line=decision.to_line,
                    )
                )
        summary = SyncSummary(
            mode=mode,
            scanned=len(candidates),
            eligible=len(work_items),
            ready=tuple(ready),
            skipped=tuple(skipped),
            needs_attention=tuple(needs_attention),
        )
        return SyncEvaluation(
            summary=summary,
            work_items=tuple(work_items),
            ledgers=ledgers,
        )

    def scope_candidates(
        self,
        request: SyncSelectionRequest,
        candidates: tuple[TranscriptCandidate, ...],
    ) -> tuple[TranscriptCandidate, ...]:
        if request.wiki is None:
            return candidates
        workspace = self.workspaces.select(
            SelectWorkspaceRequest(selector=request.wiki, base_path=request.cwd)
        )
        return tuple(
            candidate
            for candidate in candidates
            if same_workspace(candidate.repo_root, workspace)
        )


def same_workspace(repo_root: Path, workspace: Workspace) -> bool:
    return normalize_path(repo_root) == normalize_path(workspace.root_path)


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
    records: tuple[RunRecord, ...],
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


def read_transcript(candidate: TranscriptCandidate) -> TranscriptSnapshot | None:
    try:
        content = candidate.transcript_path.read_bytes()
    except OSError:
        return None
    return TranscriptSnapshot(
        content=content,
        current_size=len(content),
        current_line=count_lines(content.decode("utf-8", errors="replace")),
    )


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
    run_id: str,
    now: datetime,
) -> SyncLedgerEntry:
    return entry.model_copy(
        update={
            "status": SyncLedgerStatus.DONE,
            "last_absorbed_size": snapshot.current_size,
            "last_absorbed_line": snapshot.current_line,
            "last_absorbed_prefix_hash": sha256_bytes(snapshot.content),
            "last_absorbed_at": now,
            "last_job_id": run_id,
            "last_error": None,
            "pending_started_at": None,
            "pending_owner": None,
            "pending_from_line": None,
            "pending_to_line": None,
        }
    )


def failed_entry(entry: SyncLedgerEntry, error: Exception) -> SyncLedgerEntry:
    return entry.model_copy(
        update={
            "status": SyncLedgerStatus.FAILED,
            "last_error": first_error_line(error),
            "pending_started_at": None,
            "pending_owner": None,
            "pending_from_line": None,
            "pending_to_line": None,
        }
    )


def pending_entry(
    entry: SyncLedgerEntry,
    item: SyncWorkItem,
    now: datetime,
    owner: str,
) -> SyncLedgerEntry:
    return entry.model_copy(
        update={
            "status": SyncLedgerStatus.PENDING,
            "last_error": None,
            "pending_started_at": now,
            "pending_owner": owner,
            "pending_from_line": item.from_line,
            "pending_to_line": item.to_line,
        }
    )


def first_error_line(error: Exception) -> str:
    message = str(error).strip()
    if message == "":
        return error.__class__.__name__
    return message.splitlines()[0]


def evaluate_cursor(
    entry: SyncLedgerEntry,
    snapshot: TranscriptSnapshot,
    now: datetime,
    pending_timeout: timedelta,
) -> SyncCursorDecision:
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


def sync_claim_owner(now: datetime) -> str:
    stamp = now.strftime("%Y%m%d%H%M%S")
    return f"sync-{stamp}-{uuid4().hex[:8]}"


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


def sha256_bytes(content: bytes) -> str:
    return f"sha256:{sha256(content).hexdigest()}"


def count_lines(content: str) -> int:
    if content == "":
        return 0
    return content.count("\n") + (0 if content.endswith("\n") else 1)


def skip(candidate: TranscriptCandidate, reason: str) -> SyncSkipped:
    return SyncSkipped(
        app=candidate.app,
        session_id=candidate.session_id,
        transcript_path=candidate.transcript_path,
        repo_root=candidate.repo_root,
        reason=reason,
    )


def sync_ingest_title(candidate: TranscriptCandidate) -> str:
    return f"Sync {candidate.app.value} transcript {candidate.session_id}"


def sync_ingest_guidance(item: SyncWorkItem) -> str:
    return "\n".join(
        (
            "Scheduled sync cursor:",
            f"- App: {item.candidate.app.value}",
            f"- Session id: {item.candidate.session_id}",
            f"- Transcript: {item.candidate.transcript_path}",
            f"- Previously absorbed through line: {item.entry.last_absorbed_line}",
            f"- Previously absorbed through byte: {item.entry.last_absorbed_size}",
            f"- Focus on line {item.from_line} onward.",
            "- You may inspect earlier lines only for context.",
            "- Do not re-document decisions already absorbed unless newer lines "
            "amend, invalidate, or add important nuance to them.",
        )
    )
