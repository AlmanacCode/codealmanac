import subprocess
from pathlib import Path

import pytest
from conftest import initialize_repository

from codealmanac.app import create_app
from codealmanac.core.errors import ExecutionFailed
from codealmanac.services.harnesses.models import (
    HarnessAgentKind,
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
    HarnessTranscriptRef,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest
from codealmanac.services.runs.models import RunEventKind, RunStatus
from codealmanac.services.runs.requests import ListRunsRequest, ReadRunLogRequest
from codealmanac.services.search.requests import SearchPagesRequest
from codealmanac.settings import AppConfig
from codealmanac.workflows.garden.requests import GardenRequest, StartedGardenRequest


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

    def run(self, request: RunHarnessRequest, on_event=None) -> HarnessRunResult:
        self.requests.append(request)
        page = request.cwd / "almanac/gardened-note.md"
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
    def run(self, request: RunHarnessRequest, on_event=None) -> HarnessRunResult:
        result = super().run(request)
        (request.cwd / "src/app.py").write_text("agent mutation\n", encoding="utf-8")
        return result


class FailedGardenHarnessAdapter(GardenWritingHarnessAdapter):
    def run(self, request: RunHarnessRequest, on_event=None) -> HarnessRunResult:
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


def run_garden(app, request: GardenRequest):
    queued = app.workflows.queue.queue_garden(request)
    return app.workflows.garden.execute_started(
        StartedGardenRequest(
            cwd=request.cwd,
            repository_name=request.repository_name,
            harness=request.harness,
            model=request.model,
            title=request.title,
            guidance=request.guidance,
            auto_commit=request.auto_commit,
            run_id=queued.run_id,
        )
    )


def test_garden_workflow_runs_harness_and_refreshes_index(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    adapter = GardenWritingHarnessAdapter()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(adapter,),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    result = run_garden(
        app,
        GardenRequest(
            cwd=repo,
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
            title="Garden wiki",
            guidance="Improve a single page if useful.",
        ),
    )

    matches = app.search.search(SearchPagesRequest(cwd=repo, query="coherent"))
    log = app.runs.log(ReadRunLogRequest(run_id=result.run.run_id))

    assert result.run.status == RunStatus.DONE
    assert result.run.started_at is not None
    assert result.run.finished_at is not None
    assert result.run.summary == "gardened wiki graph"
    assert result.run.harness_transcript is not None
    assert result.run.harness_transcript.session_id == "codex-garden-session"
    assert result.health_before.empty_pages == ()
    assert result.harness.changed_files == (repo / "almanac/gardened-note.md",)
    assert result.index.pages_indexed == 2
    assert matches[0].slug == "gardened-note"
    assert adapter.requests[0].agent is HarnessAgentKind.GARDEN
    assert adapter.requests[0].prompt.startswith("Runtime context:\n{")
    assert "Garden Operation" not in adapter.requests[0].prompt
    assert "Runtime context:" in adapter.requests[0].prompt
    assert '"wiki_source_root"' in adapter.requests[0].prompt
    assert '"source_control": {' in adapter.requests[0].prompt
    assert '"auto_commit": true' in adapter.requests[0].prompt
    assert "Use normal git commands from the repository root." in (
        adapter.requests[0].prompt
    )
    assert "Improve a single page if useful." in adapter.requests[0].prompt
    assert tuple(entry.kind for entry in log) == (
        RunEventKind.STATUS,
        RunEventKind.STATUS,
        RunEventKind.MESSAGE,
        RunEventKind.OUTPUT,
        RunEventKind.STATUS,
    )
    assert log[1].message == RunStatus.RUNNING.value


def test_garden_prompt_disables_commit_policy(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    adapter = GardenWritingHarnessAdapter()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(adapter,),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    run_garden(
        app,
        GardenRequest(
            cwd=repo,
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
            auto_commit=False,
        ),
    )

    assert '"auto_commit": false' in adapter.requests[0].prompt
    assert "Do not run git commit." in adapter.requests[0].prompt
    assert "Do not stage files." in adapter.requests[0].prompt


def test_garden_workflow_allows_preexisting_dirty_almanac_edits(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    adapter = GardenWritingHarnessAdapter()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(adapter,),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    getting_started = repo / "almanac/README.md"
    getting_started.write_text(
        getting_started.read_text(encoding="utf-8")
        + "\nUser started a local wiki edit.\n",
        encoding="utf-8",
    )

    result = run_garden(
        app,
        GardenRequest(
            cwd=repo,
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
        ),
    )

    assert result.run.status == RunStatus.DONE
    assert "User started a local wiki edit." in getting_started.read_text(
        encoding="utf-8"
    )


def test_garden_workflow_allows_harness_mutation_outside_almanac(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "src").mkdir()
    (repo / "src/app.py").write_text("clean\n", encoding="utf-8")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(DirtyAppGardenHarnessAdapter(),),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    result = run_garden(
        app,
        GardenRequest(
            cwd=repo,
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
        ),
    )

    run = app.runs.list(ListRunsRequest(repository_name="repo"))[0]

    assert result.run.status == RunStatus.DONE
    assert run.status == RunStatus.DONE
    assert run.error is None
    assert (repo / "src/app.py").read_text(encoding="utf-8") == "agent mutation\n"


def test_garden_workflow_records_failed_harness_output_before_error(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(FailedGardenHarnessAdapter(),),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    with pytest.raises(ExecutionFailed, match="harness codex failed"):
        run_garden(
            app,
            GardenRequest(
                cwd=repo,
                harness=HarnessKind.CODEX,
                model="gpt-5.5",
            ),
        )

    run = app.runs.list(ListRunsRequest(repository_name="repo"))[0]
    log = app.runs.log(ReadRunLogRequest(run_id=run.run_id))

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
