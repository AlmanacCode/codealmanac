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
    freeze_process_tree,
)
from codealmanac.services.runs.models import RunExecutionRef, RunKind, RunStatus
from codealmanac.services.runs.requests import (
    CancelRunRequest,
    MarkRunRunningRequest,
    StartRunRequest,
)
from codealmanac.settings import AppConfig


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
