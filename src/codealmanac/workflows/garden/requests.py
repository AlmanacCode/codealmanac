from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import optional_text
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.repositories.models import RepositoryName
from codealmanac.services.runs.models import RunId


class GardenRequest(CodeAlmanacModel):
    cwd: Path
    harness: HarnessKind
    model: str
    repository_name: RepositoryName | None = None
    title: str | None = None
    guidance: str | None = None
    auto_commit: bool = True

    @field_validator("model", "title", "guidance")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        return optional_text(value, "garden request text")


class StartedGardenRequest(GardenRequest):
    run_id: RunId
