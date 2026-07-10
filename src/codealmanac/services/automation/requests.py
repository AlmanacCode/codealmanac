from datetime import timedelta
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.automation.models import AutomationTask


class AutomationSelectionRequest(CodeAlmanacModel):
    tasks: tuple[AutomationTask, ...] = ()
    home: Path | None = None


class InstallAutomationRequest(AutomationSelectionRequest):
    every: timedelta | None = None
    garden_every: timedelta | None = None
    garden_off: bool = False
    env_path: str | None = None
    codealmanac_executable: Path | None = None

    @field_validator("every", "garden_every")
    @classmethod
    def non_negative_duration(
        cls,
        value: timedelta | None,
    ) -> timedelta | None:
        if value is not None and value.total_seconds() < 0:
            raise ValueError("automation duration must be non-negative")
        return value


class UninstallAutomationRequest(AutomationSelectionRequest):
    pass


class AutomationStatusRequest(AutomationSelectionRequest):
    pass
