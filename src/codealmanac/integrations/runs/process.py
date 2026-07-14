import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import psutil

from codealmanac.core.errors import ExecutionFailed
from codealmanac.services.runs.models import RunExecutionRef, RunWorkerSpawnResult
from codealmanac.services.runs.requests import SpawnRunWorkerRequest
from codealmanac.workflows.run_queue.requests import SpawnRunExecutorRequest

PROCESS_BIRTH_TOLERANCE_SECONDS = 0.01
TERMINATION_GRACE_SECONDS = 2.0


class SubprocessRunExecutorProcess:
    def __init__(self, child: subprocess.Popen[bytes]):
        self.child = child

    @property
    def pid(self) -> int:
        return self.child.pid

    def wait(self) -> int:
        return self.child.wait()


class SubprocessRunExecutorSpawner:
    def spawn(self, request: SpawnRunExecutorRequest) -> SubprocessRunExecutorProcess:
        child = subprocess.Popen(
            executor_command(request),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        return SubprocessRunExecutorProcess(child)


class PsutilRunProcessController:
    def current_execution(self) -> RunExecutionRef:
        process = psutil.Process()
        return RunExecutionRef(
            execution_id=uuid4().hex,
            pid=process.pid,
            process_started_at=datetime.fromtimestamp(process.create_time(), UTC),
        )

    def terminate(self, execution: RunExecutionRef) -> None:
        root = self.matching_process(execution)
        processes = freeze_process_tree(root)
        try:
            for process in reversed(processes):
                resume_then_terminate(process)
            _, alive = psutil.wait_procs(processes, timeout=TERMINATION_GRACE_SECONDS)
            for process in alive:
                kill_process(process)
            _, survivors = psutil.wait_procs(
                alive,
                timeout=TERMINATION_GRACE_SECONDS,
            )
        except (psutil.AccessDenied, psutil.Error) as error:
            resume_processes(processes)
            raise ExecutionFailed(
                f"could not terminate run executor {execution.pid}: {error}"
            ) from error
        if survivors:
            pids = ", ".join(str(process.pid) for process in survivors)
            raise ExecutionFailed(f"run executor processes did not stop: {pids}")

    def matching_process(self, execution: RunExecutionRef) -> psutil.Process:
        try:
            process = psutil.Process(execution.pid)
            actual_started_at = datetime.fromtimestamp(process.create_time(), UTC)
        except psutil.NoSuchProcess:
            raise ExecutionFailed(
                f"run executor {execution.pid} is gone before termination "
                "could be confirmed"
            ) from None
        delta = abs((actual_started_at - execution.process_started_at).total_seconds())
        if delta > PROCESS_BIRTH_TOLERANCE_SECONDS:
            raise ExecutionFailed(
                f"refusing to signal reused executor pid {execution.pid}"
            )
        return process


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


def executor_command(request: SpawnRunExecutorRequest) -> list[str]:
    return [
        sys.executable,
        "-m",
        "codealmanac.cli.main",
        "__run-executor",
        request.run_id,
    ]


def freeze_process_tree(root: psutil.Process) -> list[psutil.Process]:
    processes: dict[tuple[int, float], psutil.Process] = {}
    pending = [root]
    while pending:
        process = pending.pop()
        try:
            identity = (process.pid, process.create_time())
            if identity in processes:
                continue
            process.suspend()
            processes[identity] = process
            pending.extend(process.children())
        except psutil.NoSuchProcess:
            if not processes and process.pid == root.pid:
                raise ExecutionFailed(
                    f"run executor {root.pid} disappeared before its process "
                    "tree could be confirmed"
                ) from None
            continue
        except psutil.Error as error:
            resume_processes(list(processes.values()))
            raise ExecutionFailed(
                f"could not freeze run executor tree: {error}"
            ) from error
    return list(processes.values())


def resume_then_terminate(process: psutil.Process) -> None:
    try:
        process.resume()
        process.terminate()
    except psutil.NoSuchProcess:
        return


def resume_processes(processes: list[psutil.Process]) -> None:
    for process in processes:
        try:
            process.resume()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue


def kill_process(process: psutil.Process) -> None:
    try:
        process.kill()
    except psutil.NoSuchProcess:
        return
