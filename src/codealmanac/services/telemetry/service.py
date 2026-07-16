import hashlib
import os
import platform
import re
import tempfile
from collections.abc import Mapping
from pathlib import Path
from types import TracebackType
from uuid import uuid4

from codealmanac.services.config.service import ConfigService
from codealmanac.services.runs.models import (
    RunFailureCategory,
    RunRecord,
    RunSpec,
    RunStatus,
)
from codealmanac.services.telemetry.durations import duration_bucket
from codealmanac.services.telemetry.models import (
    CliCommandCompletedProperties,
    LifecycleRunCompletedProperties,
    TelemetryEvent,
    TelemetryIdentity,
    TelemetryValue,
)
from codealmanac.services.telemetry.ports import TelemetrySender
from codealmanac.services.telemetry.store import TelemetryIdentityStore

TRUTHY_ENV_VALUES = frozenset(("1", "true", "yes", "on"))
TOKEN_PATTERN = re.compile(
    r"(?i)\b(api[_-]?key|access[_-]?token|auth[_-]?token|authorization|"
    r"credential|cookie|password|token|secret)\s*[=:]\s*[^\s,;]+"
)
URL_CREDENTIAL_PATTERN = re.compile(r"([a-z][a-z0-9+.-]{0,30}://)[^/@\s]+@", re.I)
COMMON_TOKEN_PATTERN = re.compile(
    r"(?i)\b(?:github_pat|gh[opsu]|phc|sk|xox[baprs])[-_][a-z0-9_-]{6,}\b"
)
POSIX_PATH_PATTERN = re.compile(r"(?<![:\w])/(?:[^\s,;:'\"<>()\[\]{}])+")
WINDOWS_PATH_PATTERN = re.compile(
    r"(?i)\b[a-z]:\\(?:[^\s,;:'\"<>()\[\]{}])+"
)
TILDE_PATH_PATTERN = re.compile(r"~/(?:[^\s,;:'\"<>()\[\]{}])+")
MAX_EXCEPTION_MESSAGE_LENGTH = 300


class TelemetryService:
    def __init__(
        self,
        config: ConfigService,
        identities: TelemetryIdentityStore,
        sender: TelemetrySender,
        version: str,
    ):
        self.config = config
        self.identities = identities
        self.sender = sender
        self.version = version
        self._identity: TelemetryIdentity | None = None
        self._prepared_policy: bool | None = None

    def identity(self) -> TelemetryIdentity:
        if self._identity is None:
            self._identity = self.identities.get_or_create()
        return self._identity

    def prepare_for_state_removal(self) -> None:
        """Freeze policy and identity before a command removes local state."""
        try:
            self._prepared_policy = self.enabled()
            if self._prepared_policy:
                self.identity()
        except Exception:
            self._prepared_policy = False
            return

    def capture(
        self,
        name: str,
        properties: Mapping[str, TelemetryValue],
    ) -> None:
        try:
            if not self.enabled():
                return
            self.sender.send(self.event(str(uuid4()), name, properties))
        except Exception:
            # Telemetry must never alter product behavior, output, or exit status.
            return

    def capture_command(self, properties: CliCommandCompletedProperties) -> None:
        self.capture("cli command completed", properties.model_dump())

    def capture_once(
        self,
        event_key: str,
        name: str,
        properties: Mapping[str, TelemetryValue],
    ) -> None:
        try:
            if not self.enabled():
                return
            event_id = self.identities.claim_event(event_key)
            if event_id is None:
                return
            self.sender.send(self.event(event_id, name, properties))
        except Exception:
            return

    def capture_exception(
        self,
        error: BaseException,
        *,
        command: str,
        process_kind: str,
        sensitive_paths: tuple[Path, ...] = (),
        sensitive_values: tuple[str, ...] = (),
    ) -> None:
        exception_type = type(error).__name__
        frames = safe_frames(error.__traceback__)
        fingerprint = exception_fingerprint(exception_type, frames)
        message = redact_exception_message(
            str(error) or exception_type,
            sensitive_paths,
            sensitive_values,
        )
        self.capture(
            "$exception",
            {
                "$exception_list": [
                    {
                        "mechanism": {
                            "type": "generic",
                            "handled": False,
                        },
                        "module": None,
                        "type": exception_type,
                        "value": message,
                        "stacktrace": {
                            "frames": frames,
                            "type": "raw",
                        },
                    }
                ],
                "$exception_fingerprint": fingerprint,
                "$exception_type": exception_type,
                "$exception_message": message,
                "command": command,
                "process_kind": process_kind,
            },
        )

    def capture_lifecycle(
        self,
        record: RunRecord,
        spec: RunSpec | None,
        failure_category: RunFailureCategory | None = None,
    ) -> None:
        if spec is None or record.finished_at is None:
            return
        started_at = record.started_at or record.created_at
        category = None
        if record.status == RunStatus.FAILED:
            category = (
                failure_category or RunFailureCategory.INTERNAL_ERROR
            ).value
        properties = LifecycleRunCompletedProperties(
            run_kind=record.kind.value,
            status=record.status.value,
            harness=spec.harness.value,
            model=spec.model,
            duration_bucket=duration_bucket(
                max(0.0, (record.finished_at - started_at).total_seconds())
            ),
            failure_category=category,
        )
        self.capture_once(
            f"run:{record.run_id}:terminal",
            "lifecycle run completed",
            properties.model_dump(exclude_none=True),
        )

    def enabled(self) -> bool:
        if any(
            env_truthy(name)
            for name in ("CODEALMANAC_NO_TELEMETRY", "DO_NOT_TRACK", "CI")
        ):
            return False
        if self._prepared_policy is not None:
            return self._prepared_policy
        return self.config.load_user().telemetry.enabled

    def event(
        self,
        event_id: str,
        name: str,
        properties: Mapping[str, TelemetryValue],
    ) -> TelemetryEvent:
        identity = self.identity()
        return TelemetryEvent(
            event_id=event_id,
            name=name,
            identity=identity,
            properties={
                    **properties,
                    "cli_version": self.version,
                    "identity_kind": identity.kind,
                    "os_family": platform.system().lower(),
                    "os_major": platform.release().split(".", 1)[0],
                    "architecture": platform.machine().lower(),
                    "python_version": (
                        f"{platform.python_version_tuple()[0]}."
                        f"{platform.python_version_tuple()[1]}"
                    ),
                    "$geoip_disable": True,
            },
        )


def env_truthy(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in TRUTHY_ENV_VALUES


def safe_frames(traceback: TracebackType | None) -> list[TelemetryValue]:
    frames: list[TelemetryValue] = []
    while traceback is not None:
        frame = traceback.tb_frame
        module = str(frame.f_globals.get("__name__", ""))
        if module == "codealmanac" or module.startswith("codealmanac."):
            filename = f"{module.replace('.', '/')}.py"
            frames.append(
                {
                    "platform": "python",
                    "filename": filename,
                    "module": module,
                    "function": frame.f_code.co_name,
                    "lineno": traceback.tb_lineno,
                    "in_app": True,
                }
            )
        traceback = traceback.tb_next
    return frames[-20:]


def exception_fingerprint(
    exception_type: str,
    frames: list[TelemetryValue],
) -> str:
    location = frames[-1] if frames else "no-codealmanac-frame"
    source = f"{exception_type}:{location}"
    return hashlib.sha256(source.encode()).hexdigest()[:20]


def redact_exception_message(
    message: str,
    sensitive_paths: tuple[Path, ...],
    sensitive_values: tuple[str, ...] = (),
) -> str:
    redacted = message
    paths = (*sensitive_paths, Path.home(), Path(tempfile.gettempdir()))
    path_strings = {str(path) for path in paths}
    path_strings.update(str(path.resolve()) for path in paths)
    for path in sorted(path_strings, key=len, reverse=True):
        if path and path != "/":
            redacted = redacted.replace(path, "<path>")
    for value in sorted(set(sensitive_values), key=len, reverse=True):
        if value and value not in {".", "-", "/"}:
            redacted = redacted.replace(value, "<argument>")
    redacted = URL_CREDENTIAL_PATTERN.sub(r"\1<credentials>@", redacted)
    redacted = TOKEN_PATTERN.sub(r"\1=<redacted>", redacted)
    redacted = COMMON_TOKEN_PATTERN.sub("<redacted>", redacted)
    redacted = WINDOWS_PATH_PATTERN.sub("<path>", redacted)
    redacted = POSIX_PATH_PATTERN.sub("<path>", redacted)
    redacted = TILDE_PATH_PATTERN.sub("<path>", redacted)
    return redacted[:MAX_EXCEPTION_MESSAGE_LENGTH]
