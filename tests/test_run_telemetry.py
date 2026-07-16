from datetime import UTC, datetime
from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.services.config.models import ConfigKey
from codealmanac.services.config.requests import SetConfigValueRequest
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.repositories.requests import RegisterRepositoryRequest
from codealmanac.services.runs.models import (
    RunExecutionRef,
    RunFailureCategory,
    RunKind,
    RunSpec,
    RunStatus,
)
from codealmanac.services.runs.requests import (
    CancelRunRequest,
    FinishRunCancellationRequest,
    FinishRunRequest,
    MarkRunRunningRequest,
    QueueRunRequest,
    ReadRunSpecRequest,
)
from codealmanac.services.telemetry.models import TelemetryEvent
from codealmanac.settings import AppConfig


@pytest.fixture(autouse=True)
def enable_test_telemetry(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("CODEALMANAC_NO_TELEMETRY", "DO_NOT_TRACK", "CI"):
        monkeypatch.delenv(name, raising=False)


class RecordingSender:
    def __init__(self):
        self.events: list[TelemetryEvent] = []

    def send(self, event: TelemetryEvent) -> None:
        self.events.append(event)


def queued_run(tmp_path: Path, *, model: str = "gpt-5.5"):
    sender = RecordingSender()
    app = create_app(
        AppConfig(database_path=tmp_path / "codealmanac.db"),
        telemetry_sender=sender,
    )
    repo = tmp_path / "repo"
    repo.mkdir()
    repository = app.repositories.register(RegisterRepositoryRequest(root_path=repo))
    run = app.runs.queue(
        QueueRunRequest(
            repository_id=repository.repository_id,
            spec=RunSpec(
                kind=RunKind.GARDEN,
                harness=HarnessKind.CODEX,
                model=model,
            ),
        )
    )
    return app, sender, run


def set_telemetry(app, *, enabled: bool) -> None:
    app.config.set(
        SetConfigValueRequest(
            key=ConfigKey.TELEMETRY_ENABLED,
            value=str(enabled).lower(),
        )
    )


def test_terminal_run_is_captured_exactly_once_without_identifiers(
    tmp_path: Path,
) -> None:
    app, sender, run = queued_run(tmp_path)
    app.runs.mark_running(MarkRunRunningRequest(run_id=run.run_id))

    request = FinishRunRequest(run_id=run.run_id, status=RunStatus.DONE)
    app.runs.finish(request)
    app.runs.finish(request)

    assert len(sender.events) == 1
    event = sender.events[0]
    assert event.name == "lifecycle run completed"
    assert event.properties["run_kind"] == "garden"
    assert event.properties["status"] == "done"
    assert event.properties["harness"] == "codex"
    assert event.properties["model"] == "gpt-5.5"
    assert "failure_category" not in event.properties
    dumped = event.model_dump_json()
    assert run.run_id not in dumped
    assert str(tmp_path) not in dumped


def test_failed_run_has_only_controlled_failure_category(tmp_path: Path) -> None:
    app, sender, run = queued_run(tmp_path)
    app.runs.mark_running(MarkRunRunningRequest(run_id=run.run_id))

    app.runs.finish(
        FinishRunRequest(
            run_id=run.run_id,
            status=RunStatus.FAILED,
            error="private provider output",
            failure_category=RunFailureCategory.PROVIDER_EXECUTION,
        )
    )

    assert sender.events[0].properties["failure_category"] == "provider_execution"
    assert "private provider output" not in sender.events[0].model_dump_json()


def test_lifecycle_event_drops_uncontrolled_private_model_text(
    tmp_path: Path,
) -> None:
    private_model = "/Users/alice/private-model-token"
    app, sender, run = queued_run(tmp_path, model=private_model)

    app.runs.finish(
        FinishRunRequest(run_id=run.run_id, status=RunStatus.DONE)
    )

    assert sender.events == []


def test_queued_cancellation_emits_terminal_event(tmp_path: Path) -> None:
    app, sender, run = queued_run(tmp_path)

    app.runs.prepare_cancellation(CancelRunRequest(run_id=run.run_id))

    assert sender.events[0].properties["status"] == "cancelled"


def test_opted_out_finish_is_not_replayed_after_reenable(tmp_path: Path) -> None:
    app, sender, run = queued_run(tmp_path)
    app.runs.mark_running(MarkRunRunningRequest(run_id=run.run_id))
    request = FinishRunRequest(run_id=run.run_id, status=RunStatus.DONE)

    set_telemetry(app, enabled=False)
    app.runs.finish(request)
    set_telemetry(app, enabled=True)
    app.runs.finish(request)

    assert sender.events == []


def test_finish_succeeds_when_telemetry_spec_read_fails(
    tmp_path: Path,
    monkeypatch,
) -> None:
    app, _sender, run = queued_run(tmp_path)
    app.runs.mark_running(MarkRunRunningRequest(run_id=run.run_id))
    monkeypatch.setattr(
        app.runs.store,
        "read_spec",
        lambda _run_id: (_ for _ in ()).throw(OSError("read spec failed")),
    )

    finished = app.runs.finish(
        FinishRunRequest(run_id=run.run_id, status=RunStatus.DONE)
    )

    assert finished.status == RunStatus.DONE


def test_finish_succeeds_when_lifecycle_capture_raises(
    tmp_path: Path,
    monkeypatch,
) -> None:
    app, _sender, run = queued_run(tmp_path)
    app.runs.mark_running(MarkRunRunningRequest(run_id=run.run_id))
    monkeypatch.setattr(
        app.telemetry,
        "capture_lifecycle",
        lambda *_args: (_ for _ in ()).throw(RuntimeError("capture failed")),
    )

    finished = app.runs.finish(
        FinishRunRequest(run_id=run.run_id, status=RunStatus.DONE)
    )

    assert finished.status == RunStatus.DONE


def test_lifecycle_shaping_failures_never_escape(
    tmp_path: Path,
    monkeypatch,
) -> None:
    app, sender, run = queued_run(tmp_path)
    record = run.model_copy(
        update={
            "status": RunStatus.DONE,
            "finished_at": run.created_at,
        }
    )
    spec = app.runs.read_spec(ReadRunSpecRequest(run_id=run.run_id))
    assert spec is not None
    monkeypatch.setattr(
        "codealmanac.services.telemetry.service.duration_bucket",
        lambda _seconds: (_ for _ in ()).throw(RuntimeError("shaping failed")),
    )

    app.telemetry.capture_lifecycle(record, spec)

    assert sender.events == []


def test_opted_out_queued_cancellation_is_not_replayed_after_reenable(
    tmp_path: Path,
) -> None:
    app, sender, run = queued_run(tmp_path)
    request = CancelRunRequest(run_id=run.run_id)

    set_telemetry(app, enabled=False)
    app.runs.prepare_cancellation(request)
    set_telemetry(app, enabled=True)
    app.runs.prepare_cancellation(request)

    assert sender.events == []


def test_queued_cancellation_succeeds_when_telemetry_spec_read_fails(
    tmp_path: Path,
    monkeypatch,
) -> None:
    app, _sender, run = queued_run(tmp_path)
    monkeypatch.setattr(
        app.runs.store,
        "read_spec",
        lambda _run_id: (_ for _ in ()).throw(OSError("read spec failed")),
    )

    result = app.runs.prepare_cancellation(CancelRunRequest(run_id=run.run_id))

    assert result.record.status == RunStatus.CANCELLED


def test_opted_out_running_cancellation_is_not_replayed_after_reenable(
    tmp_path: Path,
) -> None:
    app, sender, run = queued_run(tmp_path)
    execution = RunExecutionRef(
        execution_id="executor-1",
        pid=4242,
        process_started_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
    app.runs.mark_running(
        MarkRunRunningRequest(run_id=run.run_id, execution=execution)
    )
    app.runs.prepare_cancellation(CancelRunRequest(run_id=run.run_id))
    request = FinishRunCancellationRequest(
        run_id=run.run_id,
        execution_id=execution.execution_id,
    )

    set_telemetry(app, enabled=False)
    app.runs.finish_cancellation(request)
    set_telemetry(app, enabled=True)
    app.runs.finish_cancellation(request)

    assert sender.events == []


def test_running_cancellation_succeeds_when_telemetry_spec_read_fails(
    tmp_path: Path,
    monkeypatch,
) -> None:
    app, _sender, run = queued_run(tmp_path)
    execution = RunExecutionRef(
        execution_id="executor-1",
        pid=4242,
        process_started_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
    app.runs.mark_running(
        MarkRunRunningRequest(run_id=run.run_id, execution=execution)
    )
    app.runs.prepare_cancellation(CancelRunRequest(run_id=run.run_id))
    monkeypatch.setattr(
        app.runs.store,
        "read_spec",
        lambda _run_id: (_ for _ in ()).throw(OSError("read spec failed")),
    )

    result = app.runs.finish_cancellation(
        FinishRunCancellationRequest(
            run_id=run.run_id,
            execution_id=execution.execution_id,
        )
    )

    assert result.record.status == RunStatus.CANCELLED


def test_worker_spawn_crash_emits_exception_and_failed_lifecycle(
    tmp_path: Path,
) -> None:
    class BrokenExecutorSpawner:
        def spawn(self, request):
            raise OSError(f"cannot spawn in {tmp_path} token=private")

    sender = RecordingSender()
    app = create_app(
        AppConfig(database_path=tmp_path / "codealmanac.db"),
        telemetry_sender=sender,
        executor_spawner=BrokenExecutorSpawner(),
    )
    repo = tmp_path / "repo"
    repo.mkdir()
    repository = app.repositories.register(RegisterRepositoryRequest(root_path=repo))
    app.runs.queue(
        QueueRunRequest(
            repository_id=repository.repository_id,
            spec=RunSpec(
                kind=RunKind.GARDEN,
                harness=HarnessKind.CODEX,
                model="gpt-5.5",
            ),
        )
    )
    queued = app.runs.next_queued()
    assert queued is not None

    record = app.workflows.queue.worker.run_queued(queued)

    assert record.status == RunStatus.FAILED
    assert [event.name for event in sender.events] == [
        "$exception",
        "lifecycle run completed",
    ]
    assert sender.events[0].properties["process_kind"] == "worker"
    assert sender.events[1].properties["failure_category"] == "internal_error"
    dumped = "".join(event.model_dump_json() for event in sender.events)
    assert str(tmp_path) not in dumped
    assert "private" not in dumped


def test_worker_wait_crash_is_captured_even_after_executor_finished(
    tmp_path: Path,
) -> None:
    class FinishThenBreakSpawner:
        app = None

        def spawn(self, request):
            app = self.app

            class Process:
                def wait(self):
                    app.runs.mark_running(
                        MarkRunRunningRequest(run_id=request.run_id)
                    )
                    app.runs.finish(
                        FinishRunRequest(
                            run_id=request.run_id,
                            status=RunStatus.DONE,
                        )
                    )
                    raise OSError("worker wait machinery failed")

            return Process()

    sender = RecordingSender()
    spawner = FinishThenBreakSpawner()
    app = create_app(
        AppConfig(database_path=tmp_path / "codealmanac.db"),
        telemetry_sender=sender,
        executor_spawner=spawner,
    )
    spawner.app = app
    repo = tmp_path / "repo"
    repo.mkdir()
    repository = app.repositories.register(RegisterRepositoryRequest(root_path=repo))
    app.runs.queue(
        QueueRunRequest(
            repository_id=repository.repository_id,
            spec=RunSpec(
                kind=RunKind.GARDEN,
                harness=HarnessKind.CODEX,
                model="gpt-5.5",
            ),
        )
    )
    queued = app.runs.next_queued()
    assert queued is not None

    record = app.workflows.queue.worker.run_queued(queued)

    assert record.status == RunStatus.DONE
    assert [event.name for event in sender.events] == [
        "lifecycle run completed",
        "$exception",
    ]
