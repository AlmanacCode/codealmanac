import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Event, Thread

import pytest
from conftest import initialize_repository
from pydantic import ValidationError

from codealmanac.app import create_app
from codealmanac.core.errors import ConflictError, NotFoundError
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessEventKind,
    HarnessKind,
    HarnessTranscriptRef,
)
from codealmanac.services.runs.models import (
    RunEventKind,
    RunKind,
    RunLogEvent,
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
    QueueRunRequest,
    ReadRunLogRequest,
    ReadRunSpecRequest,
    RecordRunEventRequest,
    RecordRunHarnessTranscriptRequest,
    ShowRunRequest,
    StartRunRequest,
    StreamRunAttachRequest,
)
from codealmanac.settings import AppConfig


def test_runs_service_records_run_and_events(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    repository = initialize_repository(app, path=repo)

    record = app.runs.start(
        StartRunRequest(
            repository_id=repository.repository_id,
            kind=RunKind.INGEST,
            title="Digest design note",
        )
    )
    running = app.runs.mark_running(MarkRunRunningRequest(run_id=record.run_id))
    event = app.runs.record_event(
        RecordRunEventRequest(
            run_id=record.run_id,
            kind=RunEventKind.MESSAGE,
            message="read design note",
        )
    )
    harness_log = app.runs.record_event(
        RecordRunEventRequest(
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
            run_id=record.run_id,
            transcript=transcript,
        )
    )
    finished = app.runs.finish(
        FinishRunRequest(
            run_id=record.run_id,
            status=RunStatus.DONE,
            summary="updated wiki",
        )
    )
    listed = app.runs.list(ListRunsRequest(repository_name="repo"))
    shown = app.runs.show(
        ShowRunRequest(repository_name="repo", run_id=record.run_id)
    )
    log = app.runs.log(ReadRunLogRequest(run_id=record.run_id))

    assert record.status == RunStatus.QUEUED
    assert running.status == RunStatus.RUNNING
    assert event.sequence == 3
    assert harness_log.harness_event is not None
    assert harness_log.harness_event.provider_session_id == "provider-thread-1"
    assert attached.harness_transcript == transcript
    assert finished.status == RunStatus.DONE
    assert finished.summary == "updated wiki"
    assert [run.run_id for run in listed] == [record.run_id]
    assert shown.status == RunStatus.DONE
    assert tuple(entry.kind for entry in log) == (
        RunEventKind.STATUS,
        RunEventKind.STATUS,
        RunEventKind.MESSAGE,
        RunEventKind.TOOL,
        RunEventKind.STATUS,
    )


def test_runs_service_filters_by_registered_repository_name(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    first = tmp_path / "first"
    second = tmp_path / "second"
    first.mkdir()
    second.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    first_repository = initialize_repository(app, path=first, name="first")
    second_repository = initialize_repository(app, path=second, name="second")

    record = app.runs.start(
        StartRunRequest(
            repository_id=first_repository.repository_id,
            kind=RunKind.GARDEN,
        )
    )
    app.runs.start(
        StartRunRequest(
            repository_id=second_repository.repository_id,
            kind=RunKind.INGEST,
        )
    )

    assert app.runs.list(ListRunsRequest(repository_name="first"))[0].run_id == (
        record.run_id
    )
    assert app.runs.show(
        ShowRunRequest(repository_name="first", run_id=record.run_id)
    ).repository_id == first_repository.repository_id
    with pytest.raises(NotFoundError):
        app.runs.show(ShowRunRequest(repository_name="second", run_id=record.run_id))


def test_runs_service_refuses_running_transition_after_terminal_status(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    repository = initialize_repository(app, path=repo)
    record = app.runs.start(
        StartRunRequest(repository_id=repository.repository_id, kind=RunKind.INGEST)
    )
    app.runs.finish(
        FinishRunRequest(
            run_id=record.run_id,
            status=RunStatus.FAILED,
            error="failed before running",
        )
    )

    with pytest.raises(ConflictError):
        app.runs.mark_running(MarkRunRunningRequest(run_id=record.run_id))


def test_runs_service_cancels_queued_run_and_attaches_log(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    repository = initialize_repository(app, path=repo)
    record = app.runs.start(
        StartRunRequest(repository_id=repository.repository_id, kind=RunKind.GARDEN)
    )

    result = app.runs.cancel(CancelRunRequest(run_id=record.run_id))
    snapshot = app.runs.attach(AttachRunRequest(run_id=record.run_id))

    assert result.changed is True
    assert result.record.status == RunStatus.CANCELLED
    assert snapshot.record.status == RunStatus.CANCELLED
    assert snapshot.terminal is True
    assert tuple(entry.message for entry in snapshot.events) == (
        "queued garden",
        "cancelled",
    )


def test_runs_service_finish_preserves_cancelled_run(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    repository = initialize_repository(app, path=repo)
    record = app.runs.start(
        StartRunRequest(repository_id=repository.repository_id, kind=RunKind.GARDEN)
    )
    app.runs.mark_running(MarkRunRunningRequest(run_id=record.run_id))
    cancelled = app.runs.cancel(CancelRunRequest(run_id=record.run_id))

    finished = app.runs.finish(
        FinishRunRequest(
            run_id=record.run_id,
            status=RunStatus.DONE,
            summary="should not win",
        )
    )

    assert cancelled.changed is True
    assert finished.status == RunStatus.CANCELLED
    assert finished.summary is None


def test_runs_service_streams_attach_until_run_is_terminal(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    repository = initialize_repository(app, path=repo)
    record = app.runs.start(
        StartRunRequest(repository_id=repository.repository_id, kind=RunKind.INGEST)
    )
    first_update_seen = Event()
    updates = []
    errors = []

    def consume_attach() -> None:
        try:
            for update in app.runs.stream_attach(
                StreamRunAttachRequest(
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
            run_id=record.run_id,
            kind=RunEventKind.MESSAGE,
            message="read note",
        )
    )
    app.runs.finish(
        FinishRunRequest(
            run_id=record.run_id,
            status=RunStatus.DONE,
            summary="complete",
        )
    )
    thread.join(timeout=2)

    assert thread.is_alive() is False
    assert errors == []
    assert tuple(
        event.message for update in updates for event in update.events
    ) == (
        "queued ingest",
        "read note",
        "done",
    )
    assert updates[-1].terminal is True


def test_runs_service_persists_queue_specs_and_selects_oldest_queued_run(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    repository = initialize_repository(app, path=repo)
    foreground = app.runs.start(
        StartRunRequest(repository_id=repository.repository_id, kind=RunKind.INGEST)
    )
    first = app.runs.queue(
        QueueRunRequest(
            repository_id=repository.repository_id,
            title="Ingest first note",
            spec=RunSpec(
                kind=RunKind.INGEST,
                harness=HarnessKind.CODEX,
                model="gpt-5.5",
                inputs=("first.md",),
            ),
        )
    )
    second = app.runs.queue(
        QueueRunRequest(
            repository_id=repository.repository_id,
            title="Garden later",
            spec=RunSpec(
                kind=RunKind.GARDEN,
                harness=HarnessKind.CODEX,
                model="gpt-5.5",
            ),
        )
    )

    spec = app.runs.read_spec(ReadRunSpecRequest(run_id=first.run_id))
    queued = app.runs.next_queued()
    listed = app.runs.list(ListRunsRequest(repository_name="repo"))

    assert spec is not None
    assert spec.inputs == ("first.md",)
    assert queued is not None
    assert queued.record.run_id == first.run_id
    assert {record.run_id for record in listed} == {
        foreground.run_id,
        first.run_id,
        second.run_id,
    }


def test_runs_service_worker_lock_is_exclusive_and_recovers_stale_owner(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    now = datetime(2026, 7, 1, 12, 0, tzinfo=UTC)

    first = app.runs.acquire_worker_lock(
        AcquireRunWorkerLockRequest(
            owner="first-worker",
            pid=os.getpid(),
            now=now,
            stale_after=timedelta(minutes=10),
        )
    )
    blocked = app.runs.acquire_worker_lock(
        AcquireRunWorkerLockRequest(
            owner="second-worker",
            pid=os.getpid(),
            now=now + timedelta(minutes=1),
            stale_after=timedelta(minutes=10),
        )
    )
    recovered = app.runs.acquire_worker_lock(
        AcquireRunWorkerLockRequest(
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

    recovered.release()
    after_release = app.runs.acquire_worker_lock(
        AcquireRunWorkerLockRequest(
            owner="third-worker",
            pid=os.getpid(),
            now=now + timedelta(minutes=12),
            stale_after=timedelta(minutes=10),
        )
    )
    assert after_release is not None
    after_release.release()


def test_finish_run_request_requires_terminal_status() -> None:
    with pytest.raises(ValidationError):
        FinishRunRequest(
            run_id="run-1",
            status=RunStatus.RUNNING,
        )


def test_run_id_requests_reject_path_shaped_identifiers() -> None:
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
            request_class(run_id="../secret")

    for bad_run_id in ("", "   ", "run.json", "run id"):
        with pytest.raises(ValidationError):
            ShowRunRequest(run_id=bad_run_id)


def test_run_records_and_events_reject_unsafe_run_ids(tmp_path: Path) -> None:
    now = datetime.now(UTC)

    with pytest.raises(ValidationError, match="String should match pattern"):
        RunRecord(
            run_id="../secret",
            repository_id="repository",
            kind=RunKind.INGEST,
            status=RunStatus.QUEUED,
            title=None,
            created_at=now,
            updated_at=now,
        )

    with pytest.raises(ValidationError, match="String should match pattern"):
        RunLogEvent(
            run_id="run.json",
            sequence=1,
            timestamp=now,
            kind=RunEventKind.STATUS,
            message="queued ingest",
        )
