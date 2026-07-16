import json
import os
import subprocess
import sys
from collections.abc import Callable
from typing import Any

from codealmanac.services.telemetry.models import TelemetryEvent

POSTHOG_US_HOST = "https://us.i.posthog.com"
PROJECT_KEY_ENV = "CODEALMANAC_POSTHOG_PROJECT_KEY"
DEFAULT_PROJECT_API_KEY = "phc_ypqXB8PiWLTYn3DsKDyYb4KDEnzNsrhwrQPC8Xqd9K5i"
MAX_EVENT_BYTES = 64 * 1024
SDK_CONTEXT_PROPERTIES = frozenset(
    (
        "$is_server",
        "$lib",
        "$lib_version",
        "$os",
        "$os_distro",
        "$os_version",
        "$python_runtime",
        "$python_version",
    )
)


class SubprocessTelemetrySender:
    def __init__(self, project_api_key: str = DEFAULT_PROJECT_API_KEY):
        self.project_api_key = project_api_key

    def send(self, event: TelemetryEvent) -> None:
        if not self.project_api_key:
            return
        payload = event.model_dump_json().encode()
        if len(payload) > MAX_EVENT_BYTES:
            return
        process = subprocess.Popen(
            [sys.executable, "-m", "codealmanac.integrations.telemetry.sender"],
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            close_fds=True,
            start_new_session=True,
            env={**os.environ, PROJECT_KEY_ENV: self.project_api_key},
        )
        if process.stdin is None:
            return
        process.stdin.write(payload)
        process.stdin.close()


def deliver(
    event: TelemetryEvent,
    project_api_key: str,
    *,
    client_factory: Callable[..., Any] | None = None,
) -> None:
    if client_factory is None:
        from posthog import Posthog

        client_factory = Posthog
    client = client_factory(
        project_api_key,
        host=POSTHOG_US_HOST,
        sync_mode=True,
        timeout=5,
        disable_geoip=True,
        enable_exception_autocapture=False,
        capture_exception_code_variables=False,
        before_send=strip_sdk_context,
    )
    try:
        client.capture(
            event.name,
            distinct_id=event.identity.distinct_id,
            properties=event.properties,
            uuid=event.event_id,
            disable_geoip=True,
        )
    finally:
        client.shutdown()


def strip_sdk_context(message: dict[str, Any]) -> dict[str, Any]:
    properties = message.get("properties")
    if isinstance(properties, dict):
        for key in SDK_CONTEXT_PROPERTIES:
            properties.pop(key, None)
    return message


def main() -> int:
    try:
        payload = sys.stdin.buffer.read(MAX_EVENT_BYTES + 1)
        if len(payload) > MAX_EVENT_BYTES:
            return 0
        project_api_key = os.environ.get(PROJECT_KEY_ENV, DEFAULT_PROJECT_API_KEY)
        if not project_api_key:
            return 0
        event = TelemetryEvent.model_validate(json.loads(payload))
        deliver(event, project_api_key)
    except Exception:
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
