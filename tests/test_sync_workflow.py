import subprocess
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from pathlib import Path

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.core.paths import default_jobs_path, normalize_path
from codealmanac.services.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
    HarnessTranscriptRef,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest
from codealmanac.services.runs.models import (
    RunOperation,
    RunStatus,
    RunWorkerSpawnResult,
)
from codealmanac.services.runs.requests import (
    FinishRunRequest,
    MarkRunRunningRequest,
    RecordRunHarnessTranscriptRequest,
    ShowRunRequest,
    SpawnRunWorkerRequest,
    StartRunRequest,
)
from codealmanac.services.sources.models import TranscriptApp, TranscriptCandidate
from codealmanac.services.sources.requests import DiscoverTranscriptsRequest
from codealmanac.wiki.workspaces.identity import workspace_id_for
from codealmanac.wiki.workspaces.requests import InitializeWorkspaceRequest
from codealmanac.workflows.sync.models import (
    SyncExecution,
    SyncLedger,
    SyncLedgerEntry,
    SyncLedgerStatus,
    SyncMode,
)
from codealmanac.workflows.sync.requests import RunSyncRequest, RunSyncStatusRequest


class FakeTranscriptDiscoveryAdapter:
    app = TranscriptApp.CODEX

    def __init__(self, candidates: tuple[TranscriptCandidate, ...]):
        self.candidates = candidates
        self.requests: list[DiscoverTranscriptsRequest] = []

    def discover(
        self,
        request: DiscoverTranscriptsRequest,
    ) -> tuple[TranscriptCandidate, ...]:
        self.requests.append(request)
        return self.candidates


class SyncWritingHarnessAdapter:
    kind = HarnessKind.CODEX

    def __init__(self):
        self.requests: list[RunHarnessRequest] = []

    def check(self) -> HarnessReadiness:
        return HarnessReadiness(
            kind=self.kind,
            available=True,
            message="codex ready",
        )

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        self.requests.append(request)
        page = request.cwd / "almanac/pages/synced-transcript.md"
        page.write_text(
            """---
title: Synced Transcript
topics: [getting-started]
sources: []
---
# Synced Transcript

Sync ingested a quiet transcript.
""",
            encoding="utf-8",
        )
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="synced transcript",
            summary="synced transcript",
            changed_files=(page,),
        )


class FailedSyncHarnessAdapter(SyncWritingHarnessAdapter):
    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        self.requests.append(request)
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.FAILED,
            output_text="agent failed",
        )


class LedgerObservingHarnessAdapter(SyncWritingHarnessAdapter):
    def __init__(self, candidate: TranscriptCandidate):
        super().__init__()
        self.candidate = candidate
        self.observed_entry: SyncLedgerEntry | None = None

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        ledger = SyncLedger.model_validate_json(
            sync_ledger_path(request.cwd).read_text(encoding="utf-8")
        )
        self.observed_entry = ledger.sessions[sync_ledger_key(self.candidate)]
        return super().run(request)


class SyncWorkerSpawner:
    def __init__(self, error: Exception | None = None):
        self.error = error
        self.requests: list[SpawnRunWorkerRequest] = []

    def spawn(self, request: SpawnRunWorkerRequest) -> RunWorkerSpawnResult:
        self.requests.append(request)
        if self.error is not None:
            raise self.error
        return RunWorkerSpawnResult(
            child_pid=6262,
            command=("fake-sync-worker",),
        )


def test_sync_status_reports_ready_transcript_ranges(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "one\ntwo\n")
    candidate = transcript_candidate(repo, transcript, modified_at=old_time())
    app = app_with_candidates(isolated_home, (candidate,))
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))

    summary = app.workflows.sync.status(
        RunSyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            now=current_time(),
        )
    )

    assert summary.scanned == 1
    assert summary.eligible == 1
    assert summary.ready[0].session_id == "session-1"
    assert summary.ready[0].from_line == 1
    assert summary.ready[0].to_line == 2
    assert summary.skipped == ()
    assert summary.needs_attention == ()
    adapter = app.sources.transcript_discovery_adapters[0]
    assert adapter.requests[0].almanac_roots == (
        Path("almanac"),
        Path("docs/almanac"),
        Path(".almanac"),
    )


def test_sync_status_passes_configured_roots_to_discovery(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "one\n")
    candidate = transcript_candidate(
        repo,
        transcript,
        modified_at=old_time(),
        almanac_path=repo / "docs/almanac",
    )
    app = app_with_candidates(isolated_home, (candidate,))
    app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo, almanac_root=Path("docs/almanac"))
    )

    summary = app.workflows.sync.status(
        RunSyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            now=current_time(),
        )
    )

    adapter = app.sources.transcript_discovery_adapters[0]
    assert summary.eligible == 1
    assert adapter.requests[0].almanac_roots == (
        Path("almanac"),
        Path("docs/almanac"),
        Path(".almanac"),
    )


def test_sync_run_ingests_ready_transcripts_and_advances_ledger(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(
        tmp_path,
        (
            '{"type":"session_meta","payload":{"id":"session-1","cwd":"'
            f'{repo}"}}\n'
            '{"type":"response_item","payload":{"item":{"type":"message",'
            '"role":"user","content":[{"type":"input_text","text":'
            '"Sync should preserve the release blocker."}]}}}\n'
        ),
    )
    candidate = transcript_candidate(repo, transcript, modified_at=old_time())
    harness = SyncWritingHarnessAdapter()
    app = app_with_candidates(isolated_home, (candidate,), harness=harness)
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    summary = app.workflows.sync.run(
        RunSyncRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            harness=HarnessKind.CODEX,
            now=current_time(),
        )
    )

    ledger = SyncLedger.model_validate_json(
        sync_ledger_path(repo).read_text(encoding="utf-8")
    )
    entry = ledger.sessions[sync_ledger_key(candidate)]
    assert summary.mode == SyncMode.SYNC
    assert summary.eligible == 1
    assert summary.ready == ()
    assert summary.started[0].session_id == "session-1"
    assert entry.status == SyncLedgerStatus.DONE
    assert entry.last_absorbed_size == transcript.stat().st_size
    assert entry.last_absorbed_line == 2
    assert entry.last_job_id == summary.started[0].run_id
    assert "Scheduled sync cursor:" in harness.requests[0].prompt
    assert "Focus on line 1 onward." in harness.requests[0].prompt
    assert "Sync should preserve the release blocker." in harness.requests[0].prompt

    status = app.workflows.sync.status(
        RunSyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            now=current_time(),
        )
    )
    assert status.eligible == 0
    assert status.skipped[0].reason == "unchanged"


def test_sync_background_queues_ingest_and_leaves_pending_claim(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "one\ntwo\n")
    candidate = transcript_candidate(repo, transcript, modified_at=old_time())
    harness = SyncWritingHarnessAdapter()
    spawner = SyncWorkerSpawner()
    app = app_with_candidates(
        isolated_home,
        (candidate,),
        harness=harness,
        worker_spawner=spawner,
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))

    summary = app.workflows.sync.run(
        RunSyncRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            harness=HarnessKind.CODEX,
            execution=SyncExecution.BACKGROUND,
            now=current_time(),
            claim_owner="background-sync-owner",
        )
    )

    ledger = SyncLedger.model_validate_json(
        sync_ledger_path(repo).read_text(encoding="utf-8")
    )
    entry = ledger.sessions[sync_ledger_key(candidate)]
    run = app.runs.show(ShowRunRequest(cwd=repo, run_id=summary.started[0].run_id))

    assert summary.eligible == 1
    assert summary.started[0].from_line == 1
    assert summary.started[0].to_line == 2
    assert run.status == RunStatus.QUEUED
    assert run.operation == RunOperation.INGEST
    assert entry.status == SyncLedgerStatus.PENDING
    assert entry.pending_owner == "background-sync-owner"
    assert entry.pending_run_id == run.run_id
    assert entry.pending_to_size == transcript.stat().st_size
    assert entry.pending_prefix_hash == sha256_text("one\ntwo\n")
    assert harness.requests == []
    assert spawner.requests == [SpawnRunWorkerRequest(cwd=repo, wiki=None)]
    assert (workspace_jobs_path(repo) / f"{run.run_id}.spec.json").is_file()


def test_sync_background_spawn_failure_marks_run_and_ledger_failed(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "one\ntwo\n")
    candidate = transcript_candidate(repo, transcript, modified_at=old_time())
    spawner = SyncWorkerSpawner(error=RuntimeError("spawn denied"))
    app = app_with_candidates(
        isolated_home,
        (candidate,),
        harness=SyncWritingHarnessAdapter(),
        worker_spawner=spawner,
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))

    summary = app.workflows.sync.run(
        RunSyncRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            harness=HarnessKind.CODEX,
            execution=SyncExecution.BACKGROUND,
            now=current_time(),
        )
    )

    ledger = SyncLedger.model_validate_json(
        sync_ledger_path(repo).read_text(encoding="utf-8")
    )
    entry = ledger.sessions[sync_ledger_key(candidate)]
    run = app.runs.show(ShowRunRequest(cwd=repo, run_id=entry.last_job_id or ""))

    assert summary.started == ()
    assert summary.needs_attention[0].reason == "worker-spawn-failed"
    assert run.status == RunStatus.FAILED
    assert run.error == "spawn denied"
    assert entry.status == SyncLedgerStatus.FAILED
    assert entry.failed_attempts == 1
    assert entry.last_error == "spawn denied"
    assert entry.pending_run_id is None


def test_sync_run_writes_pending_claim_before_ingest(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "one\ntwo\n")
    candidate = transcript_candidate(repo, transcript, modified_at=old_time())
    harness = LedgerObservingHarnessAdapter(candidate)
    app = app_with_candidates(isolated_home, (candidate,), harness=harness)
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    summary = app.workflows.sync.run(
        RunSyncRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            harness=HarnessKind.CODEX,
            now=current_time(),
            claim_owner="test-sync-owner",
        )
    )

    assert harness.observed_entry is not None
    assert harness.observed_entry.status == SyncLedgerStatus.PENDING
    assert harness.observed_entry.pending_started_at == current_time()
    assert harness.observed_entry.pending_owner == "test-sync-owner"
    assert harness.observed_entry.pending_run_id is not None
    assert harness.observed_entry.pending_to_size == transcript.stat().st_size
    assert harness.observed_entry.pending_prefix_hash == sha256_text("one\ntwo\n")
    assert harness.observed_entry.pending_from_line == 1
    assert harness.observed_entry.pending_to_line == 2
    ledger = SyncLedger.model_validate_json(
        sync_ledger_path(repo).read_text(encoding="utf-8")
    )
    entry = ledger.sessions[sync_ledger_key(candidate)]
    assert entry.status == SyncLedgerStatus.DONE
    assert entry.last_job_id == summary.started[0].run_id
    assert entry.pending_started_at is None
    assert entry.pending_owner is None
    assert entry.pending_run_id is None
    assert entry.pending_to_size is None
    assert entry.pending_prefix_hash is None
    assert entry.pending_from_line is None
    assert entry.pending_to_line is None


def test_sync_run_records_failed_attempt_after_ingest_failure(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "one\ntwo\n")
    candidate = transcript_candidate(repo, transcript, modified_at=old_time())
    harness = FailedSyncHarnessAdapter()
    app = app_with_candidates(isolated_home, (candidate,), harness=harness)
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    summary = app.workflows.sync.run(
        RunSyncRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            harness=HarnessKind.CODEX,
            now=current_time(),
            claim_owner="automation-owner",
        )
    )

    ledger = SyncLedger.model_validate_json(
        sync_ledger_path(repo).read_text(encoding="utf-8")
    )
    entry = ledger.sessions[sync_ledger_key(candidate)]
    assert summary.started == ()
    assert summary.needs_attention[0].reason == "ingest-failed"
    assert entry.status == SyncLedgerStatus.FAILED
    assert entry.failed_attempts == 1
    assert entry.last_job_id is not None
    assert entry.last_error is not None
    assert entry.pending_owner is None


def test_sync_status_skips_active_pending_ledger_entry(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "one\ntwo\n")
    candidate = transcript_candidate(repo, transcript, modified_at=old_time())
    app = app_with_candidates(isolated_home, (candidate,))
    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo)
    )
    write_sync_ledger(
        workspace.almanac_path,
        candidate,
        last_absorbed_size=0,
        last_absorbed_line=0,
        prefix_hash=sha256_text(""),
        status=SyncLedgerStatus.PENDING,
        pending_started_at=current_time() - timedelta(minutes=30),
        pending_owner="active-owner",
        pending_from_line=1,
        pending_to_line=2,
    )

    summary = app.workflows.sync.status(
        RunSyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            pending_timeout=timedelta(hours=1),
            now=current_time(),
        )
    )

    assert summary.eligible == 0
    assert summary.ready == ()
    assert summary.skipped[0].reason == "sync-already-pending"


def test_sync_status_reports_stale_pending_ledger_entry(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "one\ntwo\n")
    candidate = transcript_candidate(repo, transcript, modified_at=old_time())
    app = app_with_candidates(isolated_home, (candidate,))
    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo)
    )
    write_sync_ledger(
        workspace.almanac_path,
        candidate,
        last_absorbed_size=0,
        last_absorbed_line=0,
        prefix_hash=sha256_text(""),
        status=SyncLedgerStatus.PENDING,
        pending_started_at=current_time() - timedelta(hours=3),
        pending_owner="stale-owner",
        pending_from_line=1,
        pending_to_line=2,
    )

    summary = app.workflows.sync.status(
        RunSyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            pending_timeout=timedelta(hours=1),
            now=current_time(),
        )
    )

    assert summary.eligible == 0
    assert summary.ready == ()
    assert summary.needs_attention[0].reason == "sync-pending-stale"


def test_sync_status_skips_active_pending_run(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "one\ntwo\n")
    candidate = transcript_candidate(repo, transcript, modified_at=old_time())
    app = app_with_candidates(isolated_home, (candidate,))
    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo)
    )
    run = app.runs.start(
        StartRunRequest(cwd=repo, operation=RunOperation.INGEST, title="Sync ingest")
    )
    app.runs.mark_running(MarkRunRunningRequest(cwd=repo, run_id=run.run_id))
    write_sync_ledger(
        workspace.almanac_path,
        candidate,
        last_absorbed_size=0,
        last_absorbed_line=0,
        prefix_hash=sha256_text(""),
        status=SyncLedgerStatus.PENDING,
        pending_started_at=current_time() - timedelta(minutes=30),
        pending_owner="active-owner",
        pending_run_id=run.run_id,
        pending_to_size=transcript.stat().st_size,
        pending_prefix_hash=sha256_text("one\ntwo\n"),
        pending_from_line=1,
        pending_to_line=2,
    )

    summary = app.workflows.sync.status(
        RunSyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            pending_timeout=timedelta(hours=1),
            now=current_time(),
        )
    )

    assert summary.eligible == 0
    assert summary.ready == ()
    assert summary.skipped[0].reason == "sync-pending-run-active"


def test_sync_status_reports_done_pending_run_needs_reconcile(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "one\ntwo\n")
    candidate = transcript_candidate(repo, transcript, modified_at=old_time())
    app = app_with_candidates(isolated_home, (candidate,))
    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo)
    )
    run = app.runs.start(
        StartRunRequest(cwd=repo, operation=RunOperation.INGEST, title="Sync ingest")
    )
    app.runs.mark_running(MarkRunRunningRequest(cwd=repo, run_id=run.run_id))
    app.runs.finish(
        FinishRunRequest(
            cwd=repo,
            run_id=run.run_id,
            status=RunStatus.DONE,
            summary="done",
        )
    )
    write_sync_ledger(
        workspace.almanac_path,
        candidate,
        last_absorbed_size=0,
        last_absorbed_line=0,
        prefix_hash=sha256_text(""),
        status=SyncLedgerStatus.PENDING,
        pending_started_at=current_time() - timedelta(minutes=30),
        pending_owner="done-owner",
        pending_run_id=run.run_id,
        pending_to_size=transcript.stat().st_size,
        pending_prefix_hash=sha256_text("one\ntwo\n"),
        pending_from_line=1,
        pending_to_line=2,
    )

    summary = app.workflows.sync.status(
        RunSyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            pending_timeout=timedelta(hours=1),
            now=current_time(),
        )
    )

    assert summary.eligible == 0
    assert summary.ready == ()
    assert summary.needs_attention[0].reason == "sync-pending-run-done"


def test_sync_run_reconciles_done_pending_run_before_new_work(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    absorbed = "one\ntwo\n"
    transcript = write_transcript(tmp_path, f"{absorbed}three\n")
    candidate = transcript_candidate(repo, transcript, modified_at=old_time())
    harness = SyncWritingHarnessAdapter()
    app = app_with_candidates(isolated_home, (candidate,), harness=harness)
    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo)
    )
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    run = app.runs.start(
        StartRunRequest(cwd=repo, operation=RunOperation.INGEST, title="Sync ingest")
    )
    app.runs.mark_running(MarkRunRunningRequest(cwd=repo, run_id=run.run_id))
    app.runs.finish(
        FinishRunRequest(
            cwd=repo,
            run_id=run.run_id,
            status=RunStatus.DONE,
            summary="done",
        )
    )
    write_sync_ledger(
        workspace.almanac_path,
        candidate,
        last_absorbed_size=0,
        last_absorbed_line=0,
        prefix_hash=sha256_text(""),
        status=SyncLedgerStatus.PENDING,
        pending_started_at=current_time() - timedelta(minutes=30),
        pending_owner="done-owner",
        pending_run_id=run.run_id,
        pending_to_size=len(absorbed.encode("utf-8")),
        pending_prefix_hash=sha256_text(absorbed),
        pending_from_line=1,
        pending_to_line=2,
    )

    summary = app.workflows.sync.run(
        RunSyncRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            harness=HarnessKind.CODEX,
            now=current_time(),
        )
    )

    ledger = SyncLedger.model_validate_json(
        sync_ledger_path(repo).read_text(encoding="utf-8")
    )
    entry = ledger.sessions[sync_ledger_key(candidate)]
    assert summary.eligible == 1
    assert summary.started[0].from_line == 3
    assert summary.started[0].to_line == 3
    assert "Focus on line 3 onward." in harness.requests[0].prompt
    assert entry.status == SyncLedgerStatus.DONE
    assert entry.last_absorbed_size == transcript.stat().st_size
    assert entry.last_absorbed_line == 3
    assert entry.last_job_id == summary.started[0].run_id
    assert entry.pending_run_id is None


def test_sync_run_reconciles_failed_pending_run_and_retries(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "one\ntwo\n")
    candidate = transcript_candidate(repo, transcript, modified_at=old_time())
    harness = SyncWritingHarnessAdapter()
    app = app_with_candidates(isolated_home, (candidate,), harness=harness)
    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo)
    )
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    run = app.runs.start(
        StartRunRequest(cwd=repo, operation=RunOperation.INGEST, title="Sync ingest")
    )
    app.runs.mark_running(MarkRunRunningRequest(cwd=repo, run_id=run.run_id))
    app.runs.finish(
        FinishRunRequest(
            cwd=repo,
            run_id=run.run_id,
            status=RunStatus.FAILED,
            error="previous crash",
        )
    )
    write_sync_ledger(
        workspace.almanac_path,
        candidate,
        last_absorbed_size=0,
        last_absorbed_line=0,
        prefix_hash=sha256_text(""),
        status=SyncLedgerStatus.PENDING,
        pending_started_at=current_time() - timedelta(minutes=30),
        pending_owner="failed-owner",
        pending_run_id=run.run_id,
        pending_to_size=transcript.stat().st_size,
        pending_prefix_hash=sha256_text("one\ntwo\n"),
        pending_from_line=1,
        pending_to_line=2,
    )

    summary = app.workflows.sync.run(
        RunSyncRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            harness=HarnessKind.CODEX,
            now=current_time(),
        )
    )

    assert summary.eligible == 1
    assert summary.started[0].from_line == 1
    assert "Focus on line 1 onward." in harness.requests[0].prompt


def test_sync_status_reports_exhausted_retry_budget(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "one\ntwo\n")
    candidate = transcript_candidate(repo, transcript, modified_at=old_time())
    app = app_with_candidates(isolated_home, (candidate,))
    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo)
    )
    write_sync_ledger(
        workspace.almanac_path,
        candidate,
        last_absorbed_size=0,
        last_absorbed_line=0,
        prefix_hash=sha256_text(""),
        status=SyncLedgerStatus.FAILED,
        failed_attempts=3,
    )

    summary = app.workflows.sync.status(
        RunSyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            now=current_time(),
            max_failed_attempts=3,
        )
    )

    assert summary.eligible == 0
    assert summary.ready == ()
    assert summary.needs_attention[0].reason == "sync-retry-budget-exhausted"


def test_sync_status_matches_normalized_transcript_ledger_key(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "one\ntwo\n")
    alias = tmp_path / "alias"
    alias.mkdir()
    candidate = transcript_candidate(
        repo,
        alias / ".." / transcript.name,
        modified_at=old_time(),
    )
    app = app_with_candidates(isolated_home, (candidate,))
    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo)
    )
    write_sync_ledger(
        workspace.almanac_path,
        candidate,
        last_absorbed_size=0,
        last_absorbed_line=0,
        prefix_hash=sha256_text(""),
        status=SyncLedgerStatus.PENDING,
        pending_started_at=current_time() - timedelta(minutes=30),
        pending_owner="normalized-owner",
        pending_from_line=1,
        pending_to_line=2,
    )

    summary = app.workflows.sync.status(
        RunSyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            pending_timeout=timedelta(hours=1),
            now=current_time(),
        )
    )

    assert summary.eligible == 0
    assert summary.ready == ()
    assert summary.skipped[0].reason == "sync-already-pending"


def test_sync_status_matches_ledger_entry_by_normalized_identity(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "one\ntwo\n")
    transcript_link_root = tmp_path / "transcript-link"
    transcript_link_root.symlink_to(tmp_path, target_is_directory=True)
    linked_transcript = transcript_link_root / transcript.name
    candidate = transcript_candidate(repo, transcript, modified_at=old_time())
    app = app_with_candidates(isolated_home, (candidate,))
    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo)
    )
    write_sync_ledger(
        workspace.almanac_path,
        candidate,
        last_absorbed_size=0,
        last_absorbed_line=0,
        prefix_hash=sha256_text(""),
        status=SyncLedgerStatus.PENDING,
        pending_started_at=current_time() - timedelta(minutes=30),
        pending_owner="linked-owner",
        pending_from_line=1,
        pending_to_line=2,
        session_key=f"{candidate.app.value}:{linked_transcript}",
        entry_transcript_path=linked_transcript,
    )

    summary = app.workflows.sync.status(
        RunSyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            pending_timeout=timedelta(hours=1),
            now=current_time(),
        )
    )

    assert summary.eligible == 0
    assert summary.ready == ()
    assert summary.skipped[0].reason == "sync-already-pending"


def test_sync_status_skips_internal_lifecycle_transcripts_by_session(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "one\ntwo\n")
    candidate = transcript_candidate(repo, transcript, modified_at=old_time())
    app = app_with_candidates(isolated_home, (candidate,))
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    record = app.runs.start(
        StartRunRequest(
            cwd=repo,
            operation=RunOperation.INGEST,
            title="Internal ingest",
        )
    )
    app.runs.record_harness_transcript(
        RecordRunHarnessTranscriptRequest(
            cwd=repo,
            run_id=record.run_id,
            transcript=HarnessTranscriptRef(
                kind=HarnessKind.CODEX,
                session_id="session-1",
            ),
        )
    )

    summary = app.workflows.sync.status(
        RunSyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            now=current_time(),
        )
    )

    assert summary.eligible == 0
    assert summary.ready == ()
    assert summary.skipped[0].reason == "internal-lifecycle-transcript"


def test_sync_status_skips_internal_lifecycle_transcripts_by_path(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "one\ntwo\n")
    candidate = transcript_candidate(repo, transcript, modified_at=old_time())
    app = app_with_candidates(isolated_home, (candidate,))
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    record = app.runs.start(
        StartRunRequest(
            cwd=repo,
            operation=RunOperation.GARDEN,
            title="Internal garden",
        )
    )
    app.runs.record_harness_transcript(
        RecordRunHarnessTranscriptRequest(
            cwd=repo,
            run_id=record.run_id,
            transcript=HarnessTranscriptRef(
                kind=HarnessKind.CODEX,
                session_id="different-session",
                transcript_path=transcript,
            ),
        )
    )

    summary = app.workflows.sync.status(
        RunSyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            now=current_time(),
        )
    )

    assert summary.eligible == 0
    assert summary.ready == ()
    assert summary.skipped[0].reason == "internal-lifecycle-transcript"


def test_sync_status_applies_quiet_window(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "one\n")
    candidate = transcript_candidate(repo, transcript, modified_at=current_time())
    app = app_with_candidates(isolated_home, (candidate,))
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))

    summary = app.workflows.sync.status(
        RunSyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(minutes=45),
            now=current_time(),
        )
    )

    assert summary.eligible == 0
    assert summary.skipped[0].reason == "quiet-window"


def test_sync_status_reports_prefix_mismatch_from_ledger(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = write_transcript(tmp_path, "new prefix\nmore\n")
    candidate = transcript_candidate(repo, transcript, modified_at=old_time())
    app = app_with_candidates(isolated_home, (candidate,))
    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo)
    )
    write_sync_ledger(
        workspace.almanac_path,
        candidate,
        last_absorbed_size=3,
        last_absorbed_line=1,
        prefix_hash=sha256_text("old"),
    )

    summary = app.workflows.sync.status(
        RunSyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            quiet=timedelta(),
            now=current_time(),
        )
    )

    assert summary.eligible == 0
    assert summary.needs_attention[0].reason == "prefix-mismatch"


def app_with_candidates(
    isolated_home: Path,
    candidates: tuple[TranscriptCandidate, ...],
    harness: SyncWritingHarnessAdapter | None = None,
    worker_spawner: SyncWorkerSpawner | None = None,
):
    return create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=() if harness is None else (harness,),
        transcript_discovery_adapters=(FakeTranscriptDiscoveryAdapter(candidates),),
        worker_spawner=worker_spawner,
    )


def workspace_jobs_path(repo: Path) -> Path:
    return default_jobs_path() / workspace_id_for(repo)


def sync_ledger_path(repo: Path) -> Path:
    return workspace_jobs_path(repo) / "sync-ledger.json"


def transcript_candidate(
    repo: Path,
    transcript: Path,
    modified_at: datetime,
    almanac_path: Path | None = None,
) -> TranscriptCandidate:
    return TranscriptCandidate(
        app=TranscriptApp.CODEX,
        session_id="session-1",
        transcript_path=transcript,
        cwd=repo,
        repo_root=repo,
        almanac_path=almanac_path or repo / "almanac",
        modified_at=modified_at,
        size_bytes=transcript.stat().st_size,
    )


def write_transcript(root: Path, content: str) -> Path:
    path = root / "session.jsonl"
    path.write_text(content, encoding="utf-8")
    return path


def current_time() -> datetime:
    return datetime(2026, 6, 29, 12, 0, tzinfo=UTC)


def old_time() -> datetime:
    return current_time() - timedelta(hours=2)


def write_sync_ledger(
    almanac_path: Path,
    candidate: TranscriptCandidate,
    last_absorbed_size: int,
    last_absorbed_line: int,
    prefix_hash: str,
    status: SyncLedgerStatus = SyncLedgerStatus.DONE,
    pending_started_at: datetime | None = None,
    pending_owner: str | None = None,
    pending_run_id: str | None = None,
    pending_to_size: int | None = None,
    pending_prefix_hash: str | None = None,
    pending_from_line: int | None = None,
    pending_to_line: int | None = None,
    failed_attempts: int = 0,
    session_key: str | None = None,
    entry_transcript_path: Path | None = None,
) -> None:
    path = almanac_path / "jobs/sync-ledger.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    ledger = SyncLedger(
        version=1,
        updated_at=current_time(),
        sessions={
            session_key or sync_ledger_key(candidate): SyncLedgerEntry(
                app=candidate.app,
                session_id=candidate.session_id,
                transcript_path=entry_transcript_path or candidate.transcript_path,
                status=status,
                last_absorbed_size=last_absorbed_size,
                last_absorbed_line=last_absorbed_line,
                last_absorbed_prefix_hash=prefix_hash,
                failed_attempts=failed_attempts,
                pending_started_at=pending_started_at,
                pending_owner=pending_owner,
                pending_run_id=pending_run_id,
                pending_to_size=pending_to_size,
                pending_prefix_hash=pending_prefix_hash,
                pending_from_line=pending_from_line,
                pending_to_line=pending_to_line,
            )
        },
    )
    path.write_text(ledger.model_dump_json(indent=2), encoding="utf-8")


def sha256_text(value: str) -> str:
    return f"sha256:{sha256(value.encode('utf-8')).hexdigest()}"


def sync_ledger_key(candidate: TranscriptCandidate) -> str:
    return f"{candidate.app.value}:{normalize_path(candidate.transcript_path)}"


def initialize_git(repo: Path) -> None:
    subprocess_run(("git", "init", "-q"), repo)
    subprocess_run(("git", "config", "user.email", "test@example.com"), repo)
    subprocess_run(("git", "config", "user.name", "Test User"), repo)


def commit_all(repo: Path, message: str) -> None:
    subprocess_run(("git", "add", "."), repo)
    subprocess_run(("git", "commit", "-q", "-m", message), repo)


def subprocess_run(command: tuple[str, ...], cwd: Path) -> None:
    subprocess.run(command, cwd=cwd, check=True)
