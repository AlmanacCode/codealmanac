from codealmanac.services.automation.requests import UninstallAutomationRequest
from codealmanac.services.setup.automation import (
    install_automation_request,
    should_install_automation,
)
from codealmanac.services.setup.models import SetupResult, UninstallResult
from codealmanac.services.setup.planning import setup_plan
from codealmanac.services.setup.ports import (
    InstructionInstaller,
    SetupAutomationManager,
)
from codealmanac.services.setup.requests import RunSetupRequest, RunUninstallRequest


class SetupService:
    def __init__(
        self,
        instructions: InstructionInstaller,
        automation: SetupAutomationManager,
    ):
        self._instructions = instructions
        self._automation = automation

    def run(self, request: RunSetupRequest) -> SetupResult:
        plan = setup_plan(request)
        changes = ()
        if not request.skip_instructions:
            changes = self._instructions.install(request.targets)
        automation_install = None
        if should_install_automation(request):
            automation_install = self._automation.install(
                install_automation_request(request)
            )
        if request.skip_instructions:
            return SetupResult(
                plan=plan,
                skipped_instructions=True,
                automation_install=automation_install,
            )
        return SetupResult(
            plan=plan,
            changes=changes,
            automation_install=automation_install,
        )

    def uninstall(self, request: RunUninstallRequest) -> UninstallResult:
        changes = ()
        if not request.keep_instructions:
            changes = self._instructions.uninstall(request.targets)
        automation_uninstall = None
        if not request.keep_automation:
            automation_uninstall = self._automation.uninstall(
                UninstallAutomationRequest(
                    tasks=request.automation_tasks,
                    home=request.home,
                )
            )
        if request.keep_instructions:
            return UninstallResult(
                kept_instructions=True,
                kept_automation=request.keep_automation,
                automation_uninstall=automation_uninstall,
            )
        return UninstallResult(
            kept_automation=request.keep_automation,
            changes=changes,
            automation_uninstall=automation_uninstall,
        )
