import os
import plistlib
import subprocess
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


@dataclass(frozen=True)
class LaunchdInspection:
    loaded: bool
    state: ScheduledJobState | None = None
    run_count: int | None = None
    last_exit_code: int | None = None
    pid: int | None = None


class LaunchdSchedulerAdapter:
    def install(self, job: ScheduledJob) -> ScheduledJobStatus:
        job.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        job.stdout_path.parent.mkdir(parents=True, exist_ok=True)
        job.stderr_path.parent.mkdir(parents=True, exist_ok=True)
        with job.manifest_path.open("wb") as handle:
            plistlib.dump(launchd_plist(job), handle, sort_keys=False)
        self.bootout(job)
        self.bootstrap(job)
        return self.status(job)

    def uninstall(self, job: ScheduledJob) -> bool:
        plist_existed = job.manifest_path.exists()
        service_removed = self.bootout(job)
        job.manifest_path.unlink(missing_ok=True)
        return plist_existed or service_removed

    def status(self, job: ScheduledJob) -> ScheduledJobStatus:
        inspection = self.inspect(job)
        if not job.manifest_path.exists():
            return ScheduledJobStatus(
                task=job.task,
                label=job.label,
                manifest_path=job.manifest_path,
                installed=False,
                loaded=inspection.loaded,
            )
        data = read_plist(job.manifest_path)
        return ScheduledJobStatus(
            task=job.task,
            label=job.label,
            manifest_path=job.manifest_path,
            installed=True,
            loaded=inspection.loaded,
            interval=read_interval(data),
            state=inspection.state,
            run_count=inspection.run_count,
            last_exit_code=inspection.last_exit_code,
            pid=inspection.pid,
        )

    def bootstrap(self, job: ScheduledJob) -> None:
        result = self.run_launchctl(
            ("bootstrap", launchd_target(), str(job.manifest_path))
        )
        if result.returncode != 0:
            raise ExecutionFailed(
                "launchctl bootstrap failed for "
                f"{job.label}: {surface_process_error(result)}"
            )

    def bootout(self, job: ScheduledJob) -> bool:
        result = self.run_launchctl(("bootout", f"{launchd_target()}/{job.label}"))
        if result.returncode == 0:
            return True
        if service_not_found(result):
            return False
        raise ExecutionFailed(
            f"launchctl bootout failed for {job.label}: {surface_process_error(result)}"
        )

    def is_loaded(self, job: ScheduledJob) -> bool:
        return self.inspect(job).loaded

    def inspect(self, job: ScheduledJob) -> LaunchdInspection:
        result = self.run_launchctl(("print", f"{launchd_target()}/{job.label}"))
        if result.returncode != 0:
            return LaunchdInspection(loaded=False)
        return parse_launchd_inspection(result.stdout)

    def run_launchctl(self, args: tuple[str, ...]) -> subprocess.CompletedProcess[str]:
        try:
            return subprocess.run(
                ("launchctl", *args),
                check=False,
                capture_output=True,
                text=True,
            )
        except OSError as error:
            return subprocess.CompletedProcess(
                args=("launchctl", *args),
                returncode=1,
                stdout="",
                stderr=str(error),
            )


def launchd_plist(job: ScheduledJob) -> dict[str, object]:
    data: dict[str, object] = {
        "Label": job.label,
        "Program": job.program_arguments[0],
        "ProgramArguments": list(job.program_arguments),
        "StartInterval": int(job.interval.total_seconds()),
        "EnvironmentVariables": environment_dict(job.environment),
        "RunAtLoad": True,
        "StandardOutPath": str(job.stdout_path),
        "StandardErrorPath": str(job.stderr_path),
    }
    return data


def read_plist(path: Path) -> dict[str, object]:
    with path.open("rb") as handle:
        data = plistlib.load(handle)
    if not isinstance(data, dict):
        return {}
    return data


def read_interval(data: dict[str, object]) -> timedelta | None:
    value = data.get("StartInterval")
    if not isinstance(value, int):
        return None
    return timedelta(seconds=value)


def environment_dict(values: tuple[EnvironmentVariable, ...]) -> dict[str, str]:
    return {item.name: item.value for item in values}


def launchd_target() -> str:
    return f"gui/{os.getuid()}"


def parse_launchd_inspection(output: str) -> LaunchdInspection:
    state: ScheduledJobState | None = None
    run_count: int | None = None
    last_exit_code: int | None = None
    pid: int | None = None
    for raw_line in output.splitlines():
        if not is_top_level_launchd_property(raw_line):
            continue
        key, separator, value = raw_line.strip().partition(" = ")
        if not separator:
            continue
        if key == "state":
            state = parse_launchd_state(value)
        elif key == "runs":
            run_count = parse_integer(value)
        elif key == "last exit code":
            last_exit_code = parse_integer(value)
        elif key == "pid":
            pid = parse_integer(value)
    return LaunchdInspection(
        loaded=True,
        state=state or ScheduledJobState.UNKNOWN,
        run_count=run_count,
        last_exit_code=last_exit_code,
        pid=pid,
    )


def is_top_level_launchd_property(line: str) -> bool:
    return line.startswith("\t") and not line.startswith("\t\t")


def parse_launchd_state(value: str) -> ScheduledJobState:
    if value == "running":
        return ScheduledJobState.RUNNING
    if value == "not running":
        return ScheduledJobState.IDLE
    return ScheduledJobState.UNKNOWN


def parse_integer(value: str) -> int | None:
    try:
        return int(value)
    except ValueError:
        return None


def service_not_found(result: subprocess.CompletedProcess[str]) -> bool:
    message = f"{result.stderr}\n{result.stdout}".casefold()
    return any(
        marker in message
        for marker in (
            "no such process",
            "could not find service",
            "service not found",
        )
    )
