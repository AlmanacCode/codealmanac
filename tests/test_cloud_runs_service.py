from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from codealmanac.services.cloud_auth.models import CloudIdentity, CloudLoginSession
from codealmanac.services.cloud_auth.requests import SaveCloudTokenRequest
from codealmanac.services.cloud_auth.service import CloudAuthService
from codealmanac.services.cloud_auth.store import CloudAuthStore
from codealmanac.services.cloud_runs.models import (
    CloudRun,
    CloudRunEvent,
    CloudRunPage,
    CloudRunSource,
)
from codealmanac.services.cloud_runs.requests import (
    CancelCloudRunRequest,
    ListCloudRunEventsRequest,
    ListCloudRunsForRepoRequest,
    ReadCloudRunRequest,
    RetryCloudRunRequest,
    StartCloudRunForRepoRequest,
)
from codealmanac.services.cloud_runs.service import CloudRunsService


def test_cloud_runs_service_uses_stored_cli_token(tmp_path: Path) -> None:
    client = FakeCloudRunsClient()
    service = CloudRunsService(sign_in(tmp_path), client)
    run_id = UUID(int=2)

    page = service.list_for_repo(
        ListCloudRunsForRepoRequest(
            api_url="https://api.example.test",
            repo_id=1,
            limit=5,
            cursor="2026-07-02T12:00:00+00:00",
        )
    )
    started = service.start_for_repo(
        StartCloudRunForRepoRequest(
            api_url="https://api.example.test",
            repo_id=1,
            branch="release/1.4",
        )
    )
    run = service.read(
        ReadCloudRunRequest(
            api_url="https://api.example.test",
            run_id=run_id,
        )
    )
    cancelled = service.cancel(
        CancelCloudRunRequest(
            api_url="https://api.example.test",
            run_id=run_id,
        )
    )
    retried = service.retry(
        RetryCloudRunRequest(
            api_url="https://api.example.test",
            run_id=run_id,
        )
    )
    events = service.list_events(
        ListCloudRunEventsRequest(
            api_url="https://api.example.test",
            run_id=run_id,
        )
    )

    assert page.items[0].run_id == UUID(int=1)
    assert page.next_cursor == "next"
    assert started.source.label == "branch release/1.4"
    assert run.run_id == run_id
    assert cancelled.status == "cancelled"
    assert retried.run_id == UUID(int=4)
    assert retried.status == "running"
    assert events[0].message == "running"
    assert client.calls == [
        ("list", "alm_secret", 1, 5, "2026-07-02T12:00:00+00:00"),
        ("start", "alm_secret", 1, "release/1.4"),
        ("read", "alm_secret", run_id),
        ("cancel", "alm_secret", run_id),
        ("retry", "alm_secret", run_id),
        ("events", "alm_secret", run_id),
    ]


def sign_in(tmp_path: Path) -> CloudAuthService:
    service = CloudAuthService(
        CloudAuthStore(tmp_path / "auth.json"),
        FakeCloudAuthClient(),
    )
    service.save_token(
        SaveCloudTokenRequest(
            api_url="https://api.example.test",
            token="alm_secret",
            logged_in_at=datetime(2026, 7, 2, 12, tzinfo=UTC),
        )
    )
    return service


def cloud_run(run_id: UUID) -> CloudRun:
    return CloudRun(
        run_id=run_id,
        repo_id=1,
        source=CloudRunSource(kind="branch", label="branch main"),
        status="running",
        summary="updating wiki",
        files_changed=("almanac/pages/api.md",),
        created_at=datetime(2026, 7, 2, 12, tzinfo=UTC),
    )


class FakeCloudAuthClient:
    def start_login(self, *, api_url: str) -> CloudLoginSession:
        raise NotImplementedError

    def poll_login(self, *, api_url: str, session_id: UUID) -> CloudLoginSession:
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


class FakeCloudRunsClient:
    def __init__(self) -> None:
        self.calls: list[tuple] = []

    def list_repository_runs(
        self,
        *,
        api_url: str,
        cli_token: str,
        repo_id: int,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> CloudRunPage:
        self.calls.append(("list", cli_token, repo_id, limit, cursor))
        return CloudRunPage(items=(cloud_run(UUID(int=1)),), next_cursor="next")

    def read_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        run_id: UUID,
    ) -> CloudRun:
        self.calls.append(("read", cli_token, run_id))
        return cloud_run(run_id)

    def start_repository_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        repo_id: int,
        branch: str,
    ) -> CloudRun:
        self.calls.append(("start", cli_token, repo_id, branch))
        return CloudRun(
            run_id=UUID(int=3),
            repo_id=repo_id,
            source=CloudRunSource(kind="branch", label=f"branch {branch}"),
            status="running",
        )

    def cancel_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        run_id: UUID,
    ) -> CloudRun:
        self.calls.append(("cancel", cli_token, run_id))
        return CloudRun(
            run_id=run_id,
            repo_id=1,
            source=CloudRunSource(kind="branch", label="branch main"),
            status="cancelled",
            finished_at=datetime(2026, 7, 2, 12, 30, tzinfo=UTC),
        )

    def retry_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        run_id: UUID,
    ) -> CloudRun:
        self.calls.append(("retry", cli_token, run_id))
        return CloudRun(
            run_id=UUID(int=4),
            repo_id=1,
            source=CloudRunSource(kind="branch", label="branch main"),
            status="running",
        )

    def list_run_events(
        self,
        *,
        api_url: str,
        cli_token: str,
        run_id: UUID,
    ) -> tuple[CloudRunEvent, ...]:
        self.calls.append(("events", cli_token, run_id))
        return (
            CloudRunEvent(
                run_id=run_id,
                sequence=1,
                timestamp=datetime(2026, 7, 2, 12, tzinfo=UTC),
                kind="status",
                message="running",
                payload={"worker_call_id": "call-1"},
            ),
        )
