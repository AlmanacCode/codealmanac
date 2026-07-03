from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.engine.harnesses.models import HarnessKind
from codealmanac.jobs.ledger.models import JobId


class RunGardenRequest(CodeAlmanacModel):
    cwd: Path
    harness: HarnessKind
    wiki: str | None = None
    title: str | None = None
    guidance: str | None = None

    @field_validator("title", "guidance")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "garden request text")


class RunGardenWithJobRequest(RunGardenRequest):
    job_id: JobId
