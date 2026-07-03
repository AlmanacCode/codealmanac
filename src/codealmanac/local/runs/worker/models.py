from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.local.control.models import ControlRunRecord
from codealmanac.local.delivery.execution.models import LocalDeliveryResult
from codealmanac.local.runs.execution.models import LocalEngineRunResult
from codealmanac.local.runs.preparation.models import LocalRunPreparationResult


class LocalWorkerRunResult(CodeAlmanacModel):
    processed: bool
    reason: str | None = None
    run: ControlRunRecord | None = None
    preparation: LocalRunPreparationResult | None = None
    engine: LocalEngineRunResult | None = None
    delivery: LocalDeliveryResult | None = None


class LocalWorkerSpawnResult(CodeAlmanacModel):
    child_pid: int
    command: tuple[str, ...]

    @field_validator("child_pid")
    @classmethod
    def positive_child_pid(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("local worker child pid must be positive")
        return value

    @field_validator("command")
    @classmethod
    def require_command(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if len(value) == 0:
            raise ValueError("local worker command must not be empty")
        for part in value:
            required_text(part, "local worker command part")
        return value
