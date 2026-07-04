from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from codealmanac.cloud.auth.models import CloudIdentity, CloudLoginSession
from codealmanac.cloud.auth.requests import SaveCloudTokenRequest
from codealmanac.cloud.auth.service import CloudAuthService
from codealmanac.cloud.auth.store import CloudAuthStore
from codealmanac.cloud.capture.event_store import CaptureEventStore
from codealmanac.cloud.capture.models import (
    CaptureCloudStatus,
    CaptureCredential,
)
from codealmanac.cloud.capture.requests import (
    CaptureDisableRequest,
    CaptureEnableRequest,
    CaptureHookRequest,
    CaptureInspectRequest,
    CaptureStatusRequest,
)
from codealmanac.cloud.capture.service import CloudCaptureService
from codealmanac.cloud.capture.store import CaptureStateStore
from codealmanac.integrations.capture import (
    CaptureTranscriptNormalizer,
    FileCaptureHookManager,
    GitCaptureRepositoryProbe,
)


def test_cloud_capture_enable_status_and_disable(tmp_path: Path) -> None:
    client = FakeCloudCaptureClient()
    service = capture_service(tmp_path, client=client)
    sign_in(tmp_path)

    enabled = service.enable(
        CaptureEnableRequest(
            api_url="https://api.example.test",
            providers=("codex",),
        )
    )
    state = CaptureStateStore(tmp_path / "capture.json").load()

    assert enabled.credential_present is True
    assert enabled.providers == ("codex",)
    assert state is not None
    assert state.token == "cap_secret"
    assert oct((tmp_path / "capture.json").stat().st_mode & 0o777) == "0o600"
    assert (tmp_path / ".codex/hooks.json").exists()

    status = service.status(
        CaptureStatusRequest(
            api_url="https://api.example.test",
            check_cloud=True,
        )
    )

    assert status.signed_in is True
    assert status.credential_present is True
    assert status.hooks[0].installed is True
    assert status.cloud_credentials[0].name == "CodeAlmanac capture"

    disabled = service.disable(
        CaptureDisableRequest(
            api_url="https://api.example.test",
            providers=("codex",),
        )
    )

    assert disabled.credential_removed is True
    assert disabled.revoked_remote is True
    assert CaptureStateStore(tmp_path / "capture.json").load() is None
    assert client.revoked == ["cap_secret"]


def test_capture_hook_manager_preserves_unrelated_hooks(tmp_path: Path) -> None:
    codex = tmp_path / ".codex/hooks.json"
    codex.parent.mkdir(parents=True)
    codex.write_text(
        """{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo keep"
          }
        ]
      }
    ]
  }
}
""",
        encoding="utf-8",
    )
    manager = FileCaptureHookManager(tmp_path)

    first = manager.install("codex")
    second = manager.install("codex")
    installed_body = codex.read_text(encoding="utf-8")
    removed = manager.uninstall("codex")
    body = codex.read_text(encoding="utf-8")

    assert first.changed is True
    assert second.changed is False
    assert removed.changed is True
    assert "codealmanac-capture-hook --provider codex" in installed_body
    assert "echo keep" in body
    assert "codealmanac-capture-hook --provider codex" not in body
    assert "__capture-hook" not in body


def test_cloud_capture_hook_records_diagnostic_event(tmp_path: Path) -> None:
    service = capture_service(tmp_path, client=FakeCloudCaptureClient())
    sign_in(tmp_path)
    service.enable(
        CaptureEnableRequest(
            api_url="https://api.example.test",
            providers=("claude",),
        )
    )

    event = service.record_hook(
        CaptureHookRequest(
            provider="claude",
            payload={
                "session_id": "sess_1",
                "transcript_path": "/tmp/transcript.jsonl",
                "cwd": "/tmp/repo",
                "hook_event_name": "Stop",
                "turn_id": "turn_1",
            },
        )
    )

    assert event.session_id == "sess_1"
    assert (tmp_path / "capture-events/events.jsonl").exists()
    inspected = service.inspect(CaptureInspectRequest(limit=1))
    assert inspected.events[0].session_id == "sess_1"


def capture_service(
    tmp_path: Path,
    *,
    client: "FakeCloudCaptureClient",
) -> CloudCaptureService:
    auth = CloudAuthService(
        CloudAuthStore(tmp_path / "auth.json"),
        FakeCloudAuthClient(),
    )
    return CloudCaptureService(
        auth=auth,
        store=CaptureStateStore(tmp_path / "capture.json"),
        events=CaptureEventStore(tmp_path / "capture-events"),
        client=client,
        hooks=FileCaptureHookManager(tmp_path),
        parser=CaptureTranscriptNormalizer(),
        repository_probe=GitCaptureRepositoryProbe(),
    )


def sign_in(tmp_path: Path) -> None:
    CloudAuthService(
        CloudAuthStore(tmp_path / "auth.json"),
        FakeCloudAuthClient(),
    ).save_token(
        SaveCloudTokenRequest(
            api_url="https://api.example.test",
            token="alm_secret",
            logged_in_at=datetime(2026, 7, 2, 12, tzinfo=UTC),
        )
    )


class FakeCloudAuthClient:
    def start_login(self, *, api_url: str) -> CloudLoginSession:
        raise NotImplementedError

    def poll_login(self, *, api_url: str, session_id) -> CloudLoginSession:
        raise NotImplementedError

    def me(self, *, api_url: str, token: str) -> CloudIdentity:
        assert token == "alm_secret"
        return CloudIdentity(
            api_url=api_url,
            github_user_id=10,
            github_login="rohans0509",
        )

    def logout(self, *, api_url: str, token: str) -> CloudIdentity:
        return self.me(api_url=api_url, token=token)


class FakeCloudCaptureClient:
    def __init__(self) -> None:
        self.revoked: list[str] = []

    def issue_capture_credential(
        self,
        *,
        api_url: str,
        cli_token: str,
        name: str,
    ):
        assert cli_token == "alm_secret"
        return credential_issue(name=name)

    def capture_status(self, *, api_url: str, cli_token: str) -> CaptureCloudStatus:
        assert cli_token == "alm_secret"
        return CaptureCloudStatus(credentials=(credential(name="CodeAlmanac capture"),))

    def revoke_capture_credential(
        self,
        *,
        api_url: str,
        cli_token: str,
        capture_token: str,
    ) -> bool:
        assert cli_token == "alm_secret"
        self.revoked.append(capture_token)
        return True


def credential_issue(*, name: str):
    from codealmanac.cloud.capture.models import CaptureCredentialIssue

    return CaptureCredentialIssue(
        credential=credential(name=name),
        token="cap_secret",
    )


def credential(*, name: str) -> CaptureCredential:
    return CaptureCredential(
        id=uuid4(),
        name=name,
        created_at=datetime(2026, 7, 2, 12, tzinfo=UTC),
        last_used_at=None,
    )
