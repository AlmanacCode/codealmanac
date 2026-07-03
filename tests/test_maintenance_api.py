import subprocess
from pathlib import Path

import pytest
from pydantic import ValidationError

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.engine.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
)
from codealmanac.engine.harnesses.requests import RunHarnessRequest
from codealmanac.jobs.ledger.models import JobStatus
from codealmanac.maintenance import (
    MaintenanceOperation,
    RunMaintenanceRequest,
    run_maintenance,
)
from codealmanac.wiki.search.requests import SearchPagesRequest
from codealmanac.wiki.workspaces.requests import InitializeWorkspaceRequest


class MaintenanceWritingHarnessAdapter:
    kind = HarnessKind.CODEX

    def __init__(self, page_slug: str, summary: str, output_text: str):
        self.page_slug = page_slug
        self.summary = summary
        self.output_text = output_text
        self.requests: list[RunHarnessRequest] = []

    def check(self) -> HarnessReadiness:
        return HarnessReadiness(
            kind=self.kind,
            available=True,
            message="codex ready",
        )

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        self.requests.append(request)
        page = request.cwd / f"almanac/pages/{self.page_slug}.md"
        page.write_text(
            """---
title: Maintenance Page
topics: [getting-started]
sources: []
---
# Maintenance Page

The maintenance API wrote this durable page.
""",
            encoding="utf-8",
        )
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text=self.output_text,
            summary=self.summary,
            changed_files=(page,),
        )


def test_run_maintenance_routes_ingest_to_ingest_workflow(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("capture source\n", encoding="utf-8")
    harness = MaintenanceWritingHarnessAdapter(
        "maintenance-ingest",
        "ingested maintenance source",
        "updated wiki from maintenance source",
    )
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(harness,),
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    result = run_maintenance(
        RunMaintenanceRequest(
            operation=MaintenanceOperation.INGEST,
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
            title="Hosted maintenance ingest",
            guidance="Keep the page terse.",
        ),
        app=app,
    )
    matches = app.search.search(SearchPagesRequest(cwd=repo, query="durable"))

    assert result.operation == MaintenanceOperation.INGEST
    assert result.job_status == JobStatus.DONE
    assert result.harness_status == HarnessRunStatus.SUCCEEDED
    assert result.summary == "ingested maintenance source"
    assert result.output_text == "updated wiki from maintenance source"
    assert result.job_id
    assert matches[0].slug == "maintenance-ingest"
    assert harness.requests[0].title == "Hosted maintenance ingest"
    assert "Keep the page terse." in harness.requests[0].prompt
    assert "capture source" in harness.requests[0].prompt


def test_run_maintenance_routes_init_to_init_workflow(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    initialize_git(repo)
    harness = MaintenanceWritingHarnessAdapter(
        "maintenance-init",
        "initialized maintenance wiki",
        "initialized wiki from maintenance api",
    )
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(harness,),
    )

    result = run_maintenance(
        RunMaintenanceRequest(
            operation=MaintenanceOperation.INIT,
            cwd=repo,
            harness=HarnessKind.CODEX,
            name="repo",
            description="Repository wiki maintained by CodeAlmanac.",
            title="Hosted maintenance init",
            guidance="Write one starting page.",
        ),
        app=app,
    )
    matches = app.search.search(SearchPagesRequest(cwd=repo, query="durable"))

    assert result.operation == MaintenanceOperation.INIT
    assert result.job_status == JobStatus.DONE
    assert result.harness_status == HarnessRunStatus.SUCCEEDED
    assert result.summary == "initialized maintenance wiki"
    assert result.output_text == "initialized wiki from maintenance api"
    assert matches[0].slug == "maintenance-init"
    assert harness.requests[0].title == "Hosted maintenance init"
    assert "Write one starting page." in harness.requests[0].prompt


def test_maintenance_request_validates_operation_specific_fields(tmp_path: Path):
    with pytest.raises(ValidationError, match="ingest maintenance request requires"):
        RunMaintenanceRequest(operation=MaintenanceOperation.INGEST, cwd=tmp_path)

    with pytest.raises(ValidationError, match="init maintenance request"):
        RunMaintenanceRequest(
            operation=MaintenanceOperation.INIT,
            cwd=tmp_path,
            inputs=("note.md",),
        )

    with pytest.raises(ValidationError, match="does not accept almanac_root"):
        RunMaintenanceRequest(
            operation=MaintenanceOperation.INGEST,
            cwd=tmp_path,
            inputs=("note.md",),
            almanac_root=Path("docs/almanac"),
        )


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
