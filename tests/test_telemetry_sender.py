import json
import subprocess
import sys

from codealmanac.integrations.telemetry.sender import (
    DEFAULT_PROJECT_API_KEY,
    POSTHOG_US_HOST,
    SubprocessTelemetrySender,
    deliver,
    strip_sdk_context,
)
from codealmanac.services.telemetry.models import TelemetryEvent, TelemetryIdentity


def example_event() -> TelemetryEvent:
    return TelemetryEvent(
        event_id="233d1427-6ca3-4c44-b62f-1362acd768fe",
        name="cli command completed",
        identity=TelemetryIdentity(
            installation_id="46918482-e884-4050-bcff-e94ef503cd0d",
            distinct_id="46918482-e884-4050-bcff-e94ef503cd0d",
            kind="anonymous",
        ),
        properties={
            "command": "health",
            "action": "health",
            "outcome": "success",
            "exit_code": 0,
            "duration_bucket": "<250ms",
            "interactive": False,
            "cli_version": "1.2.3",
            "identity_kind": "anonymous",
            "os_family": "darwin",
            "os_major": "25",
            "architecture": "arm64",
            "python_version": "3.13",
            "$geoip_disable": True,
        },
    )


def test_distribution_contains_only_a_public_project_key() -> None:
    assert DEFAULT_PROJECT_API_KEY.startswith("phc_")


def test_importing_parent_sender_does_not_import_posthog_sdk() -> None:
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "import sys; "
                "import codealmanac.integrations.telemetry.sender; "
                "print('posthog' in sys.modules)"
            ),
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    assert result.stdout.strip() == "False"


def test_subprocess_sender_detaches_and_writes_bounded_json(monkeypatch) -> None:
    spawned: list[tuple[list[str], dict]] = []

    class RecordingInput:
        def __init__(self):
            self.body = b""
            self.closed = False

        def write(self, body: bytes) -> None:
            self.body += body

        def close(self) -> None:
            self.closed = True

    class FakeProcess:
        def __init__(self):
            self.stdin = RecordingInput()

    process = FakeProcess()

    def fake_popen(command, **kwargs):
        spawned.append((command, kwargs))
        return process

    monkeypatch.setattr(
        "codealmanac.integrations.telemetry.sender.subprocess.Popen",
        fake_popen,
    )

    SubprocessTelemetrySender(project_api_key="phc_public").send(example_event())

    command, options = spawned[0]
    assert command[-2:] == ["-m", "codealmanac.integrations.telemetry.sender"]
    assert options["start_new_session"] is True
    assert options["close_fds"] is True
    assert options["env"]["CODEALMANAC_POSTHOG_PROJECT_KEY"] == "phc_public"
    payload = json.loads(process.stdin.body)
    assert payload["name"] == "cli command completed"
    assert "phc_public" not in json.dumps(payload)
    assert process.stdin.closed is True


def test_deliver_uses_uuid_geoip_disable_and_person_profile() -> None:
    calls: list[tuple[tuple, dict]] = []

    class FakeClient:
        def capture(self, *args, **kwargs):
            calls.append((args, kwargs))

        def shutdown(self):
            calls.append((("shutdown",), {}))

    clients: list[dict] = []

    def client_factory(key: str, **kwargs):
        clients.append({"key": key, **kwargs})
        return FakeClient()

    deliver(example_event(), "phc_public", client_factory=client_factory)

    assert clients == [
        {
            "key": "phc_public",
            "host": POSTHOG_US_HOST,
            "sync_mode": True,
            "timeout": 5,
            "disable_geoip": True,
            "enable_exception_autocapture": False,
            "capture_exception_code_variables": False,
            "before_send": strip_sdk_context,
        }
    ]
    args, kwargs = calls[0]
    assert args == ("cli command completed",)
    assert kwargs["distinct_id"] == str(example_event().identity.installation_id)
    assert kwargs["uuid"] == example_event().event_id
    assert kwargs["disable_geoip"] is True
    assert "$process_person_profile" not in kwargs["properties"]
    assert calls[-1] == (("shutdown",), {})


def test_sdk_context_is_removed_before_upload() -> None:
    message = {
        "properties": {
            "$lib": "posthog-python",
            "$lib_version": "7.24.0",
            "$is_server": True,
            "$os": "Mac OS X",
            "$os_version": "private-full-version",
            "$python_runtime": "CPython",
            "$python_version": "3.13.3",
            "os_family": "darwin",
            "os_major": "25",
            "python_version": "3.13",
        }
    }

    assert strip_sdk_context(message) == {
        "properties": {
            "os_family": "darwin",
            "os_major": "25",
            "python_version": "3.13",
        }
    }


def test_sender_drops_oversized_payload_without_spawning(monkeypatch) -> None:
    def fail_popen(*args, **kwargs):
        raise AssertionError("should not spawn")

    monkeypatch.setattr(
        "codealmanac.integrations.telemetry.sender.subprocess.Popen",
        fail_popen,
    )
    event = example_event().model_copy(
        update={"properties": {"message": "x" * 70_000}}
    )

    SubprocessTelemetrySender(project_api_key="phc_public").send(event)
