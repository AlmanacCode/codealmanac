from collections.abc import Sequence

from codealmanac.services.automation.models import AutomationTask
from codealmanac.services.automation.requests import (
    AutomationSelectionRequest,
)

DEFAULT_STATUS_TASKS = (
    AutomationTask.SYNC,
    AutomationTask.GARDEN,
    AutomationTask.UPDATE,
)


def status_task_selection(
    request: AutomationSelectionRequest,
) -> tuple[AutomationTask, ...]:
    return selected_tasks(request.tasks, DEFAULT_STATUS_TASKS)


def selected_tasks(
    requested: Sequence[AutomationTask],
    defaults: tuple[AutomationTask, ...],
) -> tuple[AutomationTask, ...]:
    tasks = tuple(requested) if len(requested) > 0 else defaults
    selected: list[AutomationTask] = []
    for task in tasks:
        if task not in selected:
            selected.append(task)
    return tuple(selected)
