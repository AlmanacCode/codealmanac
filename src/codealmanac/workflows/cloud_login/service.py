import time
from datetime import UTC, datetime

from codealmanac.services.cloud_auth.models import CloudLoginSession
from codealmanac.services.cloud_auth.requests import (
    CloudLoginPollRequest,
    CloudLoginStartRequest,
    CloudStatusRequest,
    SaveCloudTokenRequest,
)
from codealmanac.services.cloud_auth.service import CloudAuthService
from codealmanac.workflows.cloud_login.models import CloudLoginWorkflowResult
from codealmanac.workflows.cloud_login.ports import (
    BrowserOpener,
    CloudLoginInteraction,
    CloudLoginStartDecision,
)
from codealmanac.workflows.cloud_login.requests import RunCloudLoginRequest


class SilentCloudLoginInteraction:
    def started(
        self,
        session: CloudLoginSession,
        request: RunCloudLoginRequest,
    ) -> CloudLoginStartDecision:
        return CloudLoginStartDecision(open_browser=False)


class CloudLoginWorkflow:
    def __init__(
        self,
        auth: CloudAuthService,
        browser: BrowserOpener,
        interaction: CloudLoginInteraction | None = None,
    ):
        self.auth = auth
        self.browser = browser
        self.interaction = interaction or SilentCloudLoginInteraction()

    def run(self, request: RunCloudLoginRequest) -> CloudLoginWorkflowResult:
        if not request.force:
            status = self.auth.status(
                CloudStatusRequest(
                    api_url=request.api_url,
                    validate_remote=False,
                )
            )
            if status.authenticated:
                return CloudLoginWorkflowResult(
                    api_url=status.api_url,
                    status="already_signed_in",
                    github_user_id=status.github_user_id,
                    github_login=status.github_login,
                )
        started = self.auth.start_login(CloudLoginStartRequest(api_url=request.api_url))
        decision = self.interaction.started(started, request)
        if decision.open_browser:
            self.browser.open(started.verification_url)
        deadline = time.monotonic() + request.timeout_seconds
        while True:
            polled = self.auth.poll_login(
                CloudLoginPollRequest(
                    api_url=request.api_url,
                    session_id=started.session_id,
                )
            )
            if polled.status == "complete" and polled.access_token is not None:
                identity = self.auth.save_token(
                    SaveCloudTokenRequest(
                        api_url=request.api_url,
                        access_token=polled.access_token,
                        refresh_token=polled.refresh_token,
                        logged_in_at=datetime.now(UTC),
                    )
                )
                return CloudLoginWorkflowResult(
                    api_url=request.api_url,
                    status="signed_in",
                    github_user_id=identity.github_user_id,
                    github_login=identity.github_login,
                    verification_url=started.verification_url,
                    user_code=started.user_code,
                    expires_at=started.expires_at,
                )
            if polled.status == "expired":
                return CloudLoginWorkflowResult(
                    api_url=request.api_url,
                    status="expired",
                    verification_url=started.verification_url,
                    user_code=started.user_code,
                    expires_at=started.expires_at,
                )
            if time.monotonic() >= deadline:
                return CloudLoginWorkflowResult(
                    api_url=request.api_url,
                    status="timeout",
                    verification_url=started.verification_url,
                    user_code=started.user_code,
                    expires_at=started.expires_at,
                )
            time.sleep(request.poll_interval_seconds)
