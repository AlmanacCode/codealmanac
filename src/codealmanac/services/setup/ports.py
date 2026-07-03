from typing import Protocol

from codealmanac.services.automation.models import AutomationUninstallResult
from codealmanac.services.automation.requests import UninstallAutomationRequest
from codealmanac.services.setup.models import InstructionChange, SetupTarget
from codealmanac.workflows.cloud_login.models import CloudLoginWorkflowResult
from codealmanac.workflows.cloud_login.requests import RunCloudLoginRequest


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


class SetupAutomationCleaner(Protocol):
    def uninstall(
        self,
        request: UninstallAutomationRequest,
    ) -> AutomationUninstallResult:
        pass


class SetupCloudLogin(Protocol):
    def run(self, request: RunCloudLoginRequest) -> CloudLoginWorkflowResult:
        pass
