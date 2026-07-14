from datetime import UTC, datetime
from pathlib import Path

from filelock import FileLock

from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.repositories.models import Repository
from codealmanac.services.repositories.store import RepositoryStore
from codealmanac.services.runs.models import RunKind, RunSpec, RunStatus
from codealmanac.services.runs.store import RunStore
from codealmanac.services.updates.lock import UpdateLockStore
from codealmanac.services.updates.models import (
    PackageCommandResult,
    PackageInstallMetadata,
    UpdateInstallMethod,
    UpdateStatus,
)
from codealmanac.services.updates.requests import CheckUpdateRequest, RunUpdateRequest
from codealmanac.services.updates.service import UpdatesService


class FakeMetadataProvider:
    def __init__(self, metadata: PackageInstallMetadata):
        self.metadata = metadata

    def read(self) -> PackageInstallMetadata:
        return self.metadata


class FakeCommandRunner:
    def __init__(self, result: PackageCommandResult):
        self.result = result
        self.commands: list[tuple[str, ...]] = []

    def run(self, command: tuple[str, ...]) -> PackageCommandResult:
        self.commands.append(command)
        return self.result


class ScriptedCommandRunner:
    def __init__(self, results: tuple[PackageCommandResult, ...]):
        self.results = list(results)
        self.commands: list[tuple[str, ...]] = []

    def run(self, command: tuple[str, ...]) -> PackageCommandResult:
        self.commands.append(command)
        if self.results:
            return self.results.pop(0)
        return PackageCommandResult(exit_code=0)


def test_update_service_plans_uv_tool_upgrade():
    service = update_service(
        PackageInstallMetadata(version="0.1.0", installer="uv"),
    )

    plan = service.check(CheckUpdateRequest())

    assert plan.status == UpdateStatus.READY
    assert plan.method == UpdateInstallMethod.UV_TOOL
    assert plan.command == ("uv", "tool", "upgrade", "codealmanac")


def test_update_service_plans_pip_upgrade_with_current_python():
    service = update_service(
        PackageInstallMetadata(
            version="0.1.0",
            installer="pip",
            python_executable=Path("/venv/bin/python"),
        ),
    )

    plan = service.check(CheckUpdateRequest())

    assert plan.status == UpdateStatus.READY
    assert plan.method == UpdateInstallMethod.PIP
    assert plan.command == (
        str(Path("/venv/bin/python")),
        "-m",
        "pip",
        "install",
        "--upgrade",
        "codealmanac",
    )


def test_update_service_refuses_editable_install_without_running_command():
    runner = FakeCommandRunner(PackageCommandResult(exit_code=0))
    service = update_service_with_runner(
        FakeMetadataProvider(
            PackageInstallMetadata(
                version="0.1.0",
                installer="uv",
                editable=True,
                source_url="file:///repo",
            )
        ),
        runner,
    )

    result = service.run(RunUpdateRequest())

    assert result.status == UpdateStatus.UNSUPPORTED
    assert result.plan.method == UpdateInstallMethod.EDITABLE
    assert result.plan.fix == "run: git pull && uv sync"
    assert runner.commands == []


def test_update_service_returns_failed_result_from_executor():
    runner = FakeCommandRunner(
        PackageCommandResult(exit_code=2, stdout="out\n", stderr="err\n")
    )
    service = update_service_with_runner(
        FakeMetadataProvider(PackageInstallMetadata(version="0.1.0", installer="uv")),
        runner,
    )

    result = service.run(RunUpdateRequest())

    assert result.status == UpdateStatus.FAILED
    assert result.exit_code == 2
    assert result.stdout == "out\n"
    assert result.stderr == "err\n"
    assert runner.commands == [("uv", "tool", "upgrade", "codealmanac")]


def test_update_service_returns_completed_result_from_executor_success():
    runner = FakeCommandRunner(
        PackageCommandResult(exit_code=0, stderr="Nothing to upgrade\n")
    )
    service = update_service_with_runner(
        FakeMetadataProvider(PackageInstallMetadata(version="0.1.0", installer="uv")),
        runner,
    )

    result = service.run(RunUpdateRequest())

    assert result.status == UpdateStatus.COMPLETED
    assert result.exit_code == 0
    assert result.stderr == "Nothing to upgrade\n"
    assert runner.commands == [("uv", "tool", "upgrade", "codealmanac")]


def test_scheduled_update_skips_editable_install(tmp_path: Path):
    runner = FakeCommandRunner(PackageCommandResult(exit_code=0))
    service = UpdatesService(
        FakeMetadataProvider(
            PackageInstallMetadata(
                version="0.1.0",
                installer="uv",
                editable=True,
                source_url="file:///repo",
            )
        ),
        runner,
        lock_path=tmp_path / ".codealmanac" / "update.lock",
        database_path=tmp_path / ".codealmanac" / "codealmanac.db",
    )

    result = service.run(RunUpdateRequest(scheduled=True))

    assert result.status == UpdateStatus.SKIPPED
    assert result.plan.method == UpdateInstallMethod.EDITABLE
    assert result.message == (
        "scheduled update skipped: editable source install cannot be self-updated"
    )
    assert runner.commands == []


def test_scheduled_update_skips_when_lifecycle_run_is_active(tmp_path: Path):
    state_dir = tmp_path / ".codealmanac"
    database_path = state_dir / "codealmanac.db"
    write_run_record(database_path, tmp_path / "repo", RunStatus.RUNNING)
    runner = FakeCommandRunner(PackageCommandResult(exit_code=0))
    service = UpdatesService(
        FakeMetadataProvider(PackageInstallMetadata(version="0.1.0", installer="uv")),
        runner,
        lock_path=state_dir / "update.lock",
        database_path=database_path,
    )

    result = service.run(RunUpdateRequest(scheduled=True))

    assert result.status == UpdateStatus.SKIPPED
    assert result.message == "scheduled update skipped: 1 CodeAlmanac job is active"
    assert runner.commands == []

    # Lock is released, so we can acquire it
    lock = FileLock(str(state_dir / "update.lock"))
    lock.acquire(timeout=0)
    lock.release()


def test_scheduled_update_skips_when_update_lock_is_held(tmp_path: Path):
    state_dir = tmp_path / ".codealmanac"
    state_dir.mkdir()
    lock_path = state_dir / "update.lock"

    other_lock = FileLock(str(lock_path))
    other_lock.acquire()

    try:
        runner = FakeCommandRunner(PackageCommandResult(exit_code=0))
        service = UpdatesService(
            FakeMetadataProvider(
                PackageInstallMetadata(version="0.1.0", installer="uv")
            ),
            runner,
            lock_path=lock_path,
            database_path=state_dir / "codealmanac.db",
        )

        result = service.run(RunUpdateRequest(scheduled=True))

        assert result.status == UpdateStatus.SKIPPED
        assert result.message == "scheduled update skipped: update already in progress"
        assert runner.commands == []
        assert lock_path.exists()
    finally:
        other_lock.release()


def test_scheduled_update_runs_smoke_after_success(tmp_path: Path):
    runner = ScriptedCommandRunner(
        (
            PackageCommandResult(exit_code=0, stdout="updated\n"),
            PackageCommandResult(exit_code=0, stdout="codealmanac 0.2.0\n"),
            PackageCommandResult(exit_code=0, stdout='{"checks":[]}\n'),
        )
    )
    service = UpdatesService(
        FakeMetadataProvider(PackageInstallMetadata(version="0.1.0", installer="uv")),
        runner,
        lock_path=tmp_path / ".codealmanac" / "update.lock",
        database_path=tmp_path / ".codealmanac" / "codealmanac.db",
    )

    result = service.run(RunUpdateRequest(scheduled=True))

    assert result.status == UpdateStatus.COMPLETED
    assert runner.commands == [
        ("uv", "tool", "upgrade", "codealmanac"),
        ("codealmanac", "--version"),
        ("codealmanac", "doctor", "--json"),
    ]
    assert tuple(smoke.exit_code for smoke in result.smoke) == (0, 0)
    # Lock is released, so we can acquire it
    lock = FileLock(str(tmp_path / ".codealmanac/update.lock"))
    lock.acquire(timeout=0)
    lock.release()


def test_scheduled_update_fails_when_smoke_fails(tmp_path: Path):
    runner = ScriptedCommandRunner(
        (
            PackageCommandResult(exit_code=0, stdout="updated\n"),
            PackageCommandResult(exit_code=1, stderr="broken\n"),
            PackageCommandResult(exit_code=0, stdout='{"checks":[]}\n'),
        )
    )
    service = UpdatesService(
        FakeMetadataProvider(PackageInstallMetadata(version="0.1.0", installer="uv")),
        runner,
        lock_path=tmp_path / ".codealmanac" / "update.lock",
        database_path=tmp_path / ".codealmanac" / "codealmanac.db",
    )

    result = service.run(RunUpdateRequest(scheduled=True))

    assert result.status == UpdateStatus.FAILED
    assert tuple(smoke.exit_code for smoke in result.smoke) == (1, 0)


def update_service(metadata: PackageInstallMetadata) -> UpdatesService:
    return update_service_with_runner(
        FakeMetadataProvider(metadata),
        FakeCommandRunner(PackageCommandResult(exit_code=0)),
    )


def update_service_with_runner(
    metadata: FakeMetadataProvider,
    runner: FakeCommandRunner | ScriptedCommandRunner,
) -> UpdatesService:
    return UpdatesService(
        metadata,
        runner,
        lock_path=Path(":memory:").parent / "update.lock",
        database_path=Path(":memory:"),
    )


def write_run_record(
    database_path: Path,
    repository_root: Path,
    status: RunStatus,
) -> None:
    now = datetime(2026, 7, 6, tzinfo=UTC)
    repository = Repository(
        repository_id="repo-id",
        name="repo",
        description="",
        root_path=repository_root,
        almanac_path=repository_root / "almanac",
        registered_at=now,
    )
    RepositoryStore(database_path).remember(repository)
    store = RunStore(database_path)
    record = store.queue(
        repository.repository_id,
        RunSpec(
            kind=RunKind.INGEST,
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
            inputs=("note.md",),
        ),
        "Active run",
    )
    if status == RunStatus.RUNNING:
        store.mark_running(record.run_id)


def test_update_lock_store_acquires_new_lock(tmp_path: Path):
    lock_path = tmp_path / "update.lock"
    store = UpdateLockStore()

    lease = store.acquire(lock_path)
    assert lease is not None
    assert lock_path.exists()

    lease.release()

    # Another lease can be acquired after release
    lease2 = store.acquire(lock_path)
    assert lease2 is not None
    lease2.release()


def test_update_lock_store_refuses_held_lock(tmp_path: Path):
    lock_path = tmp_path / "update.lock"
    store = UpdateLockStore()

    # First acquisition
    lease1 = store.acquire(lock_path)
    assert lease1 is not None

    # Second acquisition immediately after should fail
    lease2 = store.acquire(lock_path)
    assert lease2 is None

    lease1.release()

    # After release, we can acquire again
    lease3 = store.acquire(lock_path)
    assert lease3 is not None
    lease3.release()


def hold_lock_worker(lock_path_str: str, start_event, stop_event) -> None:
    from filelock import FileLock

    lock = FileLock(lock_path_str)
    lock.acquire()
    start_event.set()
    stop_event.wait(timeout=5)
    lock.release()


def test_update_lock_store_multiprocessing(tmp_path: Path):
    lock_path = tmp_path / "update.lock"
    store = UpdateLockStore()

    import multiprocessing

    start_event = multiprocessing.Event()
    stop_event = multiprocessing.Event()

    p = multiprocessing.Process(
        target=hold_lock_worker,
        args=(str(lock_path), start_event, stop_event),
    )
    p.start()

    try:
        # Wait for the worker to acquire the lock
        assert start_event.wait(timeout=5)

        # Now, try to acquire the lock in this process. It should fail.
        lease = store.acquire(lock_path)
        assert lease is None

    finally:
        stop_event.set()
        p.join(timeout=5)

    # After the worker finishes (releasing the lock), we should be able to acquire it
    lease2 = store.acquire(lock_path)
    assert lease2 is not None
    lease2.release()
