from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.repositories.models import RepositoryName
from codealmanac.services.runs.models import RunId


class BuildRequest(CodeAlmanacModel):
    path: Path
    harness: HarnessKind
    model: str
    name: RepositoryName | None = None
    description: str = ""
    title: str | None = None
    guidance: str | None = None
    auto_commit: bool = True

    @field_validator("model", "title", "guidance")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "build request text")


class StartedBuildRequest(CodeAlmanacModel):
    """Executes a queued build run; the repository comes from the run record."""

    run_id: RunId
    harness: HarnessKind
    model: str
    title: str | None = None
    guidance: str | None = None
    auto_commit: bool = True

    @field_validator("model", "title", "guidance")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "build request text")
