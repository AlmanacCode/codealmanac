import subprocess
from pathlib import Path

import pytest
from conftest import (
    FakeRunProcessController,
    InlineRunExecutorSpawner,
    bind_inline_executor,
    initialize_repository,
)

from codealmanac.app import create_app
from codealmanac.core.errors import ExecutionFailed
from codealmanac.integrations.runs.process import worker_command
from codealmanac.services.harnesses.models import (
    HarnessAgentKind,
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest
from codealmanac.services.runs.models import RunKind, RunStatus, RunWorkerSpawnResult
from codealmanac.services.runs.requests import (
    CancelRunRequest,
    ListRunsRequest,
    MarkRunRunningRequest,
    ReadRunLogRequest,
    ShowRunRequest,
    SpawnRunWorkerRequest,
    StartRunRequest,
)
from codealmanac.services.search.requests import SearchPagesRequest
from codealmanac.settings import AppConfig
from codealmanac.workflows.build.requests import BuildRequest
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

    def run(self, request: RunHarnessRequest, on_event=None) -> HarnessRunResult:
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
    executors = InlineRunExecutorSpawner()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(harness,),
        executor_spawner=executors,
        process_controller=FakeRunProcessController(),
    )
    bind_inline_executor(app, executors)
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


def test_run_queue_processes_work_queued_at_idle_handoff(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("late queue design note\n", encoding="utf-8")
    harness = QueueWritingHarnessAdapter()
    executors = InlineRunExecutorSpawner()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(harness,),
        executor_spawner=executors,
        process_controller=FakeRunProcessController(),
    )
    bind_inline_executor(app, executors)
    initialize_repository(app, repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    release_if_idle = app.runs.release_worker_if_idle
    queued_run_id: str | None = None

    def queue_before_handoff(request):
        nonlocal queued_run_id
        if queued_run_id is None:
            queued = app.workflows.queue.queue_ingest(
                IngestRequest(
                    cwd=repo,
                    inputs=("note.md",),
                    harness=HarnessKind.CODEX,
                    model="gpt-5.5",
                    auto_commit=False,
                )
            )
            queued_run_id = queued.run_id
        return release_if_idle(request)

    monkeypatch.setattr(app.runs, "release_worker_if_idle", queue_before_handoff)

    result = app.workflows.queue.drain(DrainRunQueueRequest())

    assert queued_run_id is not None
    assert [record.run_id for record in result.processed] == [queued_run_id]
    assert app.runs.show(ShowRunRequest(run_id=queued_run_id)).status == RunStatus.DONE
    assert len(harness.requests) == 1


def test_run_queue_max_runs_leaves_later_work_for_next_worker(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "first.md").write_text("first queue note\n", encoding="utf-8")
    (repo / "second.md").write_text("second queue note\n", encoding="utf-8")
    harness = QueueWritingHarnessAdapter()
    executors = InlineRunExecutorSpawner()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(harness,),
        executor_spawner=executors,
        process_controller=FakeRunProcessController(),
    )
    bind_inline_executor(app, executors)
    initialize_repository(app, repo)
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    first = app.workflows.queue.queue_ingest(
        IngestRequest(
            cwd=repo,
            inputs=("first.md",),
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
            auto_commit=False,
        )
    )
    second = app.workflows.queue.queue_ingest(
        IngestRequest(
            cwd=repo,
            inputs=("second.md",),
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
            auto_commit=False,
        )
    )

    first_drain = app.workflows.queue.drain(DrainRunQueueRequest(max_runs=1))

    assert [record.run_id for record in first_drain.processed] == [first.run_id]
    assert app.runs.show(ShowRunRequest(run_id=first.run_id)).status == RunStatus.DONE
    assert (
        app.runs.show(ShowRunRequest(run_id=second.run_id)).status
        == RunStatus.QUEUED
    )

    second_drain = app.workflows.queue.drain(DrainRunQueueRequest(max_runs=1))

    assert [record.run_id for record in second_drain.processed] == [second.run_id]
    assert app.runs.show(ShowRunRequest(run_id=second.run_id)).status == RunStatus.DONE


def test_run_queue_drains_persisted_build_spec(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    initialize_git(repo)
    harness = QueueWritingHarnessAdapter()
    executors = InlineRunExecutorSpawner()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(harness,),
        executor_spawner=executors,
        process_controller=FakeRunProcessController(),
    )
    bind_inline_executor(app, executors)
    queued = app.workflows.queue.queue_build(
        BuildRequest(
            path=repo,
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
            name="repo",
            guidance="Write the smallest useful first wiki.",
        )
    )

    result = app.workflows.queue.drain(DrainRunQueueRequest())
    runs = app.runs.list(ListRunsRequest(repository_name="repo"))

    assert queued.status == RunStatus.QUEUED
    assert (repo / "almanac/README.md").is_file()
    assert result.lock_acquired is True
    assert [record.run_id for record in result.processed] == [queued.run_id]
    assert runs[0].status == RunStatus.DONE
    assert len(harness.requests) == 1
    assert harness.requests[0].agent is HarnessAgentKind.BUILD
    assert "Build Operation" not in harness.requests[0].prompt
    assert "Write the smallest useful first wiki." in harness.requests[0].prompt


def test_run_queue_skips_cancelled_queued_runs(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("cancelled queue note\n", encoding="utf-8")
    harness = QueueWritingHarnessAdapter()
    processes = FakeRunProcessController()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(harness,),
        process_controller=processes,
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
    app.workflows.queue.cancel(
        CancelRunRequest(repository_name=repo.name, run_id=queued.run_id)
    )

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


def test_run_queue_cancels_running_executor_before_terminal_status(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    processes = FakeRunProcessController()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        process_controller=processes,
    )
    repository = initialize_repository(app, repo)
    run = app.runs.start(
        StartRunRequest(
            repository_id=repository.repository_id,
            kind=RunKind.GARDEN,
        )
    )
    app.runs.mark_running(
        MarkRunRunningRequest(run_id=run.run_id, execution=processes.execution)
    )

    result = app.workflows.queue.cancel(CancelRunRequest(run_id=run.run_id))
    log = app.runs.log(ReadRunLogRequest(run_id=run.run_id))

    assert processes.terminated == [processes.execution]
    assert result.changed is True
    assert result.record.status == RunStatus.CANCELLED
    assert tuple(event.message for event in log) == (
        "queued garden",
        "running",
        "cancellation requested",
        "cancelled",
    )


def test_run_queue_does_not_claim_cancelled_when_termination_fails(
    tmp_path: Path,
    isolated_home: Path,
):
    class FailingController(FakeRunProcessController):
        def terminate(self, execution):
            raise ExecutionFailed("executor would not stop")

    repo = tmp_path / "repo"
    repo.mkdir()
    processes = FailingController()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        process_controller=processes,
    )
    repository = initialize_repository(app, repo)
    run = app.runs.start(
        StartRunRequest(
            repository_id=repository.repository_id,
            kind=RunKind.GARDEN,
        )
    )
    app.runs.mark_running(
        MarkRunRunningRequest(run_id=run.run_id, execution=processes.execution)
    )

    with pytest.raises(ExecutionFailed, match="executor would not stop"):
        app.workflows.queue.cancel(CancelRunRequest(run_id=run.run_id))

    current = app.runs.show(ShowRunRequest(run_id=run.run_id))
    assert current.status == RunStatus.RUNNING
    assert current.cancellation_requested_at is not None


def test_queue_manager_continues_after_running_job_is_cancelled(
    tmp_path: Path,
    isolated_home: Path,
):
    class CancellingProcess:
        pid = 4242

        def __init__(self, app, run_id, execution):
            self.app = app
            self.run_id = run_id
            self.execution = execution

        def wait(self):
            self.app.runs.mark_running(
                MarkRunRunningRequest(
                    run_id=self.run_id,
                    execution=self.execution,
                )
            )
            self.app.workflows.queue.cancel(CancelRunRequest(run_id=self.run_id))
            return -15

    class CancellingThenInlineSpawner(InlineRunExecutorSpawner):
        def __init__(self, execution):
            super().__init__()
            self.app = None
            self.execution = execution

        def spawn(self, request):
            if self.app is not None and not self.requests:
                self.requests.append(request)
                return CancellingProcess(self.app, request.run_id, self.execution)
            return super().spawn(request)

    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("queue continuation note\n", encoding="utf-8")
    harness = QueueWritingHarnessAdapter()
    processes = FakeRunProcessController()
    executors = CancellingThenInlineSpawner(processes.execution)
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(harness,),
        executor_spawner=executors,
        process_controller=processes,
    )
    executors.app = app
    bind_inline_executor(app, executors)
    initialize_repository(app, repo)
    first = app.workflows.queue.queue_ingest(
        IngestRequest(
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
        )
    )
    second = app.workflows.queue.queue_ingest(
        IngestRequest(
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
        )
    )

    result = app.workflows.queue.drain(DrainRunQueueRequest())

    assert [record.run_id for record in result.processed] == [
        first.run_id,
        second.run_id,
    ]
    assert [record.status for record in result.processed] == [
        RunStatus.CANCELLED,
        RunStatus.DONE,
    ]
    assert len(harness.requests) == 1


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
