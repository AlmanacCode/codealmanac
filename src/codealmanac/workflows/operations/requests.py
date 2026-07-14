from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.harnesses.models import (
    HarnessAgentKind,
    HarnessEvent,
    HarnessKind,
)
from codealmanac.services.runs.models import RunEventKind, RunId
from codealmanac.workflows.operations.models import OperationContext


class BeginOperationRequest(CodeAlmanacModel):
    run_id: RunId


class RecordOperationEventRequest(CodeAlmanacModel):
    context: OperationContext
    kind: RunEventKind
    message: str
    harness_event: HarnessEvent | None = None

    @field_validator("message")
    @classmethod
    def require_message(cls, value: str) -> str:
        return required_text(value, "operation event message")


class ExecuteOperationRequest(CodeAlmanacModel):
    context: OperationContext
    harness: HarnessKind
    model: str
    agent: HarnessAgentKind
    prompt: str
    title: str | None = None
    success_summary: str

    @field_validator("model", "prompt", "success_summary")
    @classmethod
    def require_text(cls, value: str) -> str:
        return required_text(value, "operation request text")

    @field_validator("title")
    @classmethod
    def require_optional_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "operation title")
