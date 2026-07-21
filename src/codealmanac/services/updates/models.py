import sys
from enum import StrEnum
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text

PACKAGE_NAME = "codealmanac"


class UpdateInstallMethod(StrEnum):
    UV_TOOL = "uv-tool"
    PIPX = "pipx"
    PIP = "pip"
    EDITABLE = "editable"
    UNKNOWN = "unknown"


class UpdateStatus(StrEnum):
    READY = "ready"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    UNSUPPORTED = "unsupported"
    FAILED = "failed"


class PackageInstallMetadata(CodeAlmanacModel):
    package: str = PACKAGE_NAME
    version: str
    installer: str | None = None
    editable: bool = False
    source_url: str | None = None
    python_executable: Path = Path(sys.executable)

    @field_validator("package", "version")
    @classmethod
    def require_text_fields(cls, value: str) -> str:
        return required_text(value, "package install metadata")

    @field_validator("installer", "source_url")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "package install metadata")


class PackageCommandResult(CodeAlmanacModel):
    exit_code: int
    stdout: str = ""
    stderr: str = ""


class UpdatePlan(CodeAlmanacModel):
    status: UpdateStatus
    method: UpdateInstallMethod
    installed_version: str
    command: tuple[str, ...] = ()
    message: str
    fix: str | None = None
    installer: str | None = None
    editable: bool = False
    source_url: str | None = None

    @field_validator("installed_version", "message")
    @classmethod
    def require_text_fields(cls, value: str) -> str:
        return required_text(value, "update plan")

    @field_validator("fix", "installer", "source_url")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "update plan")


class UpdateResult(CodeAlmanacModel):
    status: UpdateStatus
    plan: UpdatePlan
    exit_code: int | None = None
    stdout: str = ""
    stderr: str = ""
    message: str | None = None
    smoke: tuple["UpdateSmokeResult", ...] = ()

    @field_validator("message")
    @classmethod
    def normalize_optional_message(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "update result")


class UpdateSmokeResult(CodeAlmanacModel):
    command: tuple[str, ...]
    exit_code: int
    stdout: str = ""
    stderr: str = ""

    @field_validator("command")
    @classmethod
    def require_command(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if len(value) == 0:
            raise ValueError("smoke command is required")
        for part in value:
            required_text(part, "smoke command part")
        return value
