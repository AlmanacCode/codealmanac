import subprocess
from pathlib import Path

from conftest import initialize_repository

from codealmanac.app import create_app
from codealmanac.integrations.runs.process import worker_command
from codealmanac.services.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest
from codealmanac.services.runs.models import RunStatus, RunWorkerSpawnResult
from codealmanac.services.runs.requests import (
    CancelRunRequest,
    ListRunsRequest,
    ReadRunLogRequest,
    SpawnRunWorkerRequest,
)
from codealmanac.services.search.requests import SearchPagesRequest
from codealmanac.settings import AppConfig
from codealmanac.workflows.ingest.requests import IngestRequest
from codealmanac.workflows.run_queue import DrainRunQueueRequest


class QueueWritingHarnessAdapter:
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
        page = request.cwd / "almanac/queued-note.md"
        page.write_text(
            """---
title: Queued Note
topics: [concepts]
sources: []
---
# Queued Note

The queued worker turned the note into durable wiki knowledge.
""",
            encoding="utf-8",
        )
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="updated wiki",
            summary="queued ingest completed",
            changed_files=(page,),
        )


class FakeWorkerSpawner:
    def __init__(self):
        self.requests: list[SpawnRunWorkerRequest] = []

    def spawn(self, request: SpawnRunWorkerRequest) -> RunWorkerSpawnResult:
        self.requests.append(request)
        return RunWorkerSpawnResult(
            child_pid=4242,
            command=("fake-codealmanac-worker",),
        )


def test_run_queue_start_persists_spec_and_spawns_worker(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("queue design note\n", encoding="utf-8")
    spawner = FakeWorkerSpawner()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(QueueWritingHarnessAdapter(),),
        worker_spawner=spawner,
    )
    initialize_repository(app, repo)

    result = app.workflows.queue.start_ingest(
        IngestRequest(
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
        )
    )
    runs = app.runs.list(ListRunsRequest(repository_name=repo.name))

    assert result.worker.child_pid == 4242
    assert result.run.status == RunStatus.QUEUED
    assert runs[0].run_id == result.run.run_id
    assert spawner.requests == [SpawnRunWorkerRequest(cwd=repo)]
    assert (isolated_home / ".codealmanac/codealmanac.db").is_file()
    assert not (repo / "almanac/jobs").exists()


def test_run_queue_drains_persisted_ingest_spec(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("queue design note\n", encoding="utf-8")
    harness = QueueWritingHarnessAdapter()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(harness,),
    )
    initialize_repository(app, repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    queued = app.workflows.queue.queue_ingest(
        IngestRequest(
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
            title="Ingest queued note",
            guidance="Keep the page short.",
            auto_commit=False,
        )
    )

    result = app.workflows.queue.drain(DrainRunQueueRequest())
    runs = app.runs.list(ListRunsRequest(repository_name=repo.name))
    log = app.runs.log(
        ReadRunLogRequest(repository_name=repo.name, run_id=queued.run_id)
    )
    matches = app.search.search(SearchPagesRequest(cwd=repo, query="worker"))

    assert result.lock_acquired is True
    assert [record.run_id for record in result.processed] == [queued.run_id]
    assert runs[0].status == RunStatus.DONE
    assert runs[0].summary == "queued ingest completed"
    assert matches[0].slug == "queued-note"
    assert len(harness.requests) == 1
    assert "Keep the page short." in harness.requests[0].prompt
    assert '"auto_commit": false' in harness.requests[0].prompt
    assert "Do not run git commit." in harness.requests[0].prompt
    assert tuple(event.message for event in log[:2]) == (
        "queued ingest",
        "running",
    )


def test_run_queue_skips_cancelled_queued_runs(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("cancelled queue note\n", encoding="utf-8")
    harness = QueueWritingHarnessAdapter()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(harness,),
    )
    initialize_repository(app, repo)
    queued = app.workflows.queue.queue_ingest(
        IngestRequest(
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
        )
    )
    app.runs.cancel(CancelRunRequest(repository_name=repo.name, run_id=queued.run_id))

    result = app.workflows.queue.drain(DrainRunQueueRequest())
    runs = app.runs.list(ListRunsRequest(repository_name=repo.name))

    assert result.lock_acquired is True
    assert result.processed == ()
    assert runs[0].status == RunStatus.CANCELLED
    assert harness.requests == []


def test_worker_command_targets_codealmanac_module(tmp_path: Path):
    command = worker_command(SpawnRunWorkerRequest(cwd=tmp_path))

    assert command[1:] == [
        "-m",
        "codealmanac.cli.main",
        "__run-worker",
        "--cwd",
        str(tmp_path),
    ]


def initialize_git(repo: Path) -> None:
    run_git(repo, "init")


def commit_all(repo: Path, message: str) -> None:
    run_git(repo, "add", ".")
    run_git(
        repo,
        "-c",
        "user.email=agent@example.com",
        "-c",
        "user.name=CodeAlmanac Test",
        "commit",
        "-m",
        message,
    )


def run_git(repo: Path, *args: str) -> None:
    subprocess.run(
        ("git", *args),
        cwd=repo,
        text=True,
        capture_output=True,
        check=True,
    )
