from codealmanac.services.automation.requests import RemoveAllAutomationRequest
from codealmanac.services.config.models import (
    AutomationConfig,
    ConfigUpdateResult,
    GardenAutomationConfig,
    HarnessConfig,
    SyncAutomationConfig,
    UpdateAutomationConfig,
)
from codealmanac.services.config.requests import UpdateUserConfigRequest
from codealmanac.services.config.service import ConfigService
from codealmanac.services.setup.models import SetupResult, UninstallResult
from codealmanac.services.setup.planning import setup_plan
from codealmanac.services.setup.ports import (
    AutomationRemover,
    GlobalStateRemover,
    InstructionInstaller,
    PackageUninstaller,
    RunnerReadinessProbe,
)
from codealmanac.services.setup.requests import (
    DEFAULT_SETUP_TARGETS,
    RunSetupRequest,
    RunUninstallRequest,
)
from codealmanac.services.setup.runners import require_runner


class SetupService:
    def __init__(
        self,
        instructions: InstructionInstaller,
        automation_remover: AutomationRemover,
        global_state: GlobalStateRemover,
        package_uninstaller: PackageUninstaller,
        config: ConfigService,
        runner_probe: RunnerReadinessProbe | None = None,
    ):
        self._instructions = instructions
        self._automation_remover = automation_remover
        self._global_state = global_state
        self._package_uninstaller = package_uninstaller
        self._config = config
        self._runner_probe = runner_probe

    def run(self, request: RunSetupRequest) -> SetupResult:
        readiness = require_runner(self._runner_probe, request)
        config_update = self.set_config(request)
        changes = ()
        if not request.skip_instructions:
            changes = self._instructions.install(request.targets)
        return SetupResult(
            plan=setup_plan(request),
            skipped_instructions=request.skip_instructions,
            changes=changes,
            config_update=config_update,
            runner_readiness=readiness,
        )

    def uninstall(self, request: RunUninstallRequest) -> UninstallResult:
        changes = self._instructions.uninstall(DEFAULT_SETUP_TARGETS)
        automation_uninstall = self._automation_remover.remove_all(
            RemoveAllAutomationRequest(home=request.home)
        )
        global_state = self._global_state.remove()
        package_uninstall = self._package_uninstaller.uninstall()
        return UninstallResult(
            changes=changes,
            automation_uninstall=automation_uninstall,
            global_state=global_state,
            package_uninstall=package_uninstall,
        )

    def set_config(self, request: RunSetupRequest) -> ConfigUpdateResult:
        return self._config.update(
            UpdateUserConfigRequest(
                auto_commit=request.auto_commit,
                harness=HarnessConfig(
                    default=request.harness,
                    model=request.model,
                ),
                automation=AutomationConfig(
                    sync=SyncAutomationConfig(
                        enabled=not request.sync_off,
                        every=request.sync_every,
                    ),
                    garden=GardenAutomationConfig(
                        enabled=not request.garden_off,
                        every=request.garden_every,
                    ),
                    update=UpdateAutomationConfig(
                        enabled=request.auto_update,
                        every=request.update_every,
                    ),
                ),
                home=request.home,
                env_path=request.env_path,
                codealmanac_executable=request.codealmanac_executable,
            )
        )
