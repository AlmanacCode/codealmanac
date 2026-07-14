from codealmanac.services.automation.models import AutomationTask
from codealmanac.services.setup.requests import RunSetupRequest

DEFAULT_SETUP_AUTOMATION_TASKS = (
    AutomationTask.SYNC,
    AutomationTask.GARDEN,
    AutomationTask.UPDATE,
)


def should_install_automation(request: RunSetupRequest) -> bool:
    return len(selected_setup_tasks(request)) > 0


def recommendation_tasks(request: RunSetupRequest) -> tuple[AutomationTask, ...]:
    tasks = selected_setup_tasks(request)
    return tasks


def selected_setup_tasks(request: RunSetupRequest) -> tuple[AutomationTask, ...]:
    return tuple(
        task
        for task in DEFAULT_SETUP_AUTOMATION_TASKS
        if not should_skip_setup_task(task, request)
    )


def should_skip_setup_task(task: AutomationTask, request: RunSetupRequest) -> bool:
    return (
        (task == AutomationTask.SYNC and request.sync_off)
        or (task == AutomationTask.GARDEN and request.garden_off)
        or (task == AutomationTask.UPDATE and not request.auto_update)
    )
