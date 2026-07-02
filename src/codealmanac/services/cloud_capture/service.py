from datetime import UTC, datetime

from codealmanac.core.errors import ExecutionFailed
from codealmanac.services.cloud_auth.requests import CloudStatusRequest
from codealmanac.services.cloud_auth.service import CloudAuthService
from codealmanac.services.cloud_capture.event_store import CaptureEventStore
from codealmanac.services.cloud_capture.models import (
    CaptureDisableResult,
    CaptureEnableResult,
    CaptureHookEvent,
    CaptureState,
    CaptureStatus,
)
from codealmanac.services.cloud_capture.ports import (
    CaptureHookManager,
    CloudCaptureClient,
)
from codealmanac.services.cloud_capture.requests import (
    CaptureDisableRequest,
    CaptureEnableRequest,
    CaptureHookRequest,
    CaptureRepairRequest,
    CaptureStatusRequest,
)
from codealmanac.services.cloud_capture.store import CaptureStateStore


class CloudCaptureService:
    def __init__(
        self,
        *,
        auth: CloudAuthService,
        store: CaptureStateStore,
        events: CaptureEventStore,
        client: CloudCaptureClient,
        hooks: CaptureHookManager,
    ):
        self.auth = auth
        self.store = store
        self.events = events
        self.client = client
        self.hooks = hooks

    def status(self, request: CaptureStatusRequest) -> CaptureStatus:
        auth_status = self.auth.status(
            CloudStatusRequest(api_url=request.api_url, validate_remote=False)
        )
        state = self.store.load()
        providers = state.providers if state is not None else ()
        hook_statuses = tuple(self.hooks.status(provider) for provider in providers)
        cloud_credentials = ()
        if request.check_cloud and auth_status.authenticated:
            auth_state = self.auth.require_state(
                CloudStatusRequest(api_url=request.api_url)
            )
            cloud_credentials = self.client.capture_status(
                api_url=request.api_url,
                cli_token=auth_state.token,
            ).credentials
        return CaptureStatus(
            api_url=request.api_url,
            signed_in=auth_status.authenticated,
            credential_present=state is not None and state.api_url == request.api_url,
            providers=providers,
            hooks=hook_statuses,
            cloud_credentials=cloud_credentials,
        )

    def enable(self, request: CaptureEnableRequest) -> CaptureEnableResult:
        auth_state = self.auth.require_state(
            CloudStatusRequest(api_url=request.api_url)
        )
        issued = self.client.issue_capture_credential(
            api_url=request.api_url,
            cli_token=auth_state.token,
            name=request.name,
        )
        state = CaptureState(
            api_url=request.api_url,
            token=issued.token,
            created_at=datetime.now(UTC),
            providers=request.providers,
        )
        self.store.save(state)
        hooks = tuple(self.hooks.install(provider) for provider in request.providers)
        return CaptureEnableResult(
            api_url=request.api_url,
            providers=state.providers,
            credential_present=True,
            hooks=hooks,
        )

    def repair(self, request: CaptureRepairRequest) -> CaptureEnableResult:
        state = self.store.load()
        if state is None or state.api_url != request.api_url:
            return self.enable(
                CaptureEnableRequest(
                    api_url=request.api_url,
                    providers=request.providers,
                    name=request.name,
                )
            )
        providers = tuple(dict.fromkeys((*state.providers, *request.providers)))
        state = state.model_copy(update={"providers": providers})
        self.store.save(state)
        hooks = tuple(self.hooks.install(provider) for provider in providers)
        return CaptureEnableResult(
            api_url=request.api_url,
            providers=providers,
            credential_present=True,
            hooks=hooks,
        )

    def disable(self, request: CaptureDisableRequest) -> CaptureDisableResult:
        state = self.store.load()
        hooks = tuple(self.hooks.uninstall(provider) for provider in request.providers)
        if state is None or state.api_url != request.api_url:
            return CaptureDisableResult(
                api_url=request.api_url,
                providers=(),
                credential_removed=False,
                revoked_remote=False,
                hooks=hooks,
            )
        remaining = tuple(
            provider
            for provider in state.providers
            if provider not in request.providers
        )
        revoked = False
        removed = False
        if len(remaining) == 0:
            if request.revoke_remote:
                auth_state = self.auth.require_state(
                    CloudStatusRequest(api_url=request.api_url)
                )
                revoked = self.client.revoke_capture_credential(
                    api_url=request.api_url,
                    cli_token=auth_state.token,
                    capture_token=state.token,
                )
            self.store.delete()
            removed = True
        else:
            self.store.save(state.model_copy(update={"providers": remaining}))
        return CaptureDisableResult(
            api_url=request.api_url,
            providers=remaining,
            credential_removed=removed,
            revoked_remote=revoked,
            hooks=hooks,
        )

    def record_hook(self, request: CaptureHookRequest) -> CaptureHookEvent:
        if self.store.load() is None:
            raise ExecutionFailed("capture is not enabled")
        payload = request.payload
        event = CaptureHookEvent(
            provider=request.provider,
            session_id=string_value(payload.get("session_id")),
            transcript_path=string_value(payload.get("transcript_path")),
            cwd=string_value(payload.get("cwd")),
            hook_event_name=string_value(payload.get("hook_event_name")),
            turn_id=string_value(payload.get("turn_id")),
            received_at=datetime.now(UTC),
        )
        self.events.append(event)
        return event


def string_value(value: object) -> str | None:
    return value if isinstance(value, str) and value != "" else None
