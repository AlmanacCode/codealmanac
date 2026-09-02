import re
import shlex
import subprocess
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

from codealmanac.core.errors import ExecutionFailed
from codealmanac.services.automation.models import (
    ScheduledJob,
    ScheduledJobState,
    ScheduledJobStatus,
)


@dataclass(frozen=True)
class SystemdInspection:
    loaded: bool
    state: ScheduledJobState | None = None
    last_exit_code: int | None = None
    pid: int | None = None


class SystemdSchedulerAdapter:
    """Scheduler backend for Linux using systemd user timers.

    Mirrors the launchd adapter: one timer plus one oneshot service per job.
    ``job.plist_path`` holds the ``.timer`` unit path; the matching ``.service``
    unit lives next to it.
    """

    def install(self, job: ScheduledJob) -> ScheduledJobStatus:
        job.plist_path.parent.mkdir(parents=True, exist_ok=True)
        job.stdout_path.parent.mkdir(parents=True, exist_ok=True)
        job.stderr_path.parent.mkdir(parents=True, exist_ok=True)
        service_unit_path(job).write_text(systemd_service_unit(job), encoding="utf-8")
        job.plist_path.write_text(systemd_timer_unit(job), encoding="utf-8")
        self.daemon_reload()
        self.enable_timer(job)
        return self.status(job)

    def uninstall(self, job: ScheduledJob) -> bool:
        timer_existed = job.plist_path.exists()
        timer_disabled = self.disable_timer(job)
        job.plist_path.unlink(missing_ok=True)
        service_unit_path(job).unlink(missing_ok=True)
        self.daemon_reload()
        return timer_existed or timer_disabled

    def status(self, job: ScheduledJob) -> ScheduledJobStatus:
        inspection = self.inspect(job)
        if not job.plist_path.exists():
            return ScheduledJobStatus(
                task=job.task,
                label=job.label,
                plist_path=job.plist_path,
                installed=False,
                loaded=inspection.loaded,
            )
        return ScheduledJobStatus(
            task=job.task,
            label=job.label,
            plist_path=job.plist_path,
            installed=True,
            loaded=inspection.loaded,
            interval=read_timer_interval(job.plist_path),
            state=inspection.state,
            run_count=None,
            last_exit_code=inspection.last_exit_code,
            pid=inspection.pid,
        )

    def enable_timer(self, job: ScheduledJob) -> None:
        result = self.run_systemctl(("enable", "--now", timer_unit_name(job)))
        if result.returncode != 0:
            raise ExecutionFailed(
                "systemctl enable --now failed for "
                f"{job.label}: {surface_process_error(result)}"
            )

    def disable_timer(self, job: ScheduledJob) -> bool:
        result = self.run_systemctl(("disable", "--now", timer_unit_name(job)))
        if result.returncode == 0:
            return True
        if unit_not_found(result):
            return False
        raise ExecutionFailed(
            "systemctl disable failed for "
            f"{job.label}: {surface_process_error(result)}"
        )

    def daemon_reload(self) -> None:
        result = self.run_systemctl(("daemon-reload",))
        if result.returncode != 0:
            raise ExecutionFailed(
                f"systemctl daemon-reload failed: {surface_process_error(result)}"
            )

    def is_loaded(self, job: ScheduledJob) -> bool:
        return self.inspect(job).loaded

    def inspect(self, job: ScheduledJob) -> SystemdInspection:
        timer = self.run_systemctl(
            ("show", timer_unit_name(job), "--property=LoadState,ActiveState")
        )
        if timer.returncode != 0:
            return SystemdInspection(loaded=False)
        timer_values = parse_show_output(timer.stdout)
        loaded = (
            timer_values.get("LoadState") == "loaded"
            and timer_values.get("ActiveState") in {"active", "activating"}
        )
        if not loaded:
            return SystemdInspection(loaded=False)
        service = self.run_systemctl(
            (
                "show",
                service_unit_name(job),
                "--property=ActiveState,ExecMainStatus,ExecMainPID",
            )
        )
        if service.returncode != 0:
            return SystemdInspection(loaded=True, state=ScheduledJobState.UNKNOWN)
        service_values = parse_show_output(service.stdout)
        return SystemdInspection(
            loaded=True,
            state=parse_service_state(service_values.get("ActiveState")),
            last_exit_code=parse_integer(service_values.get("ExecMainStatus")),
            pid=parse_pid(service_values.get("ExecMainPID")),
        )

    def run_systemctl(self, args: tuple[str, ...]) -> subprocess.CompletedProcess[str]:
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


def timer_unit_name(job: ScheduledJob) -> str:
    return f"{job.label}.timer"


def service_unit_name(job: ScheduledJob) -> str:
    return f"{job.label}.service"


def service_unit_path(job: ScheduledJob) -> Path:
    return job.plist_path.with_suffix(".service")


def systemd_service_unit(job: ScheduledJob) -> str:
    lines = [
        "[Unit]",
        f"Description=CodeAlmanac {job.task.value} job",
        "",
        "[Service]",
        "Type=oneshot",
        f"ExecStart={shlex.join(job.program_arguments)}",
    ]
    for item in job.environment:
        lines.append(f'Environment="{item.name}={item.value}"')
    lines.append(f"StandardOutput=append:{job.stdout_path}")
    lines.append(f"StandardError=append:{job.stderr_path}")
    return "\n".join(lines) + "\n"


def systemd_timer_unit(job: ScheduledJob) -> str:
    seconds = int(job.interval.total_seconds())
    return "\n".join(
        [
            "[Unit]",
            f"Description=CodeAlmanac {job.task.value} timer",
            "",
            "[Timer]",
            # Mirrors launchd RunAtLoad: run once right after activation,
            # then repeat on the configured interval.
            "OnActiveSec=0",
            f"OnUnitActiveSec={seconds}",
            "AccuracySec=1min",
            "",
            "[Install]",
            "WantedBy=timers.target",
        ]
    ) + "\n"


def read_timer_interval(path: Path) -> timedelta | None:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None
    match = re.search(r"^OnUnitActiveSec=(\d+)$", text, re.MULTILINE)
    if match is None:
        return None
    return timedelta(seconds=int(match.group(1)))


def parse_show_output(output: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in output.splitlines():
        key, separator, value = line.partition("=")
        if separator:
            values[key.strip()] = value.strip()
    return values


def parse_service_state(value: str | None) -> ScheduledJobState:
    if value in {"active", "activating", "deactivating"}:
        return ScheduledJobState.RUNNING
    if value in {"inactive", "failed"}:
        return ScheduledJobState.IDLE
    return ScheduledJobState.UNKNOWN


def parse_integer(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def parse_pid(value: str | None) -> int | None:
    pid = parse_integer(value)
    if pid is None or pid <= 0:
        return None
    return pid


def surface_process_error(result: subprocess.CompletedProcess[str]) -> str:
    text = result.stderr.strip() or result.stdout.strip()
    if len(text) > 500:
        return f"{text[:500]}..."
    return text or f"exit {result.returncode}"


def unit_not_found(result: subprocess.CompletedProcess[str]) -> bool:
    message = f"{result.stderr}\n{result.stdout}".casefold()
    return any(
        marker in message
        for marker in (
            "does not exist",
            "not loaded",
            "no such file",
            "not found",
        )
    )
