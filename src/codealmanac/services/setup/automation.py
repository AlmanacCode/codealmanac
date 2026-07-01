from codealmanac.services.automation.models import AutomationTask
from codealmanac.services.automation.requests import InstallAutomationRequest
from codealmanac.services.setup.requests import RunSetupRequest


def should_install_automation(request: RunSetupRequest) -> bool:
    return (
        request.install_automation
        or len(request.automation_tasks) > 0
        or request.sync_every is not None
        or request.sync_quiet is not None
        or request.garden_every is not None
        or request.garden_off
    )


def recommendation_tasks(request: RunSetupRequest) -> tuple[AutomationTask, ...]:
    tasks = request.automation_tasks or (AutomationTask.SYNC, AutomationTask.GARDEN)
    return tuple(
        task
        for task in tasks
        if not (task == AutomationTask.GARDEN and request.garden_off)
    )


def install_automation_request(request: RunSetupRequest) -> InstallAutomationRequest:
    return InstallAutomationRequest(
        cwd=request.cwd,
        tasks=request.automation_tasks,
        home=request.home,
        every=request.sync_every,
        quiet=request.sync_quiet,
        garden_every=request.garden_every,
        garden_off=request.garden_off,
        env_path=request.env_path,
        python_executable=request.python_executable,
    )
