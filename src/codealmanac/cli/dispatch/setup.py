import argparse
import sys
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.cli.dispatch.config import (
    parse_optional_duration,
)
from codealmanac.cli.dispatch.setup_tui import (
    SetupCancelled,
    resolve_setup_selections,
)
from codealmanac.cli.render.admin import render_setup_result, render_uninstall_result
from codealmanac.services.setup.models import (
    PackageUninstallStatus,
    UninstallResult,
)
from codealmanac.services.setup.requests import RunSetupRequest, RunUninstallRequest


def dispatch_setup(args: argparse.Namespace, app: CodeAlmanac) -> int:
    try:
        user_config = app.config.load_user()
        runner_status = () if args.yes or args.json else app.harnesses.check()
        selections = resolve_setup_selections(args, user_config, runner_status)
    except SetupCancelled:
        print("CodeAlmanac setup canceled.", file=sys.stderr)
        return 1
    result = app.setup.run(
        RunSetupRequest(
            cwd=Path.cwd(),
            targets=selections.targets,
            harness=selections.harness,
            model=selections.model,
            yes=args.yes,
            auto_commit=selections.auto_commit,
            auto_update=selections.auto_update,
            telemetry_enabled=selections.telemetry_enabled,
            skip_instructions=args.skip_instructions,
            sync_every=parse_optional_duration(args.sync_every, "--sync-every")
            or user_config.automation.sync.every,
            sync_off=selections.sync_off,
            garden_every=(
                parse_optional_duration(args.garden_every, "--garden-every")
                or user_config.automation.garden.every
            ),
            garden_off=selections.garden_off,
            update_every=user_config.automation.update.every,
        )
    )
    render_setup_result(result, json_output=args.json)
    return 0


def dispatch_uninstall(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if not args.yes and not confirm_uninstall():
        return 1
    result = app.setup.uninstall(
        RunUninstallRequest(
            yes=args.yes,
        )
    )
    render_uninstall_result(result, json_output=args.json)
    return uninstall_exit_code(result)


def confirm_uninstall() -> bool:
    if not sys.stdin.isatty():
        print(
            "codealmanac uninstall requires --yes in non-interactive shells",
            file=sys.stderr,
        )
        return False
    response = input("Uninstall CodeAlmanac-owned machine artifacts? [y/N] ")
    if response.strip().casefold() in {"y", "yes"}:
        return True
    print("CodeAlmanac uninstall canceled.", file=sys.stderr)
    return False


def uninstall_exit_code(result: UninstallResult) -> int:
    if (
        result.package_uninstall is not None
        and result.package_uninstall.status == PackageUninstallStatus.FAILED
    ):
        return 1
    return 0
