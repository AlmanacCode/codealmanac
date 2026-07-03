import subprocess
from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.core.errors import ExecutionFailed, ValidationFailed
from codealmanac.core.models import AppConfig
from codealmanac.services.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
    HarnessTranscriptRef,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest
from codealmanac.services.runs.models import RunEventKind, RunStatus
from codealmanac.services.runs.requests import ListRunsRequest, ReadRunLogRequest
from codealmanac.wiki.search.requests import SearchPagesRequest
from codealmanac.wiki.workspaces.requests import InitializeWorkspaceRequest
from codealmanac.workflows.garden.requests import RunGardenRequest


class GardenWritingHarnessAdapter:
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
        page = request.cwd / "almanac/pages/gardened-note.md"
        page.write_text(
            """---
title: Gardened Note
topics: [getting-started]
sources: []
---
# Gardened Note

Garden preserved one coherent wiki improvement.
""",
            encoding="utf-8",
        )
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="updated wiki graph",
            summary="gardened wiki graph",
            changed_files=(page,),
            transcript=HarnessTranscriptRef(
                kind=self.kind,
                session_id="codex-garden-session",
                transcript_path=request.cwd / "codex-garden.jsonl",
            ),
        )


class DirtyAppGardenHarnessAdapter(GardenWritingHarnessAdapter):
    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        result = super().run(request)
        (request.cwd / "src/app.py").write_text("agent mutation\n", encoding="utf-8")
        return result


class FailedGardenHarnessAdapter(GardenWritingHarnessAdapter):
    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        self.requests.append(request)
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.FAILED,
            output_text="garden agent failed",
            transcript=HarnessTranscriptRef(
                kind=self.kind,
                session_id="failed-garden-session",
            ),
        )


def test_garden_workflow_runs_harness_and_refreshes_index(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    adapter = GardenWritingHarnessAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(adapter,),
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    result = app.workflows.garden.run(
        RunGardenRequest(
            cwd=repo,
            harness=HarnessKind.CODEX,
            title="Garden wiki",
            guidance="Improve a single page if useful.",
        )
    )

    matches = app.search.search(SearchPagesRequest(cwd=repo, query="coherent"))
    log = app.runs.log(ReadRunLogRequest(cwd=repo, run_id=result.run.run_id))

    assert result.run.status == RunStatus.DONE
    assert result.run.started_at is not None
    assert result.run.finished_at is not None
    assert result.run.summary == "gardened wiki graph"
    assert result.run.harness_transcript is not None
    assert result.run.harness_transcript.session_id == "codex-garden-session"
    assert result.health_before.empty_pages == ()
    assert result.harness.changed_files == (
        repo / "almanac/pages/gardened-note.md",
    )
    assert result.safety.changed_files == (
        repo / "almanac/pages/gardened-note.md",
    )
    assert result.index.pages_indexed == 2
    assert matches[0].slug == "gardened-note"
    assert "Garden Operation" in adapter.requests[0].prompt
    assert "Runtime context:" in adapter.requests[0].prompt
    assert '"pages_root"' in adapter.requests[0].prompt
    assert "Improve a single page if useful." in adapter.requests[0].prompt
    assert tuple(entry.kind for entry in log) == (
        RunEventKind.STATUS,
        RunEventKind.STATUS,
        RunEventKind.MESSAGE,
        RunEventKind.MESSAGE,
        RunEventKind.OUTPUT,
        RunEventKind.STATUS,
    )
    assert log[1].message == RunStatus.RUNNING.value


def test_garden_workflow_rejects_harness_mutation_outside_almanac(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "src").mkdir()
    (repo / "src/app.py").write_text("clean\n", encoding="utf-8")
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(DirtyAppGardenHarnessAdapter(),),
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    with pytest.raises(ValidationFailed):
        app.workflows.garden.run(
            RunGardenRequest(
                cwd=repo,
                harness=HarnessKind.CODEX,
            )
        )

    run = app.runs.list(ListRunsRequest(cwd=repo))[0]

    assert run.status == RunStatus.FAILED
    assert run.error == "garden changed file outside almanac: src/app.py"


def test_garden_workflow_records_failed_harness_output_before_error(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(FailedGardenHarnessAdapter(),),
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    with pytest.raises(ExecutionFailed, match="harness codex failed"):
        app.workflows.garden.run(
            RunGardenRequest(
                cwd=repo,
                harness=HarnessKind.CODEX,
            )
        )

    run = app.runs.list(ListRunsRequest(cwd=repo))[0]
    log = app.runs.log(ReadRunLogRequest(cwd=repo, run_id=run.run_id))

    assert run.status == RunStatus.FAILED
    assert run.error == "harness codex failed with status failed: garden agent failed"
    assert run.harness_transcript is not None
    assert run.harness_transcript.session_id == "failed-garden-session"
    assert tuple(entry.kind for entry in log)[-3:] == (
        RunEventKind.OUTPUT,
        RunEventKind.ERROR,
        RunEventKind.STATUS,
    )
    assert log[-3].message == "codex failed: garden agent failed"


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
