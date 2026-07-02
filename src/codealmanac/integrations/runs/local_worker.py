import subprocess
import sys

from codealmanac.services.runs.models import RunWorkerSpawnResult
from codealmanac.workflows.local_worker.requests import SpawnLocalWorkerRequest


class SubprocessLocalWorkerSpawner:
    def spawn(self, request: SpawnLocalWorkerRequest) -> RunWorkerSpawnResult:
        command = local_worker_command(request)
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


def local_worker_command(request: SpawnLocalWorkerRequest) -> list[str]:
    command = [
        sys.executable,
        "-m",
        "codealmanac.cli.main",
        "__run-local-worker",
        "--repository-id",
        request.repository_id,
        "--branch-id",
        request.branch_id,
        "--operation",
        request.operation,
        "--using",
        request.harness.value,
    ]
    if request.title is not None:
        command.extend(("--title", request.title))
    return command
