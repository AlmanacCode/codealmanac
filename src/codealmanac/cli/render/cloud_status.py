from rich.console import Console

from codealmanac.cli.render.common import print_json_model
from codealmanac.cloud.status.models import CloudStatusOverview


def render_cloud_status_overview(
    result: CloudStatusOverview,
    *,
    json_output: bool,
) -> None:
    if json_output:
        print_json_model(result)
        return
    console = Console(highlight=False)
    render_auth(result, console)
    render_repo(result, console)
    render_capture(result, console)


def render_auth(result: CloudStatusOverview, console: Console) -> None:
    auth = result.auth
    if auth.authenticated:
        login = auth.github_login or "unknown"
        console.print(f"Cloud: signed in as {login}")
        return
    console.print("Cloud: signed out")
    console.print("Run: codealmanac login")


def render_repo(result: CloudStatusOverview, console: Console) -> None:
    repo = result.repo
    if repo is None:
        console.print("Repository: not checked")
        return
    checkout = repo.checkout
    if not checkout.available:
        console.print("Repository: unavailable")
        if checkout.unavailable_reason is not None:
            console.print(f"Reason: {checkout.unavailable_reason}")
        return
    label = checkout.full_name or "unknown"
    branch = checkout.branch_name or "unknown"
    if repo.repository is None:
        console.print(f"Repository: not connected ({label} {branch})")
        return
    console.print(f"Repository: {repo.repository.full_name} {branch}")
    console.print(f"Triggers: {len(repo.triggers)}")


def render_capture(result: CloudStatusOverview, console: Console) -> None:
    capture = result.capture
    marker = (
        "credential installed" if capture.credential_present else "credential missing"
    )
    console.print(f"Capture: {marker}")
    if len(capture.providers) == 0:
        console.print("Providers: none")
    else:
        console.print(f"Providers: {', '.join(capture.providers)}")
    if len(capture.cloud_credentials) > 0:
        count = len(capture.cloud_credentials)
        console.print(f"Capture cloud credentials: {count} active")
