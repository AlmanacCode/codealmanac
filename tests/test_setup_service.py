from datetime import timedelta
from pathlib import Path

import pytest
from pydantic import ValidationError

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
    AutomationInstallResult,
    AutomationTask,
    AutomationUninstallResult,
    ScheduledJob,
)
from codealmanac.services.automation.requests import (
    InstallAutomationRequest,
    UninstallAutomationRequest,
)
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
    assert "codealmanac search" in body
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
    assert first.automation_install is not None
    assert tuple(job.task for job in first.automation_install.jobs) == (
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
    assert "codealmanac search" in guide_path.read_text(encoding="utf-8")
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

    request = automation.installed[0]
    assert request.every == timedelta(minutes=2)
    assert request.garden_off is True
    assert result.plan.automation_mode.value == "install"
    assert tuple(item.task for item in result.plan.automation) == (
        AutomationTask.SYNC,
        AutomationTask.UPDATE,
    )
    assert tuple(command.command for command in result.plan.next_commands) == (
        ("cd", "/path/to/your/repo"),
        ("codealmanac", "init"),
    )
    assert result.automation_install is not None
    assert tuple(job.task for job in result.automation_install.jobs) == (
        AutomationTask.SYNC,
        AutomationTask.UPDATE,
    )


def test_setup_can_skip_auto_update_automation(home: Path):
    result = setup_service(home).run(RunSetupRequest(auto_update=False))

    assert tuple(item.task for item in result.plan.automation) == (
        AutomationTask.SYNC,
        AutomationTask.GARDEN,
    )
    assert result.automation_install is not None
    assert tuple(job.task for job in result.automation_install.jobs) == (
        AutomationTask.SYNC,
        AutomationTask.GARDEN,
    )


def test_setup_can_skip_sync_automation(home: Path):
    result = setup_service(home).run(RunSetupRequest(sync_off=True))

    assert tuple(item.task for item in result.plan.automation) == (
        AutomationTask.GARDEN,
        AutomationTask.UPDATE,
    )
    assert result.automation_install is not None
    assert tuple(job.task for job in result.automation_install.jobs) == (
        AutomationTask.GARDEN,
        AutomationTask.UPDATE,
    )


def test_uninstall_removes_automation_by_default(home: Path):
    automation = FakeSetupAutomationManager(home)

    result = setup_service(home, automation).uninstall(RunUninstallRequest())

    assert len(automation.uninstalled) == 1
    assert result.automation_uninstall is not None
    assert result.automation_uninstall.tasks == (
        AutomationTask.SYNC,
        AutomationTask.GARDEN,
        AutomationTask.UPDATE,
    )
    assert automation.uninstalled[0].tasks == ()


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


def test_setup_reports_unavailable_runner_readiness(home: Path):
    probe = FakeRunnerProbe(available=False, message="codex not found on PATH")
    service = setup_service(home, runner_probe=probe)

    result = service.run(RunSetupRequest(targets=(SetupTarget.CODEX,)))

    assert probe.checked == [HarnessKind.CODEX]
    assert result.runner_readiness is not None
    assert result.runner_readiness.available is False
    assert result.runner_readiness.message == "codex not found on PATH"


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
    return SetupService(
        FileInstructionInstaller(home),
        automation or FakeSetupAutomationManager(home),
        FilesystemGlobalStateRemover(home / ".codealmanac"),
        package_uninstaller or FakePackageUninstaller(skipped_package_result()),
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
        self.installed: list[InstallAutomationRequest] = []
        self.uninstalled: list[UninstallAutomationRequest] = []

    def install(self, request: InstallAutomationRequest) -> AutomationInstallResult:
        self.installed.append(request)
        jobs = tuple(
            scheduled_job(
                home=self.home,
                task=task,
                interval=automation_interval(task, request),
            )
            for task in automation_tasks(request)
        )
        disabled = (
            (scheduled_job(home=self.home, task=AutomationTask.GARDEN),)
            if request.garden_off
            else ()
        )
        return AutomationInstallResult(jobs=jobs, disabled=disabled)

    def uninstall(
        self,
        request: UninstallAutomationRequest,
    ) -> AutomationUninstallResult:
        self.uninstalled.append(request)
        tasks = request.tasks or (
            AutomationTask.SYNC,
            AutomationTask.GARDEN,
            AutomationTask.UPDATE,
        )
        return AutomationUninstallResult(
            tasks=tasks,
            removed=tuple(self.home / f"{task.value}.plist" for task in tasks),
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


def automation_tasks(request: InstallAutomationRequest) -> tuple[AutomationTask, ...]:
    tasks = request.tasks or (
        AutomationTask.SYNC,
        AutomationTask.GARDEN,
        AutomationTask.UPDATE,
    )
    return tuple(
        task
        for task in tasks
        if not (task == AutomationTask.GARDEN and request.garden_off)
    )


def automation_interval(
    task: AutomationTask,
    request: InstallAutomationRequest,
) -> timedelta:
    if task == AutomationTask.SYNC:
        return request.every if request.every is not None else timedelta(hours=5)
    if task == AutomationTask.UPDATE:
        return request.every if request.every is not None else timedelta(days=1)
    if request.garden_every is not None:
        return request.garden_every
    return timedelta(hours=4)


def scheduled_job(
    home: Path,
    task: AutomationTask,
    interval: timedelta = timedelta(hours=4),
) -> ScheduledJob:
    return ScheduledJob(
        task=task,
        label=f"com.codealmanac.{task.value}",
        plist_path=home / f"{task.value}.plist",
        program_arguments=("codealmanac", task.value),
        interval=interval,
        environment=(),
        stdout_path=home / f"{task.value}.out.log",
        stderr_path=home / f"{task.value}.err.log",
    )
