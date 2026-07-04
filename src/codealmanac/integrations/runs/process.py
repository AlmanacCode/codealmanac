import subprocess
from pathlib import Path

from codealmanac.jobs.ledger.models import JobWorkerSpawnResult
from codealmanac.jobs.ledger.requests import SpawnJobWorkerRequest


class SubprocessJobWorkerSpawner:
    def spawn(self, request: SpawnJobWorkerRequest) -> JobWorkerSpawnResult:
        command = worker_command(request)
        child = subprocess.Popen(
            command,
            cwd=request.cwd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        return JobWorkerSpawnResult(
            child_pid=child.pid,
            command=tuple(command),
        )


def worker_command(request: SpawnJobWorkerRequest) -> list[str]:
    command = [
        "codealmanac-job-worker",
        "--cwd",
        str(Path(request.cwd)),
    ]
    if request.wiki is not None:
        command.extend(("--wiki", request.wiki))
    return command
