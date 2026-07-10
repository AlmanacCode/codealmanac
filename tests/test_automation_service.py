import plistlib
from datetime import timedelta
from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.cli.render.automation import render_automation_job_status
from codealmanac.integrations.automation.scheduler.launchd import (
    LaunchdSchedulerAdapter,
    parse_launchd_inspection,
)
from codealmanac.services.automation.defaults import (
    DEFAULT_UPDATE_INTERVAL,
)
from codealmanac.services.automation.models import (
    AutomationTask,
    ScheduledJob,
    ScheduledJobState,
    ScheduledJobStatus,
)
from codealmanac.services.automation.requests import (
    AutomationStatusRequest,
    InstallAutomationRequest,
    UninstallAutomationRequest,
)
from codealmanac.settings import AppConfig


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
    scheduler = FakeSchedulerAdapter()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        scheduler=scheduler,
    )

    result = app.automation.install(
        InstallAutomationRequest(
            home=isolated_home,
            every=timedelta(minutes=1),
            garden_every=timedelta(minutes=2),
            env_path="/custom/bin",
            codealmanac_executable=Path("/usr/local/bin/codealmanac"),
        )
    )

    assert tuple(job.task for job in result.jobs) == (
        AutomationTask.SYNC,
        AutomationTask.GARDEN,
        AutomationTask.UPDATE,
    )
    sync, garden, update = scheduler.installed
    assert sync.program_arguments == (
        "/usr/local/bin/codealmanac",
        "sync",
    )
    assert sync.interval == timedelta(minutes=1)
    assert garden.program_arguments == (
        "/usr/local/bin/codealmanac",
        "__garden-scheduler",
    )
    assert garden.interval == timedelta(minutes=2)
    assert update.program_arguments == (
        "/usr/local/bin/codealmanac",
        "update",
        "--scheduled",
    )
    assert update.interval == DEFAULT_UPDATE_INTERVAL
    assert sync.environment[0].name == "PATH"
    assert sync.environment[0].value.startswith("/custom/bin:")
    assert sync.stdout_path == isolated_home / ".codealmanac/logs/sync.out.log"
    assert sync.stderr_path == isolated_home / ".codealmanac/logs/sync.err.log"
    assert update.stdout_path == isolated_home / ".codealmanac/logs/update.out.log"
    assert update.stderr_path == isolated_home / ".codealmanac/logs/update.err.log"


def test_automation_install_sync_only_does_not_require_repo(
    tmp_path: Path,
    isolated_home: Path,
):
    scheduler = FakeSchedulerAdapter()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        scheduler=scheduler,
    )

    result = app.automation.install(
        InstallAutomationRequest(
            home=isolated_home,
            tasks=(AutomationTask.SYNC,),
            every=timedelta(minutes=10),
        )
    )

    assert tuple(job.task for job in result.jobs) == (AutomationTask.SYNC,)
    assert scheduler.installed[0].interval == timedelta(minutes=10)


def test_automation_install_update_only_can_override_interval(
    tmp_path: Path,
    isolated_home: Path,
):
    scheduler = FakeSchedulerAdapter()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        scheduler=scheduler,
    )

    result = app.automation.install(
        InstallAutomationRequest(
            home=isolated_home,
            tasks=(AutomationTask.UPDATE,),
            every=timedelta(hours=12),
        )
    )

    assert tuple(job.task for job in result.jobs) == (AutomationTask.UPDATE,)
    assert scheduler.installed[0].interval == timedelta(hours=12)


def test_automation_status_and_uninstall_work_outside_repo(
    tmp_path: Path,
    isolated_home: Path,
):
    scheduler = FakeSchedulerAdapter()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        scheduler=scheduler,
    )

    report = app.automation.status(AutomationStatusRequest(home=isolated_home))
    removed = app.automation.uninstall(UninstallAutomationRequest(home=isolated_home))

    assert tuple(status.task for status in report.statuses) == (
        AutomationTask.SYNC,
        AutomationTask.GARDEN,
        AutomationTask.UPDATE,
    )
    assert all(not status.installed for status in report.statuses)
    assert removed.removed == ()


def test_automation_garden_off_installs_sync_and_removes_garden(
    tmp_path: Path,
    isolated_home: Path,
):
    scheduler = FakeSchedulerAdapter()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        scheduler=scheduler,
    )

    result = app.automation.install(
        InstallAutomationRequest(
            home=isolated_home,
            garden_off=True,
        )
    )

    assert tuple(job.task for job in result.jobs) == (
        AutomationTask.SYNC,
        AutomationTask.UPDATE,
    )
    assert tuple(job.task for job in result.disabled) == (AutomationTask.GARDEN,)
    assert tuple(job.task for job in scheduler.uninstalled) == (AutomationTask.GARDEN,)


def test_automation_multi_task_every_keeps_update_daily(
    tmp_path: Path,
    isolated_home: Path,
):
    scheduler = FakeSchedulerAdapter()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        scheduler=scheduler,
    )
    app.automation.install(
        InstallAutomationRequest(
            home=isolated_home,
            tasks=(AutomationTask.SYNC, AutomationTask.GARDEN, AutomationTask.UPDATE),
            every=timedelta(minutes=1),
        )
    )

    assert tuple(job.task for job in scheduler.installed) == (
        AutomationTask.SYNC,
        AutomationTask.GARDEN,
        AutomationTask.UPDATE,
    )
    assert scheduler.installed[0].interval == timedelta(minutes=1)
    assert scheduler.installed[2].interval == DEFAULT_UPDATE_INTERVAL


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
            "/usr/local/bin/codealmanac",
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
    assert data["Program"] == "/usr/local/bin/codealmanac"
    assert data["ProgramArguments"][-2:] == ["--quiet", "1s"]
    assert data["StartInterval"] == 300
    assert status.installed is True
    assert status.loaded is True
    assert status.interval == timedelta(minutes=5)
    assert calls[0][1] == "bootout"
    assert calls[1][1] == "bootstrap"
    assert calls[2][1] == "print"


def test_launchd_status_parses_run_health():
    inspection = parse_launchd_inspection(
        "\tstate = running\n"
        "\truns = 7\n"
        "\tpid = 4321\n"
        "\tlast exit code = 2\n"
        "\tproperties = {\n"
        "\t\tstate = not running\n"
        "\t}\n"
    )

    assert inspection.loaded is True
    assert inspection.state == ScheduledJobState.RUNNING
    assert inspection.run_count == 7
    assert inspection.pid == 4321
    assert inspection.last_exit_code == 2


@pytest.mark.parametrize(
    ("output", "state", "run_count", "last_exit_code"),
    [
        (
            "\tstate = not running\n\truns = 0\n",
            ScheduledJobState.IDLE,
            0,
            None,
        ),
        (
            "\tstate = future state\n\truns = many\n",
            ScheduledJobState.UNKNOWN,
            None,
            None,
        ),
    ],
)
def test_launchd_status_tolerates_idle_and_unknown_values(
    output: str,
    state: ScheduledJobState,
    run_count: int | None,
    last_exit_code: int | None,
):
    inspection = parse_launchd_inspection(output)

    assert inspection.state == state
    assert inspection.run_count == run_count
    assert inspection.last_exit_code == last_exit_code


def test_automation_status_renders_run_health(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
):
    status = ScheduledJobStatus(
        task=AutomationTask.SYNC,
        label="com.codealmanac.sync",
        plist_path=tmp_path / "com.codealmanac.sync.plist",
        installed=True,
        loaded=True,
        interval=timedelta(hours=5),
        state=ScheduledJobState.IDLE,
        run_count=3,
        last_exit_code=2,
    )

    render_automation_job_status(status)

    assert capsys.readouterr().out.endswith(
        "  state: idle\n"
        "  runs: 3\n"
        "  last result: failed (exit 2)\n"
    )
    assert status.model_dump(mode="json")["last_exit_code"] == 2


def completed_process(args: tuple[str, ...]):
    from subprocess import CompletedProcess

    return CompletedProcess(args=args, returncode=0, stdout="", stderr="")
