import argparse

from codealmanac.app import CodeAlmanac
from codealmanac.cli.dispatch.automation import dispatch_automation
from codealmanac.cli.dispatch.capture import dispatch_capture, dispatch_capture_hook
from codealmanac.cli.dispatch.cloud_auth import (
    dispatch_login,
    dispatch_logout,
    dispatch_whoami,
)
from codealmanac.cli.dispatch.cloud_status import dispatch_cloud_status
from codealmanac.cli.dispatch.diagnostics import dispatch_doctor
from codealmanac.cli.dispatch.jobs import dispatch_jobs
from codealmanac.cli.dispatch.repo import dispatch_repo
from codealmanac.cli.dispatch.runs import dispatch_runs
from codealmanac.cli.dispatch.setup import dispatch_setup, dispatch_uninstall
from codealmanac.cli.dispatch.updates import dispatch_update

ADMIN_COMMANDS = frozenset(
    (
        "automation",
        "__capture-hook",
        "capture",
        "doctor",
        "jobs",
        "login",
        "logout",
        "repo",
        "runs",
        "setup",
        "status",
        "uninstall",
        "update",
        "whoami",
    )
)


def is_admin_command(command: str | None) -> bool:
    return command in ADMIN_COMMANDS


def dispatch_admin(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.command == "login":
        return dispatch_login(args, app)
    if args.command == "whoami":
        return dispatch_whoami(args, app)
    if args.command == "logout":
        return dispatch_logout(args, app)
    if args.command == "capture":
        return dispatch_capture(args, app)
    if args.command == "repo":
        return dispatch_repo(args, app)
    if args.command == "runs":
        return dispatch_runs(args, app)
    if args.command == "__capture-hook":
        return dispatch_capture_hook(args, app)
    if args.command == "setup":
        return dispatch_setup(args, app)
    if args.command == "status":
        return dispatch_cloud_status(args, app)
    if args.command == "uninstall":
        return dispatch_uninstall(args, app)
    if args.command == "doctor":
        return dispatch_doctor(args, app)
    if args.command == "update":
        return dispatch_update(args, app)
    if args.command == "jobs":
        return dispatch_jobs(args, app)
    if args.command == "automation":
        return dispatch_automation(args, app)
    raise AssertionError(f"unhandled admin command: {args.command}")
