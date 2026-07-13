from datetime import timedelta
from pathlib import Path

import pytest
from pydantic import ValidationError

from codealmanac.core.errors import ExecutionFailed
from codealmanac.integrations.setup.instructions import (
    CLAUDE_IMPORT_LINE,
    CODEALMANAC_END,
    CODEALMANAC_START,
    FileInstructionInstaller,
)
from codealmanac.integrations.setup.uninstall import (
    FilesystemGlobalStateRemover,
    PackageToolUninstaller,
)
from codealmanac.services.automation.models import (
    AutomationRemoveResult,
    AutomationTask,
    AutomationTaskApplyResult,
)
from codealmanac.services.automation.requests import (
    ReconcileAutomationTaskRequest,
    RemoveAllAutomationRequest,
)
from codealmanac.services.config.service import ConfigService
from codealmanac.services.config.store import ConfigStore
from codealmanac.services.harnesses.models import HarnessKind, HarnessReadiness
from codealmanac.services.setup.models import (
    PackageUninstallResult,
    PackageUninstallStatus,
    SetupTarget,
)
from codealmanac.services.setup.requests import RunSetupRequest, RunUninstallRequest
from codealmanac.services.setup.service import SetupService
from codealmanac.services.updates.models import (
    PackageCommandResult,
    PackageInstallMetadata,
    UpdateInstallMethod,
)


def test_setup_installs_codex_block_idempotently(home: Path):
    service = setup_service(home)

    first = service.run(RunSetupRequest(targets=(SetupTarget.CODEX,)))
    second = service.run(RunSetupRequest(targets=(SetupTarget.CODEX,)))

    agents_path = home / ".codex/AGENTS.md"
    body = agents_path.read_text(encoding="utf-8")
    assert first.changes[0].changed is True
    assert second.changes[0].changed is False
    assert body.count(CODEALMANAC_START) == 1
    assert body.count(CODEALMANAC_END) == 1
    assert "## Finding knowledge" in body
    assert 'codealmanac search "checkout timeout"' in body
    assert "codealmanac search --mentions src/checkout/" in body
    assert "## Reading pages" in body
    assert "codealmanac show PAGE --backlinks" in body
    assert "## Maintenance boundary" in body
    assert "codealmanac topics create" not in body
    assert first.plan.default_harness.value == "codex"
    assert first.plan.auto_commit is True
    assert first.plan.instruction_targets == (SetupTarget.CODEX,)
    assert tuple(item.task for item in first.plan.automation) == (
        AutomationTask.SYNC,
        AutomationTask.GARDEN,
        AutomationTask.UPDATE,
    )
    assert tuple(command.command for command in first.plan.next_commands) == (
        ("cd", "/path/to/your/repo"),
        ("codealmanac", "init"),
    )
    assert tuple(item.task for item in first.config_update.automation) == (
        AutomationTask.SYNC,
        AutomationTask.GARDEN,
        AutomationTask.UPDATE,
    )


def test_setup_uses_non_empty_codex_override(home: Path):
    override = home / ".codex/AGENTS.override.md"
    override.parent.mkdir(parents=True)
    override.write_text("# existing override\n", encoding="utf-8")

    setup_service(home).run(RunSetupRequest(targets=(SetupTarget.CODEX,)))

    assert CODEALMANAC_START in override.read_text(encoding="utf-8")
    assert not (home / ".codex/AGENTS.md").exists()


def test_setup_installs_claude_guide_and_import_idempotently(home: Path):
    service = setup_service(home)

    service.run(RunSetupRequest(targets=(SetupTarget.CLAUDE,)))
    result = service.run(RunSetupRequest(targets=(SetupTarget.CLAUDE,)))

    guide_path = home / ".claude/codealmanac.md"
    claude_md = (home / ".claude/CLAUDE.md").read_text(encoding="utf-8")
    assert result.changes[0].changed is False
    guide = guide_path.read_text(encoding="utf-8")
    assert "## Finding knowledge" in guide
    assert "## Reading pages" in guide
    assert "## Maintenance boundary" in guide
    assert claude_md.count(CLAUDE_IMPORT_LINE) == 1


def test_uninstall_removes_setup_owned_codex_content(home: Path):
    agents = home / ".codex/AGENTS.md"
    agents.parent.mkdir(parents=True)
    agents.write_text("# user rules\n", encoding="utf-8")
    service = setup_service(home)
    service.run(RunSetupRequest(targets=(SetupTarget.CODEX,)))

    result = service.uninstall(RunUninstallRequest())

    assert result.changes[0].changed is True
    assert agents.read_text(encoding="utf-8") == "# user rules\n"


def test_uninstall_removes_claude_artifacts_and_preserves_user_content(home: Path):
    claude_md = home / ".claude/CLAUDE.md"
    claude_md.parent.mkdir(parents=True)
    claude_md.write_text("# user rules\n", encoding="utf-8")
    service = setup_service(home)
    service.run(RunSetupRequest(targets=(SetupTarget.CLAUDE,)))

    result = service.uninstall(RunUninstallRequest())

    changes = {change.target: change for change in result.changes}
    assert changes[SetupTarget.CLAUDE].changed is True
    assert not (home / ".claude/codealmanac.md").exists()
    assert claude_md.read_text(encoding="utf-8") == "# user rules\n"


def test_empty_target_request_is_rejected():
    with pytest.raises(ValidationError):
        RunSetupRequest(targets=())


def test_setup_skip_instructions_still_returns_plan(home: Path):
    result = setup_service(home).run(RunSetupRequest(skip_instructions=True))

    assert result.skipped_instructions is True
    assert result.changes == ()
    assert result.plan.default_harness.value == "codex"
    assert tuple(target.value for target in result.plan.instruction_targets) == (
        "codex",
        "claude",
    )


def test_setup_installs_requested_automation(home: Path, tmp_path: Path):
    automation = FakeSetupAutomationManager(home)
    result = setup_service(home, automation).run(
        RunSetupRequest(
            sync_every=timedelta(minutes=2),
            garden_off=True,
        )
    )

    requests = {request.task: request for request in automation.applied}
    assert requests[AutomationTask.SYNC].every == timedelta(minutes=2)
    assert requests[AutomationTask.GARDEN].enabled is False
    assert result.plan.automation_mode.value == "install"
    assert tuple(item.task for item in result.plan.automation) == (
        AutomationTask.SYNC,
        AutomationTask.UPDATE,
    )
    assert tuple(command.command for command in result.plan.next_commands) == (
        ("cd", "/path/to/your/repo"),
        ("codealmanac", "init"),
    )
    assert tuple(
        item.task for item in result.config_update.automation if item.enabled
    ) == (
        AutomationTask.SYNC,
        AutomationTask.UPDATE,
    )


def test_setup_can_skip_auto_update_automation(home: Path):
    result = setup_service(home).run(RunSetupRequest(auto_update=False))

    assert tuple(item.task for item in result.plan.automation) == (
        AutomationTask.SYNC,
        AutomationTask.GARDEN,
    )
    assert tuple(
        item.task for item in result.config_update.automation if item.enabled
    ) == (
        AutomationTask.SYNC,
        AutomationTask.GARDEN,
    )


def test_setup_can_skip_sync_automation(home: Path):
    result = setup_service(home).run(RunSetupRequest(sync_off=True))

    assert tuple(item.task for item in result.plan.automation) == (
        AutomationTask.GARDEN,
        AutomationTask.UPDATE,
    )
    assert tuple(
        item.task for item in result.config_update.automation if item.enabled
    ) == (
        AutomationTask.GARDEN,
        AutomationTask.UPDATE,
    )


def test_uninstall_removes_automation_by_default(home: Path):
    automation = FakeSetupAutomationManager(home)

    result = setup_service(home, automation).uninstall(RunUninstallRequest())

    assert len(automation.remove_requests) == 1
    assert result.automation_uninstall is not None
    assert result.automation_uninstall.tasks == (
        AutomationTask.SYNC,
        AutomationTask.GARDEN,
        AutomationTask.UPDATE,
    )
    assert automation.remove_requests[0].home is None


def test_uninstall_removes_global_state_without_deleting_repo_almanac(
    home: Path,
    tmp_path: Path,
):
    global_state = home / ".codealmanac"
    global_state.mkdir(parents=True)
    (global_state / "codealmanac.db").write_text("{}", encoding="utf-8")
    repo = tmp_path / "repo"
    repo_almanac = repo / "almanac"
    repo_almanac.mkdir(parents=True)
    (repo_almanac / "README.md").write_text("# Wiki\n", encoding="utf-8")

    result = setup_service(home).uninstall(RunUninstallRequest())

    assert result.global_state is not None
    assert result.global_state.removed is True
    assert not global_state.exists()
    assert repo_almanac.is_dir()
    assert (repo_almanac / "README.md").is_file()


def test_uninstall_runs_package_uninstaller(home: Path):
    package = FakePackageUninstaller(
        PackageUninstallResult(
            status=PackageUninstallStatus.REMOVED,
            method=UpdateInstallMethod.UV_TOOL,
            command=("uv", "tool", "uninstall", "codealmanac"),
            exit_code=0,
            message="removed installed CodeAlmanac tool",
        )
    )

    result = setup_service(home, package_uninstaller=package).uninstall(
        RunUninstallRequest()
    )

    assert package.calls == 1
    assert result.package_uninstall == package.result


def test_package_uninstaller_uses_uv_tool_command():
    runner = FakePackageCommandRunner(PackageCommandResult(exit_code=0))
    uninstaller = PackageToolUninstaller(
        FakePackageMetadataProvider(
            PackageInstallMetadata(
                version="1.2.3",
                installer="uv",
            )
        ),
        runner,
    )

    result = uninstaller.uninstall()

    assert result.status == PackageUninstallStatus.REMOVED
    assert result.method == UpdateInstallMethod.UV_TOOL
    assert runner.commands == [("uv", "tool", "uninstall", "codealmanac")]


def test_package_uninstaller_uses_pip_command(tmp_path: Path):
    python = tmp_path / "python"
    runner = FakePackageCommandRunner(PackageCommandResult(exit_code=0))
    uninstaller = PackageToolUninstaller(
        FakePackageMetadataProvider(
            PackageInstallMetadata(
                version="1.2.3",
                installer="pip",
                python_executable=python,
            )
        ),
        runner,
    )

    result = uninstaller.uninstall()

    assert result.status == PackageUninstallStatus.REMOVED
    assert result.method == UpdateInstallMethod.PIP
    assert runner.commands == [
        (str(python), "-m", "pip", "uninstall", "-y", "codealmanac")
    ]


def test_package_uninstaller_skips_editable_source_install():
    runner = FakePackageCommandRunner(PackageCommandResult(exit_code=0))
    uninstaller = PackageToolUninstaller(
        FakePackageMetadataProvider(
            PackageInstallMetadata(
                version="1.2.3",
                installer="pip",
                editable=True,
            )
        ),
        runner,
    )

    result = uninstaller.uninstall()

    assert result.status == PackageUninstallStatus.SKIPPED
    assert result.method == UpdateInstallMethod.EDITABLE
    assert runner.commands == []


def test_package_uninstaller_reports_failed_command():
    runner = FakePackageCommandRunner(
        PackageCommandResult(exit_code=1, stderr="permission denied")
    )
    uninstaller = PackageToolUninstaller(
        FakePackageMetadataProvider(
            PackageInstallMetadata(
                version="1.2.3",
                installer="uv",
            )
        ),
        runner,
    )

    result = uninstaller.uninstall()

    assert result.status == PackageUninstallStatus.FAILED
    assert result.exit_code == 1
    assert result.stderr == "permission denied"


def test_setup_rejects_unavailable_runner(home: Path):
    probe = FakeRunnerProbe(available=False, message="codex not found on PATH")
    service = setup_service(home, runner_probe=probe)

    with pytest.raises(ExecutionFailed, match="codex is not configured"):
        service.run(RunSetupRequest(targets=(SetupTarget.CODEX,)))

    assert probe.checked == [HarnessKind.CODEX]


def test_setup_without_probe_reports_no_readiness(home: Path):
    service = setup_service(home)

    result = service.run(RunSetupRequest(targets=(SetupTarget.CODEX,)))

    assert result.runner_readiness is None


@pytest.fixture
def home(tmp_path: Path) -> Path:
    return tmp_path / "home"


def setup_service(
    home: Path,
    automation: "FakeSetupAutomationManager | None" = None,
    package_uninstaller: "FakePackageUninstaller | None" = None,
    runner_probe: "FakeRunnerProbe | None" = None,
) -> SetupService:
    automation_manager = automation or FakeSetupAutomationManager(home)
    config = ConfigService(
        ConfigStore(),
        home / ".codealmanac/config.toml",
        automation_manager,
    )
    return SetupService(
        FileInstructionInstaller(home),
        automation_manager,
        FilesystemGlobalStateRemover(home / ".codealmanac"),
        package_uninstaller or FakePackageUninstaller(skipped_package_result()),
        config=config,
        runner_probe=runner_probe,
    )


class FakeRunnerProbe:
    def __init__(self, available: bool, message: str):
        self.available = available
        self.message = message
        self.checked: list[HarnessKind] = []

    def readiness(self, kind: HarnessKind) -> HarnessReadiness:
        self.checked.append(kind)
        return HarnessReadiness(
            kind=kind,
            available=self.available,
            message=self.message,
        )


class FakeSetupAutomationManager:
    def __init__(self, home: Path):
        self.home = home
        self.applied: list[ReconcileAutomationTaskRequest] = []
        self.remove_requests: list[RemoveAllAutomationRequest] = []

    def reconcile_task(
        self,
        request: ReconcileAutomationTaskRequest,
    ) -> AutomationTaskApplyResult:
        self.applied.append(request)
        return AutomationTaskApplyResult(
            task=request.task,
            enabled=request.enabled,
            interval=request.every,
            manifest_path=self.home / f"{request.task.value}.plist",
            changed=True,
        )

    def remove_all(
        self,
        request: RemoveAllAutomationRequest,
    ) -> AutomationRemoveResult:
        self.remove_requests.append(request)
        return AutomationRemoveResult(
            tasks=tuple(AutomationTask),
            removed=tuple(self.home / f"{task.value}.plist" for task in AutomationTask),
        )


class FakePackageUninstaller:
    def __init__(self, result: PackageUninstallResult):
        self.result = result
        self.calls = 0

    def uninstall(self) -> PackageUninstallResult:
        self.calls += 1
        return self.result


class FakePackageMetadataProvider:
    def __init__(self, metadata: PackageInstallMetadata):
        self.metadata = metadata

    def read(self) -> PackageInstallMetadata:
        return self.metadata


class FakePackageCommandRunner:
    def __init__(self, result: PackageCommandResult):
        self.result = result
        self.commands: list[tuple[str, ...]] = []

    def run(self, command: tuple[str, ...]) -> PackageCommandResult:
        self.commands.append(command)
        return self.result


def skipped_package_result() -> PackageUninstallResult:
    return PackageUninstallResult(
        status=PackageUninstallStatus.SKIPPED,
        method=UpdateInstallMethod.UNKNOWN,
        message="unknown package installer; skipped package uninstall",
    )
