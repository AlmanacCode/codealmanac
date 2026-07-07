import argparse

from codealmanac.services.harnesses.models import HarnessKind


def add_run_commands(subcommands: argparse._SubParsersAction) -> None:
    init = subcommands.add_parser("init", help="initialize a local Almanac wiki")
    init.add_argument("path", nargs="?", default=".")
    init.add_argument("--name")
    init.add_argument("--description", default="")
    init.add_argument(
        "--using",
        choices=tuple(kind.value for kind in HarnessKind),
    )
    init.add_argument("--guidance")
    init.add_argument("--json", action="store_true")

    ingest = subcommands.add_parser("ingest", help="ingest local material")
    ingest.add_argument("inputs", nargs="+")
    ingest.add_argument("--wiki")
    ingest.add_argument(
        "--using",
        choices=tuple(kind.value for kind in HarnessKind),
    )
    ingest.add_argument("--title")
    ingest.add_argument("--guidance")
    ingest.add_argument("--json", action="store_true")

    garden = subcommands.add_parser("garden", help="garden the local wiki")
    garden.add_argument("--wiki")
    garden.add_argument(
        "--using",
        choices=tuple(kind.value for kind in HarnessKind),
    )
    garden.add_argument("--title")
    garden.add_argument("--guidance")
    garden.add_argument("--json", action="store_true")

    worker = subcommands.add_parser("__run-worker", help=argparse.SUPPRESS)
    worker.add_argument("--cwd", required=True)

    subcommands.add_parser("__garden-scheduler", help=argparse.SUPPRESS)

    sync = subcommands.add_parser("sync", help="sync recently active transcripts")
    sync.add_argument("--wiki")
    sync.add_argument("--from", dest="source_apps")
    sync.add_argument(
        "--using",
        choices=tuple(kind.value for kind in HarnessKind),
    )
    sync.add_argument("--json", action="store_true")
    sync_subcommands = sync.add_subparsers(dest="sync_command")
    sync_status = sync_subcommands.add_parser("status", help="show sync readiness")
    sync_status.add_argument("--wiki")
    sync_status.add_argument("--from", dest="source_apps")
    sync_status.add_argument("--json", action="store_true")
