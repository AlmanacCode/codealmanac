from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.runs.models import RunId


class GardenRequest(CodeAlmanacModel):
    cwd: Path
    harness: HarnessKind
    model: str
    repository_name: str | None = None
    title: str | None = None
    guidance: str | None = None
    auto_commit: bool = True

    @field_validator("model", "title", "guidance")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "garden request text")


class StartedGardenRequest(GardenRequest):
    run_id: RunId
