import subprocess
import sys
from pathlib import Path

from codealmanac.services.runs.models import RunWorkerSpawnResult
from codealmanac.services.runs.requests import SpawnRunWorkerRequest


class SubprocessRunWorkerSpawner:
    def spawn(self, request: SpawnRunWorkerRequest) -> RunWorkerSpawnResult:
        command = worker_command(request)
        child = subprocess.Popen(
            command,
            cwd=request.cwd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        return RunWorkerSpawnResult(
            child_pid=child.pid,
            command=tuple(command),
        )


def worker_command(request: SpawnRunWorkerRequest) -> list[str]:
    return [
        sys.executable,
        "-m",
        "codealmanac.cli.main",
        "__run-worker",
        "--cwd",
        str(Path(request.cwd)),
    ]
