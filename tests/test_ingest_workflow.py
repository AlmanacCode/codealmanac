import subprocess
from pathlib import Path

import pytest
from pydantic import ValidationError

from codealmanac.app import create_app
from codealmanac.core.errors import ExecutionFailed, NotFoundError, ValidationFailed
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
from codealmanac.services.search.requests import SearchPagesRequest
from codealmanac.services.sources.models import (
    SourceKind,
    SourceRef,
    SourceRuntime,
    SourceRuntimeStatus,
)
from codealmanac.services.sources.requests import InspectSourceRuntimeRequest
from codealmanac.services.workspaces.requests import InitializeWorkspaceRequest
from codealmanac.workflows.ingest.requests import RunIngestRequest


class WritingHarnessAdapter:
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
        page = request.cwd / ".almanac/pages/ingested-note.md"
        page.write_text(
            """---
title: Ingested Note
topics: [getting-started]
sources:
  - id: note
    type: file
    target: note.md
---
# Ingested Note

Ingested durable wiki knowledge from the note.
""",
            encoding="utf-8",
        )
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="updated wiki",
            summary="ingested note",
            changed_files=(page,),
            transcript=HarnessTranscriptRef(
                kind=self.kind,
                session_id="codex-ingest-session",
                transcript_path=request.cwd / "codex-ingest.jsonl",
            ),
        )


class UnsafeHarnessAdapter(WritingHarnessAdapter):
    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        self.requests.append(request)
        outside = request.cwd / "README.md"
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="changed the wrong file",
            changed_files=(outside,),
        )


class FailedHarnessAdapter(WritingHarnessAdapter):
    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        self.requests.append(request)
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.FAILED,
            output_text="agent failed",
            transcript=HarnessTranscriptRef(
                kind=self.kind,
                session_id="failed-ingest-session",
            ),
        )


class DirtyFileMutatingHarnessAdapter(WritingHarnessAdapter):
    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        self.requests.append(request)
        page = request.cwd / ".almanac/pages/ingested-note.md"
        page.write_text(
            """---
title: Ingested Note
topics: [getting-started]
sources: []
---
# Ingested Note

Ingested durable wiki knowledge from the note.
""",
            encoding="utf-8",
        )
        (request.cwd / "src/app.py").write_text("agent mutation\n", encoding="utf-8")
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="updated wiki",
            summary="ingested note",
            changed_files=(page,),
        )


class FailedDirtyFileMutatingHarnessAdapter(WritingHarnessAdapter):
    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        self.requests.append(request)
        (request.cwd / "src/app.py").write_text("agent mutation\n", encoding="utf-8")
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.FAILED,
            output_text="agent failed after mutation",
        )


class FakeSourceRuntimeAdapter:
    def supports(self, ref: SourceRef) -> bool:
        return ref.kind in {
            SourceKind.GIT_DIFF,
            SourceKind.GITHUB_PULL_REQUEST,
        }

    def inspect(self, request: InspectSourceRuntimeRequest) -> SourceRuntime:
        if request.ref.kind == SourceKind.GITHUB_PULL_REQUEST:
            return SourceRuntime(
                ref=request.ref,
                status=SourceRuntimeStatus.AVAILABLE,
                title="Fake GitHub PR",
                content="PR comment says preserve the auth decision history.",
            )
        return SourceRuntime(
            ref=request.ref,
            status=SourceRuntimeStatus.AVAILABLE,
            title="Fake Git diff",
            content="diff --git a/src/auth.py b/src/auth.py\n+new auth invariant",
        )


def test_ingest_workflow_resolves_sources_runs_harness_and_refreshes_index(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    adapter = WritingHarnessAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".almanac/registry.json"),
        harness_adapters=(adapter,),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    result = app.workflows.ingest.run(
        RunIngestRequest(
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
            title="Ingest note",
            guidance="Prefer short pages.",
        )
    )

    matches = app.search.search(SearchPagesRequest(cwd=repo, query="durable"))
    log = app.runs.log(ReadRunLogRequest(cwd=repo, run_id=result.run.run_id))

    assert result.run.status == RunStatus.DONE
    assert result.run.summary == "ingested note"
    assert result.run.harness_transcript is not None
    assert result.run.harness_transcript.session_id == "codex-ingest-session"
    assert result.sources[0].ref.fingerprint is not None
    assert result.source_runtime[0].status == SourceRuntimeStatus.SKIPPED
    assert result.harness.changed_files == (
        repo / ".almanac/pages/ingested-note.md",
    )
    assert result.safety.changed_files == (
        repo / ".almanac/pages/ingested-note.md",
    )
    assert result.index.pages_indexed == 2
    assert matches[0].slug == "ingested-note"
    assert "path.file" in adapter.requests[0].prompt
    assert '"source_runtime": [' in adapter.requests[0].prompt
    assert '"status": "skipped"' in adapter.requests[0].prompt
    assert "Prefer short pages." in adapter.requests[0].prompt
    assert "public CLI name is codealmanac" in adapter.requests[0].prompt
    assert tuple(entry.kind for entry in log) == (
        RunEventKind.STATUS,
        RunEventKind.MESSAGE,
        RunEventKind.MESSAGE,
        RunEventKind.MESSAGE,
        RunEventKind.OUTPUT,
        RunEventKind.STATUS,
    )


def test_ingest_prompt_includes_git_source_runtime(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    adapter = WritingHarnessAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".almanac/registry.json"),
        harness_adapters=(adapter,),
        source_runtime_adapters=(FakeSourceRuntimeAdapter(),),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    result = app.workflows.ingest.run(
        RunIngestRequest(
            cwd=repo,
            inputs=("git:diff",),
            harness=HarnessKind.CODEX,
        )
    )

    assert result.source_runtime[0].status == SourceRuntimeStatus.AVAILABLE
    assert "Fake Git diff" in adapter.requests[0].prompt
    assert "new auth invariant" in adapter.requests[0].prompt


def test_ingest_prompt_includes_github_source_runtime(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    adapter = WritingHarnessAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".almanac/registry.json"),
        harness_adapters=(adapter,),
        source_runtime_adapters=(FakeSourceRuntimeAdapter(),),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    result = app.workflows.ingest.run(
        RunIngestRequest(
            cwd=repo,
            inputs=("https://github.com/acme/project/pull/42",),
            harness=HarnessKind.CODEX,
        )
    )

    assert result.source_runtime[0].status == SourceRuntimeStatus.AVAILABLE
    assert "Fake GitHub PR" in adapter.requests[0].prompt
    assert "preserve the auth decision history" in adapter.requests[0].prompt


def test_ingest_workflow_fails_run_when_harness_is_missing(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    app = create_app(
        AppConfig(registry_path=isolated_home / ".almanac/registry.json"),
        harness_adapters=(),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    with pytest.raises(NotFoundError):
        app.workflows.ingest.run(
            RunIngestRequest(
                cwd=repo,
                inputs=("note.md",),
                harness=HarnessKind.CODEX,
            )
        )

    run = app.runs.list(ListRunsRequest(cwd=repo))[0]
    log = app.runs.log(ReadRunLogRequest(cwd=repo, run_id=run.run_id))

    assert run.status == RunStatus.FAILED
    assert run.error == "harness not found: codex"
    assert RunEventKind.ERROR in {entry.kind for entry in log}


def test_ingest_workflow_rejects_harness_changes_outside_almanac(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    app = create_app(
        AppConfig(registry_path=isolated_home / ".almanac/registry.json"),
        harness_adapters=(UnsafeHarnessAdapter(),),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    with pytest.raises(ValidationFailed):
        app.workflows.ingest.run(
            RunIngestRequest(
                cwd=repo,
                inputs=("note.md",),
                harness=HarnessKind.CODEX,
            )
        )

    run = app.runs.list(ListRunsRequest(cwd=repo))[0]

    assert run.status == RunStatus.FAILED
    assert run.error is not None
    assert run.error.startswith("harness reported change outside .almanac:")
    assert "README.md" in run.error


def test_ingest_workflow_fails_when_harness_returns_failed_status(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    app = create_app(
        AppConfig(registry_path=isolated_home / ".almanac/registry.json"),
        harness_adapters=(FailedHarnessAdapter(),),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    with pytest.raises(ExecutionFailed):
        app.workflows.ingest.run(
            RunIngestRequest(
                cwd=repo,
                inputs=("note.md",),
                harness=HarnessKind.CODEX,
            )
        )

    run = app.runs.list(ListRunsRequest(cwd=repo))[0]

    assert run.status == RunStatus.FAILED
    assert run.error == "harness codex failed with status failed: agent failed"
    assert run.harness_transcript is not None
    assert run.harness_transcript.session_id == "failed-ingest-session"


def test_ingest_workflow_checks_mutations_before_failed_harness_status(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    (repo / "src").mkdir()
    (repo / "src/app.py").write_text("clean\n", encoding="utf-8")
    app = create_app(
        AppConfig(registry_path=isolated_home / ".almanac/registry.json"),
        harness_adapters=(FailedDirtyFileMutatingHarnessAdapter(),),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    with pytest.raises(ValidationFailed):
        app.workflows.ingest.run(
            RunIngestRequest(
                cwd=repo,
                inputs=("note.md",),
                harness=HarnessKind.CODEX,
            )
        )

    run = app.runs.list(ListRunsRequest(cwd=repo))[0]

    assert run.status == RunStatus.FAILED
    assert run.error == "ingest changed file outside .almanac: src/app.py"


def test_ingest_workflow_allows_preexisting_dirty_app_files_when_unchanged(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    (repo / "src").mkdir()
    (repo / "src/app.py").write_text("clean\n", encoding="utf-8")
    adapter = WritingHarnessAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".almanac/registry.json"),
        harness_adapters=(adapter,),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    (repo / "src/app.py").write_text("user edit\n", encoding="utf-8")

    result = app.workflows.ingest.run(
        RunIngestRequest(
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
        )
    )

    assert result.run.status == RunStatus.DONE
    assert result.safety.changed_files == (
        repo / ".almanac/pages/ingested-note.md",
    )
    assert (repo / "src/app.py").read_text(encoding="utf-8") == "user edit\n"


def test_ingest_workflow_rejects_harness_mutation_to_dirty_app_file(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    (repo / "src").mkdir()
    (repo / "src/app.py").write_text("clean\n", encoding="utf-8")
    app = create_app(
        AppConfig(registry_path=isolated_home / ".almanac/registry.json"),
        harness_adapters=(DirtyFileMutatingHarnessAdapter(),),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    (repo / "src/app.py").write_text("user edit\n", encoding="utf-8")

    with pytest.raises(ValidationFailed):
        app.workflows.ingest.run(
            RunIngestRequest(
                cwd=repo,
                inputs=("note.md",),
                harness=HarnessKind.CODEX,
            )
        )

    run = app.runs.list(ListRunsRequest(cwd=repo))[0]

    assert run.status == RunStatus.FAILED
    assert run.error is not None
    assert run.error == "ingest changed file outside .almanac: src/app.py"


def test_ingest_workflow_rejects_dirty_almanac_preflight(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    app = create_app(
        AppConfig(registry_path=isolated_home / ".almanac/registry.json"),
        harness_adapters=(WritingHarnessAdapter(),),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    (repo / ".almanac/pages/getting-started.md").write_text(
        "local wiki edit\n",
        encoding="utf-8",
    )

    with pytest.raises(ValidationFailed):
        app.workflows.ingest.run(
            RunIngestRequest(
                cwd=repo,
                inputs=("note.md",),
                harness=HarnessKind.CODEX,
            )
        )

    run = app.runs.list(ListRunsRequest(cwd=repo))[0]

    assert run.status == RunStatus.FAILED
    assert run.error is not None
    assert run.error.startswith("ingest requires a clean .almanac before running:")


def test_ingest_workflow_requires_git_change_tracking(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    app = create_app(
        AppConfig(registry_path=isolated_home / ".almanac/registry.json"),
        harness_adapters=(WritingHarnessAdapter(),),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))

    with pytest.raises(ValidationFailed):
        app.workflows.ingest.run(
            RunIngestRequest(
                cwd=repo,
                inputs=("note.md",),
                harness=HarnessKind.CODEX,
            )
        )

    run = app.runs.list(ListRunsRequest(cwd=repo))[0]

    assert run.status == RunStatus.FAILED
    assert run.error is not None
    assert run.error.startswith("ingest requires Git change tracking:")


def test_run_ingest_request_requires_inputs(tmp_path: Path):
    with pytest.raises(ValidationError):
        RunIngestRequest(cwd=tmp_path, inputs=(), harness=HarnessKind.CODEX)


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
