import subprocess
from pathlib import Path

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.core.paths import default_jobs_path
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
from codealmanac.wiki.search.requests import SearchPagesRequest
from codealmanac.wiki.workspaces.identity import workspace_id_for
from codealmanac.wiki.workspaces.requests import InitializeWorkspaceRequest
from codealmanac.workflows.ingest.requests import RunIngestRequest
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
        page = request.cwd / "almanac/pages/queued-note.md"
        page.write_text(
            """---
title: Queued Note
topics: [concepts]
sources:
  - id: note
    type: file
    target: note.md
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


def workspace_jobs_path(repo: Path) -> Path:
    return default_jobs_path() / workspace_id_for(repo)


def test_run_queue_background_start_persists_spec_and_spawns_worker(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("queue design note\n", encoding="utf-8")
    spawner = FakeWorkerSpawner()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(QueueWritingHarnessAdapter(),),
        worker_spawner=spawner,
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))

    result = app.workflows.queue.start_ingest_background(
        RunIngestRequest(
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
        )
    )
    runs = app.runs.list(ListRunsRequest(cwd=repo))

    assert result.worker.child_pid == 4242
    assert result.run.status == RunStatus.QUEUED
    assert runs[0].run_id == result.run.run_id
    assert spawner.requests == [SpawnRunWorkerRequest(cwd=repo, wiki=None)]
    assert (workspace_jobs_path(repo) / f"{result.run.run_id}.spec.json").is_file()


def test_run_queue_drains_persisted_ingest_spec(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("queue design note\n", encoding="utf-8")
    harness = QueueWritingHarnessAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(harness,),
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    queued = app.workflows.queue.queue_ingest(
        RunIngestRequest(
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
            title="Ingest queued note",
            guidance="Keep the page short.",
        )
    )

    result = app.workflows.queue.drain(DrainRunQueueRequest(cwd=repo))
    runs = app.runs.list(ListRunsRequest(cwd=repo))
    log = app.runs.log(ReadRunLogRequest(cwd=repo, run_id=queued.run_id))
    matches = app.search.search(SearchPagesRequest(cwd=repo, query="worker"))

    assert result.lock_acquired is True
    assert [record.run_id for record in result.processed] == [queued.run_id]
    assert runs[0].status == RunStatus.DONE
    assert runs[0].summary == "queued ingest completed"
    assert matches[0].slug == "queued-note"
    assert len(harness.requests) == 1
    assert "Keep the page short." in harness.requests[0].prompt
    assert tuple(event.message for event in log[:2]) == (
        "queued ingest",
        "running",
    )
    assert not (workspace_jobs_path(repo) / "worker.lock").exists()


def test_run_queue_skips_cancelled_queued_runs(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("cancelled queue note\n", encoding="utf-8")
    harness = QueueWritingHarnessAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(harness,),
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    queued = app.workflows.queue.queue_ingest(
        RunIngestRequest(
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
        )
    )
    app.runs.cancel(CancelRunRequest(cwd=repo, run_id=queued.run_id))

    result = app.workflows.queue.drain(DrainRunQueueRequest(cwd=repo))
    runs = app.runs.list(ListRunsRequest(cwd=repo))

    assert result.lock_acquired is True
    assert result.processed == ()
    assert runs[0].status == RunStatus.CANCELLED
    assert harness.requests == []


def test_worker_command_targets_codealmanac_module(tmp_path: Path):
    command = worker_command(SpawnRunWorkerRequest(cwd=tmp_path, wiki="docs"))

    assert command[1:] == [
        "-m",
        "codealmanac.cli.main",
        "__run-worker",
        "--cwd",
        str(tmp_path),
        "--wiki",
        "docs",
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
