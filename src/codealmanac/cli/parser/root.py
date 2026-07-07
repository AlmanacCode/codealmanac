import argparse

from codealmanac import __version__
from codealmanac.cli.parser.admin import add_admin_commands
from codealmanac.cli.parser.run_commands import add_run_commands
from codealmanac.cli.parser.wiki import add_wiki_commands


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="codealmanac",
        description="Maintain a local Almanac wiki for a codebase.",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"codealmanac {__version__}",
    )
    subcommands = parser.add_subparsers(dest="command", required=True)
    add_run_commands(subcommands)
    add_wiki_commands(subcommands)
    add_admin_commands(subcommands)
    return parser
