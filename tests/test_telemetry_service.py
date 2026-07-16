from pathlib import Path

import pytest

from codealmanac.services.config.models import TelemetryConfig, UserConfig
from codealmanac.services.telemetry.models import (
    CliCommandCompletedProperties,
    TelemetryEvent,
)
from codealmanac.services.telemetry.service import TelemetryService
from codealmanac.services.telemetry.store import TelemetryIdentityStore


@pytest.fixture(autouse=True)
def enable_test_telemetry(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("CODEALMANAC_NO_TELEMETRY", "DO_NOT_TRACK", "CI"):
        monkeypatch.delenv(name, raising=False)


class StubConfig:
    def __init__(self, enabled: bool = True):
        self.enabled = enabled

    def load_user(self) -> UserConfig:
        return UserConfig(telemetry=TelemetryConfig(enabled=self.enabled))


class RecordingSender:
    def __init__(self):
        self.events: list[TelemetryEvent] = []

    def send(self, event: TelemetryEvent) -> None:
        self.events.append(event)


def command_properties(command: str = "health") -> CliCommandCompletedProperties:
    return CliCommandCompletedProperties(
        command=command,
        action=command,
        outcome="success",
        exit_code=0,
        duration_bucket="<250ms",
        interactive=False,
    )


def make_service(
    database_path: Path,
    *,
    enabled: bool = True,
) -> tuple[TelemetryService, RecordingSender]:
    sender = RecordingSender()
    service = TelemetryService(
        config=StubConfig(enabled),
        identities=TelemetryIdentityStore(database_path),
        sender=sender,
        version="1.2.3",
    )
    return service, sender


def test_identity_is_a_stable_uuid_stored_in_sqlite(tmp_path: Path) -> None:
    database_path = tmp_path / "state" / "codealmanac.db"
    service, _ = make_service(database_path)

    first = service.identity()
    second = make_service(database_path)[0].identity()

    assert first.installation_id.version == 4
    assert second == first
    assert first.distinct_id == str(first.installation_id)
    assert first.kind == "anonymous"


def test_disabled_policy_does_not_create_identity_or_send(tmp_path: Path) -> None:
    database_path = tmp_path / "codealmanac.db"
    service, sender = make_service(database_path, enabled=False)

    service.capture_command(command_properties())

    assert sender.events == []
    assert not database_path.exists()


def test_capture_adds_only_controlled_common_properties(tmp_path: Path) -> None:
    service, sender = make_service(tmp_path / "codealmanac.db")

    service.capture_command(command_properties("search"))

    assert len(sender.events) == 1
    event = sender.events[0]
    assert event.name == "cli command completed"
    assert event.identity.distinct_id == str(event.identity.installation_id)
    assert event.properties == {
        "command": "search",
        "action": "search",
        "outcome": "success",
        "exit_code": 0,
        "duration_bucket": "<250ms",
        "interactive": False,
        "cli_version": "1.2.3",
        "identity_kind": "anonymous",
        "os_family": event.properties["os_family"],
        "os_major": event.properties["os_major"],
        "architecture": event.properties["architecture"],
        "python_version": event.properties["python_version"],
        "$geoip_disable": True,
    }
    assert "$process_person_profile" not in event.properties


def test_capture_reloads_policy_for_each_event(tmp_path: Path) -> None:
    config = StubConfig(enabled=True)
    sender = RecordingSender()
    service = TelemetryService(
        config=config,
        identities=TelemetryIdentityStore(tmp_path / "codealmanac.db"),
        sender=sender,
        version="1.2.3",
    )

    service.capture_command(command_properties())
    config.enabled = False
    service.capture_command(command_properties("validate"))

    assert [event.properties["command"] for event in sender.events] == ["health"]


def test_sender_failures_never_escape(tmp_path: Path) -> None:
    class BrokenSender:
        def send(self, event: TelemetryEvent) -> None:
            raise OSError("offline")

    service = TelemetryService(
        config=StubConfig(),
        identities=TelemetryIdentityStore(tmp_path / "codealmanac.db"),
        sender=BrokenSender(),
        version="1.2.3",
    )

    service.capture_command(command_properties())


def test_capture_once_sends_only_the_first_attempt(tmp_path: Path) -> None:
    database_path = tmp_path / "codealmanac.db"
    service, sender = make_service(database_path)

    properties = {
        "run_kind": "garden",
        "status": "done",
        "harness": "codex",
        "model": "gpt-5.5",
        "duration_bucket": "1-10s",
    }
    service.capture_once(
        "run:abc:terminal",
        "lifecycle run completed",
        properties,
    )
    second_service, second_sender = make_service(database_path)
    second_service.capture_once(
        "run:abc:terminal",
        "lifecycle run completed",
        properties,
    )

    assert [event.name for event in sender.events] == ["lifecycle run completed"]
    assert second_sender.events == []


@pytest.mark.parametrize(
    ("name", "value"),
    (
        ("CODEALMANAC_NO_TELEMETRY", "true"),
        ("DO_NOT_TRACK", "1"),
        ("CI", "yes"),
    ),
)
def test_environment_policy_disables_capture(
    tmp_path: Path,
    monkeypatch,
    name: str,
    value: str,
) -> None:
    service, sender = make_service(tmp_path / "codealmanac.db")
    monkeypatch.setenv(name, value)

    service.capture_command(command_properties())

    assert sender.events == []


def test_event_allowlist_drops_unknown_properties(tmp_path: Path) -> None:
    service, sender = make_service(tmp_path / "codealmanac.db")

    service.capture(
        "cli command completed",
        {
            **command_properties().model_dump(),
            "query": "must never leave the machine",
        },
    )

    assert sender.events == []


def test_exception_capture_redacts_paths_secrets_and_source_code(
    tmp_path: Path,
) -> None:
    service, sender = make_service(tmp_path / "codealmanac.db")
    secret_path = tmp_path / "private" / "input.py"
    try:
        raise RuntimeError(
            f"failed at {secret_path} with token=secret-value and "
            "https://user:password@example.com/api"
        )
    except RuntimeError as error:
        service.capture_exception(
            error,
            command="garden",
            process_kind="executor",
            sensitive_paths=(tmp_path,),
        )

    event = sender.events[0]
    assert event.name == "$exception"
    dumped = event.model_dump_json()
    assert str(tmp_path) not in dumped
    assert "secret-value" not in dumped
    assert "password" not in dumped
    assert "raise RuntimeError" not in dumped
    exception = event.properties["$exception_list"][0]
    assert exception["mechanism"] == {"type": "generic", "handled": False}
    assert exception["stacktrace"]["type"] == "raw"
    assert event.properties["command"] == "garden"
    assert event.properties["process_kind"] == "executor"
    assert event.properties["$exception_fingerprint"]


def test_exception_capture_redacts_generic_paths_and_credentials(
    tmp_path: Path,
) -> None:
    service, sender = make_service(tmp_path / "codealmanac.db")
    try:
        raise RuntimeError(
            "failed /Volumes/customer/private.py and C:\\Users\\Ada\\secret.py "
            "password=hunter2 authorization=Bearer-private sk-live-secret"
        )
    except RuntimeError as error:
        service.capture_exception(
            error,
            command="garden",
            process_kind="executor",
        )

    dumped = sender.events[0].model_dump_json()
    assert "/Volumes/customer/private.py" not in dumped
    assert "C:\\\\Users\\\\Ada" not in dumped
    assert "hunter2" not in dumped
    assert "Bearer-private" not in dumped
    assert "sk-live-secret" not in dumped
