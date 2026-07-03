from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID, uuid4

from codealmanac.services.cloud_auth.models import CloudIdentity, CloudLoginSession
from codealmanac.services.cloud_auth.service import CloudAuthService
from codealmanac.services.cloud_auth.store import CloudAuthStore
from codealmanac.workflows.cloud_login.ports import CloudLoginStartDecision
from codealmanac.workflows.cloud_login.requests import RunCloudLoginRequest
from codealmanac.workflows.cloud_login.service import CloudLoginWorkflow


def test_cloud_login_uses_interaction_decision_to_open_browser(tmp_path: Path) -> None:
    client = FakeCloudAuthClient(statuses=("complete",))
    browser = FakeBrowser()
    workflow = CloudLoginWorkflow(
        CloudAuthService(CloudAuthStore(tmp_path / "auth.json"), client),
        browser,
        FakeCloudLoginInteraction(open_browser=True),
    )

    result = workflow.run(
        RunCloudLoginRequest(
            api_url="https://api.example.test",
            timeout_seconds=0,
            poll_interval_seconds=0,
        )
    )

    assert result.status == "signed_in"
    assert result.github_login == "rohans0509"
    assert browser.opened == ["https://app.example.test/cli-login"]


def test_cloud_login_default_interaction_does_not_open_browser(
    tmp_path: Path,
) -> None:
    browser = FakeBrowser()
    workflow = CloudLoginWorkflow(
        CloudAuthService(
            CloudAuthStore(tmp_path / "auth.json"),
            FakeCloudAuthClient(statuses=("complete",)),
        ),
        browser,
    )

    result = workflow.run(
        RunCloudLoginRequest(
            api_url="https://api.example.test",
            timeout_seconds=0,
            poll_interval_seconds=0,
        )
    )

    assert result.status == "signed_in"
    assert browser.opened == []


def test_cloud_login_no_browser_print_path_does_not_open_browser(
    tmp_path: Path,
) -> None:
    browser = FakeBrowser()
    workflow = CloudLoginWorkflow(
        CloudAuthService(
            CloudAuthStore(tmp_path / "auth.json"),
            FakeCloudAuthClient(statuses=("complete",)),
        ),
        browser,
    )

    result = workflow.run(
        RunCloudLoginRequest(
            api_url="https://api.example.test",
            no_browser=True,
            timeout_seconds=0,
            poll_interval_seconds=0,
        )
    )

    assert result.status == "signed_in"
    assert browser.opened == []


def test_cloud_login_returns_timeout_without_token(tmp_path: Path) -> None:
    workflow = CloudLoginWorkflow(
        CloudAuthService(
            CloudAuthStore(tmp_path / "auth.json"),
            FakeCloudAuthClient(statuses=("pending",)),
        ),
        FakeBrowser(),
    )

    result = workflow.run(
        RunCloudLoginRequest(
            api_url="https://api.example.test",
            no_browser=True,
            timeout_seconds=0,
            poll_interval_seconds=0,
        )
    )

    assert result.status == "timeout"
    assert CloudAuthStore(tmp_path / "auth.json").load() is None


class FakeBrowser:
    def __init__(self) -> None:
        self.opened: list[str] = []

    def open(self, url: str) -> bool:
        self.opened.append(url)
        return True


class FakeCloudLoginInteraction:
    def __init__(self, open_browser: bool) -> None:
        self.open_browser = open_browser

    def started(
        self,
        session: CloudLoginSession,
        request: RunCloudLoginRequest,
    ) -> CloudLoginStartDecision:
        return CloudLoginStartDecision(open_browser=self.open_browser)


class FakeCloudAuthClient:
    def __init__(self, *, statuses: tuple[str, ...]) -> None:
        self.session_id = uuid4()
        self.statuses = list(statuses)

    def start_login(self, *, api_url: str) -> CloudLoginSession:
        return login_session(self.session_id, status="pending")

    def poll_login(self, *, api_url: str, session_id: UUID) -> CloudLoginSession:
        status = self.statuses.pop(0)
        token = "alm_secret" if status == "complete" else None
        return login_session(session_id, status=status, token=token)

    def me(self, *, api_url: str, token: str) -> CloudIdentity:
        return CloudIdentity(
            api_url=api_url,
            github_user_id=10,
            github_login="rohans0509",
        )

    def logout(self, *, api_url: str, token: str) -> CloudIdentity:
        return self.me(api_url=api_url, token=token)


def login_session(
    session_id: UUID,
    *,
    status: str,
    token: str | None = None,
) -> CloudLoginSession:
    return CloudLoginSession(
        session_id=session_id,
        user_code="ABCD2345",
        verification_url="https://app.example.test/cli-login",
        expires_at=datetime(2026, 7, 2, 12, 10, tzinfo=UTC),
        status=status,  # type: ignore[arg-type]
        token=token,
    )
