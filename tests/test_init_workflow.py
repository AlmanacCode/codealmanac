import subprocess
from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.core.errors import ValidationFailed
from codealmanac.core.models import AppConfig
from codealmanac.engine.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
)
from codealmanac.engine.harnesses.requests import RunHarnessRequest
from codealmanac.jobs.ledger.models import (
    JobOperation,
    JobStatus,
    JobWorkerSpawnResult,
)
from codealmanac.jobs.ledger.requests import (
    ListJobsRequest,
    ReadJobLogRequest,
    SpawnJobWorkerRequest,
)
from codealmanac.jobs.queue.requests import DrainJobQueueRequest
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


class InitWorkerSpawner:
    def __init__(self):
        self.requests: list[SpawnJobWorkerRequest] = []

    def spawn(self, request: SpawnJobWorkerRequest) -> JobWorkerSpawnResult:
        self.requests.append(request)
        return JobWorkerSpawnResult(
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
    log = app.jobs.log(ReadJobLogRequest(cwd=repo, job_id=result.job.job_id))

    assert result.job.operation == JobOperation.INIT
    assert result.job.status == JobStatus.DONE
    assert result.job.summary == "initialized wiki"
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

    assert result.job.status == JobStatus.DONE
    assert result.existing_page_count == 1
    assert len(harness.requests) == 1


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
    drained = app.workflows.queue.drain(DrainJobQueueRequest(cwd=repo))
    runs = app.jobs.list(ListJobsRequest(cwd=repo))

    assert started.worker.child_pid == 9191
    assert started.job.operation == JobOperation.INIT
    assert started.job.status == JobStatus.QUEUED
    assert drained.lock_acquired is True
    assert [record.job_id for record in drained.processed] == [started.job.job_id]
    assert runs[0].status == JobStatus.DONE
    assert runs[0].summary == "initialized wiki"
    assert harness.requests[0].cwd == repo
    assert spawner.requests == [SpawnJobWorkerRequest(cwd=repo, wiki=None)]


def initialize_git(repo: Path) -> None:
    subprocess.run(
        ("git", "init", "-q"),
        cwd=repo,
        text=True,
        capture_output=True,
        check=True,
    )
