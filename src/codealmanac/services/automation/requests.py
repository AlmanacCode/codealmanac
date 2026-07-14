from datetime import timedelta
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.automation.models import AutomationTask


class AutomationSelectionRequest(CodeAlmanacModel):
    tasks: tuple[AutomationTask, ...] = ()
    home: Path | None = None


class ReconcileAutomationTaskRequest(CodeAlmanacModel):
    task: AutomationTask
    enabled: bool
    every: timedelta
    home: Path | None = None
    env_path: str | None = None
    codealmanac_executable: Path | None = None

    @field_validator("every")
    @classmethod
    def positive_duration(cls, value: timedelta) -> timedelta:
        if value.total_seconds() <= 0:
            raise ValueError("automation duration must be greater than zero")
        return value


class RemoveAllAutomationRequest(CodeAlmanacModel):
    home: Path | None = None
    env_path: str | None = None
    codealmanac_executable: Path | None = None


class AutomationStatusRequest(AutomationSelectionRequest):
    pass
