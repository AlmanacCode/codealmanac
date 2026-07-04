from datetime import UTC, datetime
from pathlib import Path

from codealmanac.cloud.auth.requests import CloudStatusRequest
from codealmanac.cloud.auth.service import CloudAuthService
from codealmanac.cloud.capture.event_store import CaptureEventStore
from codealmanac.cloud.capture.models import (
    CaptureDisableResult,
    CaptureEnableResult,
    CaptureHookEvent,
    CaptureInspectResult,
    CaptureState,
    CaptureStatus,
)
from codealmanac.cloud.capture.ports import (
    CaptureHookManager,
    CaptureRepositoryProbe,
    CaptureTranscriptParser,
    CloudCaptureClient,
)
from codealmanac.cloud.capture.requests import (
    CaptureDisableRequest,
    CaptureEnableRequest,
    CaptureHookRequest,
    CaptureInspectRequest,
    CaptureRepairRequest,
    CaptureStatusRequest,
)
from codealmanac.cloud.capture.store import CaptureStateStore
from codealmanac.core.errors import ExecutionFailed


class CloudCaptureService:
    def __init__(
        self,
        *,
        auth: CloudAuthService,
        store: CaptureStateStore,
        events: CaptureEventStore,
        client: CloudCaptureClient,
        hooks: CaptureHookManager,
        parser: CaptureTranscriptParser,
        repository_probe: CaptureRepositoryProbe,
    ):
        self.auth = auth
        self.store = store
        self.events = events
        self.client = client
        self.hooks = hooks
        self.parser = parser
        self.repository_probe = repository_probe

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
        state = self.store.load()
        if state is None:
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
        artifact_upload = self.parser.artifact(
            provider=request.provider,
            payload=payload,
        )
        if artifact_upload is None:
            event = event.model_copy(
                update={
                    "upload_status": "skipped",
                    "upload_error": "missing transcript evidence",
                }
            )
            self.events.append(event)
            return event
        try:
            artifact = self.client.upload_capture_artifact(
                api_url=state.api_url,
                capture_token=state.token,
                artifact=artifact_upload,
            )
            repository = self.repository_probe.read(Path(artifact_upload.first_cwd))
            turn = self.parser.normalize(
                provider=request.provider,
                payload=payload,
                artifact=artifact,
                repository=repository,
            )
            if turn is None:
                event = event.model_copy(
                    update={
                        "upload_status": "skipped",
                        "upload_error": "missing transcript metadata",
                        "artifact_ref": artifact.ref,
                    }
                )
                self.events.append(event)
                return event
            result = self.client.upload_capture_turn(
                api_url=state.api_url,
                capture_token=state.token,
                turn=turn,
            )
            event = event.model_copy(
                update={
                    "upload_status": "uploaded",
                    "artifact_ref": artifact.ref,
                    "repo_full_name": turn.repo_full_name,
                    "branch": turn.branch,
                    "routing_status": result.routing_status,
                }
            )
        except Exception as error:
            event = event.model_copy(
                update={
                    "upload_status": "failed",
                    "upload_error": error_message(error),
                }
            )
        self.events.append(event)
        return event

    def inspect(self, request: CaptureInspectRequest) -> CaptureInspectResult:
        return CaptureInspectResult(events=self.events.latest(request.limit))


def string_value(value: object) -> str | None:
    return value if isinstance(value, str) and value != "" else None


def error_message(error: Exception) -> str:
    message = str(error).strip()
    if message == "":
        message = error.__class__.__name__
    return message[:500]
