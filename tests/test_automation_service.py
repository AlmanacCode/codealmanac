import os
import plistlib
from datetime import timedelta
from pathlib import Path

import pytest
from pydantic import ValidationError

from codealmanac.app import create_app
from codealmanac.cli.render.automation import render_automation_job_status
from codealmanac.core.errors import ExecutionFailed
from codealmanac.integrations.automation.scheduler.launchd import (
    LaunchdSchedulerAdapter,
    parse_launchd_inspection,
)
from codealmanac.services.automation.models import (
    AutomationTask,
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

    def unavailable_reason(self) -> str | None:
        return None

    def install(self, job: ScheduledJob) -> ScheduledJobStatus:
        self.installed.append(job)
        self.loaded.add(job.plist_path)
        return status_for(job, installed=True)

    def uninstall(self, job: ScheduledJob) -> bool:
        self.uninstalled.append(job)
        existed = job.plist_path in self.loaded
        self.loaded.discard(job.plist_path)
        return existed

    def status(self, job: ScheduledJob) -> ScheduledJobStatus:
        return status_for(job, installed=job.plist_path in self.loaded)


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
    scheduler.loaded.add(
        isolated_home / "Library/LaunchAgents/com.codealmanac.garden.plist"
    )

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
        scheduler.loaded.add(
            isolated_home / f"Library/LaunchAgents/com.codealmanac.{task.value}.plist"
        )

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
        plist_path=tmp_path / "com.codealmanac.sync.plist",
        program_arguments=("/usr/local/bin/codealmanac", "sync"),
        interval=timedelta(minutes=5),
        environment=(),
        stdout_path=tmp_path / "logs/sync.out.log",
        stderr_path=tmp_path / "logs/sync.err.log",
    )

    status = LaunchdSchedulerAdapter().install(job)

    data = plistlib.loads(job.plist_path.read_bytes())
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
        plist_path=tmp_path / "missing.plist",
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
        plist_path=plist_path,
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
        plist_path=tmp_path / "missing.plist",
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
        plist_path=job.plist_path,
        installed=installed,
        loaded=installed,
        interval=job.interval if installed else None,
    )


def completed_process(
    args: tuple[str, ...],
    returncode: int = 0,
    stderr: str = "",
):
    from subprocess import CompletedProcess

    return CompletedProcess(
        args=args,
        returncode=returncode,
        stdout="",
        stderr=stderr,
    )
