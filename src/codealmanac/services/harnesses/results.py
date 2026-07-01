from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.harnesses.events import HarnessEvent, HarnessEventKind
from codealmanac.services.harnesses.kinds import HarnessKind, HarnessRunStatus


class HarnessReadiness(CodeAlmanacModel):
    kind: HarnessKind
    available: bool
    message: str

    @field_validator("message")
    @classmethod
    def require_message(cls, value: str) -> str:
        return required_text(value, "harness readiness message")


class HarnessTranscriptRef(CodeAlmanacModel):
    kind: HarnessKind
    session_id: str
    transcript_path: Path | None = None

    @field_validator("session_id")
    @classmethod
    def require_session_id(cls, value: str) -> str:
        return required_text(value, "harness transcript session id")


class HarnessRunResult(CodeAlmanacModel):
    kind: HarnessKind
    status: HarnessRunStatus
    output_text: str
    summary: str | None = None
    changed_files: tuple[Path, ...] = ()
    transcript: HarnessTranscriptRef | None = None
    events: tuple[HarnessEvent, ...] = ()

    @field_validator("output_text")
    @classmethod
    def require_output_text(cls, value: str) -> str:
        return required_text(value, "harness output")


def terminal_harness_event(
    kind: HarnessKind,
    status: HarnessRunStatus,
    output_text: str,
) -> HarnessEvent:
    return HarnessEvent(
        kind=HarnessEventKind.DONE,
        status=status,
        message=terminal_harness_message(kind, status, output_text),
    )


def terminal_harness_message(
    kind: HarnessKind,
    status: HarnessRunStatus,
    output_text: str,
) -> str:
    suffix = first_line(output_text)
    details = f": {suffix}" if suffix else ""
    return f"{kind.value} {status.value}{details}"


def first_line(value: str) -> str:
    lines = value.splitlines()
    return lines[0] if lines else value
