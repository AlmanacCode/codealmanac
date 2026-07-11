from typing import Protocol

from codealmanac.services.automation.models import (
    AutomationRemoveResult,
)
from codealmanac.services.automation.requests import (
    RemoveAllAutomationRequest,
)
from codealmanac.services.harnesses.models import HarnessKind, HarnessReadiness
from codealmanac.services.setup.models import (
    GlobalStateRemovalResult,
    InstructionChange,
    PackageUninstallResult,
    SetupTarget,
)


class InstructionInstaller(Protocol):
    def install(
        self,
        targets: tuple[SetupTarget, ...],
    ) -> tuple[InstructionChange, ...]:
        pass

    def uninstall(
        self,
        targets: tuple[SetupTarget, ...],
    ) -> tuple[InstructionChange, ...]:
        pass


class AutomationRemover(Protocol):
    def remove_all(
        self,
        request: RemoveAllAutomationRequest,
    ) -> AutomationRemoveResult:
        pass


class RunnerReadinessProbe(Protocol):
    def readiness(self, kind: HarnessKind) -> HarnessReadiness:
        """Return local readiness of one runner without starting an agent run."""


class GlobalStateRemover(Protocol):
    def remove(self) -> GlobalStateRemovalResult:
        pass


class PackageUninstaller(Protocol):
    def uninstall(self) -> PackageUninstallResult:
        pass
