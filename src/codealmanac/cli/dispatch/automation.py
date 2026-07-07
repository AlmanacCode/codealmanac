import argparse
from collections.abc import Sequence

from codealmanac.app import CodeAlmanac
from codealmanac.cli.dispatch.config import parse_optional_duration
from codealmanac.cli.render.admin import (
    render_automation_install,
    render_automation_status,
    render_automation_uninstall,
)
from codealmanac.services.automation.models import AutomationTask
from codealmanac.services.automation.requests import (
    AutomationStatusRequest,
    InstallAutomationRequest,
    UninstallAutomationRequest,
)


def dispatch_automation(args: argparse.Namespace, app: CodeAlmanac) -> int:
    tasks = parse_automation_tasks(args.tasks)
    if args.automation_command == "install":
        result = app.automation.install(
            InstallAutomationRequest(
                tasks=tasks,
                every=parse_optional_duration(args.every, "--every"),
                garden_every=parse_optional_duration(
                    args.garden_every,
                    "--garden-every",
                ),
                garden_off=args.garden_off,
            )
        )
        render_automation_install(result, json_output=args.json)
        return 0
    if args.automation_command == "uninstall":
        result = app.automation.uninstall(UninstallAutomationRequest(tasks=tasks))
        render_automation_uninstall(result, json_output=args.json)
        return 0
    if args.automation_command == "status":
        result = app.automation.status(AutomationStatusRequest(tasks=tasks))
        render_automation_status(result, json_output=args.json)
        return 0
    raise AssertionError(f"unhandled automation command: {args.automation_command}")

def parse_automation_tasks(values: Sequence[str]) -> tuple[AutomationTask, ...]:
    tasks: list[AutomationTask] = []
    for value in values:
        task = AutomationTask(value)
        if task not in tasks:
            tasks.append(task)
    return tuple(tasks)
