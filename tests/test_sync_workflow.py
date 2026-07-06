import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path

from codealmanac.app import create_app
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.repositories.requests import InitializeRepositoryRequest
from codealmanac.services.runs.models import RunKind, RunWorkerSpawnResult
from codealmanac.services.runs.requests import ReadRunSpecRequest, SpawnRunWorkerRequest
from codealmanac.services.sources.models import TranscriptApp, TranscriptCandidate
from codealmanac.services.sources.requests import DiscoverTranscriptsRequest
from codealmanac.settings import AppConfig
from codealmanac.workflows.sync.models import SyncMode
from codealmanac.workflows.sync.requests import SyncRequest, SyncStatusRequest


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


def test_sync_status_groups_active_transcripts_by_repository(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = initialized_repo(tmp_path, "repo")
    active = transcript_candidate(repo, tmp_path / "active.jsonl", current_time())
    inactive = transcript_candidate(
        repo,
        tmp_path / "inactive.jsonl",
        current_time() - timedelta(hours=6),
        session_id="inactive-session",
    )
    app, adapter, spawner = app_with_sync(
        isolated_home,
        candidates=(active, inactive),
    )
    app.workflows.build.initialize(InitializeRepositoryRequest(path=repo))

    summary = app.workflows.sync.status(
        SyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            now=current_time(),
        )
    )

    assert summary.mode == SyncMode.STATUS
    assert summary.scanned == 2
    assert summary.eligible == 1
    assert len(summary.ready) == 1
    assert summary.ready[0].repository_name == "repo"
    assert summary.ready[0].transcript_paths == (active.transcript_path,)
    assert summary.skipped[0].reason == "inactive"
    assert adapter.requests[0].apps == (TranscriptApp.CODEX,)
    assert spawner.requests == []


def test_sync_uses_exact_registered_cwd_without_root_hopping(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = initialized_repo(tmp_path, "repo")
    nested = repo / "src" / "package"
    nested.mkdir(parents=True)
    candidate = transcript_candidate(nested, tmp_path / "nested.jsonl", current_time())
    app, _, _ = app_with_sync(isolated_home, candidates=(candidate,))
    app.workflows.build.initialize(InitializeRepositoryRequest(path=repo))

    summary = app.workflows.sync.status(
        SyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            now=current_time(),
        )
    )

    assert summary.eligible == 0
    assert summary.ready == ()
    assert summary.skipped[0].reason == "unregistered-cwd"


def test_sync_run_queues_one_ingest_run_per_repository_and_records_scan_time(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = initialized_repo(tmp_path, "repo")
    first = transcript_candidate(
        repo,
        tmp_path / "first.jsonl",
        current_time() - timedelta(minutes=1),
    )
    second = transcript_candidate(
        repo,
        tmp_path / "second.jsonl",
        current_time() - timedelta(minutes=10),
        session_id="second-session",
    )
    database_path = isolated_home / ".codealmanac/codealmanac.db"
    app, _, spawner = app_with_sync(
        isolated_home,
        candidates=(first, second),
        database_path=database_path,
    )
    app.workflows.build.initialize(InitializeRepositoryRequest(path=repo))

    summary = app.workflows.sync.run(
        SyncRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            harness=HarnessKind.CODEX,
            now=current_time(),
            auto_commit=False,
        )
    )

    assert summary.mode == SyncMode.SYNC
    assert summary.eligible == 2
    assert summary.ready == ()
    assert len(summary.started) == 1
    assert summary.started[0].repository_name == "repo"
    assert summary.started[0].transcript_count == 2
    assert len(spawner.requests) == 1
    spec = app.runs.read_spec(
        ReadRunSpecRequest(
            cwd=repo,
            wiki="repo",
            run_id=summary.started[0].run_id,
        )
    )
    assert spec is not None
    assert spec.kind == RunKind.INGEST
    assert spec.inputs == (
        f"transcript:{second.transcript_path}",
        f"transcript:{first.transcript_path}",
    )
    assert spec.auto_commit is False
    assert sync_completed_at(database_path) == current_time().isoformat()

    next_status = app.workflows.sync.status(
        SyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            now=current_time() + timedelta(minutes=1),
        )
    )
    assert next_status.eligible == 0
    assert next_status.skipped[0].reason == "inactive"


def test_sync_advances_scan_time_even_when_queueing_fails(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = initialized_repo(tmp_path, "repo")
    candidate = transcript_candidate(repo, tmp_path / "active.jsonl", current_time())
    database_path = isolated_home / ".codealmanac/codealmanac.db"
    app, _, _ = app_with_sync(
        isolated_home,
        candidates=(candidate,),
        database_path=database_path,
        spawner=SyncWorkerSpawner(error=OSError("spawn failed")),
    )
    app.workflows.build.initialize(InitializeRepositoryRequest(path=repo))

    summary = app.workflows.sync.run(
        SyncRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            harness=HarnessKind.CODEX,
            now=current_time(),
        )
    )

    assert summary.eligible == 1
    assert len(summary.started) == 1
    assert summary.needs_attention[0].reason == "worker-spawn-failed: spawn failed"
    assert sync_completed_at(database_path) == current_time().isoformat()


def test_sync_uses_last_completed_time_before_interval_fallback(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = initialized_repo(tmp_path, "repo")
    database_path = isolated_home / ".codealmanac/codealmanac.db"
    previous = current_time() - timedelta(hours=8)
    active_after_sleep = transcript_candidate(
        repo,
        tmp_path / "active-after-sleep.jsonl",
        current_time() - timedelta(hours=7),
    )
    app, _, _ = app_with_sync(
        isolated_home,
        candidates=(active_after_sleep,),
        database_path=database_path,
    )
    app.workflows.build.initialize(InitializeRepositoryRequest(path=repo))
    write_sync_completed_at(database_path, previous)

    summary = app.workflows.sync.status(
        SyncStatusRequest(
            cwd=repo,
            apps=(TranscriptApp.CODEX,),
            now=current_time(),
        )
    )

    assert summary.since == previous
    assert summary.eligible == 1


def initialized_repo(tmp_path: Path, name: str) -> Path:
    repo = tmp_path / name
    repo.mkdir()
    return repo


def app_with_sync(
    isolated_home: Path,
    *,
    candidates: tuple[TranscriptCandidate, ...],
    database_path: Path | None = None,
    spawner: SyncWorkerSpawner | None = None,
):
    adapter = FakeTranscriptDiscoveryAdapter(candidates)
    selected_spawner = spawner or SyncWorkerSpawner()
    app = create_app(
        AppConfig(
            database_path=database_path
            or isolated_home / ".codealmanac/codealmanac.db"
        ),
        transcript_discovery_adapters=(adapter,),
        worker_spawner=selected_spawner,
    )
    return app, adapter, selected_spawner


def transcript_candidate(
    repo: Path,
    path: Path,
    modified_at: datetime,
    *,
    session_id: str = "session-1",
) -> TranscriptCandidate:
    path.write_text("transcript\n", encoding="utf-8")
    return TranscriptCandidate(
        app=TranscriptApp.CODEX,
        session_id=session_id,
        transcript_path=path,
        cwd=repo,
        repo_root=repo,
        almanac_path=repo / "almanac",
        modified_at=modified_at,
        size_bytes=path.stat().st_size,
    )


def current_time() -> datetime:
    return datetime(2026, 7, 6, 12, 0, tzinfo=UTC)


def sync_completed_at(database_path: Path) -> str | None:
    with sqlite3.connect(database_path) as connection:
        row = connection.execute(
            "SELECT last_completed_at FROM sync_state WHERE name = 'sync'"
        ).fetchone()
    if row is None:
        return None
    return str(row[0])


def write_sync_completed_at(database_path: Path, completed_at: datetime) -> None:
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS sync_state (
                name TEXT PRIMARY KEY,
                last_completed_at TEXT
            )
            """
        )
        connection.execute(
            """
            INSERT INTO sync_state (name, last_completed_at)
            VALUES ('sync', ?)
            ON CONFLICT(name) DO UPDATE SET
                last_completed_at = excluded.last_completed_at
            """,
            (completed_at.isoformat(),),
        )
