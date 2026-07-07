from codealmanac.services.automation.requests import UninstallAutomationRequest
from codealmanac.services.config.models import ConfigKey, ConfigSetResult
from codealmanac.services.config.requests import SetConfigValueRequest
from codealmanac.services.config.service import ConfigService
from codealmanac.services.harnesses.models import HarnessReadiness
from codealmanac.services.setup.automation import (
    install_automation_request,
    should_install_automation,
)
from codealmanac.services.setup.models import SetupResult, UninstallResult
from codealmanac.services.setup.planning import setup_plan
from codealmanac.services.setup.ports import (
    GlobalStateRemover,
    InstructionInstaller,
    PackageUninstaller,
    RunnerReadinessProbe,
    SetupAutomationManager,
)
from codealmanac.services.setup.requests import (
    DEFAULT_SETUP_TARGETS,
    RunSetupRequest,
    RunUninstallRequest,
)


class SetupService:
    def __init__(
        self,
        instructions: InstructionInstaller,
        automation: SetupAutomationManager,
        global_state: GlobalStateRemover,
        package_uninstaller: PackageUninstaller,
        config: ConfigService | None = None,
        runner_probe: RunnerReadinessProbe | None = None,
    ):
        self._instructions = instructions
        self._automation = automation
        self._global_state = global_state
        self._package_uninstaller = package_uninstaller
        self._config = config
        self._runner_probe = runner_probe

    def run(self, request: RunSetupRequest) -> SetupResult:
        config_updates = self.set_config(request)
        changes = ()
        if not request.skip_instructions:
            changes = self._instructions.install(request.targets)
        automation_install = None
        if should_install_automation(request):
            automation_install = self._automation.install(
                install_automation_request(request)
            )
        return SetupResult(
            plan=setup_plan(request),
            skipped_instructions=request.skip_instructions,
            changes=changes,
            config_update=config_updates[0] if len(config_updates) > 0 else None,
            config_updates=config_updates,
            automation_install=automation_install,
            runner_readiness=self.runner_readiness(request),
        )

    def runner_readiness(self, request: RunSetupRequest) -> HarnessReadiness | None:
        if self._runner_probe is None:
            return None
        return self._runner_probe.readiness(request.harness)

    def uninstall(self, request: RunUninstallRequest) -> UninstallResult:
        changes = self._instructions.uninstall(DEFAULT_SETUP_TARGETS)
        automation_uninstall = self._automation.uninstall(
            UninstallAutomationRequest(
                home=request.home,
            )
        )
        global_state = self._global_state.remove()
        package_uninstall = self._package_uninstaller.uninstall()
        return UninstallResult(
            changes=changes,
            automation_uninstall=automation_uninstall,
            global_state=global_state,
            package_uninstall=package_uninstall,
        )

    def set_config(self, request: RunSetupRequest) -> tuple[ConfigSetResult, ...]:
        if self._config is None:
            return ()
        return (
            self._config.set(
                SetConfigValueRequest(
                    key=ConfigKey.AUTO_COMMIT,
                    value="true" if request.auto_commit else "false",
                )
            ),
            self._config.set(
                SetConfigValueRequest(
                    key=ConfigKey.HARNESS_DEFAULT,
                    value=request.harness.value,
                )
            ),
            self._config.set(
                SetConfigValueRequest(
                    key=ConfigKey.HARNESS_MODEL,
                    value=request.model,
                )
            ),
        )
