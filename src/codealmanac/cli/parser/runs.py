import argparse

from codealmanac.cli.parser.cloud_auth import add_api_url


def add_runs_commands(subcommands: argparse._SubParsersAction) -> None:
    runs = subcommands.add_parser("runs", help="inspect cloud update runs")
    runs_subcommands = runs.add_subparsers(dest="runs_command", required=True)

    runs_list = runs_subcommands.add_parser("list", help="list cloud runs")
    runs_list.add_argument("--limit", type=int)
    runs_list.add_argument("--cursor")
    add_api_url(runs_list)
    runs_list.add_argument("--json", action="store_true")

    runs_start = runs_subcommands.add_parser("start", help="start a cloud run")
    runs_start.add_argument("--branch", required=True)
    add_api_url(runs_start)
    runs_start.add_argument("--json", action="store_true")

    runs_show = runs_subcommands.add_parser("show", help="show one cloud run")
    runs_show.add_argument("run_id")
    add_api_url(runs_show)
    runs_show.add_argument("--json", action="store_true")

    runs_cancel = runs_subcommands.add_parser("cancel", help="cancel one cloud run")
    runs_cancel.add_argument("run_id")
    add_api_url(runs_cancel)
    runs_cancel.add_argument("--json", action="store_true")

    runs_retry = runs_subcommands.add_parser("retry", help="retry one cloud run")
    runs_retry.add_argument("run_id")
    add_api_url(runs_retry)
    runs_retry.add_argument("--json", action="store_true")

    runs_logs = runs_subcommands.add_parser("logs", help="show one cloud run log")
    runs_logs.add_argument("run_id")
    add_api_url(runs_logs)
    runs_logs.add_argument("--json", action="store_true")
