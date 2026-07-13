import os
import plistlib
from datetime import timedelta
from pathlib import Path

import pytest
from pydantic import ValidationError

from codealmanac.app import create_app
from codealmanac.cli.render.automation import render_automation_job_status
from codealmanac.core.errors import ExecutionFailed
from codealmanac.integrations.automation.scheduler import default_scheduler_adapter
from codealmanac.integrations.automation.scheduler.launchd import (
    LaunchdSchedulerAdapter,
    parse_launchd_inspection,
)
from codealmanac.integrations.automation.scheduler.systemd import (
    SystemdSchedulerAdapter,
    exec_start,
    service_unit_path,
    timer_unit,
)
from codealmanac.services.automation.jobs import launch_path, manifest_path_for
from codealmanac.services.automation.models import (
    AutomationTask,
    EnvironmentVariable,
    ScheduledJob,
    ScheduledJobState,
    ScheduledJobStatus,
)
from codealmanac.services.automation.requests import (
    AutomationStatusRequest,
    ReconcileAutomationTaskRequest,
    RemoveAllAutomationRequest,
)
from codealmanac.settings import AppConfig


class FakeSchedulerAdapter:
    def __init__(self):
        self.installed: list[ScheduledJob] = []
        self.uninstalled: list[ScheduledJob] = []
        self.loaded: set[Path] = set()

    def install(self, job: ScheduledJob) -> ScheduledJobStatus:
        self.installed.append(job)
        self.loaded.add(job.manifest_path)
        return status_for(job, installed=True)

    def uninstall(self, job: ScheduledJob) -> bool:
        self.uninstalled.append(job)
        existed = job.manifest_path in self.loaded
        self.loaded.discard(job.manifest_path)
        return existed

    def status(self, job: ScheduledJob) -> ScheduledJobStatus:
        return status_for(job, installed=job.manifest_path in self.loaded)


def test_automation_reconcile_enabled_installs_explicit_task(
    isolated_home: Path,
) -> None:
    scheduler = FakeSchedulerAdapter()
    app = automation_app(isolated_home, scheduler)

    result = app.automation.reconcile_task(
        ReconcileAutomationTaskRequest(
            task=AutomationTask.SYNC,
            enabled=True,
            every=timedelta(minutes=10),
            home=isolated_home,
            env_path="/custom/bin",
            codealmanac_executable=Path("/usr/local/bin/codealmanac"),
        )
    )

    assert result.task == AutomationTask.SYNC
    assert result.enabled is True
    assert result.changed is True
    job = scheduler.installed[0]
    assert job.interval == timedelta(minutes=10)
    assert job.program_arguments == ("/usr/local/bin/codealmanac", "sync")
    assert job.environment[0].value.startswith("/custom/bin:")
    assert scheduler.uninstalled == []


def test_automation_reconcile_disabled_removes_explicit_task(
    isolated_home: Path,
) -> None:
    scheduler = FakeSchedulerAdapter()
    app = automation_app(isolated_home, scheduler)
    scheduler.loaded.add(manifest_path_for(AutomationTask.GARDEN, isolated_home))

    result = app.automation.reconcile_task(
        ReconcileAutomationTaskRequest(
            task=AutomationTask.GARDEN,
            enabled=False,
            every=timedelta(hours=4),
            home=isolated_home,
        )
    )

    assert result.enabled is False
    assert result.changed is True
    assert scheduler.installed == []
    assert scheduler.uninstalled[0].task == AutomationTask.GARDEN


def test_automation_request_rejects_non_positive_interval() -> None:
    with pytest.raises(ValidationError, match="greater than zero"):
        ReconcileAutomationTaskRequest(
            task=AutomationTask.UPDATE,
            enabled=True,
            every=timedelta(0),
        )


def test_automation_remove_all_is_explicit(
    isolated_home: Path,
) -> None:
    scheduler = FakeSchedulerAdapter()
    app = automation_app(isolated_home, scheduler)
    for task in AutomationTask:
        scheduler.loaded.add(manifest_path_for(task, isolated_home))

    result = app.automation.remove_all(RemoveAllAutomationRequest(home=isolated_home))

    assert result.tasks == tuple(AutomationTask)
    assert [job.task for job in scheduler.uninstalled] == list(AutomationTask)
    assert len(result.removed) == 3


def test_automation_status_defaults_to_all_read_only(
    isolated_home: Path,
) -> None:
    scheduler = FakeSchedulerAdapter()
    app = automation_app(isolated_home, scheduler)

    report = app.automation.status(AutomationStatusRequest(home=isolated_home))

    assert tuple(status.task for status in report.statuses) == tuple(AutomationTask)
    assert scheduler.installed == []
    assert scheduler.uninstalled == []


def test_launchd_adapter_writes_structured_plist(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
        manifest_path=tmp_path / "com.codealmanac.sync.plist",
        program_arguments=("/usr/local/bin/codealmanac", "sync"),
        interval=timedelta(minutes=5),
        environment=(),
        stdout_path=tmp_path / "logs/sync.out.log",
        stderr_path=tmp_path / "logs/sync.err.log",
    )

    status = LaunchdSchedulerAdapter().install(job)

    data = plistlib.loads(job.manifest_path.read_bytes())
    assert data["Label"] == "com.codealmanac.sync"
    assert data["Program"] == "/usr/local/bin/codealmanac"
    assert data["ProgramArguments"][-1] == "sync"
    assert data["StartInterval"] == 300
    assert status.installed is True
    assert status.loaded is True
    assert status.interval == timedelta(minutes=5)
    assert calls[0][1] == "bootout"
    assert calls[1][1] == "bootstrap"
    assert calls[2][1] == "print"


def test_launchd_uninstall_boots_out_loaded_service_without_plist(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
        manifest_path=tmp_path / "missing.plist",
        program_arguments=("/usr/local/bin/codealmanac", "sync"),
        interval=timedelta(minutes=5),
        environment=(),
        stdout_path=tmp_path / "sync.out.log",
        stderr_path=tmp_path / "sync.err.log",
    )

    removed = LaunchdSchedulerAdapter().uninstall(job)

    assert removed is True
    assert calls == [
        ("launchctl", "bootout", f"gui/{os.getuid()}/com.codealmanac.sync")
    ]


def test_launchd_uninstall_preserves_plist_on_real_bootout_failure(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_run(
        args: tuple[str, ...],
        check: bool,
        capture_output: bool,
        text: bool,
    ):
        return completed_process(
            args,
            returncode=5,
            stderr="Boot-out failed: 5: Input/output error",
        )

    monkeypatch.setattr(
        "codealmanac.integrations.automation.scheduler.launchd.subprocess.run",
        fake_run,
    )
    plist_path = tmp_path / "com.codealmanac.sync.plist"
    plist_path.write_text("existing", encoding="utf-8")
    job = ScheduledJob(
        task=AutomationTask.SYNC,
        label="com.codealmanac.sync",
        manifest_path=plist_path,
        program_arguments=("/usr/local/bin/codealmanac", "sync"),
        interval=timedelta(minutes=5),
        environment=(),
        stdout_path=tmp_path / "sync.out.log",
        stderr_path=tmp_path / "sync.err.log",
    )

    with pytest.raises(ExecutionFailed, match="Input/output error"):
        LaunchdSchedulerAdapter().uninstall(job)

    assert plist_path.exists()


def test_launchd_uninstall_tolerates_service_not_found(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_run(
        args: tuple[str, ...],
        check: bool,
        capture_output: bool,
        text: bool,
    ):
        return completed_process(
            args,
            returncode=3,
            stderr="Boot-out failed: 3: No such process",
        )

    monkeypatch.setattr(
        "codealmanac.integrations.automation.scheduler.launchd.subprocess.run",
        fake_run,
    )
    job = ScheduledJob(
        task=AutomationTask.SYNC,
        label="com.codealmanac.sync",
        manifest_path=tmp_path / "missing.plist",
        program_arguments=("/usr/local/bin/codealmanac", "sync"),
        interval=timedelta(minutes=5),
        environment=(),
        stdout_path=tmp_path / "sync.out.log",
        stderr_path=tmp_path / "sync.err.log",
    )

    assert LaunchdSchedulerAdapter().uninstall(job) is False


def test_launchd_status_parses_run_health() -> None:
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
        ("\tstate = not running\n\truns = 0\n", ScheduledJobState.IDLE, 0, None),
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
) -> None:
    inspection = parse_launchd_inspection(output)

    assert inspection.state == state
    assert inspection.run_count == run_count
    assert inspection.last_exit_code == last_exit_code


def test_automation_status_renders_run_health(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    status = ScheduledJobStatus(
        task=AutomationTask.SYNC,
        label="com.codealmanac.sync",
        manifest_path=tmp_path / "com.codealmanac.sync.plist",
        installed=True,
        loaded=True,
        interval=timedelta(hours=5),
        state=ScheduledJobState.IDLE,
        run_count=3,
        last_exit_code=2,
    )

    render_automation_job_status(status)

    assert capsys.readouterr().out.endswith(
        "  state: idle\n  runs: 3\n  last result: failed (exit 2)\n"
    )


def automation_app(isolated_home: Path, scheduler: FakeSchedulerAdapter):
    return create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        scheduler=scheduler,
    )


def status_for(job: ScheduledJob, installed: bool) -> ScheduledJobStatus:
    return ScheduledJobStatus(
        task=job.task,
        label=job.label,
        manifest_path=job.manifest_path,
        installed=installed,
        loaded=installed,
        interval=job.interval if installed else None,
    )


def completed_process(
    args: tuple[str, ...],
    returncode: int = 0,
    stdout: str = "",
    stderr: str = "",
):
    from subprocess import CompletedProcess

    return CompletedProcess(
        args=args,
        returncode=returncode,
        stdout=stdout,
        stderr=stderr,
    )


class FakeSystemctl:
    def __init__(
        self,
        show_outputs: dict[str, str] | None = None,
        failures: dict[str, tuple[int, str]] | None = None,
    ):
        self.calls: list[tuple[str, ...]] = []
        self.show_outputs = show_outputs or {}
        self.failures = failures or {}

    def __call__(self, args: tuple[str, ...]):
        self.calls.append(args)
        if args[0] in self.failures:
            returncode, stderr = self.failures[args[0]]
            return completed_process(args, returncode=returncode, stderr=stderr)
        if args[0] == "show":
            return completed_process(args, stdout=self.show_outputs.get(args[1], ""))
        return completed_process(args)


def systemd_job(tmp_path: Path) -> ScheduledJob:
    return ScheduledJob(
        task=AutomationTask.SYNC,
        label="com.codealmanac.sync",
        manifest_path=tmp_path / "systemd/user/com.codealmanac.sync.timer",
        program_arguments=("/usr/local/bin/codealmanac", "sync"),
        interval=timedelta(minutes=5),
        environment=(EnvironmentVariable(name="PATH", value="/custom/bin"),),
        stdout_path=tmp_path / "logs/sync.out.log",
        stderr_path=tmp_path / "logs/sync.err.log",
    )


def test_manifest_path_for_selects_platform_manifest(tmp_path: Path) -> None:
    assert manifest_path_for(AutomationTask.SYNC, tmp_path, platform="darwin") == (
        tmp_path / "Library/LaunchAgents/com.codealmanac.sync.plist"
    )
    assert manifest_path_for(AutomationTask.SYNC, tmp_path, platform="linux") == (
        tmp_path / ".config/systemd/user/com.codealmanac.sync.timer"
    )


def test_manifest_path_for_honors_xdg_config_home(tmp_path: Path) -> None:
    xdg = tmp_path / "xdg"
    assert manifest_path_for(
        AutomationTask.SYNC, tmp_path, platform="linux", config_home=str(xdg)
    ) == (xdg / "systemd/user/com.codealmanac.sync.timer")
    # A relative XDG_CONFIG_HOME is invalid per the spec and is ignored.
    assert manifest_path_for(
        AutomationTask.SYNC, tmp_path, platform="linux", config_home="relative/path"
    ) == (tmp_path / ".config/systemd/user/com.codealmanac.sync.timer")


def test_launch_path_selects_platform_fallbacks(tmp_path: Path) -> None:
    darwin = launch_path(tmp_path, "/custom/bin", platform="darwin").split(":")
    linux = launch_path(tmp_path, "/custom/bin", platform="linux").split(":")

    assert darwin == [
        "/custom/bin",
        str(tmp_path / ".local/bin"),
        str(tmp_path / ".bun/bin"),
        "/usr/local/bin",
        "/opt/homebrew/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
    ]
    assert linux == [
        "/custom/bin",
        str(tmp_path / ".local/bin"),
        str(tmp_path / ".bun/bin"),
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
    ]


def test_default_scheduler_adapter_selects_platform(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("sys.platform", "linux")
    assert isinstance(default_scheduler_adapter(), SystemdSchedulerAdapter)
    monkeypatch.setattr("sys.platform", "darwin")
    assert isinstance(default_scheduler_adapter(), LaunchdSchedulerAdapter)


def test_systemd_adapter_installs_timer_and_service_units(tmp_path: Path) -> None:
    systemctl = FakeSystemctl(
        show_outputs={
            "com.codealmanac.sync.timer": "LoadState=loaded\nActiveState=active\n",
            "com.codealmanac.sync.service": (
                "ActiveState=inactive\n"
                "ExecMainStatus=0\n"
                "ExecMainExitTimestampMonotonic=0\n"
                "MainPID=0\n"
            ),
        }
    )
    job = systemd_job(tmp_path)

    status = SystemdSchedulerAdapter(run_command=systemctl).install(job)

    service_text = service_unit_path(job).read_text(encoding="utf-8")
    timer_text = job.manifest_path.read_text(encoding="utf-8")
    assert "Type=oneshot" in service_text
    assert 'ExecStart="/usr/local/bin/codealmanac" "sync"' in service_text
    assert 'Environment="PATH=/custom/bin"' in service_text
    assert f"StandardOutput=append:{job.stdout_path}" in service_text
    assert f"StandardError=append:{job.stderr_path}" in service_text
    assert "OnActiveSec=0" in timer_text
    assert "OnUnitActiveSec=300" in timer_text
    assert "Unit=com.codealmanac.sync.service" in timer_text
    assert "WantedBy=timers.target" in timer_text
    assert [call[0] for call in systemctl.calls[:3]] == [
        "daemon-reload",
        "enable",
        "restart",
    ]
    assert systemctl.calls[1] == ("enable", "com.codealmanac.sync.timer")
    assert status.installed is True
    assert status.loaded is True
    assert status.interval == timedelta(minutes=5)
    assert status.state == ScheduledJobState.IDLE
    assert status.last_exit_code is None
    assert status.pid is None


def test_systemd_exec_start_quotes_and_escapes() -> None:
    assert exec_start(("/opt/my tools/codealmanac", "sync", "100%")) == (
        '"/opt/my tools/codealmanac" "sync" "100%%"'
    )


def test_systemd_uninstall_removes_units_and_reloads(tmp_path: Path) -> None:
    systemctl = FakeSystemctl()
    job = systemd_job(tmp_path)
    job.manifest_path.parent.mkdir(parents=True, exist_ok=True)
    job.manifest_path.write_text("timer", encoding="utf-8")
    service_unit_path(job).write_text("service", encoding="utf-8")

    removed = SystemdSchedulerAdapter(run_command=systemctl).uninstall(job)

    assert removed is True
    assert not job.manifest_path.exists()
    assert not service_unit_path(job).exists()
    assert systemctl.calls == [
        ("disable", "--now", "com.codealmanac.sync.timer"),
        ("stop", "com.codealmanac.sync.service"),
        ("daemon-reload",),
        ("reset-failed", "com.codealmanac.sync.timer", "com.codealmanac.sync.service"),
    ]


def test_systemd_uninstall_tolerates_unit_not_found(tmp_path: Path) -> None:
    systemctl = FakeSystemctl(
        failures={
            "disable": (1, "Unit file com.codealmanac.sync.timer does not exist."),
            "stop": (1, "Unit com.codealmanac.sync.service not loaded."),
        }
    )
    job = systemd_job(tmp_path)

    assert SystemdSchedulerAdapter(run_command=systemctl).uninstall(job) is False


def test_systemd_uninstall_preserves_units_on_real_failure(tmp_path: Path) -> None:
    systemctl = FakeSystemctl(failures={"disable": (1, "Access denied")})
    job = systemd_job(tmp_path)
    job.manifest_path.parent.mkdir(parents=True, exist_ok=True)
    job.manifest_path.write_text("timer", encoding="utf-8")

    with pytest.raises(ExecutionFailed, match="Access denied"):
        SystemdSchedulerAdapter(run_command=systemctl).uninstall(job)

    assert job.manifest_path.exists()


def test_systemd_status_reports_running_service(tmp_path: Path) -> None:
    systemctl = FakeSystemctl(
        show_outputs={
            "com.codealmanac.sync.timer": "LoadState=loaded\n",
            "com.codealmanac.sync.service": (
                "ActiveState=activating\n"
                "ExecMainStatus=0\n"
                "ExecMainExitTimestampMonotonic=0\n"
                "MainPID=4321\n"
            ),
        }
    )
    job = systemd_job(tmp_path)
    job.manifest_path.parent.mkdir(parents=True, exist_ok=True)
    job.manifest_path.write_text(timer_unit(job), encoding="utf-8")

    status = SystemdSchedulerAdapter(run_command=systemctl).status(job)

    assert status.state == ScheduledJobState.RUNNING
    assert status.pid == 4321
    assert status.last_exit_code is None
    assert status.interval == timedelta(minutes=5)


def test_systemd_status_reports_last_failed_run(tmp_path: Path) -> None:
    systemctl = FakeSystemctl(
        show_outputs={
            "com.codealmanac.sync.timer": "LoadState=loaded\n",
            "com.codealmanac.sync.service": (
                "ActiveState=failed\n"
                "ExecMainStatus=2\n"
                "ExecMainExitTimestampMonotonic=12345\n"
                "MainPID=0\n"
            ),
        }
    )
    job = systemd_job(tmp_path)
    job.manifest_path.parent.mkdir(parents=True, exist_ok=True)
    job.manifest_path.write_text(timer_unit(job), encoding="utf-8")

    status = SystemdSchedulerAdapter(run_command=systemctl).status(job)

    assert status.state == ScheduledJobState.IDLE
    assert status.last_exit_code == 2
    assert status.pid is None


def test_systemd_status_handles_missing_manifest(tmp_path: Path) -> None:
    systemctl = FakeSystemctl(
        show_outputs={"com.codealmanac.sync.timer": "LoadState=not-found\n"}
    )
    job = systemd_job(tmp_path)

    status = SystemdSchedulerAdapter(run_command=systemctl).status(job)

    assert status.installed is False
    assert status.loaded is False
    assert status.interval is None


def test_systemd_status_reports_inactive_timer_as_unloaded(tmp_path: Path) -> None:
    systemctl = FakeSystemctl(
        show_outputs={
            "com.codealmanac.sync.timer": "LoadState=loaded\nActiveState=inactive\n",
            "com.codealmanac.sync.service": (
                "ActiveState=inactive\n"
                "ExecMainStatus=0\n"
                "ExecMainExitTimestampMonotonic=0\n"
                "MainPID=0\n"
            ),
        }
    )
    job = systemd_job(tmp_path)
    job.manifest_path.parent.mkdir(parents=True, exist_ok=True)
    job.manifest_path.write_text(timer_unit(job), encoding="utf-8")

    status = SystemdSchedulerAdapter(run_command=systemctl).status(job)

    assert status.installed is True
    assert status.loaded is False
