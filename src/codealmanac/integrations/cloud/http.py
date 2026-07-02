from datetime import datetime
from typing import Any
from uuid import UUID

import httpx

from codealmanac.core.errors import ExecutionFailed
from codealmanac.services.cloud_auth.models import CloudIdentity, CloudLoginSession
from codealmanac.services.cloud_capture.models import (
    CaptureArtifact,
    CaptureArtifactUpload,
    CaptureCloudStatus,
    CaptureCredential,
    CaptureCredentialIssue,
    CaptureTranscriptUpload,
    CaptureTurnUploadResult,
)
from codealmanac.services.cloud_repositories.models import (
    CloudDeliveryMode,
    CloudRepository,
    CloudRepositoryTriggerPolicy,
)
from codealmanac.services.cloud_runs.models import (
    CloudRun,
    CloudRunEvent,
    CloudRunPage,
    CloudRunSource,
)


class HttpCloudAuthClient:
    def __init__(self, timeout: float = 10.0):
        self.timeout = timeout

    def start_login(self, *, api_url: str) -> CloudLoginSession:
        data = self._request("POST", f"{api_url}/v1/auth/cli/start")
        return login_session(data)

    def poll_login(self, *, api_url: str, session_id: UUID) -> CloudLoginSession:
        data = self._request(
            "POST",
            f"{api_url}/v1/auth/cli/sessions/{session_id}/poll",
        )
        return login_session(data)

    def me(self, *, api_url: str, token: str) -> CloudIdentity:
        data = self._request(
            "GET",
            f"{api_url}/v1/me",
            token=token,
        )
        return identity(api_url, data)

    def logout(self, *, api_url: str, token: str) -> CloudIdentity:
        data = self._request(
            "POST",
            f"{api_url}/v1/auth/logout",
            token=token,
        )
        return identity(api_url, data)

    def issue_capture_credential(
        self,
        *,
        api_url: str,
        cli_token: str,
        name: str,
    ) -> CaptureCredentialIssue:
        data = self._request(
            "POST",
            f"{api_url}/v1/capture/credentials",
            token=cli_token,
            json_body={"name": name},
        )
        credential = capture_credential(data["credential"])
        return CaptureCredentialIssue(credential=credential, token=str(data["token"]))

    def capture_status(self, *, api_url: str, cli_token: str) -> CaptureCloudStatus:
        data = self._request(
            "GET",
            f"{api_url}/v1/capture/status",
            token=cli_token,
        )
        return CaptureCloudStatus(
            credentials=tuple(
                capture_credential(item) for item in data.get("credentials", [])
            )
        )

    def revoke_capture_credential(
        self,
        *,
        api_url: str,
        cli_token: str,
        capture_token: str,
    ) -> bool:
        data = self._request(
            "POST",
            f"{api_url}/v1/capture/credentials/revoke",
            token=cli_token,
            json_body={"token": capture_token},
        )
        return bool(data.get("revoked"))

    def resolve_repository(
        self,
        *,
        api_url: str,
        cli_token: str,
        full_name: str,
    ) -> CloudRepository:
        data = self._request(
            "POST",
            f"{api_url}/v1/repositories/resolve",
            token=cli_token,
            json_body={"fullName": full_name},
        )
        return cloud_repository(data)

    def list_repository_triggers(
        self,
        *,
        api_url: str,
        cli_token: str,
        repo_id: int,
    ) -> tuple[CloudRepositoryTriggerPolicy, ...]:
        data = self._request(
            "GET",
            f"{api_url}/v1/repositories/{repo_id}/triggers",
            token=cli_token,
        )
        if not isinstance(data.get("items"), list):
            return tuple(
                cloud_repository_trigger_policy(item)
                for item in require_list_response(data)
            )
        return tuple(cloud_repository_trigger_policy(item) for item in data["items"])

    def upsert_repository_trigger(
        self,
        *,
        api_url: str,
        cli_token: str,
        repo_id: int,
        branch: str,
        enabled: bool | None = None,
        delivery_mode: CloudDeliveryMode | None = None,
    ) -> CloudRepositoryTriggerPolicy:
        body: dict[str, Any] = {"branch": branch}
        if enabled is not None:
            body["enabled"] = enabled
        if delivery_mode is not None:
            body["deliveryMode"] = delivery_mode
        data = self._request(
            "PUT",
            f"{api_url}/v1/repositories/{repo_id}/triggers",
            token=cli_token,
            json_body=body,
        )
        return cloud_repository_trigger_policy(data)

    def list_repository_runs(
        self,
        *,
        api_url: str,
        cli_token: str,
        repo_id: int,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> CloudRunPage:
        params: dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        if cursor is not None:
            params["cursor"] = cursor
        data = self._request(
            "GET",
            f"{api_url}/v1/repositories/{repo_id}/runs",
            token=cli_token,
            params=params or None,
        )
        return cloud_run_page(data)

    def start_repository_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        repo_id: int,
        branch: str,
    ) -> CloudRun:
        data = self._request(
            "POST",
            f"{api_url}/v1/repositories/{repo_id}/runs",
            token=cli_token,
            json_body={"branch": branch},
        )
        return cloud_run(data)

    def read_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        run_id: UUID,
    ) -> CloudRun:
        data = self._request(
            "GET",
            f"{api_url}/v1/runs/{run_id}",
            token=cli_token,
        )
        return cloud_run(data)

    def cancel_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        run_id: UUID,
    ) -> CloudRun:
        data = self._request(
            "POST",
            f"{api_url}/v1/runs/{run_id}/cancel",
            token=cli_token,
        )
        return cloud_run(data)

    def retry_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        run_id: UUID,
    ) -> CloudRun:
        data = self._request(
            "POST",
            f"{api_url}/v1/runs/{run_id}/retry",
            token=cli_token,
        )
        return cloud_run(data)

    def list_run_events(
        self,
        *,
        api_url: str,
        cli_token: str,
        run_id: UUID,
    ) -> tuple[CloudRunEvent, ...]:
        data = self._request(
            "GET",
            f"{api_url}/v1/runs/{run_id}/events",
            token=cli_token,
        )
        return tuple(cloud_run_event(item) for item in require_list_response(data))

    def upload_capture_artifact(
        self,
        *,
        api_url: str,
        capture_token: str,
        artifact: CaptureArtifactUpload,
    ) -> CaptureArtifact:
        data = self._request(
            "POST",
            f"{api_url}/v1/capture/artifacts",
            token=capture_token,
            headers={
                "Content-Type": artifact.content_type,
                "X-CodeAlmanac-Provider": artifact.provider,
                "X-CodeAlmanac-Provider-Session-Id": artifact.provider_session_id,
            },
            content=artifact.body,
        )
        return CaptureArtifact(
            ref=str(data["ref"]),
            sha256=str(data["sha256"]),
            size_bytes=int(data["sizeBytes"]),
            content_type=str(data["contentType"]),
        )

    def upload_capture_turn(
        self,
        *,
        api_url: str,
        capture_token: str,
        turn: CaptureTranscriptUpload,
    ) -> CaptureTurnUploadResult:
        data = self._request(
            "POST",
            f"{api_url}/v1/capture/turns",
            token=capture_token,
            json_body=capture_turn_body(turn),
        )
        return CaptureTurnUploadResult(
            accepted=bool(data["accepted"]),
            routed=bool(data["routed"]),
            routing_status=data["routingStatus"],
            source_id=data.get("sourceId"),
            turn_id=data.get("turnId"),
            message_count=int(data["messageCount"]),
        )

    def _request(
        self,
        method: str,
        url: str,
        *,
        token: str | None = None,
        headers: dict[str, str] | None = None,
        json_body: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        content: bytes | None = None,
    ) -> dict[str, Any]:
        request_headers = dict(headers or {})
        if token is not None:
            request_headers["Authorization"] = f"Bearer {token}"
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.request(
                    method,
                    url,
                    headers=request_headers or None,
                    params=params,
                    json=json_body,
                    content=content,
                )
        except httpx.HTTPError as error:
            raise ExecutionFailed(f"cloud request failed: {error}") from error
        if response.status_code >= 400:
            message = response.text.strip() or response.reason_phrase
            raise ExecutionFailed(
                f"cloud request failed ({response.status_code}): {message}"
            )
        try:
            payload = response.json()
        except ValueError as error:
            raise ExecutionFailed("cloud returned invalid JSON") from error
        if isinstance(payload, dict):
            return payload
        if isinstance(payload, list):
            return {"_root": payload}
        raise ExecutionFailed("cloud returned invalid JSON")


def login_session(data: dict[str, Any]) -> CloudLoginSession:
    return CloudLoginSession(
        session_id=UUID(str(data["sessionId"])),
        user_code=str(data["userCode"]),
        verification_url=str(data["verificationUrl"]),
        expires_at=datetime.fromisoformat(
            str(data["expiresAt"]).replace("Z", "+00:00")
        ),
        status=data["status"],
        token=data.get("token"),
    )


def identity(api_url: str, data: dict[str, Any]) -> CloudIdentity:
    return CloudIdentity(
        api_url=api_url,
        github_user_id=int(data["githubUserId"]),
        github_login=str(data["githubLogin"]),
    )


def capture_credential(data: dict[str, Any]) -> CaptureCredential:
    return CaptureCredential(
        id=data["id"],
        name=str(data["name"]),
        created_at=parse_datetime(data.get("createdAt")),
        last_used_at=parse_datetime(data.get("lastUsedAt")),
    )


def cloud_repository(data: dict[str, Any]) -> CloudRepository:
    return CloudRepository(
        repo_id=int(data["repoId"]),
        account_id=int(data["accountId"]),
        full_name=str(data["fullName"]),
        default_branch=str(data["defaultBranch"]),
    )


def cloud_repository_trigger_policy(
    data: dict[str, Any],
) -> CloudRepositoryTriggerPolicy:
    return CloudRepositoryTriggerPolicy(
        repo_id=int(data["repoId"]),
        branch=str(data["branch"]),
        enabled=bool(data["enabled"]),
        delivery_mode=data["deliveryMode"],
    )


def cloud_run_page(data: dict[str, Any]) -> CloudRunPage:
    return CloudRunPage(
        items=tuple(cloud_run(item) for item in data.get("items", [])),
        next_cursor=data.get("nextCursor"),
    )


def cloud_run(data: dict[str, Any]) -> CloudRun:
    return CloudRun(
        run_id=UUID(str(data["runId"])),
        repo_id=int(data["repoId"]),
        source=cloud_run_source(data["source"]),
        status=data["status"],
        summary=data.get("summary"),
        files_changed=tuple(str(path) for path in data.get("filesChanged", [])),
        commit_sha=data.get("commitSha"),
        created_at=parse_datetime(data.get("createdAt")),
        finished_at=parse_datetime(data.get("finishedAt")),
    )


def cloud_run_source(data: dict[str, Any]) -> CloudRunSource:
    return CloudRunSource(
        kind=str(data["kind"]),
        label=str(data["label"]),
        url=data.get("url"),
    )


def cloud_run_event(data: dict[str, Any]) -> CloudRunEvent:
    timestamp = parse_datetime(data.get("timestamp"))
    if timestamp is None:
        raise ExecutionFailed("cloud returned invalid run event timestamp")
    return CloudRunEvent(
        run_id=UUID(str(data["runId"])),
        sequence=int(data["sequence"]),
        timestamp=timestamp,
        kind=data["kind"],
        message=str(data["message"]),
        payload=data.get("payload"),
    )


def require_list_response(data: dict[str, Any]) -> list[Any]:
    if list(data.keys()) == ["_root"] and isinstance(data["_root"], list):
        return data["_root"]
    raise ExecutionFailed("cloud returned invalid JSON")


def capture_turn_body(turn: CaptureTranscriptUpload) -> dict[str, Any]:
    return {
        "provider": turn.provider,
        "providerSessionId": turn.provider_session_id,
        "providerTurnId": turn.provider_turn_id,
        "transcriptPathHash": turn.transcript_path_hash,
        "firstCwd": turn.first_cwd,
        "repoFullName": turn.repo_full_name,
        "branch": turn.branch,
        "branchSource": turn.branch_source,
        "routingStatus": turn.routing_status,
        "headSha": turn.head_sha,
        "startedAt": turn.started_at.isoformat(),
        "completedAt": (
            turn.completed_at.isoformat() if turn.completed_at is not None else None
        ),
        "artifactRef": turn.artifact_ref,
    }


def parse_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
