from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.engine.harnesses.models import HarnessKind


class RunNextLocalWorkerRequest(CodeAlmanacModel):
    repository_id: str | None = None
    branch_id: str | None = None
    operation: str = "update"
    harness: HarnessKind = HarnessKind.CODEX
    title: str | None = None
    guidance: str | None = None

    @field_validator("repository_id", "branch_id", "operation", "title", "guidance")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "local worker request text")


class SpawnLocalWorkerRequest(CodeAlmanacModel):
    cwd: Path
    repository_id: str
    branch_id: str
    operation: str = "update"
    harness: HarnessKind = HarnessKind.CODEX
    title: str | None = None
    guidance: str | None = None

    @field_validator("repository_id", "branch_id", "operation", "title", "guidance")
    @classmethod
    def require_spawn_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "local worker spawn text")
