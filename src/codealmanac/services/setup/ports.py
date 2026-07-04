from typing import Protocol

from codealmanac.cloud.auth.login_models import CloudLoginWorkflowResult
from codealmanac.cloud.auth.login_requests import RunCloudLoginRequest
from codealmanac.cloud.capture.models import CaptureEnableResult
from codealmanac.cloud.capture.requests import CaptureRepairRequest
from codealmanac.services.setup.models import InstructionChange, SetupTarget


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


class SetupCloudLogin(Protocol):
    def run(self, request: RunCloudLoginRequest) -> CloudLoginWorkflowResult:
        pass


class SetupCapture(Protocol):
    def repair(self, request: CaptureRepairRequest) -> CaptureEnableResult:
        pass
