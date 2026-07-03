from urllib.parse import quote, urlencode

from codealmanac.core.errors import ValidationFailed
from codealmanac.services.cloud_repositories.models import CloudRepository
from codealmanac.services.cloud_repositories.requests import (
    ResolveCloudRepositoryRequest,
)
from codealmanac.services.cloud_repositories.service import CloudRepositoriesService
from codealmanac.workflows.cloud_login.ports import BrowserOpener
from codealmanac.workflows.cloud_open.models import CloudOpenResult, CloudOpenTarget
from codealmanac.workflows.cloud_open.requests import OpenCloudTargetRequest
from codealmanac.workflows.local_setup.models import LocalRepositoryState
from codealmanac.workflows.local_setup.ports import LocalRepositoryProbe


class CloudOpenWorkflow:
    def __init__(
        self,
        repository_probe: LocalRepositoryProbe,
        cloud_repositories: CloudRepositoriesService,
        browser: BrowserOpener,
    ):
        self.repository_probe = repository_probe
        self.cloud_repositories = cloud_repositories
        self.browser = browser

    def open(self, request: OpenCloudTargetRequest) -> CloudOpenResult:
        checkout = self.repository_probe.read(request.cwd)
        require_github_checkout(checkout)
        repository = None
        if request.target == "wiki":
            repository = self.cloud_repositories.resolve(
                ResolveCloudRepositoryRequest(
                    api_url=request.api_url,
                    full_name=required_part(checkout.full_name, "GitHub repository"),
                )
            )
        url = url_for_target(
            request.target,
            app_url=request.app_url,
            checkout=checkout,
            repository=repository,
        )
        opened = False if request.no_browser else self.browser.open(url)
        return CloudOpenResult(
            target=request.target,
            url=url,
            opened=opened,
            checkout=checkout,
        )


def require_github_checkout(checkout: LocalRepositoryState) -> None:
    if not checkout.available:
        raise ValidationFailed(
            checkout.unavailable_reason or "GitHub checkout unavailable"
        )
    if checkout.provider != "github":
        raise ValidationFailed("current checkout is not a GitHub repository")
    if checkout.owner_login is None or checkout.name is None:
        raise ValidationFailed("GitHub checkout is missing owner or repository name")


def url_for_target(
    target: CloudOpenTarget,
    *,
    app_url: str,
    checkout: LocalRepositoryState,
    repository: CloudRepository | None = None,
) -> str:
    owner = required_part(checkout.owner_login, "GitHub owner")
    repo = required_part(checkout.name, "GitHub repository")
    if target == "github":
        return f"https://github.com/{quote(owner, safe='')}/{quote(repo, safe='')}"
    if target == "wiki":
        if repository is None:
            raise ValidationFailed("cloud repository is unavailable")
        return (
            f"{app_url}/dashboard/accounts/{repository.account_id}"
            f"/repositories/{repository.repo_id}/wiki"
        )
    if target == "setup":
        return repo_setup_url(app_url, owner=owner, repo=repo, target=None)
    if target == "repo":
        return repo_setup_url(app_url, owner=owner, repo=repo, target="activity")
    if target == "settings":
        return repo_setup_url(app_url, owner=owner, repo=repo, target="settings")
    if target == "github-app":
        return repo_setup_url(app_url, owner=owner, repo=repo, target="github-app")
    raise AssertionError(f"unhandled cloud open target: {target}")


def repo_setup_url(
    app_url: str,
    *,
    owner: str,
    repo: str,
    target: str | None,
) -> str:
    params = {
        "provider": "github",
        "owner": owner,
        "repo": repo,
    }
    if target is not None:
        params["target"] = target
    return f"{app_url}/setup/repo?{urlencode(params)}"


def required_part(value: str | None, label: str) -> str:
    if value is None:
        raise ValidationFailed(f"{label} is unavailable")
    return value
