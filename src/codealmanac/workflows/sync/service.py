from datetime import UTC, datetime, timedelta
from hashlib import sha256
from pathlib import Path
from uuid import uuid4

from codealmanac.core.paths import normalize_path
from codealmanac.services.runs.models import RunRecord, RunStatus
from codealmanac.services.runs.requests import FinishRunRequest, ListRunsRequest
from codealmanac.services.runs.service import RunsService
from codealmanac.services.sources.models import TranscriptCandidate
from codealmanac.services.sources.requests import DiscoverTranscriptsRequest
from codealmanac.services.sources.service import SourcesService
from codealmanac.services.workspaces.models import Workspace
from codealmanac.services.workspaces.requests import SelectWorkspaceRequest
from codealmanac.services.workspaces.service import WorkspacesService
from codealmanac.workflows.ingest.requests import (
    RunIngestRequest,
    RunIngestWithRunRequest,
)
from codealmanac.workflows.ingest.service import IngestWorkflow
from codealmanac.workflows.run_queue.service import RunQueueWorkflow
from codealmanac.workflows.sync.models import (
    SyncCursorDecision,
    SyncDecisionKind,
    SyncEvaluation,
    SyncExecution,
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
        queue: RunQueueWorkflow,
        ledger_store: SyncLedgerStore,
    ):
        self.workspaces = workspaces
        self.sources = sources
        self.runs = runs
        self.ingest = ingest
        self.queue = queue
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
            ingest_request = RunIngestRequest(
                cwd=item.candidate.repo_root,
                inputs=(f"transcript:{item.candidate.transcript_path}",),
                harness=request.harness,
                wiki=request.wiki,
                title=sync_ingest_title(item.candidate),
                guidance=sync_ingest_guidance(item),
            )
            if request.execution == SyncExecution.BACKGROUND:
                run = self.queue.queue_ingest(ingest_request)
                pending = pending_entry(item.entry, item, now, claim_owner, run.run_id)
                ledger.sessions[item.ledger_key] = pending
                ledger = self.ledger_store.save(
                    item.candidate.almanac_path,
                    ledger,
                    now,
                )
                ledgers[item.candidate.repo_root] = ledger
                try:
                    self.queue.spawn_worker(item.candidate.repo_root, request.wiki)
                except Exception as error:
                    self.runs.finish(
                        FinishRunRequest(
                            cwd=item.candidate.repo_root,
                            wiki=request.wiki,
                            run_id=run.run_id,
                            status=RunStatus.FAILED,
                            error=first_error_line(error),
                        )
                    )
                    ledger.sessions[item.ledger_key] = failed_entry(
                        pending,
                        error,
                        run.run_id,
                    )
                    self.ledger_store.save(
                        item.candidate.almanac_path,
                        ledger,
                        now,
                    )
                    needs_attention.append(skip(item.candidate, "worker-spawn-failed"))
                    continue
                started.append(sync_started(item, run.run_id))
                continue
            run = self.ingest.start(ingest_request)
            pending = pending_entry(item.entry, item, now, claim_owner, run.run_id)
            ledger.sessions[item.ledger_key] = pending
            ledger = self.ledger_store.save(
                item.candidate.almanac_path,
                ledger,
                now,
            )
            ledgers[item.candidate.repo_root] = ledger
            item = item.model_copy(update={"entry": pending})
            try:
                result = self.ingest.run_with_run(
                    RunIngestWithRunRequest(
                        cwd=ingest_request.cwd,
                        inputs=ingest_request.inputs,
                        harness=ingest_request.harness,
                        wiki=ingest_request.wiki,
                        title=ingest_request.title,
                        guidance=ingest_request.guidance,
                        run_id=run.run_id,
                    )
                )
            except Exception as error:
                ledger.sessions[item.ledger_key] = failed_entry(
                    item.entry,
                    error,
                    run.run_id,
                )
                self.ledger_store.save(
                    item.candidate.almanac_path,
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
                item.candidate.almanac_path,
                ledger,
                now,
            )
            started.append(sync_started(item, result.run.run_id))
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
                almanac_roots=self.workspaces.discoverable_almanac_roots(),
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
                self.ledger_store.load(candidate.almanac_path),
            )
            snapshot = read_transcript(candidate)
            if snapshot is None:
                needs_attention.append(skip(candidate, "read-failed"))
                continue
            key = ledger_key(candidate)
            entry = ledger_entry(ledger, candidate, key)
            if mode == SyncMode.SYNC:
                reconciled = reconcile_pending_entry(entry, records, current_time)
                if reconciled != entry:
                    ledger.sessions[key] = reconciled
                    ledger = self.ledger_store.save(
                        candidate.almanac_path,
                        ledger,
                        current_time,
                    )
                    ledgers[candidate.repo_root] = ledger
                    entry = reconciled
            pending_run_decision = evaluate_pending_run(entry, records)
            if pending_run_decision is not None:
                if pending_run_decision.kind == SyncDecisionKind.SKIP:
                    skipped.append(skip(candidate, pending_run_decision.reason))
                else:
                    needs_attention.append(
                        skip(candidate, pending_run_decision.reason)
                    )
                continue
            decision = evaluate_cursor(
                entry,
                snapshot,
                current_time,
                request.pending_timeout,
                request.max_failed_attempts,
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
            "failed_attempts": 0,
            "pending_started_at": None,
            "pending_owner": None,
            "pending_run_id": None,
            "pending_to_size": None,
            "pending_prefix_hash": None,
            "pending_from_line": None,
            "pending_to_line": None,
        }
    )


def failed_entry(
    entry: SyncLedgerEntry,
    error: Exception,
    run_id: str | None = None,
) -> SyncLedgerEntry:
    return entry.model_copy(
        update={
            "status": SyncLedgerStatus.FAILED,
            "last_error": first_error_line(error),
            "last_job_id": run_id or entry.pending_run_id or entry.last_job_id,
            "failed_attempts": entry.failed_attempts + 1,
            "pending_started_at": None,
            "pending_owner": None,
            "pending_run_id": None,
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
    run_id: str,
) -> SyncLedgerEntry:
    return entry.model_copy(
        update={
            "status": SyncLedgerStatus.PENDING,
            "last_error": None,
            "pending_started_at": now,
            "pending_owner": owner,
            "pending_run_id": run_id,
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
    records: tuple[RunRecord, ...],
) -> SyncCursorDecision | None:
    if entry.status != SyncLedgerStatus.PENDING or entry.pending_run_id is None:
        return None
    record = run_record(records, entry.pending_run_id)
    if record is None:
        return None
    if record.status in {RunStatus.QUEUED, RunStatus.RUNNING}:
        return SyncCursorDecision(
            kind=SyncDecisionKind.SKIP,
            reason="sync-pending-run-active",
        )
    if record.status == RunStatus.DONE:
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
    records: tuple[RunRecord, ...],
    now: datetime,
) -> SyncLedgerEntry:
    if entry.status != SyncLedgerStatus.PENDING or entry.pending_run_id is None:
        return entry
    record = run_record(records, entry.pending_run_id)
    if record is None or record.status in {RunStatus.QUEUED, RunStatus.RUNNING}:
        return entry
    if record.status == RunStatus.DONE:
        if not pending_cursor_complete(entry):
            return needs_attention_entry(
                entry,
                "sync-pending-missing-cursor",
                record.run_id,
            )
        return entry.model_copy(
            update={
                "status": SyncLedgerStatus.DONE,
                "last_absorbed_size": entry.pending_to_size,
                "last_absorbed_line": entry.pending_to_line,
                "last_absorbed_prefix_hash": entry.pending_prefix_hash,
                "last_absorbed_at": record.finished_at or now,
                "last_job_id": record.run_id,
                "last_error": None,
                **cleared_pending_fields(),
            }
        )
    return entry.model_copy(
        update={
            "status": SyncLedgerStatus.FAILED,
            "last_job_id": record.run_id,
            "last_error": record.error or f"sync-pending-run-{record.status.value}",
            "failed_attempts": entry.failed_attempts + 1,
            **cleared_pending_fields(),
        }
    )


def pending_cursor_complete(entry: SyncLedgerEntry) -> bool:
    return (
        entry.pending_to_size is not None
        and entry.pending_to_line is not None
        and entry.pending_prefix_hash is not None
    )


def needs_attention_entry(
    entry: SyncLedgerEntry,
    reason: str,
    run_id: str,
) -> SyncLedgerEntry:
    return entry.model_copy(
        update={
            "status": SyncLedgerStatus.NEEDS_ATTENTION,
            "last_job_id": run_id,
            "last_error": reason,
            **cleared_pending_fields(),
        }
    )


def cleared_pending_fields() -> dict[str, None]:
    return {
        "pending_started_at": None,
        "pending_owner": None,
        "pending_run_id": None,
        "pending_to_size": None,
        "pending_prefix_hash": None,
        "pending_from_line": None,
        "pending_to_line": None,
    }


def run_record(records: tuple[RunRecord, ...], run_id: str) -> RunRecord | None:
    for record in records:
        if record.run_id == run_id:
            return record
    return None


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


def sync_started(item: SyncWorkItem, run_id: str) -> SyncStarted:
    return SyncStarted(
        app=item.candidate.app,
        session_id=item.candidate.session_id,
        transcript_path=item.candidate.transcript_path,
        repo_root=item.candidate.repo_root,
        run_id=run_id,
        from_line=item.from_line,
        to_line=item.to_line,
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
