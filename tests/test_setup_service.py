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
from codealmanac.services.setup.models import SetupTarget
from codealmanac.services.setup.requests import RunSetupRequest, RunUninstallRequest
from codealmanac.services.setup.service import SetupService
from codealmanac.workflows.cloud_login.models import CloudLoginWorkflowResult
from codealmanac.workflows.cloud_login.requests import RunCloudLoginRequest


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
    assert first.plan.instruction_targets == (SetupTarget.CODEX,)
    assert first.plan.automation == ()
    assert first.plan.next_commands[-1].command == ("codealmanac", "open")


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


def test_uninstall_removes_only_setup_owned_codex_content(home: Path):
    agents = home / ".codex/AGENTS.md"
    agents.parent.mkdir(parents=True)
    agents.write_text("# user rules\n", encoding="utf-8")
    service = setup_service(home)
    service.run(RunSetupRequest(targets=(SetupTarget.CODEX,)))

    result = service.uninstall(RunUninstallRequest(targets=(SetupTarget.CODEX,)))

    assert result.changes[0].changed is True
    assert agents.read_text(encoding="utf-8") == "# user rules\n"


def test_uninstall_removes_claude_artifacts_and_preserves_user_content(home: Path):
    claude_md = home / ".claude/CLAUDE.md"
    claude_md.parent.mkdir(parents=True)
    claude_md.write_text("# user rules\n", encoding="utf-8")
    service = setup_service(home)
    service.run(RunSetupRequest(targets=(SetupTarget.CLAUDE,)))

    result = service.uninstall(RunUninstallRequest(targets=(SetupTarget.CLAUDE,)))

    assert result.changes[0].changed is True
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
            cwd=tmp_path,
            install_automation=True,
            sync_every=timedelta(minutes=2),
            sync_quiet=timedelta(seconds=5),
            garden_off=True,
        )
    )

    request = automation.installed[0]
    assert request.cwd == tmp_path
    assert request.every == timedelta(minutes=2)
    assert request.quiet == timedelta(seconds=5)
    assert request.garden_off is True
    assert result.plan.automation_mode.value == "install"
    assert tuple(item.task for item in result.plan.automation) == (AutomationTask.SYNC,)
    assert result.plan.next_commands[-1].command == (
        "codealmanac",
        "automation",
        "status",
    )
    assert result.automation_install is not None
    assert tuple(job.task for job in result.automation_install.jobs) == (
        AutomationTask.SYNC,
    )


def test_uninstall_removes_automation_by_default(home: Path):
    automation = FakeSetupAutomationManager(home)

    result = setup_service(home, automation).uninstall(
        RunUninstallRequest(targets=(SetupTarget.CODEX,))
    )

    assert len(automation.uninstalled) == 1
    assert result.kept_automation is False
    assert result.automation_uninstall is not None
    assert result.automation_uninstall.tasks == (
        AutomationTask.SYNC,
        AutomationTask.GARDEN,
    )


def test_uninstall_can_keep_automation(home: Path):
    automation = FakeSetupAutomationManager(home)

    result = setup_service(home, automation).uninstall(
        RunUninstallRequest(
            targets=(SetupTarget.CODEX,),
            keep_automation=True,
        )
    )

    assert automation.uninstalled == []
    assert result.kept_automation is True
    assert result.automation_uninstall is None


@pytest.fixture
def home(tmp_path: Path) -> Path:
    return tmp_path / "home"


def setup_service(
    home: Path,
    automation: "FakeSetupAutomationManager | None" = None,
) -> SetupService:
    return SetupService(
        FileInstructionInstaller(home),
        automation or FakeSetupAutomationManager(home),
        FakeSetupCloudLogin(),
    )


class FakeSetupCloudLogin:
    def __init__(self) -> None:
        self.requests: list[RunCloudLoginRequest] = []

    def run(self, request: RunCloudLoginRequest) -> CloudLoginWorkflowResult:
        self.requests.append(request)
        return CloudLoginWorkflowResult(
            api_url=request.api_url,
            status="signed_in",
            github_user_id=10,
            github_login="rohans0509",
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
        tasks = request.tasks or (AutomationTask.SYNC, AutomationTask.GARDEN)
        return AutomationUninstallResult(
            tasks=tasks,
            removed=tuple(self.home / f"{task.value}.plist" for task in tasks),
        )


def automation_tasks(request: InstallAutomationRequest) -> tuple[AutomationTask, ...]:
    tasks = request.tasks or (AutomationTask.SYNC, AutomationTask.GARDEN)
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
