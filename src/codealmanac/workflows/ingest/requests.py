from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import optional_text
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.repositories.models import RepositoryName
from codealmanac.services.runs.models import RunId


class IngestRequest(CodeAlmanacModel):
    cwd: Path
    inputs: tuple[str, ...]
    harness: HarnessKind
    model: str
    repository_name: RepositoryName | None = None
    title: str | None = None
    guidance: str | None = None
    auto_commit: bool = True

    @field_validator("inputs")
    @classmethod
    def require_inputs(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if len(value) == 0:
            raise ValueError("at least one ingest input is required")
        return value

    @field_validator("model", "title", "guidance")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        return optional_text(value, "ingest request text")


class StartedIngestRequest(IngestRequest):
    run_id: RunId
