from argparse import Namespace
from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.cli.main import main
from codealmanac.cli.telemetry import command_action, duration_bucket
from codealmanac.services.automation.models import ScheduledJob, ScheduledJobStatus
from codealmanac.services.setup.models import (
    PackageUninstallResult,
    PackageUninstallStatus,
)
from codealmanac.services.telemetry.models import TelemetryEvent
from codealmanac.services.updates.models import UpdateInstallMethod
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


class SkippedPackageUninstaller:
    def uninstall(self) -> PackageUninstallResult:
        return PackageUninstallResult(
            status=PackageUninstallStatus.SKIPPED,
            method=UpdateInstallMethod.UNKNOWN,
            message="test package removal skipped",
        )


class SkippedScheduler:
    def install(self, _job: ScheduledJob) -> ScheduledJobStatus:
        raise AssertionError("install is not expected during uninstall")

    def uninstall(self, _job: ScheduledJob) -> bool:
        return False

    def status(self, _job: ScheduledJob) -> ScheduledJobStatus:
        raise AssertionError("status is not expected during uninstall")


@pytest.mark.parametrize(
    ("namespace", "expected"),
    (
        (Namespace(command="search", query="private query"), ("search", "search")),
        (Namespace(command="sync", sync_command=None), ("sync", "run")),
        (Namespace(command="sync", sync_command="status"), ("sync", "status")),
        (Namespace(command="topics", topic_command=None), ("topics", "list")),
        (Namespace(command="topics", topic_command="delete"), ("topics", "delete")),
        (Namespace(command="config", config_command="set"), ("config", "set")),
        (Namespace(command="jobs", jobs_command=None), ("jobs", "list")),
        (Namespace(command="jobs", jobs_command="attach"), ("jobs", "attach")),
        (
            Namespace(command="automation", automation_command="status"),
            ("automation", "status"),
        ),
        (
            Namespace(command="update", check=False, scheduled=False),
            ("update", "run"),
        ),
        (
            Namespace(command="update", check=True, scheduled=False),
            ("update", "check"),
        ),
        (
            Namespace(command="update", check=False, scheduled=True),
            ("update", "scheduled"),
        ),
    ),
)
def test_command_action_uses_only_controlled_parser_fields(
    namespace: Namespace,
    expected: tuple[str, str],
) -> None:
    assert command_action(namespace) == expected


def test_hidden_commands_are_not_product_commands() -> None:
    assert command_action(Namespace(command="__run-worker")) is None


@pytest.mark.parametrize(
    ("seconds", "expected"),
    (
        (0.249, "<250ms"),
        (0.25, "250ms-1s"),
        (1, "1-10s"),
        (10, "10-60s"),
        (60, "1-5m"),
        (300, "5m+"),
    ),
)
def test_duration_buckets(seconds: float, expected: str) -> None:
    assert duration_bucket(seconds) == expected


def test_main_captures_successful_command_without_arguments(
    tmp_path: Path,
    monkeypatch,
) -> None:
    sender = RecordingSender()
    app = create_app(
        AppConfig(database_path=tmp_path / "codealmanac.db"),
        telemetry_sender=sender,
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["config", "list", "--json"]) == 0

    event = sender.events[0]
    assert event.name == "cli command completed"
    assert event.properties["command"] == "config"
    assert event.properties["action"] == "list"
    assert event.properties["outcome"] == "success"
    assert event.properties["exit_code"] == 0
    assert "argv" not in event.properties
    assert "json" not in event.properties


def test_main_captures_handled_failure_without_exception(
    tmp_path: Path,
    monkeypatch,
) -> None:
    sender = RecordingSender()
    app = create_app(
        AppConfig(database_path=tmp_path / "codealmanac.db"),
        telemetry_sender=sender,
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["show", "private-page-name"]) == 1

    assert [event.name for event in sender.events] == ["cli command completed"]
    assert sender.events[0].properties["outcome"] == "failed"


def test_current_config_opt_out_command_emits_no_event(
    tmp_path: Path,
    monkeypatch,
) -> None:
    sender = RecordingSender()
    app = create_app(
        AppConfig(database_path=tmp_path / "codealmanac.db"),
        telemetry_sender=sender,
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["config", "set", "telemetry.enabled", "false", "--json"]) == 0

    assert app.config.load_user().telemetry.enabled is False
    assert sender.events == []


def test_uninstall_preserves_preexisting_opt_out_and_removes_identity_state(
    isolated_home: Path,
    monkeypatch,
) -> None:
    sender = RecordingSender()
    database_path = isolated_home / ".codealmanac/codealmanac.db"
    app = create_app(
        AppConfig(database_path=database_path),
        scheduler=SkippedScheduler(),
        telemetry_sender=sender,
        package_uninstaller=SkippedPackageUninstaller(),
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["config", "set", "telemetry.enabled", "false", "--json"]) == 0
    assert main(["uninstall", "--yes", "--json"]) == 0

    assert sender.events == []
    assert not database_path.exists()


def test_main_captures_crash_and_reraises(
    tmp_path: Path,
    monkeypatch,
) -> None:
    sender = RecordingSender()
    app = create_app(
        AppConfig(database_path=tmp_path / "codealmanac.db"),
        telemetry_sender=sender,
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    def crash(args, app):
        raise RuntimeError(f"boom at {tmp_path} token=private")

    monkeypatch.setattr("codealmanac.cli.execution.dispatch_app", crash)

    with pytest.raises(RuntimeError, match="boom"):
        main(["health"])

    assert [event.name for event in sender.events] == [
        "$exception",
        "cli command completed",
    ]
    assert sender.events[-1].properties["outcome"] == "crashed"
    assert str(tmp_path) not in sender.events[0].model_dump_json()
    assert "private" not in sender.events[0].model_dump_json()


def test_exception_shaping_cannot_replace_original_crash(
    tmp_path: Path,
    monkeypatch,
) -> None:
    class BrokenStringError(RuntimeError):
        def __str__(self) -> str:
            raise RuntimeError("exception stringification failed")

    sender = RecordingSender()
    app = create_app(
        AppConfig(database_path=tmp_path / "codealmanac.db"),
        telemetry_sender=sender,
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    def crash(args, app):
        raise BrokenStringError

    monkeypatch.setattr("codealmanac.cli.execution.dispatch_app", crash)

    with pytest.raises(BrokenStringError):
        main(["health"])

    assert [event.name for event in sender.events] == [
        "$exception",
        "cli command completed",
    ]
    assert sender.events[0].properties["$exception_message"] == "BrokenStringError"


def test_main_captures_interruption_and_reraises(
    tmp_path: Path,
    monkeypatch,
) -> None:
    sender = RecordingSender()
    app = create_app(
        AppConfig(database_path=tmp_path / "codealmanac.db"),
        telemetry_sender=sender,
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    def interrupt(args, app):
        raise KeyboardInterrupt

    monkeypatch.setattr("codealmanac.cli.execution.dispatch_app", interrupt)

    with pytest.raises(KeyboardInterrupt):
        main(["health"])

    assert [event.name for event in sender.events] == ["cli command completed"]
    assert sender.events[0].properties["outcome"] == "interrupted"
    assert sender.events[0].properties["exit_code"] == 130


def test_jobs_attach_returned_130_is_captured_as_interrupted(
    tmp_path: Path,
    monkeypatch,
) -> None:
    sender = RecordingSender()
    app = create_app(
        AppConfig(database_path=tmp_path / "codealmanac.db"),
        telemetry_sender=sender,
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    def interrupted_attach(_request):
        def updates():
            raise KeyboardInterrupt
            yield

        return updates()

    monkeypatch.setattr(app.runs, "stream_attach", interrupted_attach)

    assert main(["jobs", "attach", "garden-attach-test"]) == 130

    event = sender.events[0]
    assert event.properties["command"] == "jobs"
    assert event.properties["action"] == "attach"
    assert event.properties["outcome"] == "interrupted"
    assert event.properties["exit_code"] == 130


def test_main_redacts_user_arguments_echoed_by_an_unhandled_error(
    tmp_path: Path,
    monkeypatch,
) -> None:
    sender = RecordingSender()
    app = create_app(
        AppConfig(database_path=tmp_path / "codealmanac.db"),
        telemetry_sender=sender,
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    def crash(args, app):
        raise RuntimeError(f"unexpected query: {args.query}")

    monkeypatch.setattr("codealmanac.cli.execution.dispatch_app", crash)

    with pytest.raises(RuntimeError, match="unexpected query"):
        main(["search", "private-customer-query"])

    assert "private-customer-query" not in sender.events[0].model_dump_json()


@pytest.mark.parametrize(
    ("argv", "expected_process_kind"),
    (
        (("__run-executor", "private-run-id"), "executor"),
        (("__run-worker", "--cwd", "/private/repository"), "worker"),
        (("__garden-scheduler",), "scheduler"),
    ),
)
def test_hidden_process_crash_has_process_kind_but_no_command_event(
    tmp_path: Path,
    monkeypatch,
    argv: tuple[str, ...],
    expected_process_kind: str,
) -> None:
    sender = RecordingSender()
    app = create_app(
        AppConfig(database_path=tmp_path / "codealmanac.db"),
        telemetry_sender=sender,
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    def crash(args, app):
        raise RuntimeError("unexpected executor crash")

    monkeypatch.setattr("codealmanac.cli.execution.dispatch_app", crash)

    with pytest.raises(RuntimeError, match="executor"):
        main(list(argv))

    assert [event.name for event in sender.events] == ["$exception"]
    assert sender.events[0].properties["process_kind"] == expected_process_kind
    assert "private-run-id" not in sender.events[0].model_dump_json()
    assert "/private/repository" not in sender.events[0].model_dump_json()
