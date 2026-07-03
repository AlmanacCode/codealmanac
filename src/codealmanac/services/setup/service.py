from codealmanac.core.errors import ExecutionFailed
from codealmanac.services.automation.requests import UninstallAutomationRequest
from codealmanac.services.setup.models import SetupResult, UninstallResult
from codealmanac.services.setup.planning import setup_plan
from codealmanac.services.setup.ports import (
    InstructionInstaller,
    SetupAutomationCleaner,
    SetupCloudLogin,
)
from codealmanac.services.setup.requests import RunSetupRequest, RunUninstallRequest
from codealmanac.workflows.cloud_login.requests import RunCloudLoginRequest


class SetupService:
    def __init__(
        self,
        instructions: InstructionInstaller,
        automation: SetupAutomationCleaner,
        cloud_login: SetupCloudLogin | None = None,
    ):
        self._instructions = instructions
        self._automation = automation
        self._cloud_login = cloud_login

    def run(self, request: RunSetupRequest) -> SetupResult:
        plan = setup_plan(request)
        cloud_login = None
        if not request.skip_login:
            if self._cloud_login is None:
                raise ExecutionFailed("cloud login is not configured")
            cloud_login = self._cloud_login.run(
                RunCloudLoginRequest(
                    api_url=request.api_url,
                    no_browser=request.no_browser,
                    browser_mode=request.login_browser_mode,
                    timeout_seconds=request.login_timeout_seconds,
                    poll_interval_seconds=request.login_poll_interval_seconds,
                )
            )
            if cloud_login.status not in {"signed_in", "already_signed_in"}:
                raise ExecutionFailed("cloud login did not complete")
        changes = ()
        if not request.skip_instructions:
            changes = self._instructions.install(request.targets)
        if request.skip_instructions:
            return SetupResult(
                plan=plan,
                cloud_login=cloud_login,
                skipped_instructions=True,
            )
        return SetupResult(
            plan=plan,
            cloud_login=cloud_login,
            changes=changes,
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
