import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Event, Thread

import pytest
from pydantic import ValidationError

from codealmanac.app import create_app
from codealmanac.core.errors import ConflictError
from codealmanac.core.models import AppConfig
from codealmanac.core.paths import default_jobs_path
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessEventKind,
    HarnessKind,
    HarnessTranscriptRef,
)
from codealmanac.services.runs.io import RunLedgerIO
from codealmanac.services.runs.models import (
    RunAttachSnapshot,
    RunEventKind,
    RunLogEvent,
    RunOperation,
    RunRecord,
    RunSpec,
    RunStatus,
)
from codealmanac.services.runs.requests import (
    AcquireRunWorkerLockRequest,
    AttachRunRequest,
    CancelRunRequest,
    FinishRunRequest,
    ListRunsRequest,
    MarkRunRunningRequest,
    NextQueuedRunRequest,
    QueueRunRequest,
    ReadRunLogRequest,
    ReadRunSpecRequest,
    RecordRunEventRequest,
    RecordRunHarnessTranscriptRequest,
    ShowRunRequest,
    StartRunRequest,
    StreamRunAttachRequest,
)
from codealmanac.services.runs.store import RunStore
from codealmanac.services.runs.streaming import RunAttachStreamer
from codealmanac.services.workspaces.identity import workspace_id_for
from codealmanac.services.workspaces.requests import InitializeWorkspaceRequest


def workspace_jobs_path(repo: Path) -> Path:
    return default_jobs_path() / workspace_id_for(repo)


class FailingAppendLedger(RunLedgerIO):
    def __init__(self):
        self.fail_append = False

    def append_event(self, almanac_path: Path, event: RunLogEvent) -> None:
        if self.fail_append:
            raise OSError("cannot append event")
        super().append_event(almanac_path, event)


def test_runs_service_records_job_and_events(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))

    record = app.runs.start(
        StartRunRequest(
            cwd=repo,
            operation=RunOperation.INGEST,
            title="Digest design note",
        )
    )
    running = app.runs.mark_running(
        MarkRunRunningRequest(cwd=repo, run_id=record.run_id)
    )
    event = app.runs.record_event(
        RecordRunEventRequest(
            cwd=repo,
            run_id=record.run_id,
            kind=RunEventKind.MESSAGE,
            message="read design note",
        )
    )
    harness_log = app.runs.record_event(
        RecordRunEventRequest(
            cwd=repo,
            run_id=record.run_id,
            kind=RunEventKind.TOOL,
            message="codex provider session provider-thread-1",
            harness_event=HarnessEvent(
                kind=HarnessEventKind.PROVIDER_SESSION,
                message="codex provider session provider-thread-1",
                provider_session_id="provider-thread-1",
            ),
        )
    )
    transcript = HarnessTranscriptRef(
        kind=HarnessKind.CODEX,
        session_id="codex-session-1",
        transcript_path=Path("/tmp/codex-session.jsonl"),
    )
    attached = app.runs.record_harness_transcript(
        RecordRunHarnessTranscriptRequest(
            cwd=repo,
            run_id=record.run_id,
            transcript=transcript,
        )
    )
    finished = app.runs.finish(
        FinishRunRequest(
            cwd=repo,
            run_id=record.run_id,
            status=RunStatus.DONE,
            summary="updated wiki",
        )
    )
    listed = app.runs.list(ListRunsRequest(cwd=repo))
    shown = app.runs.show(ShowRunRequest(cwd=repo, run_id=record.run_id))
    log = app.runs.log(ReadRunLogRequest(cwd=repo, run_id=record.run_id))

    assert record.status == RunStatus.QUEUED
    assert running.status == RunStatus.RUNNING
    assert running.started_at is not None
    assert event.sequence == 3
    assert event.harness_event is None
    assert harness_log.sequence == 4
    assert harness_log.harness_event is not None
    assert harness_log.harness_event.provider_session_id == "provider-thread-1"
    assert attached.harness_transcript == transcript
    assert finished.status == RunStatus.DONE
    assert finished.started_at == running.started_at
    assert finished.harness_transcript == transcript
    assert finished.summary == "updated wiki"
    assert [run.run_id for run in listed] == [record.run_id]
    assert shown.status == RunStatus.DONE
    jobs_path = workspace_jobs_path(repo)
    assert shown.log_path == jobs_path / f"{record.run_id}.jsonl"
    assert tuple(entry.kind for entry in log) == (
        RunEventKind.STATUS,
        RunEventKind.STATUS,
        RunEventKind.MESSAGE,
        RunEventKind.TOOL,
        RunEventKind.STATUS,
    )
    assert log[2].harness_event is None
    assert log[3].harness_event is not None
    assert log[3].harness_event.provider_session_id == "provider-thread-1"
    assert (jobs_path / f"{record.run_id}.json").is_file()
    assert (jobs_path / f"{record.run_id}.jsonl").is_file()
    assert not (repo / "almanac/jobs" / f"{record.run_id}.json").exists()


def test_runs_service_targets_registered_wiki(
    tmp_path: Path,
    isolated_home: Path,
):
    first = tmp_path / "first"
    second = tmp_path / "second"
    first.mkdir()
    second.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=first, name="first")
    )
    app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=second, name="second")
    )

    record = app.runs.start(
        StartRunRequest(cwd=second, wiki="first", operation=RunOperation.GARDEN)
    )

    assert (workspace_jobs_path(first) / f"{record.run_id}.json").is_file()
    assert app.runs.list(ListRunsRequest(cwd=second, wiki="first"))[0].run_id == (
        record.run_id
    )


def test_runs_service_refuses_running_transition_after_terminal_status(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    record = app.runs.start(StartRunRequest(cwd=repo, operation=RunOperation.INGEST))
    app.runs.finish(
        FinishRunRequest(
            cwd=repo,
            run_id=record.run_id,
            status=RunStatus.FAILED,
            error="failed before running",
        )
    )

    with pytest.raises(ConflictError):
        app.runs.mark_running(MarkRunRunningRequest(cwd=repo, run_id=record.run_id))


def test_runs_service_cancels_queued_run_and_attaches_log(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    record = app.runs.start(StartRunRequest(cwd=repo, operation=RunOperation.GARDEN))

    result = app.runs.cancel(CancelRunRequest(cwd=repo, run_id=record.run_id))
    snapshot = app.runs.attach(AttachRunRequest(cwd=repo, run_id=record.run_id))

    assert result.changed is True
    assert result.record.status == RunStatus.CANCELLED
    assert result.record.started_at is None
    assert result.record.finished_at is not None
    assert snapshot.record.status == RunStatus.CANCELLED
    assert snapshot.terminal is True
    assert tuple(entry.message for entry in snapshot.events) == (
        "queued garden",
        "cancelled",
    )


def test_runs_service_cancel_is_idempotent_for_terminal_run(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    record = app.runs.start(StartRunRequest(cwd=repo, operation=RunOperation.GARDEN))
    app.runs.finish(
        FinishRunRequest(
            cwd=repo,
            run_id=record.run_id,
            status=RunStatus.FAILED,
            error="already failed",
        )
    )

    result = app.runs.cancel(CancelRunRequest(cwd=repo, run_id=record.run_id))
    log = app.runs.log(ReadRunLogRequest(cwd=repo, run_id=record.run_id))

    assert result.changed is False
    assert result.record.status == RunStatus.FAILED
    assert tuple(entry.message for entry in log) == (
        "queued garden",
        "failed",
    )


def test_runs_service_finish_preserves_cancelled_run(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    record = app.runs.start(StartRunRequest(cwd=repo, operation=RunOperation.GARDEN))
    app.runs.mark_running(MarkRunRunningRequest(cwd=repo, run_id=record.run_id))
    cancelled = app.runs.cancel(CancelRunRequest(cwd=repo, run_id=record.run_id))

    finished = app.runs.finish(
        FinishRunRequest(
            cwd=repo,
            run_id=record.run_id,
            status=RunStatus.DONE,
            summary="should not win",
        )
    )
    log = app.runs.log(ReadRunLogRequest(cwd=repo, run_id=record.run_id))

    assert cancelled.changed is True
    assert finished.status == RunStatus.CANCELLED
    assert finished.summary is None
    assert tuple(entry.message for entry in log) == (
        "queued garden",
        "running",
        "cancelled",
    )


def test_runs_service_streams_attach_until_run_is_terminal(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    record = app.runs.start(StartRunRequest(cwd=repo, operation=RunOperation.INGEST))
    first_update_seen = Event()
    updates = []
    errors = []

    def consume_attach() -> None:
        try:
            for update in app.runs.stream_attach(
                StreamRunAttachRequest(
                    cwd=repo,
                    run_id=record.run_id,
                    poll_interval_seconds=0.01,
                )
            ):
                updates.append(update)
                first_update_seen.set()
        except Exception as error:
            errors.append(error)

    thread = Thread(target=consume_attach, daemon=True)
    thread.start()

    assert first_update_seen.wait(timeout=1)
    app.runs.record_event(
        RecordRunEventRequest(
            cwd=repo,
            run_id=record.run_id,
            kind=RunEventKind.MESSAGE,
            message="read note",
        )
    )
    app.runs.finish(
        FinishRunRequest(
            cwd=repo,
            run_id=record.run_id,
            status=RunStatus.DONE,
            summary="complete",
        )
    )
    thread.join(timeout=2)

    assert thread.is_alive() is False
    assert errors == []
    assert tuple(event.message for update in updates for event in update.events) == (
        "queued ingest",
        "read note",
        "done",
    )
    assert updates[-1].terminal is True
    assert updates[-1].record.status == RunStatus.DONE


def test_run_attach_streamer_waits_for_terminal_status_event(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    record = app.runs.start(StartRunRequest(cwd=repo, operation=RunOperation.INGEST))
    done = record.model_copy(update={"status": RunStatus.DONE})
    queued_event = app.runs.log(ReadRunLogRequest(cwd=repo, run_id=record.run_id))[0]
    terminal_event = queued_event.model_copy(
        update={
            "sequence": 2,
            "kind": RunEventKind.STATUS,
            "message": RunStatus.DONE.value,
        }
    )

    class TerminalRaceStore:
        def __init__(self):
            self.calls = 0

        def attach(self, _almanac_path: Path, _run_id: str) -> RunAttachSnapshot:
            self.calls += 1
            if self.calls == 1:
                return RunAttachSnapshot(
                    record=done,
                    events=(queued_event,),
                    terminal=True,
                )
            return RunAttachSnapshot(
                record=done,
                events=(queued_event, terminal_event),
                terminal=True,
            )

    store = TerminalRaceStore()
    updates = tuple(
        RunAttachStreamer(store).stream(repo / "almanac", record.run_id, 0.01)
    )

    assert store.calls == 2
    assert tuple(event.message for update in updates for event in update.events) == (
        "queued ingest",
        "done",
    )
    assert updates[-1].terminal is True


def test_run_attach_streamer_waits_through_repeated_terminal_log_race(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    record = app.runs.start(StartRunRequest(cwd=repo, operation=RunOperation.INGEST))
    done = record.model_copy(update={"status": RunStatus.DONE})
    queued_event = app.runs.log(ReadRunLogRequest(cwd=repo, run_id=record.run_id))[0]
    terminal_event = queued_event.model_copy(
        update={
            "sequence": 2,
            "kind": RunEventKind.STATUS,
            "message": RunStatus.DONE.value,
        }
    )

    class RepeatedTerminalRaceStore:
        def __init__(self):
            self.calls = 0

        def attach(self, _almanac_path: Path, _run_id: str) -> RunAttachSnapshot:
            self.calls += 1
            if self.calls < 4:
                return RunAttachSnapshot(
                    record=done,
                    events=(queued_event,),
                    terminal=True,
                )
            return RunAttachSnapshot(
                record=done,
                events=(queued_event, terminal_event),
                terminal=True,
            )

    store = RepeatedTerminalRaceStore()
    updates = tuple(
        RunAttachStreamer(store).stream(repo / "almanac", record.run_id, 0.01)
    )

    assert store.calls == 4
    assert tuple(event.message for update in updates for event in update.events) == (
        "queued ingest",
        "done",
    )
    assert updates[-1].terminal is True


def test_runs_service_persists_queue_specs_and_selects_oldest_background_run(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    foreground = app.runs.start(
        StartRunRequest(cwd=repo, operation=RunOperation.INGEST)
    )
    first = app.runs.queue(
        QueueRunRequest(
            cwd=repo,
            title="Ingest first note",
            spec=RunSpec(
                operation=RunOperation.INGEST,
                cwd=repo,
                harness=HarnessKind.CODEX,
                inputs=("first.md",),
            ),
        )
    )
    second = app.runs.queue(
        QueueRunRequest(
            cwd=repo,
            title="Garden later",
            spec=RunSpec(
                operation=RunOperation.GARDEN,
                cwd=repo,
                harness=HarnessKind.CODEX,
            ),
        )
    )

    spec = app.runs.read_spec(ReadRunSpecRequest(cwd=repo, run_id=first.run_id))
    queued = app.runs.next_queued(NextQueuedRunRequest(cwd=repo))
    listed = app.runs.list(ListRunsRequest(cwd=repo))

    assert foreground.status == RunStatus.QUEUED
    assert spec is not None
    assert spec.inputs == ("first.md",)
    assert queued is not None
    assert queued.record.run_id == first.run_id
    assert queued.spec == spec
    assert {record.run_id for record in listed} == {
        foreground.run_id,
        first.run_id,
        second.run_id,
    }


def test_run_spec_accepts_init_payload_and_rejects_source_inputs(tmp_path: Path):
    spec = RunSpec(
        operation=RunOperation.INIT,
        cwd=tmp_path,
        harness=HarnessKind.CODEX,
        almanac_root=Path("docs/almanac"),
        workspace_name="docs",
        description="first wiki",
        guidance="keep it short",
        force=True,
    )

    assert spec.operation == RunOperation.INIT
    assert spec.almanac_root == Path("docs/almanac")
    assert spec.workspace_name == "docs"

    with pytest.raises(ValidationError, match="init run spec does not accept inputs"):
        RunSpec(
            operation=RunOperation.INIT,
            cwd=tmp_path,
            harness=HarnessKind.CODEX,
            inputs=("note.md",),
        )


def test_runs_service_worker_lock_is_exclusive_and_recovers_stale_owner(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    now = datetime(2026, 7, 1, 12, 0, tzinfo=UTC)

    first = app.runs.acquire_worker_lock(
        AcquireRunWorkerLockRequest(
            cwd=repo,
            owner="first-worker",
            pid=os.getpid(),
            now=now,
            stale_after=timedelta(minutes=10),
        )
    )
    blocked = app.runs.acquire_worker_lock(
        AcquireRunWorkerLockRequest(
            cwd=repo,
            owner="second-worker",
            pid=os.getpid(),
            now=now + timedelta(minutes=1),
            stale_after=timedelta(minutes=10),
        )
    )
    recovered = app.runs.acquire_worker_lock(
        AcquireRunWorkerLockRequest(
            cwd=repo,
            owner="second-worker",
            pid=os.getpid(),
            now=now + timedelta(minutes=11),
            stale_after=timedelta(minutes=10),
        )
    )

    assert first is not None
    assert blocked is None
    assert recovered is not None
    assert recovered.owner.owner == "second-worker"

    first.release()
    jobs_path = workspace_jobs_path(repo)
    assert (jobs_path / "worker.lock").is_dir()
    recovered.release()
    assert not (jobs_path / "worker.lock").exists()


def test_run_store_restores_previous_record_when_status_event_append_fails(
    tmp_path: Path,
):
    run_dir = tmp_path / "jobs"
    ledger = FailingAppendLedger()
    store = RunStore(ledger=ledger)
    record = store.create(
        run_dir,
        Path("jobs"),
        "workspace",
        RunOperation.INGEST,
        title=None,
    )

    ledger.fail_append = True
    with pytest.raises(OSError, match="cannot append event"):
        store.mark_running(run_dir, record.run_id)

    restored = store.read(run_dir, record.run_id)
    log = store.log(run_dir, record.run_id)

    assert restored.status == RunStatus.QUEUED
    assert restored.started_at is None
    assert tuple(event.message for event in log) == ("queued ingest",)


def test_run_store_removes_queue_spec_when_initial_event_append_fails(
    tmp_path: Path,
):
    run_dir = tmp_path / "jobs"
    ledger = FailingAppendLedger()
    store = RunStore(ledger=ledger)
    spec = RunSpec(
        operation=RunOperation.INGEST,
        cwd=tmp_path,
        harness=HarnessKind.CODEX,
        inputs=("note.md",),
    )

    ledger.fail_append = True
    with pytest.raises(OSError, match="cannot append event"):
        store.queue(
            run_dir,
            Path("jobs"),
            "workspace",
            spec,
            title=None,
        )

    assert store.list(run_dir, limit=None) == ()
    assert list(run_dir.glob("*.spec.json")) == []


def test_finish_run_request_requires_terminal_status(tmp_path: Path):
    with pytest.raises(ValidationError):
        FinishRunRequest(
            cwd=tmp_path,
            run_id="run-1",
            status=RunStatus.RUNNING,
        )


def test_run_id_requests_reject_path_shaped_identifiers(tmp_path: Path):
    request_classes = (
        ShowRunRequest,
        ReadRunLogRequest,
        AttachRunRequest,
        CancelRunRequest,
        ReadRunSpecRequest,
        MarkRunRunningRequest,
    )

    for request_class in request_classes:
        with pytest.raises(ValidationError, match="String should match pattern"):
            request_class(cwd=tmp_path, run_id="../secret")

    for bad_run_id in ("", "   ", "run.json", "run id"):
        with pytest.raises(ValidationError):
            ShowRunRequest(cwd=tmp_path, run_id=bad_run_id)


def test_run_records_and_events_reject_unsafe_run_ids(tmp_path: Path):
    now = datetime.now(UTC)

    with pytest.raises(ValidationError, match="String should match pattern"):
        RunRecord(
            run_id="../secret",
            workspace_id="workspace",
            operation=RunOperation.INGEST,
            status=RunStatus.QUEUED,
            title=None,
            created_at=now,
            updated_at=now,
            log_path=tmp_path / "run.jsonl",
        )

    with pytest.raises(ValidationError, match="String should match pattern"):
        RunLogEvent(
            run_id="run.json",
            sequence=1,
            timestamp=now,
            kind=RunEventKind.STATUS,
            message="queued ingest",
        )


def test_run_store_rejects_unsafe_run_ids_before_path_access(tmp_path: Path):
    store = RunStore()
    run_dir = tmp_path / "jobs"
    bad_record = run_dir / "run.json.json"
    bad_record.parent.mkdir(parents=True)
    bad_record.write_text("{}", encoding="utf-8")

    with pytest.raises(ValidationError, match="String should match pattern"):
        store.read(run_dir, "../secret")

    assert store.list(run_dir, limit=None) == ()
