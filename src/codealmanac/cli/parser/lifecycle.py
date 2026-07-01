import argparse

from codealmanac.services.harnesses.models import HarnessKind


def add_lifecycle_commands(subcommands: argparse._SubParsersAction) -> None:
    init = subcommands.add_parser("init", help="initialize a local Almanac wiki")
    init.add_argument("path", nargs="?", default=".")
    init.add_argument("--root")
    init.add_argument("--name")
    init.add_argument("--description", default="")

    build = subcommands.add_parser("build", help="build or refresh a local wiki")
    build.add_argument("path", nargs="?", default=".")
    build.add_argument("--root")
    build.add_argument("--name")
    build.add_argument("--description", default="")

    ingest = subcommands.add_parser("ingest", help="ingest local material")
    ingest.add_argument("inputs", nargs="+")
    ingest.add_argument("--wiki")
    ingest.add_argument(
        "--using",
        choices=tuple(kind.value for kind in HarnessKind),
    )
    ingest.add_argument("--title")
    ingest.add_argument("--guidance")
    ingest_mode = ingest.add_mutually_exclusive_group()
    ingest_mode.add_argument("--background", action="store_true")
    ingest_mode.add_argument("--foreground", action="store_true")
    ingest.add_argument("--json", action="store_true")

    garden = subcommands.add_parser("garden", help="garden the local wiki")
    garden.add_argument("--wiki")
    garden.add_argument(
        "--using",
        choices=tuple(kind.value for kind in HarnessKind),
    )
    garden.add_argument("--title")
    garden.add_argument("--guidance")
    garden_mode = garden.add_mutually_exclusive_group()
    garden_mode.add_argument("--background", action="store_true")
    garden_mode.add_argument("--foreground", action="store_true")
    garden.add_argument("--json", action="store_true")

    worker = subcommands.add_parser("__run-worker", help=argparse.SUPPRESS)
    worker.add_argument("--cwd", required=True)
    worker.add_argument("--wiki")

    sync = subcommands.add_parser("sync", help="sync quiet local transcripts")
    sync.add_argument("--wiki")
    sync.add_argument("--from", dest="source_apps")
    sync.add_argument("--quiet")
    sync.add_argument("--pending-timeout")
    sync.add_argument("--max-failed-attempts", type=int)
    sync.add_argument("--claim-owner")
    sync_mode = sync.add_mutually_exclusive_group()
    sync_mode.add_argument("--background", action="store_true")
    sync_mode.add_argument("--foreground", action="store_true")
    sync.add_argument(
        "--using",
        choices=tuple(kind.value for kind in HarnessKind),
    )
    sync.add_argument("--json", action="store_true")
    sync_subcommands = sync.add_subparsers(dest="sync_command")
    sync_status = sync_subcommands.add_parser("status", help="show sync readiness")
    sync_status.add_argument("--wiki")
    sync_status.add_argument("--from", dest="source_apps")
    sync_status.add_argument("--quiet")
    sync_status.add_argument("--pending-timeout")
    sync_status.add_argument("--max-failed-attempts", type=int)
    sync_status.add_argument("--json", action="store_true")
