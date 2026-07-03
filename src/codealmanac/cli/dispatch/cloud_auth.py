import argparse

from codealmanac.app import CodeAlmanac
from codealmanac.cli.render.cloud_auth import (
    render_cloud_login_result,
    render_cloud_logout_result,
    render_cloud_status,
)
from codealmanac.services.cloud_auth.requests import (
    CloudLogoutRequest,
    CloudStatusRequest,
)
from codealmanac.workflows.cloud_login.requests import (
    CloudLoginBrowserMode,
    RunCloudLoginRequest,
)


def dispatch_login(args: argparse.Namespace, app: CodeAlmanac) -> int:
    result = app.workflows.cloud_login.run(
        RunCloudLoginRequest(
            api_url=args.api_url,
            no_browser=args.no_browser,
            browser_mode=login_browser_mode(args),
            timeout_seconds=args.timeout,
            poll_interval_seconds=args.poll_every,
            force=args.force,
        )
    )
    render_cloud_login_result(result, json_output=args.json)
    return 0 if result.status in {"signed_in", "already_signed_in"} else 1


def dispatch_whoami(args: argparse.Namespace, app: CodeAlmanac) -> int:
    status = app.cloud_auth.status(
        CloudStatusRequest(
            api_url=args.api_url,
            validate_remote=True,
        )
    )
    render_cloud_status(status, json_output=args.json)
    return 0 if status.authenticated else 1


def dispatch_logout(args: argparse.Namespace, app: CodeAlmanac) -> int:
    result = app.cloud_auth.logout(CloudLogoutRequest(api_url=args.api_url))
    render_cloud_logout_result(result, json_output=args.json)
    return 0


def login_browser_mode(args: argparse.Namespace) -> CloudLoginBrowserMode:
    if args.json:
        return "silent"
    if args.no_browser:
        return "never"
    return "prompt"
