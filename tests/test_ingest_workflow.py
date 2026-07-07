import subprocess
from pathlib import Path

import httpx
import pytest
from conftest import initialize_repository
from pydantic import ValidationError

from codealmanac.app import create_app
from codealmanac.core.errors import ExecutionFailed, NotFoundError, ValidationFailed
from codealmanac.integrations.sources.web import WebSourceRuntimeAdapter
from codealmanac.services.harnesses.models import (
    HarnessActorConfidence,
    HarnessActorRole,
    HarnessAgentTrace,
    HarnessEvent,
    HarnessEventKind,
    HarnessKind,
    HarnessReadiness,
    HarnessRunActor,
    HarnessRunResult,
    HarnessRunStatus,
    HarnessToolDisplay,
    HarnessToolDisplayKind,
    HarnessToolStatus,
    HarnessTranscriptRef,
    HarnessUsage,
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
from codealmanac.services.sources.requests import (
    InspectSourceRuntimeRequest,
    ResolveSourcesRequest,
)
from codealmanac.settings import AppConfig
from codealmanac.workflows.ingest.requests import IngestRequest


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
        page = request.cwd / "almanac/ingested-note.md"
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


class EventfulHarnessAdapter(WritingHarnessAdapter):
    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        result = super().run(request)
        return result.model_copy(
            update={
                "events": (
                    HarnessEvent(
                        kind=HarnessEventKind.TEXT,
                        message="agent read source note",
                        actor=HarnessRunActor(
                            thread_id="root-thread",
                            role=HarnessActorRole.ROOT,
                            confidence=HarnessActorConfidence.PROVIDER,
                            label="Main",
                        ),
                    ),
                    HarnessEvent(
                        kind=HarnessEventKind.TOOL_USE,
                        message="agent wrote almanac/ingested-note.md",
                        tool_id="tool-1",
                        tool_name="fileChange",
                        tool_display=HarnessToolDisplay(
                            kind=HarnessToolDisplayKind.EDIT,
                            title="Editing file",
                            path="almanac/ingested-note.md",
                            status=HarnessToolStatus.COMPLETED,
                            provider_thread_id="root-thread",
                            provider_turn_id="turn-1",
                        ),
                    ),
                    HarnessEvent(
                        kind=HarnessEventKind.CONTEXT_USAGE,
                        message="usage: 42 tokens",
                        usage=HarnessUsage(
                            input_tokens=30,
                            output_tokens=12,
                            total_tokens=42,
                            max_tokens=200000,
                        ),
                    ),
                    HarnessEvent(
                        kind=HarnessEventKind.AGENT_SPAWNED,
                        message="spawned helper",
                        agent_trace=HarnessAgentTrace(
                            parent_thread_id="root-thread",
                            child_thread_id="helper-thread",
                            prompt="Review the page.",
                        ),
                    ),
                    HarnessEvent(
                        kind=HarnessEventKind.DONE,
                        status=HarnessRunStatus.SUCCEEDED,
                        message="codex succeeded: updated wiki",
                        provider_session_id="root-thread",
                        source_thread_id="root-thread",
                        source_turn_id="turn-1",
                        source_role=HarnessActorRole.ROOT,
                    ),
                )
            }
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
        page = request.cwd / "almanac/ingested-note.md"
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


class DirtyWikiMutatingHarnessAdapter(WritingHarnessAdapter):
    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        result = super().run(request)
        dirty_page = request.cwd / "almanac/README.md"
        dirty_page.write_text(
            dirty_page.read_text(encoding="utf-8")
            + "\nAgent continued the preexisting wiki edit.\n",
            encoding="utf-8",
        )
        return result.model_copy(
            update={
                "changed_files": (
                    dirty_page,
                    *result.changed_files,
                )
            }
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


class RecordingPathSourceRuntimeAdapter:
    def __init__(self):
        self.requests: list[InspectSourceRuntimeRequest] = []

    def supports(self, ref: SourceRef) -> bool:
        return ref.kind == SourceKind.PATH_DIRECTORY

    def inspect(self, request: InspectSourceRuntimeRequest) -> SourceRuntime:
        self.requests.append(request)
        return SourceRuntime(
            ref=request.ref,
            status=SourceRuntimeStatus.AVAILABLE,
            title="Fake directory",
            content="captured directory runtime",
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
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(adapter,),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    result = app.workflows.ingest.run(
        IngestRequest(
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
            title="Ingest note",
            guidance="Prefer short pages.",
        )
    )

    matches = app.search.search(SearchPagesRequest(cwd=repo, query="durable"))
    log = app.runs.log(ReadRunLogRequest(run_id=result.run.run_id))

    assert result.run.status == RunStatus.DONE
    assert result.run.started_at is not None
    assert result.run.finished_at is not None
    assert result.run.summary == "ingested note"
    assert result.run.harness_transcript is not None
    assert result.run.harness_transcript.session_id == "codex-ingest-session"
    assert result.sources[0].ref.fingerprint is not None
    assert result.source_runtime[0].status == SourceRuntimeStatus.AVAILABLE
    assert result.harness.changed_files == (
        repo / "almanac/ingested-note.md",
    )
    assert result.safety.changed_files == (
        repo / "almanac/ingested-note.md",
    )
    assert result.index.pages_indexed == 2
    assert matches[0].slug == "ingested-note"
    assert "path.file" in adapter.requests[0].prompt
    assert '"source_runtime": [' in adapter.requests[0].prompt
    assert '"source_control": {' in adapter.requests[0].prompt
    assert '"auto_commit": true' in adapter.requests[0].prompt
    assert "Use normal git commands from the repository root." in (
        adapter.requests[0].prompt
    )
    assert "almanac: <summary>" in adapter.requests[0].prompt
    assert "auth decision" in adapter.requests[0].prompt
    assert "Prefer short pages." in adapter.requests[0].prompt
    assert "public command and product name is `codealmanac`" in (
        adapter.requests[0].prompt
    )
    assert tuple(entry.kind for entry in log) == (
        RunEventKind.STATUS,
        RunEventKind.STATUS,
        RunEventKind.MESSAGE,
        RunEventKind.MESSAGE,
        RunEventKind.MESSAGE,
        RunEventKind.OUTPUT,
        RunEventKind.STATUS,
    )
    assert log[1].message == RunStatus.RUNNING.value


def test_ingest_prompt_disables_commit_policy(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    adapter = WritingHarnessAdapter()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(adapter,),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    app.workflows.ingest.run(
        IngestRequest(
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
            auto_commit=False,
        )
    )

    assert '"auto_commit": false' in adapter.requests[0].prompt
    assert "Do not run git commit." in adapter.requests[0].prompt
    assert "Do not stage files." in adapter.requests[0].prompt


def test_ingest_workflow_records_normalized_harness_events(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(EventfulHarnessAdapter(),),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    result = app.workflows.ingest.run(
        IngestRequest(
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
        )
    )

    log = app.runs.log(ReadRunLogRequest(run_id=result.run.run_id))

    assert tuple((entry.kind, entry.message) for entry in log[-6:]) == (
        (RunEventKind.OUTPUT, "agent read source note"),
        (RunEventKind.TOOL, "agent wrote almanac/ingested-note.md"),
        (RunEventKind.TOOL, "usage: 42 tokens"),
        (RunEventKind.TOOL, "spawned helper"),
        (RunEventKind.OUTPUT, "codex succeeded: updated wiki"),
        (RunEventKind.STATUS, "done"),
    )
    assert log[-6].harness_event is not None
    assert log[-6].harness_event.actor is not None
    assert log[-6].harness_event.actor.role == HarnessActorRole.ROOT
    assert log[-5].harness_event is not None
    assert log[-5].harness_event.tool_display is not None
    assert log[-5].harness_event.tool_display.path == (
        "almanac/ingested-note.md"
    )
    assert log[-4].harness_event is not None
    assert log[-4].harness_event.usage is not None
    assert log[-4].harness_event.usage.total_tokens == 42
    assert log[-3].harness_event is not None
    assert log[-3].harness_event.agent_trace is not None
    assert log[-3].harness_event.agent_trace.child_thread_id == "helper-thread"
    assert log[-2].harness_event is not None
    assert log[-2].harness_event.provider_session_id == "root-thread"


def test_ingest_prompt_includes_git_source_runtime(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    adapter = WritingHarnessAdapter()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(adapter,),
        source_runtime_adapters=(FakeSourceRuntimeAdapter(),),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    result = app.workflows.ingest.run(
        IngestRequest(
            cwd=repo,
            inputs=("git:diff",),
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
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
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(adapter,),
        source_runtime_adapters=(FakeSourceRuntimeAdapter(),),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    result = app.workflows.ingest.run(
        IngestRequest(
            cwd=repo,
            inputs=("https://github.com/acme/project/pull/42",),
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
        )
    )

    assert result.source_runtime[0].status == SourceRuntimeStatus.AVAILABLE
    assert "Fake GitHub PR" in adapter.requests[0].prompt
    assert "preserve the auth decision history" in adapter.requests[0].prompt


def test_ingest_prompt_includes_web_source_runtime(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    adapter = WritingHarnessAdapter()
    web = WebSourceRuntimeAdapter(
        client=httpx.Client(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200,
                    headers={"content-type": "text/html; charset=utf-8"},
                    text=(
                        "<html><head><title>Retention Decisions</title></head>"
                        "<body><p>Keep pricing context in the wiki.</p></body></html>"
                    ),
                    request=request,
                )
            )
        )
    )
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(adapter,),
        source_runtime_adapters=(web,),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    result = app.workflows.ingest.run(
        IngestRequest(
            cwd=repo,
            inputs=("https://example.test/retention",),
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
        )
    )

    assert result.source_runtime[0].status == SourceRuntimeStatus.AVAILABLE
    assert "Retention Decisions" in adapter.requests[0].prompt
    assert "Keep pricing context in the wiki." in adapter.requests[0].prompt


def test_ingest_workflow_passes_almanac_root_to_source_runtime(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    runtime = RecordingPathSourceRuntimeAdapter()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        source_runtime_adapters=(runtime,),
    )
    initialize_repository(app, path=repo)
    repository = app.repositories.registered_repository_at(repo)
    sources = app.sources.resolve(ResolveSourcesRequest(cwd=repo, inputs=(".",)))

    result = app.workflows.ingest.inspect_source_runtime(repository, sources)

    assert result[0].status == SourceRuntimeStatus.AVAILABLE
    assert runtime.requests[0].cwd == repo
    assert runtime.requests[0].context.ignored_directories == (Path("almanac"),)


def test_ingest_workflow_fails_run_when_harness_is_missing(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    with pytest.raises(NotFoundError):
        app.workflows.ingest.run(
            IngestRequest(
                cwd=repo,
                inputs=("note.md",),
                harness=HarnessKind.CODEX,
            model="gpt-5.5",
            )
        )

    run = app.runs.list(ListRunsRequest(repository_name="repo"))[0]
    log = app.runs.log(ReadRunLogRequest(run_id=run.run_id))

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
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(UnsafeHarnessAdapter(),),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    with pytest.raises(ValidationFailed):
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
    assert run.error.startswith("harness reported change outside almanac/:")
    assert "README.md" in run.error


def test_ingest_workflow_fails_when_harness_returns_failed_status(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(FailedHarnessAdapter(),),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    with pytest.raises(ExecutionFailed):
        app.workflows.ingest.run(
            IngestRequest(
                cwd=repo,
                inputs=("note.md",),
                harness=HarnessKind.CODEX,
            model="gpt-5.5",
            )
        )

    run = app.runs.list(ListRunsRequest(repository_name="repo"))[0]
    log = app.runs.log(ReadRunLogRequest(run_id=run.run_id))

    assert run.status == RunStatus.FAILED
    assert run.error == "harness codex failed with status failed: agent failed"
    assert run.harness_transcript is not None
    assert run.harness_transcript.session_id == "failed-ingest-session"
    assert tuple(entry.kind for entry in log)[-3:] == (
        RunEventKind.OUTPUT,
        RunEventKind.ERROR,
        RunEventKind.STATUS,
    )
    assert log[-3].message == "codex failed: agent failed"


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
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(FailedDirtyFileMutatingHarnessAdapter(),),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")

    with pytest.raises(ValidationFailed):
        app.workflows.ingest.run(
            IngestRequest(
                cwd=repo,
                inputs=("note.md",),
                harness=HarnessKind.CODEX,
            model="gpt-5.5",
            )
        )

    run = app.runs.list(ListRunsRequest(repository_name="repo"))[0]
    log = app.runs.log(ReadRunLogRequest(run_id=run.run_id))

    assert run.status == RunStatus.FAILED
    assert run.error == "ingest changed file outside almanac: src/app.py"
    assert tuple(entry.kind for entry in log)[-3:] == (
        RunEventKind.OUTPUT,
        RunEventKind.ERROR,
        RunEventKind.STATUS,
    )
    assert log[-3].message == "codex failed: agent failed after mutation"


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
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(adapter,),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    (repo / "src/app.py").write_text("user edit\n", encoding="utf-8")

    result = app.workflows.ingest.run(
        IngestRequest(
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
        )
    )

    assert result.run.status == RunStatus.DONE
    assert result.safety.changed_files == (
        repo / "almanac/ingested-note.md",
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
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(DirtyFileMutatingHarnessAdapter(),),
    )
    initialize_repository(app, path=repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    (repo / "src/app.py").write_text("user edit\n", encoding="utf-8")

    with pytest.raises(ValidationFailed):
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
    assert run.error == "ingest changed file outside almanac: src/app.py"


def test_ingest_workflow_allows_preexisting_dirty_almanac_edits(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(DirtyWikiMutatingHarnessAdapter(),),
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

    result = app.workflows.ingest.run(
        IngestRequest(
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
        )
    )

    page_text = getting_started.read_text(encoding="utf-8")

    assert result.run.status == RunStatus.DONE
    assert result.safety.changed_files == (
        repo / "almanac/README.md",
        repo / "almanac/ingested-note.md",
    )
    assert "User started a local wiki edit." in page_text
    assert "Agent continued the preexisting wiki edit." in page_text


def test_ingest_workflow_requires_git_change_tracking(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(WritingHarnessAdapter(),),
    )
    initialize_repository(app, path=repo)

    with pytest.raises(ValidationFailed):
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
    assert run.error.startswith("ingest requires Git change tracking:")


def test_run_ingest_request_requires_inputs(tmp_path: Path):
    with pytest.raises(ValidationError):
        IngestRequest(
            cwd=tmp_path,
            inputs=(),
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
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
