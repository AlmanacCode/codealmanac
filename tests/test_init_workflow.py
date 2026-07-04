import subprocess
from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.core.errors import ValidationFailed
from codealmanac.core.models import AppConfig
from codealmanac.engine.harnesses.models import (
    HarnessEvent,
    HarnessEventKind,
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
)
from codealmanac.engine.harnesses.requests import RunHarnessRequest
from codealmanac.runs.ledger.models import (
    RunKind,
    RunStatus,
    RunWorkerSpawnResult,
)
from codealmanac.runs.ledger.requests import (
    ListRunsRequest,
    ReadRunLogRequest,
    SpawnRunWorkerRequest,
)
from codealmanac.runs.queue.requests import DrainRunQueueRequest
from codealmanac.wiki.search.requests import SearchPagesRequest
from codealmanac.wiki.workspaces.requests import InitializeWorkspaceRequest
from codealmanac.workflows.init.requests import RunInitRequest


class InitWritingHarnessAdapter:
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
        page = request.cwd / "almanac/pages/initialized-note.md"
        page.write_text(
            """---
title: Initialized Note
topics: [concepts]
sources: []
---
# Initialized Note

The init workflow built the first durable wiki page.
""",
            encoding="utf-8",
        )
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="initialized wiki",
            summary="initialized wiki",
            changed_files=(page,),
        )


class CustomRootInitHarnessAdapter(InitWritingHarnessAdapter):
    def __init__(self, almanac_root: Path):
        super().__init__()
        self.almanac_root = almanac_root

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        self.requests.append(request)
        page = request.cwd / self.almanac_root / "pages/initialized-note.md"
        page.write_text(
            """---
title: Initialized Note
topics: [concepts]
sources: []
---
# Initialized Note

The custom-root init workflow built this page.
""",
            encoding="utf-8",
        )
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="initialized custom wiki",
            summary="initialized custom wiki",
            changed_files=(page,),
        )


class StreamingInitHarnessAdapter(InitWritingHarnessAdapter):
    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        event = HarnessEvent(
            kind=HarnessEventKind.TEXT,
            message="live init event",
        )
        if request.event_sink is not None:
            request.event_sink(event)
        result = super().run(request)
        return result.model_copy(update={"events": (event,)})


class InitWorkerSpawner:
    def __init__(self):
        self.requests: list[SpawnRunWorkerRequest] = []

    def spawn(self, request: SpawnRunWorkerRequest) -> RunWorkerSpawnResult:
        self.requests.append(request)
        return RunWorkerSpawnResult(
            child_pid=9191,
            command=("fake-codealmanac-worker",),
        )


def test_init_workflow_runs_harness_and_refreshes_index(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    initialize_git(repo)
    harness = InitWritingHarnessAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(harness,),
    )

    result = app.workflows.init.run(
        RunInitRequest(
            path=repo,
            harness=HarnessKind.CODEX,
            guidance="Keep the first page short.",
        )
    )
    matches = app.search.search(SearchPagesRequest(cwd=repo, query="durable"))
    log = app.runs.log(ReadRunLogRequest(cwd=repo, run_id=result.run.run_id))

    assert result.run.kind == RunKind.INIT
    assert result.run.status == RunStatus.DONE
    assert result.run.summary == "initialized wiki"
    assert result.existing_page_count == 0
    assert result.index.pages_indexed == 2
    assert matches[0].slug == "initialized-note"
    assert "Init Operation" in harness.requests[0].prompt
    assert "Phase 1: Scan And Plan" in harness.requests[0].prompt
    assert "Keep the first page short." in harness.requests[0].prompt
    assert "verified almanac mutation boundary preflight" in {
        entry.message for entry in log
    }


def test_init_workflow_refuses_populated_wiki_without_force(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(InitWritingHarnessAdapter(),),
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))

    with pytest.raises(ValidationFailed, match="pass --force to rebuild"):
        app.workflows.init.run(
            RunInitRequest(
                path=repo,
                harness=HarnessKind.CODEX,
            )
        )


def test_init_workflow_force_runs_on_populated_wiki(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    initialize_git(repo)
    harness = InitWritingHarnessAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(harness,),
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))

    result = app.workflows.init.run(
        RunInitRequest(
            path=repo,
            harness=HarnessKind.CODEX,
            force=True,
        )
    )

    assert result.run.status == RunStatus.DONE
    assert result.existing_page_count == 1
    assert len(harness.requests) == 1


def test_init_workflow_uses_selected_root_for_page_run_boundary(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    initialize_git(repo)
    custom_root = Path("custom-wiki")
    harness = CustomRootInitHarnessAdapter(custom_root)
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(harness,),
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    commit_all(repo, "default wiki")

    result = app.workflows.init.run(
        RunInitRequest(
            path=repo,
            almanac_root=custom_root,
            harness=HarnessKind.CODEX,
        )
    )
    log = app.runs.log(ReadRunLogRequest(cwd=repo, run_id=result.run.run_id))

    assert result.run.status == RunStatus.DONE
    assert result.workspace.almanac_root == custom_root
    assert "custom-wiki" in harness.requests[0].prompt
    assert (repo / "custom-wiki/pages/initialized-note.md").is_file()
    assert "verified custom-wiki mutation boundary preflight" in {
        entry.message for entry in log
    }


def test_init_workflow_records_streamed_harness_events_once(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    initialize_git(repo)
    harness = StreamingInitHarnessAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(harness,),
    )

    result = app.workflows.init.run(
        RunInitRequest(path=repo, harness=HarnessKind.CODEX)
    )
    log = app.runs.log(ReadRunLogRequest(cwd=repo, run_id=result.run.run_id))

    assert result.run.status == RunStatus.DONE
    assert [entry.message for entry in log].count("live init event") == 1


def test_init_background_queues_spec_and_worker_drains_it(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    initialize_git(repo)
    harness = InitWritingHarnessAdapter()
    spawner = InitWorkerSpawner()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(harness,),
        worker_spawner=spawner,
    )

    started = app.workflows.queue.start_init_background(
        RunInitRequest(
            path=repo,
            harness=HarnessKind.CODEX,
            name="repo",
        )
    )
    drained = app.workflows.queue.drain(DrainRunQueueRequest(cwd=repo))
    runs = app.runs.list(ListRunsRequest(cwd=repo))

    assert started.worker.child_pid == 9191
    assert started.run.kind == RunKind.INIT
    assert started.run.status == RunStatus.QUEUED
    assert drained.lock_acquired is True
    assert [record.run_id for record in drained.processed] == [started.run.run_id]
    assert runs[0].status == RunStatus.DONE
    assert runs[0].summary == "initialized wiki"
    assert harness.requests[0].cwd == repo
    assert spawner.requests == [SpawnRunWorkerRequest(cwd=repo, wiki=None)]


def initialize_git(repo: Path) -> None:
    subprocess.run(
        ("git", "init", "-q"),
        cwd=repo,
        text=True,
        capture_output=True,
        check=True,
    )


def commit_all(repo: Path, message: str) -> None:
    subprocess.run(
        ("git", "add", "."),
        cwd=repo,
        text=True,
        capture_output=True,
        check=True,
    )
    subprocess.run(
        (
            "git",
            "-c",
            "user.email=agent@example.com",
            "-c",
            "user.name=CodeAlmanac Test",
            "commit",
            "-m",
            message,
        ),
        cwd=repo,
        text=True,
        capture_output=True,
        check=True,
    )
