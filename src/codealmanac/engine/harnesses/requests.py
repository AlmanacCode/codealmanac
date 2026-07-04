from collections.abc import Callable
from pathlib import Path

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.engine.harnesses.models import HarnessEvent, HarnessKind

HarnessEventSink = Callable[[HarnessEvent], None]


class RunHarnessRequest(CodeAlmanacModel):
    kind: HarnessKind
    cwd: Path
    prompt: str
    title: str | None = None
    event_sink: HarnessEventSink | None = Field(default=None, exclude=True, repr=False)

    @field_validator("prompt")
    @classmethod
    def require_prompt(cls, value: str) -> str:
        return required_text(value, "harness prompt")
