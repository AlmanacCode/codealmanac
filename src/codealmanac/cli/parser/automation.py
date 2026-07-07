import argparse

from codealmanac.services.automation.models import AutomationTask


def add_automation_commands(subcommands: argparse._SubParsersAction) -> None:
    automation = subcommands.add_parser(
        "automation",
        help="manage local scheduled automation",
    )
    automation_subcommands = automation.add_subparsers(
        dest="automation_command",
        required=True,
    )
    automation_install = automation_subcommands.add_parser(
        "install",
        help="install scheduled sync and garden jobs",
    )
    automation_install.add_argument(
        "tasks",
        nargs="*",
        choices=tuple(task.value for task in AutomationTask),
    )
    automation_install.add_argument(
        "--every",
        help="run interval for sync or one selected task",
    )
    automation_install.add_argument(
        "--garden-every",
        help="Garden run interval (default: 4h)",
    )
    automation_install.add_argument(
        "--garden-off",
        action="store_true",
        help="disable scheduled Garden automation",
    )
    automation_install.add_argument("--json", action="store_true")
    automation_uninstall = automation_subcommands.add_parser(
        "uninstall",
        help="remove scheduled jobs",
    )
    automation_uninstall.add_argument(
        "tasks",
        nargs="*",
        choices=tuple(task.value for task in AutomationTask),
    )
    automation_uninstall.add_argument("--json", action="store_true")
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
