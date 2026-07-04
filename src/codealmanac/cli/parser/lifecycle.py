import argparse

from codealmanac.engine.harnesses.models import HarnessKind


def add_lifecycle_commands(subcommands: argparse._SubParsersAction) -> None:
    init = subcommands.add_parser("init", help="initialize a local Almanac wiki")
    init.add_argument("path", nargs="?", default=".")
    init.add_argument("--root")
    init.add_argument("--name")
    init.add_argument("--description", default="")
    init.add_argument(
        "--using",
        choices=tuple(kind.value for kind in HarnessKind),
    )
    init_mode = init.add_mutually_exclusive_group()
    init_mode.add_argument("--background", action="store_true")
    init_mode.add_argument("--foreground", action="store_true")
    init.add_argument("--force", action="store_true")
    init.add_argument("--yes", action="store_true")
    init.add_argument("--verbose", action="store_true")
    init.add_argument("--guidance")
    init.add_argument("--json", action="store_true")
