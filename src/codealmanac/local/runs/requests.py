from pathlib import Path

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.engine.harnesses.models import HarnessKind
from codealmanac.local.control.models import ControlRunStatus
from codealmanac.local.runs.kinds import LocalRunKind


class StartLocalRunRequest(CodeAlmanacModel):
    cwd: Path
    branch_name: str | None = None
    kind: LocalRunKind = LocalRunKind.UPDATE
    harness: HarnessKind = HarnessKind.CODEX
    title: str | None = None
    guidance: str | None = None

    @field_validator("branch_name", "title", "guidance")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "local run start text")


class ListLocalRunsRequest(CodeAlmanacModel):
    repository_id: str | None = None
    branch_id: str | None = None
    statuses: tuple[ControlRunStatus, ...] = Field(default_factory=tuple)
    limit: int = 20

    @field_validator("repository_id", "branch_id")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "local run list filter")

    @field_validator("limit")
    @classmethod
    def require_valid_limit(cls, value: int) -> int:
        if value < 1 or value > 100:
            raise ValueError("local run list limit must be between 1 and 100")
        return value


class ShowLocalRunRequest(CodeAlmanacModel):
    run_id: str

    @field_validator("run_id")
    @classmethod
    def require_run_id(cls, value: str) -> str:
        return required_text(value, "local run id")


class ReadLocalRunLogsRequest(CodeAlmanacModel):
    run_id: str

    @field_validator("run_id")
    @classmethod
    def require_run_id(cls, value: str) -> str:
        return required_text(value, "local run id")
