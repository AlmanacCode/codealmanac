from enum import StrEnum
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text


class HarnessKind(StrEnum):
    CODEX = "codex"
    CLAUDE = "claude"


class HarnessRunStatus(StrEnum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class HarnessReadiness(CodeAlmanacModel):
    kind: HarnessKind
    available: bool
    message: str

    @field_validator("message")
    @classmethod
    def require_message(cls, value: str) -> str:
        return required_text(value, "harness readiness message")


class HarnessRunResult(CodeAlmanacModel):
    kind: HarnessKind
    status: HarnessRunStatus
    output_text: str
    summary: str | None = None
    changed_files: tuple[Path, ...] = ()
