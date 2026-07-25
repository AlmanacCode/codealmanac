import subprocess
import sys
import time
from datetime import UTC, datetime, timedelta

import psutil
import pytest
from conftest import initialize_repository

from codealmanac.app import create_app
from codealmanac.core.errors import ExecutionFailed
from codealmanac.integrations.runs.process import (
    PsutilRunProcessController,
    SubprocessRunExecutorSpawner,
    SubprocessRunWorkerSpawner,
    executor_command,
    freeze_process_tree,
    kill_process,
    resume_processes,
    resume_then_terminate,
    worker_command,
)
from codealmanac.services.runs.models import RunExecutionRef, RunKind, RunStatus
from codealmanac.services.runs.requests import (
    CancelRunRequest,
    MarkRunRunningRequest,
    SpawnRunWorkerRequest,
    StartRunRequest,
)
from codealmanac.settings import AppConfig
from codealmanac.workflows.run_queue.requests import SpawnRunExecutorRequest


def test_process_controller_terminates_executor_and_separate_session_child():
    parent_code = """
import subprocess
import sys
import time

child = subprocess.Popen(
    [sys.executable, "-c", "import time; time.sleep(60)"],
    start_new_session=True,
)
print(child.pid, flush=True)
time.sleep(60)
"""
    parent = subprocess.Popen(
        [sys.executable, "-c", parent_code],
        stdout=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    assert parent.stdout is not None
    child_pid = int(parent.stdout.readline().strip())
    execution = execution_for(parent.pid)

    try:
        PsutilRunProcessController().terminate(execution)
        parent.wait(timeout=2)

        assert not process_is_executing(parent.pid)
        assert not process_is_executing(child_pid)
    finally:
        kill_if_alive(parent.pid)
        kill_if_alive(child_pid)


def test_process_controller_refuses_reused_pid_identity():
    child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
    execution = execution_for(child.pid).model_copy(
        update={"process_started_at": datetime.now(UTC) + timedelta(days=1)}
    )

    try:
        with pytest.raises(ExecutionFailed, match="refusing to signal reused"):
            PsutilRunProcessController().terminate(execution)
        assert process_is_executing(child.pid)
    finally:
        kill_if_alive(child.pid)


def test_process_controller_force_kills_executor_that_ignores_termination():
    child = subprocess.Popen(
        [
            sys.executable,
            "-c",
            (
                "import signal, time; "
                "signal.signal(signal.SIGTERM, signal.SIG_IGN); "
                "print('ready', flush=True); time.sleep(60)"
            ),
        ],
        stdout=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    assert child.stdout is not None
    assert child.stdout.readline().strip() == "ready"

    try:
        PsutilRunProcessController().terminate(execution_for(child.pid))
        child.wait(timeout=2)
        assert not process_is_executing(child.pid)
    finally:
        kill_if_alive(child.pid)


def test_process_controller_rejects_root_that_vanishes_before_tree_freeze():
    class VanishedRoot:
        pid = 4242

        def create_time(self):
            raise psutil.NoSuchProcess(self.pid)

    with pytest.raises(ExecutionFailed, match="disappeared before its process tree"):
        freeze_process_tree(VanishedRoot())


def test_real_cancellation_stops_process_tree_before_sqlite_terminal_status(
    tmp_path,
    isolated_home,
):
    parent_code = """
import subprocess
import sys
import time

child = subprocess.Popen(
    [sys.executable, "-c", "import time; time.sleep(60)"],
    start_new_session=True,
)
print(child.pid, flush=True)
time.sleep(60)
"""
    parent = subprocess.Popen(
        [sys.executable, "-c", parent_code],
        stdout=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    assert parent.stdout is not None
    child_pid = int(parent.stdout.readline().strip())
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    repository = initialize_repository(app, repo)
    run = app.runs.start(
        StartRunRequest(
            repository_id=repository.repository_id,
            kind=RunKind.GARDEN,
        )
    )
    execution = execution_for(parent.pid)
    app.runs.mark_running(
        MarkRunRunningRequest(run_id=run.run_id, execution=execution)
    )

    try:
        result = app.workflows.queue.cancel(CancelRunRequest(run_id=run.run_id))

        assert not process_is_executing(parent.pid)
        assert not process_is_executing(child_pid)
        assert result.record.status == RunStatus.CANCELLED
        assert result.record.finished_at is not None
    finally:
        kill_if_alive(parent.pid)
        kill_if_alive(child_pid)


def test_freeze_process_tree_suspends_each_process_once():
    child = FakeProcess(pid=2)
    root = FakeProcess(pid=1, children=[child, child])

    frozen = freeze_process_tree(root)

    assert [process.pid for process in frozen] == [1, 2]
    assert child.suspended == 1


def test_freeze_process_tree_resumes_what_it_froze_when_suspension_fails():
    child = FakeProcess(pid=2, suspend_error=psutil.AccessDenied(2))
    root = FakeProcess(pid=1, children=[child])

    with pytest.raises(ExecutionFailed, match="could not freeze run executor tree"):
        freeze_process_tree(root)

    assert root.resumed == 1


def test_freeze_process_tree_skips_children_that_exit_mid_walk():
    child = FakeProcess(pid=2, suspend_error=psutil.NoSuchProcess(2))
    root = FakeProcess(pid=1, children=[child])

    frozen = freeze_process_tree(root)

    assert [process.pid for process in frozen] == [1]


def test_resume_then_terminate_ignores_a_process_that_already_exited():
    resume_then_terminate(FakeProcess(pid=1, resume_error=psutil.NoSuchProcess(1)))


def test_process_controller_resumes_the_tree_when_termination_is_denied(monkeypatch):
    child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])

    def deny(*args, **kwargs):
        raise psutil.AccessDenied(child.pid)

    monkeypatch.setattr(psutil, "wait_procs", deny)

    try:
        with pytest.raises(ExecutionFailed, match="could not terminate run executor"):
            PsutilRunProcessController().terminate(execution_for(child.pid))
        assert psutil.Process(child.pid).status() != psutil.STATUS_STOPPED
    finally:
        kill_if_alive(child.pid)
        child.wait(timeout=5)


def test_process_controller_reports_processes_that_survive_the_kill(monkeypatch):
    child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
    survivor = psutil.Process(child.pid)

    monkeypatch.setattr(psutil, "wait_procs", lambda procs, timeout: ([], [survivor]))

    try:
        with pytest.raises(ExecutionFailed, match="did not stop"):
            PsutilRunProcessController().terminate(execution_for(child.pid))
    finally:
        kill_if_alive(child.pid)
        child.wait(timeout=5)


def test_process_controller_reports_the_current_process_as_execution():
    execution = PsutilRunProcessController().current_execution()

    process = psutil.Process()
    assert execution.pid == process.pid
    assert execution.execution_id != ""
    assert execution.process_started_at == datetime.fromtimestamp(
        process.create_time(), UTC
    )


def test_process_controller_rejects_an_executor_that_already_exited():
    execution = RunExecutionRef(
        execution_id="process-test",
        pid=unused_pid(),
        process_started_at=datetime.now(UTC),
    )

    with pytest.raises(ExecutionFailed, match="is gone before termination"):
        PsutilRunProcessController().terminate(execution)


def test_worker_command_runs_the_worker_entrypoint_for_a_repository(tmp_path):
    command = worker_command(SpawnRunWorkerRequest(cwd=tmp_path))

    assert command == [
        sys.executable,
        "-m",
        "codealmanac.cli.main",
        "__run-worker",
        "--cwd",
        str(tmp_path),
    ]


def test_executor_command_runs_the_executor_entrypoint_for_a_run():
    command = executor_command(SpawnRunExecutorRequest(run_id="run-1"))

    assert command == [
        sys.executable,
        "-m",
        "codealmanac.cli.main",
        "__run-executor",
        "run-1",
    ]


def test_executor_spawner_detaches_the_child_and_exposes_its_pid(monkeypatch):
    calls = record_popen_calls(monkeypatch)

    process = SubprocessRunExecutorSpawner().spawn(
        SpawnRunExecutorRequest(run_id="run-1")
    )

    assert process.pid == 4242
    assert process.wait() == 0
    assert calls[0]["command"][-2:] == ["__run-executor", "run-1"]
    assert calls[0]["start_new_session"] is True
    assert calls[0]["stdin"] == subprocess.DEVNULL


def test_worker_spawner_reports_the_command_it_launched(monkeypatch, tmp_path):
    calls = record_popen_calls(monkeypatch)

    result = SubprocessRunWorkerSpawner().spawn(SpawnRunWorkerRequest(cwd=tmp_path))

    assert result.child_pid == 4242
    assert result.command == tuple(worker_command(SpawnRunWorkerRequest(cwd=tmp_path)))
    assert calls[0]["cwd"] == tmp_path
    assert calls[0]["start_new_session"] is True


def test_resume_and_kill_helpers_tolerate_dead_processes():
    child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
    process = psutil.Process(child.pid)
    process.kill()
    child.wait(timeout=5)

    resume_processes([process])
    kill_process(process)


class FakeProcess:
    """Minimal psutil.Process stand-in for process-tree walk edge cases."""

    def __init__(
        self,
        pid: int,
        children: list["FakeProcess"] | None = None,
        suspend_error: Exception | None = None,
        resume_error: Exception | None = None,
    ):
        self.pid = pid
        self._children = children or []
        self.suspend_error = suspend_error
        self.resume_error = resume_error
        self.suspended = 0
        self.resumed = 0
        self.terminated = 0

    def create_time(self) -> float:
        return float(self.pid)

    def children(self) -> list["FakeProcess"]:
        return self._children

    def suspend(self) -> None:
        if self.suspend_error is not None:
            raise self.suspend_error
        self.suspended += 1

    def resume(self) -> None:
        if self.resume_error is not None:
            raise self.resume_error
        self.resumed += 1

    def terminate(self) -> None:
        self.terminated += 1


def record_popen_calls(monkeypatch) -> list[dict]:
    calls: list[dict] = []

    class FakeChild:
        pid = 4242

        def wait(self) -> int:
            return 0

    def fake_popen(command, **kwargs):
        calls.append({"command": command, **kwargs})
        return FakeChild()

    monkeypatch.setattr(subprocess, "Popen", fake_popen)
    return calls


def unused_pid() -> int:
    candidate = 4242
    while psutil.pid_exists(candidate):
        candidate += 1
    return candidate


def execution_for(pid: int) -> RunExecutionRef:
    process = psutil.Process(pid)
    return RunExecutionRef(
        execution_id="process-test",
        pid=pid,
        process_started_at=datetime.fromtimestamp(process.create_time(), UTC),
    )


def process_is_executing(pid: int) -> bool:
    deadline = time.monotonic() + 2
    while time.monotonic() < deadline:
        try:
            process = psutil.Process(pid)
            if not process.is_running() or process.status() == psutil.STATUS_ZOMBIE:
                return False
        except psutil.NoSuchProcess:
            return False
        time.sleep(0.02)
    return True


def kill_if_alive(pid: int) -> None:
    try:
        psutil.Process(pid).kill()
    except psutil.NoSuchProcess:
        return
