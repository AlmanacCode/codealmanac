import argparse
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.cli.render.admin import render_setup_result, render_uninstall_result
from codealmanac.services.setup.models import SetupTarget
from codealmanac.services.setup.requests import RunSetupRequest, RunUninstallRequest
from codealmanac.workflows.cloud_login.requests import CloudLoginBrowserMode


def dispatch_setup(args: argparse.Namespace, app: CodeAlmanac) -> int:
    result = app.setup.run(
        RunSetupRequest(
            cwd=Path.cwd(),
            targets=parse_setup_targets(args.target),
            yes=args.yes,
            api_url=args.api_url,
            no_browser=args.no_browser,
            login_browser_mode=setup_login_browser_mode(args),
            login_timeout_seconds=args.login_timeout,
            login_poll_interval_seconds=args.login_poll_every,
            skip_login=args.skip_login,
            skip_instructions=args.skip_instructions,
        )
    )
    render_setup_result(result, json_output=args.json)
    return 0


def dispatch_uninstall(args: argparse.Namespace, app: CodeAlmanac) -> int:
    result = app.setup.uninstall(
        RunUninstallRequest(
            targets=parse_setup_targets(args.target),
            yes=args.yes,
            keep_instructions=args.keep_instructions,
            keep_automation=args.keep_automation,
        )
    )
    render_uninstall_result(result, json_output=args.json)
    return 0


def setup_login_browser_mode(args: argparse.Namespace) -> CloudLoginBrowserMode:
    if args.json:
        return "silent"
    if args.no_browser:
        return "never"
    if args.yes:
        return "open"
    return "prompt"


def parse_setup_targets(value: str) -> tuple[SetupTarget, ...]:
    if value == "all":
        return (SetupTarget.CODEX, SetupTarget.CLAUDE)
    return (SetupTarget(value),)
