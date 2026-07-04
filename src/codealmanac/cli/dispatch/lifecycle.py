import argparse

from codealmanac.app import CodeAlmanac
from codealmanac.cli.dispatch.init import dispatch_init
from codealmanac.cli.dispatch.worker import dispatch_run_worker

LIFECYCLE_COMMANDS = frozenset(
    (
        "__run-worker",
        "init",
    )
)


def is_lifecycle_command(command: str | None) -> bool:
    return command in LIFECYCLE_COMMANDS


def dispatch_lifecycle(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.command == "init":
        return dispatch_init(args, app)
    if args.command == "__run-worker":
        return dispatch_run_worker(args, app)
    raise AssertionError(f"unhandled lifecycle command: {args.command}")
