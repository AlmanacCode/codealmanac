from typing import Protocol

from codealmanac.services.cloud_capture.models import (
    CaptureCloudStatus,
    CaptureCredentialIssue,
    CaptureHookChange,
    CaptureHookStatus,
    CaptureProvider,
)


class CloudCaptureClient(Protocol):
    def issue_capture_credential(
        self,
        *,
        api_url: str,
        cli_token: str,
        name: str,
    ) -> CaptureCredentialIssue:
        pass

    def capture_status(self, *, api_url: str, cli_token: str) -> CaptureCloudStatus:
        pass

    def revoke_capture_credential(
        self,
        *,
        api_url: str,
        cli_token: str,
        capture_token: str,
    ) -> bool:
        pass


class CaptureHookManager(Protocol):
    def install(self, provider: CaptureProvider) -> CaptureHookChange:
        pass

    def uninstall(self, provider: CaptureProvider) -> CaptureHookChange:
        pass

    def status(self, provider: CaptureProvider) -> CaptureHookStatus:
        pass

