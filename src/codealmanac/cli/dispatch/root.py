import argparse

from codealmanac.app import CodeAlmanac
from codealmanac.cli.dispatch.admin import dispatch_admin, is_admin_command
from codealmanac.cli.dispatch.run_commands import (
    dispatch_run_command,
    is_run_command,
)
from codealmanac.cli.dispatch.wiki import dispatch_wiki, is_wiki_command


def dispatch(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if is_run_command(args.command):
        return dispatch_run_command(args, app)
    if is_wiki_command(args.command):
        return dispatch_wiki(args, app)
    if is_admin_command(args.command):
        return dispatch_admin(args, app)
    raise AssertionError(f"unhandled command: {args.command}")
