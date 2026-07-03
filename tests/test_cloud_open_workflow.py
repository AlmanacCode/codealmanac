from pathlib import Path

import pytest

from codealmanac.core.errors import NotFoundError, ValidationFailed
from codealmanac.services.cloud_repositories.models import CloudRepository
from codealmanac.services.cloud_repositories.requests import (
    ResolveCloudRepositoryRequest,
)
from codealmanac.workflows.cloud_open.requests import OpenCloudTargetRequest
from codealmanac.workflows.cloud_open.service import CloudOpenWorkflow
from codealmanac.workflows.local_setup.models import LocalRepositoryState


def test_cloud_open_workflow_resolves_and_opens_dashboard_wiki_url(
    tmp_path: Path,
) -> None:
    browser = FakeBrowser()
    repositories = FakeCloudRepositories()
    workflow = CloudOpenWorkflow(
        FakeRepositoryProbe(local_repository_state(tmp_path / "repo")),
        repositories,
        browser,
    )

    result = workflow.open(
        OpenCloudTargetRequest(
            cwd=tmp_path / "repo",
            app_url="https://app.example.test/",
            api_url="https://api.example.test/",
        )
    )

    assert result.url == (
        "https://app.example.test/dashboard/accounts/264516179"
        "/repositories/1212149375/wiki"
    )
    assert result.opened is True
    assert browser.opened == [result.url]
    assert repositories.resolved == [
        ResolveCloudRepositoryRequest(
            api_url="https://api.example.test",
            full_name="AlmanacCode/codealmanac",
        )
    ]


def test_cloud_open_workflow_falls_back_to_public_wiki_when_cli_is_not_logged_in(
    tmp_path: Path,
) -> None:
    browser = FakeBrowser()
    repositories = FakeCloudRepositories(error=NotFoundError("cloud auth state", ""))
    workflow = CloudOpenWorkflow(
        FakeRepositoryProbe(local_repository_state(tmp_path / "repo")),
        repositories,
        browser,
    )

    result = workflow.open(
        OpenCloudTargetRequest(
            cwd=tmp_path / "repo",
            app_url="https://app.example.test/",
            api_url="https://api.example.test/",
            no_browser=True,
        )
    )

    assert result.url == "https://app.example.test/wiki/github/AlmanacCode/codealmanac"
    assert result.opened is False
    assert browser.opened == []
    assert repositories.resolved == [
        ResolveCloudRepositoryRequest(
            api_url="https://api.example.test",
            full_name="AlmanacCode/codealmanac",
        )
    ]


def test_cloud_open_workflow_does_not_hide_repository_resolution_failures(
    tmp_path: Path,
) -> None:
    workflow = CloudOpenWorkflow(
        FakeRepositoryProbe(local_repository_state(tmp_path / "repo")),
        FakeCloudRepositories(error=NotFoundError("cloud repository", "missing")),
        FakeBrowser(),
    )

    with pytest.raises(NotFoundError, match="cloud repository not found: missing"):
        workflow.open(
            OpenCloudTargetRequest(
                cwd=tmp_path / "repo",
                app_url="https://app.example.test/",
                api_url="https://api.example.test/",
            )
        )


def test_cloud_open_workflow_builds_setup_and_repo_targets(tmp_path: Path) -> None:
    workflow = CloudOpenWorkflow(
        FakeRepositoryProbe(local_repository_state(tmp_path / "repo")),
        FakeCloudRepositories(),
        FakeBrowser(),
    )

    setup = workflow.open(
        OpenCloudTargetRequest(
            cwd=tmp_path / "repo",
            app_url="https://app.example.test",
            target="setup",
            no_browser=True,
        )
    )
    repo = workflow.open(
        OpenCloudTargetRequest(
            cwd=tmp_path / "repo",
            app_url="https://app.example.test",
            target="repo",
            no_browser=True,
        )
    )
    settings = workflow.open(
        OpenCloudTargetRequest(
            cwd=tmp_path / "repo",
            app_url="https://app.example.test",
            target="settings",
            no_browser=True,
        )
    )
    github_app = workflow.open(
        OpenCloudTargetRequest(
            cwd=tmp_path / "repo",
            app_url="https://app.example.test",
            target="github-app",
            no_browser=True,
        )
    )

    assert setup.url == (
        "https://app.example.test/setup/repo?"
        "provider=github&owner=AlmanacCode&repo=codealmanac"
    )
    assert repo.url == (
        "https://app.example.test/setup/repo?"
        "provider=github&owner=AlmanacCode&repo=codealmanac&target=activity"
    )
    assert settings.url == (
        "https://app.example.test/setup/repo?"
        "provider=github&owner=AlmanacCode&repo=codealmanac&target=settings"
    )
    assert github_app.url == (
        "https://app.example.test/setup/repo?"
        "provider=github&owner=AlmanacCode&repo=codealmanac&target=github-app"
    )
    assert setup.opened is False


def test_cloud_open_workflow_opens_github_direct_target(tmp_path: Path) -> None:
    workflow = CloudOpenWorkflow(
        FakeRepositoryProbe(local_repository_state(tmp_path / "repo")),
        FakeCloudRepositories(),
        FakeBrowser(),
    )

    result = workflow.open(
        OpenCloudTargetRequest(
            cwd=tmp_path / "repo",
            target="github",
            no_browser=True,
        )
    )

    assert result.url == "https://github.com/AlmanacCode/codealmanac"


def test_cloud_open_workflow_rejects_unavailable_checkout(tmp_path: Path) -> None:
    workflow = CloudOpenWorkflow(
        FakeRepositoryProbe(
            LocalRepositoryState(
                cwd=tmp_path / "repo",
                available=False,
                unavailable_reason="not a git repository",
            )
        ),
        FakeCloudRepositories(),
        FakeBrowser(),
    )

    with pytest.raises(ValidationFailed, match="not a git repository"):
        workflow.open(OpenCloudTargetRequest(cwd=tmp_path / "repo"))


class FakeBrowser:
    def __init__(self) -> None:
        self.opened: list[str] = []

    def open(self, url: str) -> bool:
        self.opened.append(url)
        return True


class FakeRepositoryProbe:
    def __init__(self, state: LocalRepositoryState) -> None:
        self.state = state

    def read(self, cwd: Path) -> LocalRepositoryState:
        return self.state


class FakeCloudRepositories:
    def __init__(self, error: NotFoundError | None = None) -> None:
        self.error = error
        self.resolved: list[ResolveCloudRepositoryRequest] = []

    def resolve(self, request: ResolveCloudRepositoryRequest) -> CloudRepository:
        self.resolved.append(request)
        if self.error is not None:
            raise self.error
        return CloudRepository(
            repo_id=1212149375,
            account_id=264516179,
            full_name=request.full_name,
            default_branch="main",
        )


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
