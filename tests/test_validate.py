import subprocess
from pathlib import Path

import pytest
from conftest import initialize_repository

from codealmanac.app import create_app
from codealmanac.cli.main import main
from codealmanac.core.errors import ValidationFailed
from codealmanac.services.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest
from codealmanac.services.health.requests import ValidateWikiRequest
from codealmanac.services.runs.models import RunStatus
from codealmanac.services.runs.requests import ListRunsRequest
from codealmanac.settings import AppConfig
from codealmanac.workflows.ingest.requests import IngestRequest


def test_validate_passes_starter_wiki(tmp_path: Path, isolated_home: Path):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    initialize_repository(app, path=repo)

    result = app.health.validate(ValidateWikiRequest(cwd=repo))

    assert result.ok is True
    assert result.issues == ()
    assert result.index is not None
    assert result.index.pages_indexed == 1


def test_validate_reports_broken_markdown_links(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = initialized_repo(tmp_path, isolated_home)
    write_page(repo, "auth-flow.md", "# Auth Flow\n\nSee [Missing](missing-page).\n")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    result = app.health.validate(ValidateWikiRequest(cwd=repo))

    assert result.ok is False
    assert ("broken_links", "auth-flow") in {
        (issue.category, issue.page) for issue in result.issues
    }


def test_validate_reports_route_collisions_without_traceback(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = initialized_repo(tmp_path, isolated_home)
    write_page(repo, "architecture.md", "# Architecture\n\nPage.\n")
    write_page(repo, "architecture/README.md", "# Architecture\n\nFolder page.\n")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    result = app.health.validate(ValidateWikiRequest(cwd=repo))

    assert result.ok is False
    assert result.index is None
    assert [issue.category for issue in result.issues] == ["page_routes"]
    assert "page route collision" in result.issues[0].message


def test_validate_reports_invalid_source_shape(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = initialized_repo(tmp_path, isolated_home)
    write_page(
        repo,
        "source-shape.md",
        """---
title: Source Shape
topics: [concepts]
sources:
  - id: missing-target
    type: file
---
# Source Shape

The source entry is malformed.
""",
    )
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    result = app.health.validate(ValidateWikiRequest(cwd=repo))

    assert result.ok is False
    assert ("sources", "source-shape") in {
        (issue.category, issue.page) for issue in result.issues
    }


def test_validate_reports_runtime_state_leaks(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = initialized_repo(tmp_path, isolated_home)
    (repo / "almanac/index.db").write_text("runtime leak\n", encoding="utf-8")
    (repo / "almanac/jobs").mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    result = app.health.validate(ValidateWikiRequest(cwd=repo))

    assert result.ok is False
    runtime_paths = {
        issue.path for issue in result.issues if issue.category == "runtime_state"
    }
    assert runtime_paths == {"index.db", "jobs"}


def test_cli_validate_returns_nonzero_for_issues(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
):
    repo = initialized_repo(tmp_path, isolated_home)
    write_page(repo, "auth-flow.md", "# Auth Flow\n\nSee [Missing](missing-page).\n")
    monkeypatch.chdir(repo)

    exit_code = main(["validate"])

    output = capsys.readouterr()
    assert exit_code == 1
    assert "validate: failed\n" in output.out
    assert "(broken_links)" in output.out
    assert "auth-flow" in output.out


def test_lifecycle_run_fails_when_validation_fails(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("note\n", encoding="utf-8")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(InvalidSourceHarnessAdapter(),),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    with pytest.raises(ValidationFailed, match="validation failed"):
        app.workflows.ingest.run(
            IngestRequest(
                cwd=repo,
                inputs=("note.md",),
                harness=HarnessKind.CODEX,
            model="gpt-5.5",
            )
        )

    run = app.runs.list(ListRunsRequest(repository_name="repo"))[0]
    assert run.status == RunStatus.FAILED
    assert run.error is not None
    assert run.error.startswith("validation failed")


class InvalidSourceHarnessAdapter:
    kind = HarnessKind.CODEX

    def check(self) -> HarnessReadiness:
        return HarnessReadiness(
            kind=self.kind,
            available=True,
            message="codex ready",
        )

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        page = request.cwd / "almanac/invalid-source.md"
        page.write_text(
            """---
title: Invalid Source
topics: [concepts]
sources:
  - id: missing-target
    type: file
---
# Invalid Source

The harness wrote a page with invalid source metadata.
""",
            encoding="utf-8",
        )
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="updated wiki",
            summary="updated wiki",
            changed_files=(page,),
        )


def initialized_repo(tmp_path: Path, isolated_home: Path) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    initialize_repository(app, path=repo)
    return repo


def write_page(repo: Path, name: str, body: str) -> None:
    path = repo / "almanac" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")


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
