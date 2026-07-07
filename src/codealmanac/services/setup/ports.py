from typing import Protocol

from codealmanac.services.automation.models import (
    AutomationInstallResult,
    AutomationUninstallResult,
)
from codealmanac.services.automation.requests import (
    InstallAutomationRequest,
    UninstallAutomationRequest,
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


class SetupAutomationManager(Protocol):
    def install(self, request: InstallAutomationRequest) -> AutomationInstallResult:
        pass

    def uninstall(
        self,
        request: UninstallAutomationRequest,
    ) -> AutomationUninstallResult:
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
