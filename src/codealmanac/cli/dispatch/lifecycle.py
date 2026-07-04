import argparse

from codealmanac.app import CodeAlmanac
from codealmanac.cli.dispatch.init import dispatch_init

LIFECYCLE_COMMANDS = frozenset(("init",))


def is_lifecycle_command(command: str | None) -> bool:
    return command in LIFECYCLE_COMMANDS


def dispatch_lifecycle(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.command == "init":
        return dispatch_init(args, app)
    raise AssertionError(f"unhandled lifecycle command: {args.command}")
