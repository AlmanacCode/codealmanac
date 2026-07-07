from datetime import UTC, datetime
from pathlib import Path

from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.repositories.models import Repository
from codealmanac.services.repositories.store import RepositoryStore
from codealmanac.services.runs.models import RunKind, RunSpec, RunStatus
from codealmanac.services.runs.store import RunStore
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
        "/venv/bin/python",
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
    assert not (state_dir / "update.lock").exists()


def test_scheduled_update_skips_when_update_lock_is_held(tmp_path: Path):
    state_dir = tmp_path / ".codealmanac"
    state_dir.mkdir()
    (state_dir / "update.lock").write_text(
        '{"pid": 1, "created_at": "2099-01-01T00:00:00Z"}',
        encoding="utf-8",
    )
    runner = FakeCommandRunner(PackageCommandResult(exit_code=0))
    service = UpdatesService(
        FakeMetadataProvider(PackageInstallMetadata(version="0.1.0", installer="uv")),
        runner,
        lock_path=state_dir / "update.lock",
        database_path=state_dir / "codealmanac.db",
    )

    result = service.run(
        RunUpdateRequest(
            scheduled=True,
            now=datetime(2026, 7, 6, tzinfo=UTC),
        )
    )

    assert result.status == UpdateStatus.SKIPPED
    assert result.message == "scheduled update skipped: update already in progress"
    assert runner.commands == []
    assert (state_dir / "update.lock").exists()


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
    assert not (tmp_path / ".codealmanac/update.lock").exists()


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
