import argparse

from codealmanac.services.automation.models import AutomationTask


def add_automation_commands(subcommands: argparse._SubParsersAction) -> None:
    automation = subcommands.add_parser(
        "automation",
        help="inspect local scheduled automation",
    )
    automation_subcommands = automation.add_subparsers(
        dest="automation_command",
        required=True,
    )
    automation_status = automation_subcommands.add_parser(
        "status",
        help="show scheduled automation status",
    )
    automation_status.add_argument(
        "tasks",
        nargs="*",
        choices=tuple(task.value for task in AutomationTask),
    )
    automation_status.add_argument("--json", action="store_true")
