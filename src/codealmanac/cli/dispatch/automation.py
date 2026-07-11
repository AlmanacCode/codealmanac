import argparse
from collections.abc import Sequence

from codealmanac.app import CodeAlmanac
from codealmanac.cli.render.admin import render_automation_status
from codealmanac.services.automation.models import AutomationTask
from codealmanac.services.automation.requests import AutomationStatusRequest


def dispatch_automation(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.automation_command == "status":
        result = app.automation.status(
            AutomationStatusRequest(tasks=parse_automation_tasks(args.tasks))
        )
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
