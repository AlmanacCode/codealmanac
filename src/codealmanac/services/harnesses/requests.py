from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.harnesses.models import HarnessAgentKind, HarnessKind


class RunHarnessRequest(CodeAlmanacModel):
    kind: HarnessKind
    model: str
    agent: HarnessAgentKind
    cwd: Path
    prompt: str
    title: str | None = None

    @field_validator("model", "prompt")
    @classmethod
    def require_text(cls, value: str) -> str:
        return required_text(value, "harness request text")
