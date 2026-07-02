import json
import shutil
import subprocess
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path

import pytest

from codealmanac import __version__
from codealmanac.app import create_app
from codealmanac.cli.main import build_parser, main
from codealmanac.core.models import AppConfig
from codealmanac.core.paths import normalize_path
from codealmanac.integrations.setup.instructions import CODEALMANAC_START
from codealmanac.services.automation.models import (
    AutomationTask,
    ScheduledJob,
    ScheduledJobStatus,
)
from codealmanac.services.control.models import (
    ControlDeliveryMode,
    LocalGitState,
    TriggerEventStatus,
)
from codealmanac.services.control.requests import (
    ListTriggerEventsRequest,
    SetBranchPolicyRequest,
    UpsertRepositoryRequest,
)
from codealmanac.services.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
    HarnessTranscriptRef,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest
from codealmanac.services.runs.models import (
    RunEventKind,
    RunOperation,
    RunStatus,
    RunWorkerSpawnResult,
)
from codealmanac.services.runs.requests import (
    FinishRunRequest,
    ListRunsRequest,
    RecordRunEventRequest,
    RecordRunHarnessTranscriptRequest,
    ShowRunRequest,
    SpawnRunWorkerRequest,
    StartRunRequest,
)
from codealmanac.services.sources.models import TranscriptApp, TranscriptCandidate
from codealmanac.services.sources.requests import DiscoverTranscriptsRequest
from codealmanac.services.updates.models import (
    PackageCommandResult,
    PackageInstallMetadata,
)
from codealmanac.services.workspaces.requests import InitializeWorkspaceRequest
from codealmanac.workflows.ingest.requests import RunIngestRequest
from codealmanac.workflows.sync.models import (
    SyncLedger,
    SyncLedgerEntry,
    SyncLedgerStatus,
)


class CliWritingHarnessAdapter:
    kind = HarnessKind.CODEX

    def __init__(self):
        self.requests: list[RunHarnessRequest] = []

    def check(self) -> HarnessReadiness:
        return HarnessReadiness(
            kind=self.kind,
            available=True,
            message="codex ready",
        )

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        self.requests.append(request)
        page = request.cwd / "almanac/pages/cli-ingest-note.md"
        page.write_text(
            """---
title: CLI Ingest Note
topics: [getting-started]
sources: []
---
# CLI Ingest Note

The public CLI ingested bounded source material.
""",
            encoding="utf-8",
        )
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="ingested through CLI",
            summary="ingested through CLI",
            changed_files=(page,),
        )


class CliGardenHarnessAdapter:
    kind = HarnessKind.CODEX

    def __init__(self):
        self.requests: list[RunHarnessRequest] = []

    def check(self) -> HarnessReadiness:
        return HarnessReadiness(
            kind=self.kind,
            available=True,
            message="codex ready",
        )

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        self.requests.append(request)
        page = request.cwd / "almanac/pages/cli-garden-note.md"
        page.write_text(
            """---
title: CLI Garden Note
topics: [getting-started]
sources: []
---
# CLI Garden Note

The public CLI gardened the local wiki graph.
""",
            encoding="utf-8",
        )
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="gardened through CLI",
            summary="gardened through CLI",
            changed_files=(page,),
        )


class CliWorkerSpawner:
    def __init__(self):
        self.requests: list[SpawnRunWorkerRequest] = []

    def spawn(self, request: SpawnRunWorkerRequest) -> RunWorkerSpawnResult:
        self.requests.append(request)
        return RunWorkerSpawnResult(
            child_pid=5151,
            command=("fake-codealmanac-worker",),
        )


class CliTranscriptDiscoveryAdapter:
    app = TranscriptApp.CODEX

    def __init__(self, candidates: tuple[TranscriptCandidate, ...]):
        self.candidates = candidates
        self.requests: list[DiscoverTranscriptsRequest] = []

    def discover(
        self,
        request: DiscoverTranscriptsRequest,
    ) -> tuple[TranscriptCandidate, ...]:
        self.requests.append(request)
        return self.candidates


class CliSchedulerAdapter:
    def __init__(self):
        self.installed: list[ScheduledJob] = []
        self.uninstalled: list[ScheduledJob] = []

    def install(self, job: ScheduledJob) -> ScheduledJobStatus:
        self.installed.append(job)
        return ScheduledJobStatus(
            task=job.task,
            label=job.label,
            plist_path=job.plist_path,
            installed=True,
            loaded=True,
            interval=job.interval,
        )

    def uninstall(self, job: ScheduledJob) -> bool:
        self.uninstalled.append(job)
        return False

    def status(self, job: ScheduledJob) -> ScheduledJobStatus:
        return ScheduledJobStatus(
            task=job.task,
            label=job.label,
            plist_path=job.plist_path,
            installed=False,
            loaded=False,
        )


class CliUpdateMetadataProvider:
    def __init__(self, metadata: PackageInstallMetadata):
        self.metadata = metadata

    def read(self) -> PackageInstallMetadata:
        return self.metadata


class CliUpdateRunner:
    def __init__(self, result: PackageCommandResult):
        self.result = result
        self.commands: list[tuple[str, ...]] = []

    def run(self, command: tuple[str, ...]) -> PackageCommandResult:
        self.commands.append(command)
        return self.result


class CliLocalGitStateProbe:
    def __init__(self, state: LocalGitState):
        self.state = state
        self.requests: list[Path] = []

    def read(self, cwd: Path) -> LocalGitState:
        self.requests.append(cwd)
        return self.state


def test_cli_init_creates_wiki_and_prints_name(
    tmp_path: Path,
    isolated_home: Path,
    capsys,
):
    repo = tmp_path / "My Repo"
    repo.mkdir()

    exit_code = main(["init", str(repo), "--description", "cli test"])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert captured.out == "my-repo\n"
    assert "initialized" in captured.err
    assert (repo / "almanac/pages/getting-started.md").is_file()
    assert (isolated_home / ".codealmanac/registry.json").is_file()


def test_cli_init_accepts_configured_root(
    tmp_path: Path,
    isolated_home: Path,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()

    exit_code = main(["init", str(repo), "--root", "docs/almanac"])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert captured.out == "repo\n"
    assert str(repo / "docs/almanac") in captured.err
    assert (repo / "docs/almanac/pages/getting-started.md").is_file()


def test_cli_setup_and_uninstall_codex_instructions(
    isolated_home: Path,
    capsys,
):
    exit_code = main(["setup", "--yes", "--target", "codex"])

    captured = capsys.readouterr()
    agents_path = isolated_home / ".codex/AGENTS.md"
    assert exit_code == 0
    assert "CodeAlmanac setup" in captured.out
    assert "Agent instructions" in captured.out
    assert "default agent" in captured.out
    assert "codex" in captured.out
    assert "Next steps" in captured.out
    assert "codealmanac init" in captured.out
    assert "codealmanac automation install sync --every 5h --quiet 45m" in (
        captured.out
    )
    assert CODEALMANAC_START in agents_path.read_text(encoding="utf-8")

    second_exit = main(["setup", "--yes", "--target", "codex"])
    second = capsys.readouterr()
    assert second_exit == 0
    assert "Codex instructions already installed" in second.out

    uninstall_exit = main(["uninstall", "--yes", "--target", "codex"])
    uninstall = capsys.readouterr()
    assert uninstall_exit == 0
    assert "CodeAlmanac uninstall" in uninstall.out
    assert "Removed artifacts" in uninstall.out
    assert not agents_path.exists()


def test_cli_setup_skip_instructions_json(capsys):
    exit_code = main(["setup", "--yes", "--skip-instructions", "--json"])

    captured = capsys.readouterr()
    assert exit_code == 0
    payload = json.loads(captured.out)
    assert payload["skipped_instructions"] is True
    assert payload["changes"] == []
    assert payload["plan"]["default_harness"] == "codex"
    assert payload["plan"]["instruction_targets"] == ["codex", "claude"]
    assert payload["plan"]["automation"][0]["command"] == [
        "codealmanac",
        "automation",
        "install",
        "sync",
        "--every",
        "5h",
        "--quiet",
        "45m",
    ]


def test_cli_setup_installs_automation_with_explicit_flags(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    scheduler = CliSchedulerAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        scheduler=scheduler,
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert (
        main(
            [
                "setup",
                "--yes",
                "--target",
                "codex",
                "--install-automation",
                "--sync-every",
                "1m",
                "--sync-quiet",
                "1s",
                "--garden-every",
                "2m",
            ]
        )
        == 0
    )

    output = capsys.readouterr()
    assert "automation mode" in output.out
    assert "install" in output.out
    assert "Scheduled automation" in output.out
    assert tuple(job.task for job in scheduler.installed) == (
        AutomationTask.SYNC,
        AutomationTask.GARDEN,
    )
    assert scheduler.installed[0].interval.total_seconds() == 60
    assert scheduler.installed[1].interval.total_seconds() == 120

    assert main(["uninstall", "--yes", "--target", "codex"]) == 0

    capsys.readouterr()
    assert tuple(job.task for job in scheduler.uninstalled) == (
        AutomationTask.SYNC,
        AutomationTask.GARDEN,
    )


def test_cli_list_outputs_registered_wikis(
    tmp_path: Path,
    isolated_home: Path,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()

    assert main(["init", str(repo)]) == 0
    capsys.readouterr()

    exit_code = main(["list"])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert captured.out == f"repo\t{repo}\talmanac\n"


def test_cli_list_json_reports_registry_status(
    tmp_path: Path,
    isolated_home: Path,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    assert main(["init", str(repo)]) == 0
    capsys.readouterr()

    assert main(["list", "--json"]) == 0

    captured = capsys.readouterr()
    assert '"name": "repo"' in captured.out
    assert '"almanac_root": "almanac"' in captured.out
    assert '"status": "available"' in captured.out


def test_cli_list_drop_removes_selected_wiki(
    tmp_path: Path,
    isolated_home: Path,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    assert main(["init", str(repo)]) == 0
    capsys.readouterr()

    assert main(["list", "--drop", "repo"]) == 0
    drop_output = capsys.readouterr()
    assert drop_output.out == f"dropped repo\t{repo}\talmanac\n"

    assert main(["list"]) == 0
    list_output = capsys.readouterr()
    assert list_output.out == ""


def test_cli_list_drop_missing_removes_unreachable_wikis(
    tmp_path: Path,
    isolated_home: Path,
    capsys,
):
    live_repo = tmp_path / "live"
    missing_repo = tmp_path / "missing"
    live_repo.mkdir()
    missing_repo.mkdir()
    assert main(["init", str(live_repo), "--name", "live"]) == 0
    capsys.readouterr()
    assert main(["init", str(missing_repo), "--name", "missing"]) == 0
    capsys.readouterr()
    shutil.rmtree(missing_repo)

    assert main(["list", "--drop-missing"]) == 0
    drop_output = capsys.readouterr()
    assert drop_output.out == f"dropped missing\t{missing_repo}\talmanac\n"

    assert main(["list"]) == 0
    list_output = capsys.readouterr()
    assert list_output.out == f"live\t{live_repo}\talmanac\n"


def test_cli_build_and_reindex_commands(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()

    assert main(["build", str(repo)]) == 0
    build_output = capsys.readouterr()
    assert build_output.out == "built repo: 1 page (1 updated, 0 removed)\n"
    assert (repo / "almanac/index.db").is_file()

    (repo / "almanac/pages/note.md").write_text(
        "# Note\n\nReindexNeedle.\n",
        encoding="utf-8",
    )
    monkeypatch.chdir(repo)

    assert main(["reindex"]) == 0
    reindex_output = capsys.readouterr()
    assert reindex_output.out == "reindexed: 2 pages (2 updated, 0 removed)\n"

    assert main(["reindex", "--json"]) == 0
    json_output = capsys.readouterr()
    assert '"pages_indexed": 2' in json_output.out


def test_cli_reindex_can_target_registered_wiki(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    first = tmp_path / "first"
    second = tmp_path / "second"
    first.mkdir()
    second.mkdir()

    assert main(["build", str(first), "--name", "first"]) == 0
    capsys.readouterr()
    assert main(["build", str(second), "--name", "second"]) == 0
    capsys.readouterr()
    (first / "almanac/pages/remote.md").write_text(
        "# Remote\n\nTargeted reindex.\n",
        encoding="utf-8",
    )
    monkeypatch.chdir(second)

    assert main(["reindex", "--wiki", "first"]) == 0

    output = capsys.readouterr()
    assert output.out == "reindexed: 2 pages (2 updated, 0 removed)\n"


def test_cli_doctor_reports_local_state(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    assert main(["build", str(repo)]) == 0
    capsys.readouterr()
    monkeypatch.chdir(repo)

    assert main(["doctor"]) == 0

    output = capsys.readouterr()
    assert f"codealmanac v{__version__}\n" in output.out
    assert "## Install\n" in output.out
    assert "manual: 8 bundled docs" in output.out
    assert "manual: 8 docs" in output.out
    assert f"repo: {repo}\n" in output.out
    assert "index: 1 page, 1 topic" in output.out


def test_cli_doctor_reports_manual_drift(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    assert main(["build", str(repo)]) == 0
    capsys.readouterr()
    (repo / "almanac/manual/README.md").write_text(
        "local manual edit\n",
        encoding="utf-8",
    )
    monkeypatch.chdir(repo)

    assert main(["doctor"]) == 0

    output = capsys.readouterr()
    assert "info manual differs: README.md" in output.out
    assert "codealmanac build preserves existing files" in output.out


def test_cli_help_includes_update():
    parser = build_parser()

    help_text = parser.format_help()

    assert "update" in help_text


def test_cli_update_check_json_reports_plan(monkeypatch, capsys):
    app = create_app(
        update_metadata=CliUpdateMetadataProvider(
            PackageInstallMetadata(version="0.1.0", installer="uv")
        ),
        update_runner=CliUpdateRunner(PackageCommandResult(exit_code=0)),
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["update", "--check", "--json"]) == 0

    output = capsys.readouterr()
    assert '"status": "ready"' in output.out
    assert '"method": "uv-tool"' in output.out
    assert '"uv",' in output.out
    assert '"tool",' in output.out
    assert '"upgrade",' in output.out


def test_cli_update_refuses_editable_install(monkeypatch, capsys):
    runner = CliUpdateRunner(PackageCommandResult(exit_code=0))
    app = create_app(
        update_metadata=CliUpdateMetadataProvider(
            PackageInstallMetadata(
                version="0.1.0",
                installer="uv",
                editable=True,
                source_url="file:///repo",
            )
        ),
        update_runner=runner,
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["update"]) == 1

    output = capsys.readouterr()
    assert "update status: unsupported" in output.out
    assert "editable source install cannot be self-updated" in output.out
    assert "run: git pull && uv sync" in output.out
    assert runner.commands == []


def test_cli_doctor_json_reports_no_wiki(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    monkeypatch.chdir(tmp_path)

    assert main(["doctor", "--json"]) == 0

    output = capsys.readouterr()
    assert '"key": "wiki.none"' in output.out
    assert '"fix": "run: codealmanac init"' in output.out


def test_cli_help_includes_serve(capsys):
    parser = build_parser()

    with pytest.raises(SystemExit) as exit_info:
        parser.parse_args(["--help"])

    output = capsys.readouterr()
    assert exit_info.value.code == 0
    assert "serve" in output.out
    assert "jobs" in output.out
    assert "ingest" in output.out
    assert "garden" in output.out
    assert "sync" in output.out
    assert "automation" in output.out


def test_cli_ingest_runs_workflow_with_selected_harness(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    adapter = CliWritingHarnessAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(adapter,),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert (
        main(
            [
                "ingest",
                "note.md",
                "--using",
                "codex",
                "--title",
                "Digest note",
                "--guidance",
                "Write one short page.",
            ]
        )
        == 0
    )

    output = capsys.readouterr()
    assert "ingested " in output.out
    assert "sources: 1\n" in output.out
    assert "wiki_changes: 1\n" in output.out
    assert "summary: ingested through CLI\n" in output.out
    assert adapter.requests[0].title == "Digest note"
    assert "Write one short page." in adapter.requests[0].prompt
    assert (repo / "almanac/pages/cli-ingest-note.md").is_file()


def test_cli_ingest_uses_configured_default_harness(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    adapter = CliWritingHarnessAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(adapter,),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    (repo / "almanac/config.toml").write_text(
        """
[harness]
default = "codex"
""",
        encoding="utf-8",
    )
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["ingest", "note.md"]) == 0

    output = capsys.readouterr()
    assert "ingested " in output.out
    assert adapter.requests[0].kind == HarnessKind.CODEX
    assert (repo / "almanac/pages/cli-ingest-note.md").is_file()


def test_cli_ingest_background_queues_run_and_spawns_worker(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    harness = CliWritingHarnessAdapter()
    spawner = CliWorkerSpawner()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(harness,),
        worker_spawner=spawner,
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert (
        main(["ingest", "note.md", "--using", "codex", "--background", "--json"])
        == 0
    )

    output = capsys.readouterr()
    data = json.loads(output.out)
    run = app.runs.show(ShowRunRequest(cwd=repo, run_id=data["run_id"]))

    assert data["status"] == "queued"
    assert data["child_pid"] == 5151
    assert run.status == RunStatus.QUEUED
    assert harness.requests == []
    assert spawner.requests == [SpawnRunWorkerRequest(cwd=repo, wiki=None)]
    assert (repo / "almanac/jobs" / f"{run.run_id}.spec.json").is_file()


def test_cli_garden_runs_workflow_with_selected_harness(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    adapter = CliGardenHarnessAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(adapter,),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert (
        main(
            [
                "garden",
                "--using",
                "codex",
                "--title",
                "Clean up graph",
                "--guidance",
                "Improve one page boundary.",
            ]
        )
        == 0
    )

    output = capsys.readouterr()
    assert "gardened " in output.out
    assert "wiki_changes: 1\n" in output.out
    assert "summary: gardened through CLI\n" in output.out
    assert adapter.requests[0].title == "Clean up graph"
    assert "Garden Operation" in adapter.requests[0].prompt
    assert "Improve one page boundary." in adapter.requests[0].prompt
    assert (repo / "almanac/pages/cli-garden-note.md").is_file()


def test_cli_garden_background_plain_output(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    harness = CliGardenHarnessAdapter()
    spawner = CliWorkerSpawner()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(harness,),
        worker_spawner=spawner,
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["garden", "--using", "codex", "--background"]) == 0

    output = capsys.readouterr()
    run = app.runs.list(ListRunsRequest(cwd=repo))[0]

    assert f"queued {run.run_id}: queued" in output.out
    assert "worker_pid: 5151" in output.out
    assert run.operation == RunOperation.GARDEN
    assert harness.requests == []
    assert spawner.requests == [SpawnRunWorkerRequest(cwd=repo, wiki=None)]


def test_cli_hidden_run_worker_drains_queued_run(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "note.md").write_text("auth decision\n", encoding="utf-8")
    harness = CliWritingHarnessAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(harness,),
        worker_spawner=CliWorkerSpawner(),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    queued = app.workflows.queue.queue_ingest(
        RunIngestRequest(
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
        )
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["__run-worker", "--cwd", str(repo)]) == 0

    run = app.runs.show(ShowRunRequest(cwd=repo, run_id=queued.run_id))

    assert run.status == RunStatus.DONE
    assert harness.requests[0].kind == HarnessKind.CODEX
    assert (repo / "almanac/pages/cli-ingest-note.md").is_file()


def test_cli_hidden_record_local_trigger_records_pending_event(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    probe = CliLocalGitStateProbe(
        LocalGitState(
            cwd=repo,
            available=True,
            repository_root=repo,
            branch_name="dev",
            head_sha="head-1",
        )
    )
    app = create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            control_db_path=isolated_home / ".codealmanac/control.sqlite",
        ),
        local_git_state_probe=probe,
    )
    repository = app.control.upsert_repository(
        UpsertRepositoryRequest(
            provider="github",
            owner_login="AlmanacCode",
            name="codealmanac",
            full_name="AlmanacCode/codealmanac",
            default_branch="dev",
            almanac_root=Path("almanac"),
            local_root_path=repo,
        )
    )
    app.control.set_branch_policy(
        SetBranchPolicyRequest(
            repository_id=repository.id,
            name="dev",
            trigger_enabled=True,
            delivery_mode=ControlDeliveryMode.COMMIT,
        )
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert (
        main(
            [
                "__record-local-trigger",
                "--cwd",
                str(repo / "src"),
                "--kind",
                "local_post_commit",
                "--json",
            ]
        )
        == 0
    )

    output = capsys.readouterr()
    data = json.loads(output.out)
    pending = app.control.list_trigger_events(
        ListTriggerEventsRequest(statuses=(TriggerEventStatus.PENDING,))
    )

    assert data["recorded"] is True
    assert data["event"]["head_sha"] == "head-1"
    assert tuple(event.head_sha for event in pending) == ("head-1",)
    assert probe.requests == [repo / "src"]


def test_cli_sync_status_reports_ready_transcripts(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = tmp_path / "codex.jsonl"
    transcript.write_text('{"timestamp":"2026-01-01T00:00:00Z"}\n', encoding="utf-8")
    candidate = TranscriptCandidate(
        app=TranscriptApp.CODEX,
        session_id="codex-session",
        transcript_path=transcript,
        cwd=repo,
        repo_root=repo,
        almanac_path=repo / "almanac",
        modified_at=datetime(2026, 1, 1, tzinfo=UTC),
        size_bytes=transcript.stat().st_size,
    )
    adapter = CliTranscriptDiscoveryAdapter((candidate,))
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        transcript_discovery_adapters=(adapter,),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["sync", "status", "--from", "codex", "--quiet", "0s"]) == 0

    output = capsys.readouterr()
    assert "sync status:\n" in output.out
    assert "scanned: 1\n" in output.out
    assert "eligible: 1\n" in output.out
    assert "ready codex codex-session: lines 1-1\n" in output.out
    assert adapter.requests[0].apps == (TranscriptApp.CODEX,)


def test_cli_sync_status_uses_configured_quiet_window(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = tmp_path / "codex.jsonl"
    transcript.write_text('{"timestamp":"2026-01-01T00:00:00Z"}\n', encoding="utf-8")
    candidate = TranscriptCandidate(
        app=TranscriptApp.CODEX,
        session_id="codex-session",
        transcript_path=transcript,
        cwd=repo,
        repo_root=repo,
        almanac_path=repo / "almanac",
        modified_at=datetime.now(UTC),
        size_bytes=transcript.stat().st_size,
    )
    adapter = CliTranscriptDiscoveryAdapter((candidate,))
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        transcript_discovery_adapters=(adapter,),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    (repo / "almanac/config.toml").write_text(
        """
[sync]
quiet = "0s"
""",
        encoding="utf-8",
    )
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["sync", "status", "--from", "codex"]) == 0

    output = capsys.readouterr()
    assert "eligible: 1\n" in output.out
    assert "ready codex codex-session: lines 1-1\n" in output.out


def test_cli_sync_status_uses_retry_budget_flags(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = tmp_path / "codex.jsonl"
    transcript.write_text('{"timestamp":"2026-01-01T00:00:00Z"}\n', encoding="utf-8")
    candidate = TranscriptCandidate(
        app=TranscriptApp.CODEX,
        session_id="codex-session",
        transcript_path=transcript,
        cwd=repo,
        repo_root=repo,
        almanac_path=repo / "almanac",
        modified_at=datetime(2026, 1, 1, tzinfo=UTC),
        size_bytes=transcript.stat().st_size,
    )
    adapter = CliTranscriptDiscoveryAdapter((candidate,))
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        transcript_discovery_adapters=(adapter,),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    ledger_path = repo / "almanac/jobs/sync-ledger.json"
    ledger_path.parent.mkdir(parents=True, exist_ok=True)
    ledger = SyncLedger(
        version=1,
        updated_at=datetime(2026, 1, 1, tzinfo=UTC),
        sessions={
            f"{candidate.app.value}:{normalize_path(candidate.transcript_path)}": (
                SyncLedgerEntry(
                    app=candidate.app,
                    session_id=candidate.session_id,
                    transcript_path=candidate.transcript_path,
                    status=SyncLedgerStatus.FAILED,
                    last_absorbed_size=0,
                    last_absorbed_line=0,
                    last_absorbed_prefix_hash=f"sha256:{sha256(b'').hexdigest()}",
                    failed_attempts=1,
                )
            )
        },
    )
    ledger_path.write_text(ledger.model_dump_json(indent=2), encoding="utf-8")
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert (
        main(
            [
                "sync",
                "status",
                "--from",
                "codex",
                "--quiet",
                "0s",
                "--max-failed-attempts",
                "1",
            ]
        )
        == 0
    )

    output = capsys.readouterr()
    assert "needs_attention: 1\n" in output.out
    assert "sync-retry-budget-exhausted" in output.out


def test_cli_sync_runs_ingest_for_ready_transcripts(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = tmp_path / "codex.jsonl"
    transcript.write_text('{"timestamp":"2026-01-01T00:00:00Z"}\n', encoding="utf-8")
    candidate = TranscriptCandidate(
        app=TranscriptApp.CODEX,
        session_id="codex-session",
        transcript_path=transcript,
        cwd=repo,
        repo_root=repo,
        almanac_path=repo / "almanac",
        modified_at=datetime(2026, 1, 1, tzinfo=UTC),
        size_bytes=transcript.stat().st_size,
    )
    transcript_adapter = CliTranscriptDiscoveryAdapter((candidate,))
    harness = CliWritingHarnessAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(harness,),
        transcript_discovery_adapters=(transcript_adapter,),
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["sync", "--from", "codex", "--quiet", "0s", "--using", "codex"]) == 0

    output = capsys.readouterr()
    assert "sync:\n" in output.out
    assert "scanned: 1\n" in output.out
    assert "eligible: 1\n" in output.out
    assert "started: 1\n" in output.out
    assert "started codex codex-session: ingest-" in output.out
    assert "Scheduled sync cursor:" in harness.requests[0].prompt
    assert f"transcript:{transcript}" in harness.requests[0].prompt
    assert (repo / "almanac/jobs/sync-ledger.json").is_file()


def test_cli_sync_background_queues_ingest_for_ready_transcripts(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    transcript = tmp_path / "codex.jsonl"
    transcript.write_text('{"timestamp":"2026-01-01T00:00:00Z"}\n', encoding="utf-8")
    candidate = TranscriptCandidate(
        app=TranscriptApp.CODEX,
        session_id="codex-session",
        transcript_path=transcript,
        cwd=repo,
        repo_root=repo,
        almanac_path=repo / "almanac",
        modified_at=datetime(2026, 1, 1, tzinfo=UTC),
        size_bytes=transcript.stat().st_size,
    )
    transcript_adapter = CliTranscriptDiscoveryAdapter((candidate,))
    harness = CliWritingHarnessAdapter()
    spawner = CliWorkerSpawner()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(harness,),
        transcript_discovery_adapters=(transcript_adapter,),
        worker_spawner=spawner,
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert (
        main(
            [
                "sync",
                "--from",
                "codex",
                "--quiet",
                "0s",
                "--using",
                "codex",
                "--background",
            ]
        )
        == 0
    )

    output = capsys.readouterr()
    run = app.runs.list(ListRunsRequest(cwd=repo))[0]

    assert "sync:\n" in output.out
    assert "started: 1\n" in output.out
    assert f"started codex codex-session: {run.run_id}" in output.out
    assert run.status == RunStatus.QUEUED
    assert harness.requests == []
    assert spawner.requests == [SpawnRunWorkerRequest(cwd=repo, wiki=None)]
    assert (repo / "almanac/jobs" / f"{run.run_id}.spec.json").is_file()


def test_cli_automation_install_status_and_uninstall(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    scheduler = CliSchedulerAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        scheduler=scheduler,
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert (
        main(
            [
                "automation",
                "install",
                "--every",
                "1m",
                "--quiet",
                "1s",
                "--garden-every",
                "2m",
            ]
        )
        == 0
    )
    install_output = capsys.readouterr()
    assert "automation installed\n" in install_output.out
    assert "sync interval: 60s\n" in install_output.out
    assert "sync quiet: 1s\n" in install_output.out
    assert "garden interval: 120s\n" in install_output.out
    assert tuple(job.task.value for job in scheduler.installed) == ("sync", "garden")

    assert main(["automation", "status", "--json"]) == 0
    status_output = capsys.readouterr()
    assert '"statuses": [' in status_output.out
    assert '"task": "sync"' in status_output.out

    assert main(["automation", "uninstall", "sync"]) == 0
    uninstall_output = capsys.readouterr()
    assert "automation not installed\n" in uninstall_output.out
    assert scheduler.uninstalled[-1].task.value == "sync"


def test_cli_jobs_inspects_local_run_records(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
    record = app.runs.start(
        StartRunRequest(
            cwd=repo,
            operation=RunOperation.INGEST,
            title="Digest note",
        )
    )
    app.runs.record_event(
        RecordRunEventRequest(
            cwd=repo,
            run_id=record.run_id,
            kind=RunEventKind.MESSAGE,
            message="read note",
        )
    )
    app.runs.record_harness_transcript(
        RecordRunHarnessTranscriptRequest(
            cwd=repo,
            run_id=record.run_id,
            transcript=HarnessTranscriptRef(
                kind=HarnessKind.CODEX,
                session_id="codex-job-session",
                transcript_path=repo / "codex-job.jsonl",
            ),
        )
    )
    monkeypatch.chdir(repo)

    assert main(["jobs"]) == 0
    list_output = capsys.readouterr()
    assert f"{record.run_id}\tqueued\tingest\tDigest note\n" in list_output.out

    assert main(["jobs", "show", record.run_id]) == 0
    show_output = capsys.readouterr()
    assert f"id: {record.run_id}\n" in show_output.out
    assert "operation: ingest\n" in show_output.out
    assert "harness_transcript: codex codex-job-session\n" in show_output.out
    assert f"harness_transcript_path: {repo / 'codex-job.jsonl'}\n" in (show_output.out)

    assert main(["jobs", "logs", record.run_id]) == 0
    log_output = capsys.readouterr()
    assert "1\tstatus\tqueued ingest\n" in log_output.out
    assert "2\tmessage\tread note\n" in log_output.out

    assert main(["jobs", "logs", record.run_id, "--json"]) == 0
    logs_json_output = capsys.readouterr()
    log_events = json.loads(logs_json_output.out)
    assert "harness_event" not in log_events[0]

    app.runs.finish(
        FinishRunRequest(
            cwd=repo,
            run_id=record.run_id,
            status=RunStatus.DONE,
            summary="digest complete",
        )
    )

    assert main(["jobs", "attach", record.run_id]) == 0
    attach_output = capsys.readouterr()
    assert "1\tstatus\tqueued ingest\n" in attach_output.out
    assert "2\tmessage\tread note\n" in attach_output.out
    assert "3\tstatus\tdone\n" in attach_output.out
    assert "status: done\n" in attach_output.out

    cancellable = app.runs.start(
        StartRunRequest(
            cwd=repo,
            operation=RunOperation.GARDEN,
            title="Garden later",
        )
    )

    assert main(["jobs", "cancel", cancellable.run_id]) == 0
    cancel_output = capsys.readouterr()
    assert f"cancelled {cancellable.run_id}\n" in cancel_output.out
    cancelled_record = app.runs.show(
        ShowRunRequest(cwd=repo, run_id=cancellable.run_id)
    )
    assert cancelled_record.status == RunStatus.CANCELLED

    assert main(["jobs", "--json"]) == 0
    json_output = capsys.readouterr()
    assert f'"run_id": "{record.run_id}"' in json_output.out
    assert '"session_id": "codex-job-session"' in json_output.out

    assert main(["jobs", "cancel", cancellable.run_id, "--json"]) == 0
    cancel_json_output = capsys.readouterr()
    assert '"changed": false' in cancel_json_output.out
    assert '"status": "cancelled"' in cancel_json_output.out


def test_cli_jobs_rejects_path_shaped_run_ids(capsys):
    assert main(["jobs", "show", "../secret"]) == 1

    output = capsys.readouterr()
    assert output.out == ""
    assert "String should match pattern" in output.err


def test_cli_search_and_show_read_current_repo_wiki(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    assert main(["init", str(repo)]) == 0
    capsys.readouterr()
    page_path = repo / "almanac/pages/auth-flow.md"
    page_path.write_text(
        """---
title: Auth Flow
topics: [auth]
sources:
  - id: auth-folder
    type: file
    path: src/auth/
    note: Auth implementation folder.
---
# Auth Flow

Login reads [[src/auth/session.py]]. [@auth-folder]
""",
        encoding="utf-8",
    )
    monkeypatch.chdir(repo)

    assert main(["search", "login"]) == 0
    search_output = capsys.readouterr()
    assert search_output.out == "auth-flow\n"

    assert main(["show", "auth-flow", "--lead"]) == 0
    show_output = capsys.readouterr()
    assert show_output.out == "# Auth Flow\n"

    assert main(["show", "auth-flow", "--body", "--meta"]) == 0
    body_output = capsys.readouterr()
    assert body_output.out.startswith("# Auth Flow\n\nLogin reads")

    assert main(["show", "auth-flow", "--meta"]) == 0
    meta_output = capsys.readouterr()
    assert "sources:\n" in meta_output.out
    assert "auth-folder [file] src/auth/ - Auth implementation folder." in (
        meta_output.out
    )

    assert main(["search", "missing"]) == 0
    empty_output = capsys.readouterr()
    assert empty_output.out == ""
    assert empty_output.err == "# 0 results\n"


def test_cli_search_rejects_removed_archive_flags(capsys):
    with pytest.raises(SystemExit) as include_archive:
        main(["search", "--include-archive"])
    include_output = capsys.readouterr()

    assert include_archive.value.code == 2
    assert "unrecognized arguments: --include-archive" in include_output.err

    with pytest.raises(SystemExit) as archived:
        main(["search", "--archived"])
    archive_output = capsys.readouterr()

    assert archived.value.code == 2
    assert "unrecognized arguments: --archived" in archive_output.err


def test_cli_topics_and_health_read_current_repo_wiki(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    pages = repo / "almanac/pages"
    pages.mkdir(parents=True)
    (repo / "almanac/topics.yaml").write_text(
        """topics:
  - slug: auth
    title: Auth
    parents: []
  - slug: empty-topic
    title: Empty Topic
    parents: []
""",
        encoding="utf-8",
    )
    (pages / "auth-flow.md").write_text(
        "---\ntopics: [auth]\n---\n# Auth Flow\n\nSee [[missing-page]].\n",
        encoding="utf-8",
    )
    monkeypatch.chdir(repo)

    assert main(["topics"]) == 0
    topics_output = capsys.readouterr()
    assert "auth\t1\tAuth\n" in topics_output.out

    assert main(["topics", "show", "auth"]) == 0
    topic_output = capsys.readouterr()
    assert "pages:\n  auth-flow\n" in topic_output.out

    assert main(["health", "--json"]) == 0
    health_output = capsys.readouterr()
    assert '"broken_links": [' in health_output.out
    assert '"target_slug": "missing-page"' in health_output.out


def test_cli_tag_and_untag_update_page_frontmatter(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    pages = repo / "almanac/pages"
    pages.mkdir(parents=True)
    (repo / "almanac/topics.yaml").write_text("topics: []\n", encoding="utf-8")
    page = pages / "auth-flow.md"
    page.write_text("---\ntopics: [auth]\n---\n# Auth Flow\n", encoding="utf-8")
    monkeypatch.chdir(repo)

    assert main(["tag", "auth-flow", "sessions"]) == 0
    tag_output = capsys.readouterr()
    assert tag_output.out == "auth-flow: tagged sessions\n"

    assert main(["untag", "auth-flow", "auth"]) == 0
    untag_output = capsys.readouterr()
    assert untag_output.out == "auth-flow: untagged auth\n"

    assert main(["untag", "auth-flow", "missing"]) == 0
    noop_output = capsys.readouterr()
    assert noop_output.out == "auth-flow: not tagged missing\n"

    assert "sessions" in page.read_text(encoding="utf-8")


def test_cli_topics_mutation_commands(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    pages = repo / "almanac/pages"
    pages.mkdir(parents=True)
    (repo / "almanac/topics.yaml").write_text(
        """topics:
  - slug: concepts
    title: Concepts
    parents: []
""",
        encoding="utf-8",
    )
    monkeypatch.chdir(repo)

    assert main(["topics", "create", "Auth", "--parent", "concepts"]) == 0
    create_output = capsys.readouterr()
    assert create_output.out == "auth: created\n"

    assert main(["topics", "describe", "auth", "Authentication"]) == 0
    describe_output = capsys.readouterr()
    assert describe_output.out == "auth: described\n"

    assert main(["topics", "create", "JWT"]) == 0
    capsys.readouterr()
    assert main(["topics", "link", "jwt", "auth"]) == 0
    link_output = capsys.readouterr()
    assert link_output.out == "linked jwt -> auth\n"

    assert main(["topics", "show", "auth"]) == 0
    show_output = capsys.readouterr()
    assert "description: Authentication\n" in show_output.out
    assert "children: jwt\n" in show_output.out

    assert main(["topics", "rename", "auth", "security"]) == 0
    rename_output = capsys.readouterr()
    assert rename_output.out == "renamed auth -> security (0 pages updated)\n"

    assert main(["topics", "delete", "security"]) == 0
    delete_output = capsys.readouterr()
    assert delete_output.out == "deleted security (0 pages untagged)\n"


def initialize_git(repo: Path) -> None:
    run_git(repo, "init")


def commit_all(repo: Path, message: str) -> None:
    run_git(repo, "add", ".")
    run_git(
        repo,
        "-c",
        "user.email=agent@example.com",
        "-c",
        "user.name=CodeAlmanac Test",
        "commit",
        "-m",
        message,
    )


def run_git(repo: Path, *args: str) -> None:
    subprocess.run(
        ("git", *args),
        cwd=repo,
        text=True,
        capture_output=True,
        check=True,
    )
