from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.engine.harnesses.models import HarnessKind
from codealmanac.local.control.models import LocalRunId


class ExecuteLocalEngineRunRequest(CodeAlmanacModel):
    run_id: LocalRunId
    harness: HarnessKind = HarnessKind.CODEX
    title: str | None = None
    guidance: str | None = None

    @field_validator("title", "guidance")
    @classmethod
    def require_optional_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "local engine title")
