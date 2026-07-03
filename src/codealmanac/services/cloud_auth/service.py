from datetime import UTC, datetime

from codealmanac.core.errors import NotFoundError
from codealmanac.services.cloud_auth.models import (
    CloudAuthState,
    CloudIdentity,
    CloudLoginSession,
    CloudLogoutResult,
    CloudStatus,
)
from codealmanac.services.cloud_auth.ports import CloudAuthClient
from codealmanac.services.cloud_auth.requests import (
    CloudLoginPollRequest,
    CloudLoginStartRequest,
    CloudLogoutRequest,
    CloudStatusRequest,
    SaveCloudTokenRequest,
)
from codealmanac.services.cloud_auth.store import CloudAuthStore


class CloudAuthService:
    def __init__(self, store: CloudAuthStore, client: CloudAuthClient):
        self.store = store
        self.client = client

    def start_login(self, request: CloudLoginStartRequest) -> CloudLoginSession:
        return self.client.start_login(api_url=request.api_url)

    def poll_login(self, request: CloudLoginPollRequest) -> CloudLoginSession:
        return self.client.poll_login(
            api_url=request.api_url,
            session_id=request.session_id,
        )

    def save_token(self, request: SaveCloudTokenRequest) -> CloudIdentity:
        identity = self.client.me(api_url=request.api_url, token=request.access_token)
        self.store.save(
            CloudAuthState(
                api_url=request.api_url,
                access_token=request.access_token,
                refresh_token=request.refresh_token,
                github_user_id=identity.github_user_id,
                github_login=identity.github_login,
                logged_in_at=request.logged_in_at,
            )
        )
        return identity

    def status(self, request: CloudStatusRequest) -> CloudStatus:
        state = self.store.load()
        if state is None or state.api_url != request.api_url:
            return CloudStatus(api_url=request.api_url, authenticated=False)
        if not request.validate_remote:
            return CloudStatus(
                api_url=state.api_url,
                authenticated=True,
                github_user_id=state.github_user_id,
                github_login=state.github_login,
            )
        identity = self.client.me(api_url=state.api_url, token=state.token)
        if (
            identity.github_user_id != state.github_user_id
            or identity.github_login != state.github_login
        ):
            state = state.model_copy(
                update={
                    "github_user_id": identity.github_user_id,
                    "github_login": identity.github_login,
                    "logged_in_at": datetime.now(UTC),
                }
            )
            self.store.save(state)
        return CloudStatus(
            api_url=state.api_url,
            authenticated=True,
            github_user_id=identity.github_user_id,
            github_login=identity.github_login,
        )

    def require_state(self, request: CloudStatusRequest) -> CloudAuthState:
        state = self.store.load()
        if state is None or state.api_url != request.api_url:
            raise NotFoundError("cloud auth state", request.api_url)
        return state

    def logout(self, request: CloudLogoutRequest) -> CloudLogoutResult:
        state = self.store.load()
        if state is None or state.api_url != request.api_url:
            return CloudLogoutResult(api_url=request.api_url, signed_out=False)
        identity = self.client.logout(api_url=state.api_url, token=state.token)
        self.store.delete()
        return CloudLogoutResult(
            api_url=state.api_url,
            signed_out=True,
            github_user_id=identity.github_user_id,
            github_login=identity.github_login,
        )
