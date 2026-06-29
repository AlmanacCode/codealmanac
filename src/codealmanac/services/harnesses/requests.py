from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.harnesses.models import HarnessKind


class RunHarnessRequest(CodeAlmanacModel):
    kind: HarnessKind
    cwd: Path
    prompt: str
    title: str | None = None

    @field_validator("prompt")
    @classmethod
    def require_prompt(cls, value: str) -> str:
        return required_text(value, "harness prompt")
