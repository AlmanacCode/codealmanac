from pathlib import Path

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.runs.models import RunId
from codealmanac.wiki.workspaces.roots import validate_almanac_root_field


class RunInitRequest(CodeAlmanacModel):
    path: Path
    harness: HarnessKind
    almanac_root: Path | None = None
    name: str | None = Field(
        default=None,
        description="None means derive the registry name from the workspace path.",
    )
    description: str = ""
    title: str | None = None
    guidance: str | None = None
    force: bool = False

    @field_validator("almanac_root")
    @classmethod
    def validate_almanac_root(cls, value: Path | None) -> Path | None:
        if value is None:
            return None
        return validate_almanac_root_field(value)

    @field_validator("name", "title", "guidance")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "init request text")


class RunInitWithRunRequest(RunInitRequest):
    run_id: RunId
