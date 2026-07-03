import argparse

from codealmanac.services.harnesses.models import HarnessKind


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

    worker = subcommands.add_parser("__run-worker", help=argparse.SUPPRESS)
    worker.add_argument("--cwd", required=True)
    worker.add_argument("--wiki")

    local_worker = subcommands.add_parser(
        "__run-local-worker",
        help=argparse.SUPPRESS,
    )
    local_worker.add_argument("--repository-id")
    local_worker.add_argument("--branch-id")
    local_worker.add_argument("--operation", default="update")
    local_worker.add_argument(
        "--using",
        default=HarnessKind.CODEX.value,
        choices=tuple(kind.value for kind in HarnessKind),
    )
    local_worker.add_argument("--title")
    local_worker.add_argument("--json", action="store_true")

    local_trigger = subcommands.add_parser(
        "__record-local-trigger",
        help=argparse.SUPPRESS,
    )
    local_trigger.add_argument("--cwd", default=".")
    local_trigger.add_argument(
        "--kind",
        required=True,
        choices=(
            "local_post_commit",
            "local_post_merge",
            "local_post_rewrite",
            "manual",
        ),
    )
    local_trigger.add_argument("--previous-head")
    local_trigger.add_argument("--payload-ref")
    local_trigger.add_argument("--spawn-worker", action="store_true")
    local_trigger.add_argument("--json", action="store_true")

    sync = subcommands.add_parser("sync", help=argparse.SUPPRESS)
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
