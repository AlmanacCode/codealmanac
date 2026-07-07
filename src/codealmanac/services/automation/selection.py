from collections.abc import Sequence
from dataclasses import dataclass

from codealmanac.core.errors import ValidationFailed
from codealmanac.services.automation.models import AutomationTask
from codealmanac.services.automation.requests import (
    AutomationSelectionRequest,
    InstallAutomationRequest,
)

DEFAULT_INSTALL_TASKS = (
    AutomationTask.SYNC,
    AutomationTask.GARDEN,
    AutomationTask.UPDATE,
)
DEFAULT_STATUS_TASKS = (
    AutomationTask.SYNC,
    AutomationTask.GARDEN,
    AutomationTask.UPDATE,
)


@dataclass(frozen=True)
class InstallTaskSelection:
    tasks: tuple[AutomationTask, ...]
    explicit_tasks: bool
    disable_garden: bool


def install_task_selection(request: InstallAutomationRequest) -> InstallTaskSelection:
    explicit_tasks = len(request.tasks) > 0
    tasks = selected_tasks(request.tasks, DEFAULT_INSTALL_TASKS)
    validate_install_selection(request, tasks, explicit_tasks)
    selected = tuple(
        task
        for task in tasks
        if not (task == AutomationTask.GARDEN and request.garden_off)
    )
    return InstallTaskSelection(
        tasks=selected,
        explicit_tasks=explicit_tasks,
        disable_garden=not explicit_tasks and request.garden_off,
    )


def status_task_selection(
    request: AutomationSelectionRequest,
) -> tuple[AutomationTask, ...]:
    return selected_tasks(request.tasks, DEFAULT_STATUS_TASKS)


def base_install_request(
    request: AutomationSelectionRequest,
) -> InstallAutomationRequest:
    return InstallAutomationRequest(
        tasks=request.tasks,
        home=request.home,
    )


def validate_install_selection(
    request: InstallAutomationRequest,
    tasks: tuple[AutomationTask, ...],
    explicit_tasks: bool,
) -> None:
    if explicit_tasks and request.garden_off:
        raise ValidationFailed(
            "--garden-off can only be used with the default automation install"
        )


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
