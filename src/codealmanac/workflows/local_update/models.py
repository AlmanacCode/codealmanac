from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.control.models import (
    ControlRunRecord,
    TriggerEventRecord,
)
from codealmanac.workflows.local_status.models import LocalStatusResult
from codealmanac.workflows.local_worker.models import LocalWorkerRunResult


class LocalUpdateResult(CodeAlmanacModel):
    started: bool
    reason: str | None = None
    status: LocalStatusResult
    trigger: TriggerEventRecord | None = None
    worker: LocalWorkerRunResult | None = None
    active_run: ControlRunRecord | None = None

    @field_validator("reason")
    @classmethod
    def require_optional_reason(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "local update reason")
