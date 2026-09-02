import subprocess
from datetime import timedelta
from pathlib import Path

import pytest

from codealmanac.integrations.automation.scheduler.systemd import (
    SystemdSchedulerAdapter,
)
from codealmanac.services.automation.models import (
    AutomationTask,
    EnvironmentVariable,
    ScheduledJob,
)


def completed(args: tuple[str, ...], stdout: str = "", returncode: int = 0):
    return subprocess.CompletedProcess(
        args=args, returncode=returncode, stdout=stdout, stderr=""
    )


def make_job(tmp_path: Path) -> ScheduledJob:
    return ScheduledJob(
        task=AutomationTask.SYNC,
        label="com.codealmanac.sync",
        plist_path=tmp_path / "systemd/user/com.codealmanac.sync.timer",
        program_arguments=("/usr/local/bin/codealmanac", "sync"),
        interval=timedelta(minutes=5),
        environment=(EnvironmentVariable(name="PATH", value="/usr/bin"),),
        stdout_path=tmp_path / "logs/sync.out.log",
        stderr_path=tmp_path / "logs/sync.err.log",
    )


def show_output(values: dict[str, str]) -> str:
    return "\n".join(f"{key}={value}" for key, value in values.items())


def test_systemd_adapter_writes_units_and_enables_timer(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[str, ...]] = []

    def fake_run(args, check, capture_output, text):
        calls.append(args)
        if args[2] == "show" and args[3].endswith(".timer"):
            timer_state = {"LoadState": "loaded", "ActiveState": "active"}
            return completed(args, stdout=show_output(timer_state))
        if args[2] == "show":
            return completed(
                args,
                stdout=show_output(
                    {
                        "ActiveState": "inactive",
                        "ExecMainStatus": "0",
                        "ExecMainPID": "0",
                    }
                ),
            )
        return completed(args)

    monkeypatch.setattr(
        "codealmanac.integrations.automation.scheduler.systemd.subprocess.run",
        fake_run,
    )
    job = make_job(tmp_path)

    status = SystemdSchedulerAdapter().install(job)

    timer_text = job.plist_path.read_text(encoding="utf-8")
    service_text = job.plist_path.with_suffix(".service").read_text(encoding="utf-8")
    assert "OnUnitActiveSec=300" in timer_text
    assert "WantedBy=timers.target" in timer_text
    assert "ExecStart=/usr/local/bin/codealmanac sync" in service_text
    assert 'Environment="PATH=/usr/bin"' in service_text
    assert f"StandardOutput=append:{job.stdout_path}" in service_text
    assert status.installed is True
    assert status.loaded is True
    assert status.interval == timedelta(minutes=5)
    assert calls[0][2] == "daemon-reload"
    assert calls[1][2:] == ("enable", "--now", "com.codealmanac.sync.timer")


def test_systemd_uninstall_removes_units(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[str, ...]] = []

    def fake_run(args, check, capture_output, text):
        calls.append(args)
        return completed(args)

    monkeypatch.setattr(
        "codealmanac.integrations.automation.scheduler.systemd.subprocess.run",
        fake_run,
    )
    job = make_job(tmp_path)
    job.plist_path.parent.mkdir(parents=True)
    job.plist_path.write_text("[Timer]\n", encoding="utf-8")
    job.plist_path.with_suffix(".service").write_text("[Service]\n", encoding="utf-8")

    removed = SystemdSchedulerAdapter().uninstall(job)

    assert removed is True
    assert not job.plist_path.exists()
    assert not job.plist_path.with_suffix(".service").exists()
    assert calls[0][2:] == ("disable", "--now", "com.codealmanac.sync.timer")
    assert calls[-1][2] == "daemon-reload"


def test_systemd_uninstall_tolerates_missing_unit(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_run(args, check, capture_output, text):
        if args[2] == "disable":
            return subprocess.CompletedProcess(
                args=args,
                returncode=1,
                stdout="",
                stderr="Unit com.codealmanac.sync.timer does not exist.",
            )
        return completed(args)

    monkeypatch.setattr(
        "codealmanac.integrations.automation.scheduler.systemd.subprocess.run",
        fake_run,
    )
    job = make_job(tmp_path)

    removed = SystemdSchedulerAdapter().uninstall(job)

    assert removed is False


def test_systemd_status_reports_running_service(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_run(args, check, capture_output, text):
        if args[3].endswith(".timer"):
            timer_state = {"LoadState": "loaded", "ActiveState": "active"}
            return completed(args, stdout=show_output(timer_state))
        return completed(
            args,
            stdout=show_output(
                {"ActiveState": "active", "ExecMainStatus": "0", "ExecMainPID": "4242"}
            ),
        )

    monkeypatch.setattr(
        "codealmanac.integrations.automation.scheduler.systemd.subprocess.run",
        fake_run,
    )
    job = make_job(tmp_path)
    job.plist_path.parent.mkdir(parents=True)
    job.plist_path.write_text(
        "[Timer]\nOnUnitActiveSec=300\n", encoding="utf-8"
    )

    status = SystemdSchedulerAdapter().status(job)

    assert status.loaded is True
    assert status.state is not None and status.state.value == "running"
    assert status.pid == 4242
    assert status.interval == timedelta(minutes=5)
