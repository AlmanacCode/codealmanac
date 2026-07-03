from typing import Protocol

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.cloud_auth.models import CloudLoginSession
from codealmanac.workflows.cloud_login.requests import RunCloudLoginRequest


class BrowserOpener(Protocol):
    def open(self, url: str) -> bool:
        pass


class CloudLoginStartDecision(CodeAlmanacModel):
    open_browser: bool = False


class CloudLoginInteraction(Protocol):
    def started(
        self,
        session: CloudLoginSession,
        request: RunCloudLoginRequest,
    ) -> CloudLoginStartDecision:
        pass
