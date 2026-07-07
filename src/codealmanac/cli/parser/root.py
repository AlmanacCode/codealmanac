import argparse

from codealmanac import __version__
from codealmanac.cli.parser.admin import add_admin_commands
from codealmanac.cli.parser.run_commands import add_run_commands
from codealmanac.cli.parser.wiki import add_wiki_commands

PUBLIC_COMMAND_METAVAR = (
    "{init,ingest,garden,sync,list,search,show,topics,health,validate,reindex,"
    "serve,tag,untag,config,setup,uninstall,doctor,update,jobs,automation}"
)


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
    subcommands = parser.add_subparsers(
        dest="command",
        required=True,
        metavar=PUBLIC_COMMAND_METAVAR,
    )
    add_run_commands(subcommands)
    add_wiki_commands(subcommands)
    add_admin_commands(subcommands)
    return parser
