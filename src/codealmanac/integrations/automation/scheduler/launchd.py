import os
import plistlib
import subprocess
from datetime import timedelta
from pathlib import Path

from codealmanac.core.errors import ExecutionFailed
from codealmanac.services.automation.models import (
    EnvironmentVariable,
    ScheduledJob,
    ScheduledJobStatus,
)


class LaunchdSchedulerAdapter:
    def install(self, job: ScheduledJob) -> ScheduledJobStatus:
        job.plist_path.parent.mkdir(parents=True, exist_ok=True)
        job.stdout_path.parent.mkdir(parents=True, exist_ok=True)
        job.stderr_path.parent.mkdir(parents=True, exist_ok=True)
        with job.plist_path.open("wb") as handle:
            plistlib.dump(launchd_plist(job), handle, sort_keys=False)
        self.bootout(job)
        self.bootstrap(job)
        return self.status(job)

    def uninstall(self, job: ScheduledJob) -> bool:
        if not job.plist_path.exists():
            return False
        self.bootout(job)
        job.plist_path.unlink(missing_ok=True)
        return True

    def status(self, job: ScheduledJob) -> ScheduledJobStatus:
        if not job.plist_path.exists():
            return ScheduledJobStatus(
                task=job.task,
                label=job.label,
                plist_path=job.plist_path,
                installed=False,
                loaded=self.is_loaded(job),
            )
        data = read_plist(job.plist_path)
        return ScheduledJobStatus(
            task=job.task,
            label=job.label,
            plist_path=job.plist_path,
            installed=True,
            loaded=self.is_loaded(job),
            interval=read_interval(data),
        )

    def bootstrap(self, job: ScheduledJob) -> None:
        result = self.run_launchctl(
            ("bootstrap", launchd_target(), str(job.plist_path))
        )
        if result.returncode != 0:
            raise ExecutionFailed(
                "launchctl bootstrap failed for "
                f"{job.label}: {surface_process_error(result)}"
            )

    def bootout(self, job: ScheduledJob) -> None:
        self.run_launchctl(("bootout", launchd_target(), str(job.plist_path)))

    def is_loaded(self, job: ScheduledJob) -> bool:
        result = self.run_launchctl(("print", f"{launchd_target()}/{job.label}"))
        return result.returncode == 0

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


def surface_process_error(result: subprocess.CompletedProcess[str]) -> str:
    text = result.stderr.strip() or result.stdout.strip()
    if len(text) > 500:
        return f"{text[:500]}..."
    return text or f"exit {result.returncode}"
