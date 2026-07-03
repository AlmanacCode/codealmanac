import plistlib
from datetime import timedelta
from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.core.errors import ValidationFailed
from codealmanac.core.models import AppConfig
from codealmanac.integrations.automation.scheduler.launchd import (
    LaunchdSchedulerAdapter,
)
from codealmanac.services.automation.defaults import (
    AUTOMATION_SYNC_CLAIM_OWNER,
    AUTOMATION_SYNC_MAX_FAILED_ATTEMPTS,
    AUTOMATION_SYNC_PENDING_TIMEOUT,
    duration_text,
)
from codealmanac.services.automation.models import (
    AutomationTask,
    ScheduledJob,
    ScheduledJobStatus,
)
from codealmanac.services.automation.requests import (
    AutomationStatusRequest,
    InstallAutomationRequest,
    UninstallAutomationRequest,
)
from codealmanac.wiki.workspaces.requests import InitializeWorkspaceRequest


class FakeSchedulerAdapter:
    def __init__(self):
        self.installed: list[ScheduledJob] = []
        self.uninstalled: list[ScheduledJob] = []
        self.loaded: set[Path] = set()

    def install(self, job: ScheduledJob) -> ScheduledJobStatus:
        self.installed.append(job)
        self.loaded.add(job.plist_path)
        return ScheduledJobStatus(
            task=job.task,
            label=job.label,
            plist_path=job.plist_path,
            installed=True,
            loaded=True,
            interval=job.interval,
        )

    def uninstall(self, job: ScheduledJob) -> bool:
        self.uninstalled.append(job)
        if job.plist_path in self.loaded:
            self.loaded.remove(job.plist_path)
            return True
        return False

    def status(self, job: ScheduledJob) -> ScheduledJobStatus:
        return ScheduledJobStatus(
            task=job.task,
            label=job.label,
            plist_path=job.plist_path,
            installed=job.plist_path in self.loaded,
            loaded=job.plist_path in self.loaded,
            interval=job.interval if job.plist_path in self.loaded else None,
        )


def test_automation_install_plans_sync_and_garden(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    scheduler = FakeSchedulerAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        scheduler=scheduler,
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))

    result = app.automation.install(
        InstallAutomationRequest(
            cwd=repo,
            home=isolated_home,
            every=timedelta(minutes=1),
            quiet=timedelta(seconds=1),
            garden_every=timedelta(minutes=2),
            env_path="/custom/bin",
            python_executable=Path("/usr/bin/python3"),
        )
    )

    assert tuple(job.task for job in result.jobs) == (
        AutomationTask.SYNC,
        AutomationTask.GARDEN,
    )
    sync, garden = scheduler.installed
    assert sync.program_arguments == (
        "/usr/bin/python3",
        "-m",
        "codealmanac.cli.main",
        "sync",
        "--quiet",
        "1s",
        "--claim-owner",
        AUTOMATION_SYNC_CLAIM_OWNER,
        "--pending-timeout",
        duration_text(AUTOMATION_SYNC_PENDING_TIMEOUT),
        "--max-failed-attempts",
        str(AUTOMATION_SYNC_MAX_FAILED_ATTEMPTS),
    )
    assert sync.interval == timedelta(minutes=1)
    assert sync.working_directory is None
    assert garden.program_arguments == (
        "/usr/bin/python3",
        "-m",
        "codealmanac.cli.main",
        "garden",
    )
    assert garden.interval == timedelta(minutes=2)
    assert garden.working_directory == repo
    assert sync.environment[0].name == "PATH"
    assert sync.environment[0].value.startswith("/custom/bin:")
    assert sync.stdout_path == isolated_home / ".codealmanac/logs/sync.out.log"
    assert sync.stderr_path == isolated_home / ".codealmanac/logs/sync.err.log"


def test_automation_install_sync_only_does_not_require_repo(
    tmp_path: Path,
    isolated_home: Path,
):
    scheduler = FakeSchedulerAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        scheduler=scheduler,
    )

    result = app.automation.install(
        InstallAutomationRequest(
            cwd=tmp_path,
            home=isolated_home,
            tasks=(AutomationTask.SYNC,),
            every=timedelta(minutes=10),
        )
    )

    assert tuple(job.task for job in result.jobs) == (AutomationTask.SYNC,)
    assert scheduler.installed[0].interval == timedelta(minutes=10)


def test_automation_install_preserves_zero_quiet(
    tmp_path: Path,
    isolated_home: Path,
):
    scheduler = FakeSchedulerAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        scheduler=scheduler,
    )

    app.automation.install(
        InstallAutomationRequest(
            cwd=tmp_path,
            home=isolated_home,
            tasks=(AutomationTask.SYNC,),
            every=timedelta(minutes=10),
            quiet=timedelta(seconds=0),
        )
    )

    args = scheduler.installed[0].program_arguments
    assert duration_text(timedelta(seconds=0)) == "0s"
    assert args[args.index("--quiet") + 1] == "0s"


def test_automation_status_and_uninstall_work_outside_repo(
    tmp_path: Path,
    isolated_home: Path,
):
    scheduler = FakeSchedulerAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        scheduler=scheduler,
    )

    report = app.automation.status(AutomationStatusRequest(home=isolated_home))
    removed = app.automation.uninstall(UninstallAutomationRequest(home=isolated_home))

    assert tuple(status.task for status in report.statuses) == (
        AutomationTask.SYNC,
        AutomationTask.GARDEN,
    )
    assert all(not status.installed for status in report.statuses)
    assert removed.removed == ()


def test_automation_garden_off_installs_sync_and_removes_garden(
    tmp_path: Path,
    isolated_home: Path,
):
    scheduler = FakeSchedulerAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        scheduler=scheduler,
    )

    result = app.automation.install(
        InstallAutomationRequest(
            cwd=tmp_path,
            home=isolated_home,
            garden_off=True,
        )
    )

    assert tuple(job.task for job in result.jobs) == (AutomationTask.SYNC,)
    assert tuple(job.task for job in result.disabled) == (AutomationTask.GARDEN,)
    assert tuple(job.task for job in scheduler.uninstalled) == (AutomationTask.GARDEN,)


def test_automation_rejects_ambiguous_every_for_multiple_explicit_tasks(
    tmp_path: Path,
    isolated_home: Path,
):
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        scheduler=FakeSchedulerAdapter(),
    )

    with pytest.raises(ValidationFailed, match="--every can only target one"):
        app.automation.install(
            InstallAutomationRequest(
                cwd=tmp_path,
                home=isolated_home,
                tasks=(AutomationTask.SYNC, AutomationTask.GARDEN),
                every=timedelta(minutes=1),
            )
        )


def test_launchd_adapter_writes_structured_plist(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    calls: list[tuple[str, ...]] = []

    def fake_run(
        args: tuple[str, ...],
        check: bool,
        capture_output: bool,
        text: bool,
    ):
        calls.append(args)
        return completed_process(args)

    monkeypatch.setattr(
        "codealmanac.integrations.automation.scheduler.launchd.subprocess.run",
        fake_run,
    )
    job = ScheduledJob(
        task=AutomationTask.SYNC,
        label="com.codealmanac.sync",
        plist_path=tmp_path / "com.codealmanac.sync.plist",
        program_arguments=(
            "python",
            "-m",
            "codealmanac.cli.main",
            "sync",
            "--quiet",
            "1s",
        ),
        interval=timedelta(minutes=5),
        environment=(),
        stdout_path=tmp_path / "logs/sync.out.log",
        stderr_path=tmp_path / "logs/sync.err.log",
    )

    status = LaunchdSchedulerAdapter().install(job)

    data = plistlib.loads(job.plist_path.read_bytes())
    assert data["Label"] == "com.codealmanac.sync"
    assert data["ProgramArguments"][-2:] == ["--quiet", "1s"]
    assert data["StartInterval"] == 300
    assert status.installed is True
    assert status.loaded is True
    assert status.interval == timedelta(minutes=5)
    assert status.quiet == timedelta(seconds=1)
    assert calls[0][1] == "bootout"
    assert calls[1][1] == "bootstrap"
    assert calls[2][1] == "print"


def completed_process(args: tuple[str, ...]):
    from subprocess import CompletedProcess

    return CompletedProcess(args=args, returncode=0, stdout="", stderr="")
