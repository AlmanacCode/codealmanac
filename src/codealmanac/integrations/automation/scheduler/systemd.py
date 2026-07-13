import subprocess
from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

from codealmanac.core.errors import ExecutionFailed
from codealmanac.integrations.automation.scheduler.process import (
    surface_process_error,
)
from codealmanac.services.automation.models import (
    EnvironmentVariable,
    ScheduledJob,
    ScheduledJobState,
    ScheduledJobStatus,
)

SystemctlRunner = Callable[[tuple[str, ...]], "subprocess.CompletedProcess[str]"]


@dataclass(frozen=True)
class SystemdServiceInspection:
    state: ScheduledJobState | None = None
    last_exit_code: int | None = None
    pid: int | None = None


class SystemdSchedulerAdapter:
    def __init__(self, run_command: SystemctlRunner | None = None):
        self.run_command = run_command or run_systemctl

    def install(self, job: ScheduledJob) -> ScheduledJobStatus:
        job.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        job.stdout_path.parent.mkdir(parents=True, exist_ok=True)
        job.stderr_path.parent.mkdir(parents=True, exist_ok=True)
        service_unit_path(job).write_text(service_unit(job), encoding="utf-8")
        job.manifest_path.write_text(timer_unit(job), encoding="utf-8")
        self.daemon_reload(job)
        self.enable(job)
        self.restart(job)
        return self.status(job)

    def uninstall(self, job: ScheduledJob) -> bool:
        units_existed = job.manifest_path.exists() or service_unit_path(job).exists()
        timer_disabled = self.disable(job)
        self.stop_service(job)
        job.manifest_path.unlink(missing_ok=True)
        service_unit_path(job).unlink(missing_ok=True)
        self.daemon_reload(job)
        self.reset_failed(job)
        return units_existed or timer_disabled

    def status(self, job: ScheduledJob) -> ScheduledJobStatus:
        if not job.manifest_path.exists():
            return ScheduledJobStatus(
                task=job.task,
                label=job.label,
                manifest_path=job.manifest_path,
                installed=False,
                loaded=self.is_loaded(job),
            )
        inspection = self.inspect_service(job)
        return ScheduledJobStatus(
            task=job.task,
            label=job.label,
            manifest_path=job.manifest_path,
            installed=True,
            loaded=self.is_loaded(job),
            interval=read_timer_interval(job.manifest_path.read_text(encoding="utf-8")),
            state=inspection.state,
            last_exit_code=inspection.last_exit_code,
            pid=inspection.pid,
        )

    def enable(self, job: ScheduledJob) -> None:
        result = self.run_command(("enable", timer_name(job)))
        if result.returncode != 0:
            raise ExecutionFailed(
                "systemctl enable failed for "
                f"{job.label}: {surface_process_error(result)}"
            )

    def restart(self, job: ScheduledJob) -> None:
        result = self.run_command(("restart", timer_name(job)))
        if result.returncode != 0:
            raise ExecutionFailed(
                "systemctl restart failed for "
                f"{job.label}: {surface_process_error(result)}"
            )

    def disable(self, job: ScheduledJob) -> bool:
        result = self.run_command(("disable", "--now", timer_name(job)))
        if result.returncode == 0:
            return True
        if unit_not_found(result):
            return False
        raise ExecutionFailed(
            f"systemctl disable failed for {job.label}: {surface_process_error(result)}"
        )

    def stop_service(self, job: ScheduledJob) -> None:
        result = self.run_command(("stop", service_name(job)))
        if result.returncode != 0 and not unit_not_found(result):
            raise ExecutionFailed(
                "systemctl stop failed for "
                f"{job.label}: {surface_process_error(result)}"
            )

    def reset_failed(self, job: ScheduledJob) -> None:
        # Stopping the timer can fire one last trigger that the service stop
        # then kills, leaving a residual failed unit in the user manager.
        result = self.run_command(("reset-failed", timer_name(job), service_name(job)))
        if result.returncode != 0 and not unit_not_found(result):
            raise ExecutionFailed(
                "systemctl reset-failed failed for "
                f"{job.label}: {surface_process_error(result)}"
            )

    def daemon_reload(self, job: ScheduledJob) -> None:
        result = self.run_command(("daemon-reload",))
        if result.returncode != 0:
            raise ExecutionFailed(
                "systemctl daemon-reload failed for "
                f"{job.label}: {surface_process_error(result)}"
            )

    def is_loaded(self, job: ScheduledJob) -> bool:
        # A stopped, disabled, or failed timer still reports LoadState=loaded
        # because systemd can parse its unit file. Only an active timer is
        # actually scheduling runs, so gate on ActiveState too.
        properties = self.show(timer_name(job), ("LoadState", "ActiveState"))
        return properties.get("LoadState") == "loaded" and properties.get(
            "ActiveState"
        ) in ("active", "activating")

    def inspect_service(self, job: ScheduledJob) -> SystemdServiceInspection:
        properties = self.show(
            service_name(job),
            (
                "ActiveState",
                "ExecMainStatus",
                "ExecMainExitTimestampMonotonic",
                "MainPID",
            ),
        )
        if not properties:
            return SystemdServiceInspection()
        return SystemdServiceInspection(
            state=parse_systemd_state(properties.get("ActiveState", "")),
            last_exit_code=read_last_exit_code(properties),
            pid=positive_integer(properties.get("MainPID", "")),
        )

    def show(self, unit: str, properties: tuple[str, ...]) -> dict[str, str]:
        result = self.run_command(("show", unit, f"--property={','.join(properties)}"))
        if result.returncode != 0:
            return {}
        return parse_show_properties(result.stdout)


def run_systemctl(args: tuple[str, ...]) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            ("systemctl", "--user", *args),
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError as error:
        return subprocess.CompletedProcess(
            args=("systemctl", "--user", *args),
            returncode=1,
            stdout="",
            stderr=str(error),
        )


def service_unit_path(job: ScheduledJob) -> Path:
    return job.manifest_path.with_suffix(".service")


def timer_name(job: ScheduledJob) -> str:
    return f"{job.label}.timer"


def service_name(job: ScheduledJob) -> str:
    return f"{job.label}.service"


def service_unit(job: ScheduledJob) -> str:
    lines = [
        "[Unit]",
        f"Description=CodeAlmanac {job.task.value} automation",
        "",
        "[Service]",
        "Type=oneshot",
        f"ExecStart={exec_start(job.program_arguments)}",
        *environment_lines(job.environment),
        f"StandardOutput=append:{job.stdout_path}",
        f"StandardError=append:{job.stderr_path}",
    ]
    return "\n".join(lines) + "\n"


def timer_unit(job: ScheduledJob) -> str:
    lines = [
        "[Unit]",
        f"Description=CodeAlmanac {job.task.value} automation timer",
        "",
        "[Timer]",
        "OnActiveSec=0",
        f"OnUnitActiveSec={int(job.interval.total_seconds())}",
        f"Unit={service_name(job)}",
        "",
        "[Install]",
        "WantedBy=timers.target",
    ]
    return "\n".join(lines) + "\n"


def exec_start(arguments: tuple[str, ...]) -> str:
    return " ".join(quote_unit_value(argument) for argument in arguments)


def environment_lines(values: tuple[EnvironmentVariable, ...]) -> list[str]:
    return [
        f"Environment={quote_unit_value(f'{item.name}={item.value}')}"
        for item in values
    ]


def quote_unit_value(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"').replace("%", "%%")
    return f'"{escaped}"'


def read_timer_interval(text: str) -> timedelta | None:
    for line in text.splitlines():
        key, separator, value = line.partition("=")
        if separator and key.strip() == "OnUnitActiveSec":
            seconds = positive_integer(value.strip())
            if seconds is not None:
                return timedelta(seconds=seconds)
    return None


def parse_show_properties(output: str) -> dict[str, str]:
    properties: dict[str, str] = {}
    for line in output.splitlines():
        key, separator, value = line.partition("=")
        if separator:
            properties[key.strip()] = value.strip()
    return properties


def parse_systemd_state(value: str) -> ScheduledJobState:
    if value in ("activating", "active", "deactivating"):
        return ScheduledJobState.RUNNING
    if value in ("inactive", "failed"):
        return ScheduledJobState.IDLE
    return ScheduledJobState.UNKNOWN


def read_last_exit_code(properties: dict[str, str]) -> int | None:
    if properties.get("ExecMainExitTimestampMonotonic", "0") == "0":
        return None
    try:
        return int(properties.get("ExecMainStatus", ""))
    except ValueError:
        return None


def positive_integer(value: str) -> int | None:
    try:
        parsed = int(value)
    except ValueError:
        return None
    if parsed <= 0:
        return None
    return parsed


def unit_not_found(result: subprocess.CompletedProcess[str]) -> bool:
    message = f"{result.stderr}\n{result.stdout}".casefold()
    return any(
        marker in message
        for marker in (
            "does not exist",
            "not loaded",
            "not found",
        )
    )
