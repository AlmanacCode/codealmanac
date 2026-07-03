import argparse

from codealmanac import __version__
from codealmanac.cli.parser.admin import add_admin_commands, add_cloud_commands
from codealmanac.cli.parser.dev import add_dev_commands
from codealmanac.cli.parser.lifecycle import add_lifecycle_commands
from codealmanac.cli.parser.local import add_local_commands
from codealmanac.cli.parser.open import add_open_commands
from codealmanac.cli.parser.wiki import add_wiki_commands


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="codealmanac",
        description=(
            "Open, update, and inspect CodeAlmanac wikis for GitHub repositories."
        ),
    )
    parser.add_argument("--version", action="version", version=__version__)
    subcommands = parser.add_subparsers(
        dest="command",
        metavar="command",
        required=False,
    )
    add_open_commands(subcommands)
    add_cloud_commands(subcommands)
    add_lifecycle_commands(subcommands)
    add_dev_commands(subcommands)
    add_local_commands(subcommands)
    add_wiki_commands(subcommands)
    add_admin_commands(subcommands)
    hide_suppressed_subcommands(subcommands)
    return parser


def hide_suppressed_subcommands(subcommands: argparse._SubParsersAction) -> None:
    subcommands._choices_actions = [
        action
        for action in subcommands._choices_actions
        if action.help != argparse.SUPPRESS
    ]
