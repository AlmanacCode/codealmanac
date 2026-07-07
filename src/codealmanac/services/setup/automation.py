from codealmanac.services.automation.models import AutomationTask
from codealmanac.services.automation.requests import InstallAutomationRequest
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


def install_automation_request(request: RunSetupRequest) -> InstallAutomationRequest:
    return InstallAutomationRequest(
        tasks=install_tasks(request),
        home=request.home,
        every=request.sync_every,
        garden_every=request.garden_every,
        garden_off=request.garden_off,
        env_path=request.env_path,
        python_executable=request.python_executable,
    )


def install_tasks(request: RunSetupRequest) -> tuple[AutomationTask, ...]:
    return selected_setup_tasks(request)


def selected_setup_tasks(request: RunSetupRequest) -> tuple[AutomationTask, ...]:
    requested = request.automation_tasks or DEFAULT_SETUP_AUTOMATION_TASKS
    return tuple(
        task
        for task in requested
        if not should_skip_setup_task(task, request)
    )


def should_skip_setup_task(task: AutomationTask, request: RunSetupRequest) -> bool:
    return (
        (task == AutomationTask.SYNC and request.sync_off)
        or (task == AutomationTask.GARDEN and request.garden_off)
        or (task == AutomationTask.UPDATE and not request.auto_update)
    )
