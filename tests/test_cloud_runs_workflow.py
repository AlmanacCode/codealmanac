from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from codealmanac.services.cloud_auth.models import CloudIdentity, CloudLoginSession
from codealmanac.services.cloud_auth.requests import SaveCloudTokenRequest
from codealmanac.services.cloud_auth.service import CloudAuthService
from codealmanac.services.cloud_auth.store import CloudAuthStore
from codealmanac.services.cloud_repositories.models import (
    CloudRepository,
    CloudRepositoryTriggerPolicy,
)
from codealmanac.services.cloud_repositories.service import CloudRepositoriesService
from codealmanac.services.cloud_runs.models import (
    CloudRun,
    CloudRunEvent,
    CloudRunPage,
    CloudRunSource,
)
from codealmanac.services.cloud_runs.service import CloudRunsService
from codealmanac.workflows.cloud_repo.service import CloudRepoWorkflow
from codealmanac.workflows.cloud_runs.requests import (
    CancelCloudRunWorkflowRequest,
    ListCloudRunsRequest,
    ReadCloudRunLogRequest,
    RetryCloudRunWorkflowRequest,
    ShowCloudRunRequest,
    StartCloudRunRequest,
)
from codealmanac.workflows.cloud_runs.service import CloudRunsWorkflow
from codealmanac.workflows.local_setup.models import LocalRepositoryState


def test_cloud_runs_workflow_lists_current_repo_and_reads_run_by_id(
    tmp_path: Path,
) -> None:
    run_id = UUID(int=2)
    runs_client = FakeCloudRunsClient()
    workflow = CloudRunsWorkflow(
        CloudRunsService(sign_in(tmp_path), runs_client),
        CloudRepoWorkflow(
            CloudRepositoriesService(sign_in(tmp_path), FakeCloudRepositoriesClient()),
            FakeRepositoryProbe(local_repository_state(tmp_path / "repo")),
        ),
    )

    page = workflow.list(
        ListCloudRunsRequest(
            cwd=tmp_path / "repo",
            api_url="https://api.example.test",
            limit=10,
        )
    )
    started = workflow.start(
        StartCloudRunRequest(
            cwd=tmp_path / "repo",
            api_url="https://api.example.test",
            branch="release/1.4",
        )
    )
    detail = workflow.show(
        ShowCloudRunRequest(
            api_url="https://api.example.test",
            run_id=run_id,
        )
    )
    cancelled = workflow.cancel(
        CancelCloudRunWorkflowRequest(
            api_url="https://api.example.test",
            run_id=run_id,
        )
    )
    retried = workflow.retry(
        RetryCloudRunWorkflowRequest(
            api_url="https://api.example.test",
            run_id=run_id,
        )
    )
    log = workflow.log(
        ReadCloudRunLogRequest(
            api_url="https://api.example.test",
            run_id=run_id,
        )
    )

    assert page.status.repository is not None
    assert page.status.repository.full_name == "AlmanacCode/codealmanac"
    assert page.page.items[0].run_id == UUID(int=1)
    assert started.run.source.label == "branch release/1.4"
    assert detail.run.run_id == run_id
    assert cancelled.run.status == "cancelled"
    assert retried.run.run_id == UUID(int=4)
    assert retried.run.status == "running"
    assert log.events[0].message == "running"
    assert runs_client.calls == [
        ("list", 1, 10, None),
        ("start", 1, "release/1.4"),
        ("read", run_id),
        ("cancel", run_id),
        ("retry", run_id),
        ("events", run_id),
    ]


class FakeRepositoryProbe:
    def __init__(self, state: LocalRepositoryState) -> None:
        self.state = state

    def read(self, cwd: Path) -> LocalRepositoryState:
        return self.state


def local_repository_state(repo: Path) -> LocalRepositoryState:
    return LocalRepositoryState(
        cwd=repo,
        available=True,
        repository_root=repo,
        branch_name="dev",
        head_sha="head-1",
        provider="github",
        owner_login="AlmanacCode",
        name="codealmanac",
        full_name="AlmanacCode/codealmanac",
        default_branch="main",
    )


def sign_in(tmp_path: Path) -> CloudAuthService:
    service = CloudAuthService(
        CloudAuthStore(tmp_path / f"{UUID(int=4)}.json"),
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


class FakeCloudRepositoriesClient:
    def resolve_repository(
        self,
        *,
        api_url: str,
        cli_token: str,
        full_name: str,
    ) -> CloudRepository:
        return CloudRepository(
            repo_id=1,
            account_id=10,
            full_name=full_name,
            default_branch="main",
        )

    def list_repository_triggers(
        self,
        *,
        api_url: str,
        cli_token: str,
        repo_id: int,
    ) -> tuple[CloudRepositoryTriggerPolicy, ...]:
        return ()

    def upsert_repository_trigger(
        self,
        *,
        api_url: str,
        cli_token: str,
        repo_id: int,
        branch: str,
        enabled: bool | None = None,
        delivery_mode=None,
    ) -> CloudRepositoryTriggerPolicy:
        raise NotImplementedError


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
        self.calls.append(("list", repo_id, limit, cursor))
        return CloudRunPage(items=(cloud_run(UUID(int=1)),), next_cursor=None)

    def read_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        run_id: UUID,
    ) -> CloudRun:
        self.calls.append(("read", run_id))
        return cloud_run(run_id)

    def start_repository_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        repo_id: int,
        branch: str,
    ) -> CloudRun:
        self.calls.append(("start", repo_id, branch))
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
        self.calls.append(("cancel", run_id))
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
        self.calls.append(("retry", run_id))
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
        self.calls.append(("events", run_id))
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
