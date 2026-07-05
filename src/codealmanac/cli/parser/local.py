import argparse

from codealmanac.engine.harnesses.models import HarnessKind
from codealmanac.local.control.models import ControlRunStatus
from codealmanac.local.runs.kinds import LocalRunKind

LOCAL_DELIVERY_CHOICES = ("commit", "working-tree")
LOCAL_RUN_STATUS_CHOICES = tuple(status.value for status in ControlRunStatus)


def add_local_commands(subcommands: argparse._SubParsersAction) -> None:
    local = subcommands.add_parser("local", help="manage local CodeAlmanac setup")
    local_subcommands = local.add_subparsers(dest="local_command", required=True)

    status = local_subcommands.add_parser("status", help="show local setup status")
    status.add_argument("--json", action="store_true")

    setup = local_subcommands.add_parser(
        "setup",
        help="configure local branch triggers for this checkout",
    )
    setup.add_argument("--branch", help="branch to maintain; defaults to current")
    setup.add_argument(
        "--delivery",
        choices=LOCAL_DELIVERY_CHOICES,
        default="commit",
        help="how local runs deliver wiki updates",
    )
    setup.add_argument(
        "--root",
        help="repo-relative Almanac root to maintain; defaults to almanac",
    )
    setup.add_argument(
        "--skip-hooks",
        action="store_true",
        help="record policy without installing Git hooks",
    )
    setup.add_argument("--json", action="store_true")

    triggers = local_subcommands.add_parser(
        "triggers",
        help="manage local branch trigger policy",
    )
    triggers_subcommands = triggers.add_subparsers(
        dest="triggers_command",
        required=True,
    )

    triggers_list = triggers_subcommands.add_parser(
        "list",
        help="list local branch trigger policies",
    )
    triggers_list.add_argument("--json", action="store_true")

    triggers_enable = triggers_subcommands.add_parser(
        "enable",
        help="enable local runs for a branch",
    )
    triggers_enable.add_argument("branch")
    triggers_enable.add_argument("--delivery", choices=LOCAL_DELIVERY_CHOICES)
    triggers_enable.add_argument("--json", action="store_true")

    triggers_disable = triggers_subcommands.add_parser(
        "disable",
        help="disable local runs for a branch",
    )
    triggers_disable.add_argument("branch")
    triggers_disable.add_argument("--json", action="store_true")

    delivery = local_subcommands.add_parser(
        "delivery",
        help="manage local delivery policy",
    )
    delivery_subcommands = delivery.add_subparsers(
        dest="delivery_command",
        required=True,
    )
    delivery_set = delivery_subcommands.add_parser(
        "set",
        help="set local delivery mode for a branch",
    )
    delivery_set.add_argument("--branch", required=True)
    delivery_set.add_argument("--mode", choices=LOCAL_DELIVERY_CHOICES, required=True)
    delivery_set.add_argument("--json", action="store_true")

    runs = local_subcommands.add_parser("runs", help="start and inspect local runs")
    runs_subcommands = runs.add_subparsers(dest="local_runs_command", required=True)

    runs_start = runs_subcommands.add_parser("start", help="start a local run")
    runs_start.add_argument("--branch")
    runs_start.add_argument(
        "--kind",
        default=LocalRunKind.UPDATE.value,
        choices=tuple(kind.value for kind in LocalRunKind),
    )
    runs_start.add_argument(
        "--using",
        default=HarnessKind.CODEX.value,
        choices=tuple(kind.value for kind in HarnessKind),
    )
    runs_start.add_argument("--title")
    runs_start.add_argument("--guidance")
    runs_start.add_argument("--json", action="store_true")

    runs_list = runs_subcommands.add_parser("list", help="list local runs")
    runs_list.add_argument("--limit", type=int, default=20)
    runs_list.add_argument(
        "--status",
        action="append",
        choices=LOCAL_RUN_STATUS_CHOICES,
        default=[],
    )
    runs_list.add_argument("--repository-id")
    runs_list.add_argument("--branch-id")
    runs_list.add_argument("--json", action="store_true")

    runs_show = runs_subcommands.add_parser("show", help="show a local run")
    runs_show.add_argument("run_id")
    runs_show.add_argument("--json", action="store_true")

    runs_cancel = runs_subcommands.add_parser("cancel", help="cancel a local run")
    runs_cancel.add_argument("run_id")
    runs_cancel.add_argument("--json", action="store_true")

    runs_retry = runs_subcommands.add_parser("retry", help="retry a local run")
    runs_retry.add_argument("run_id")
    runs_retry.add_argument("--json", action="store_true")

    runs_logs = runs_subcommands.add_parser("logs", help="show local run logs")
    runs_logs.add_argument("run_id")
    runs_logs.add_argument("--json", action="store_true")
