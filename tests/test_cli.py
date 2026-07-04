import json
import shutil
import subprocess
from datetime import UTC, datetime
from io import StringIO
from pathlib import Path
from uuid import UUID, uuid4

import pytest

from codealmanac import __version__
from codealmanac.app import create_app
from codealmanac.capture_hook import main as capture_hook_main
from codealmanac.cli.dispatch.setup import setup_login_browser_mode
from codealmanac.cli.main import build_parser, main
from codealmanac.cloud.auth.models import CloudIdentity, CloudLoginSession
from codealmanac.cloud.capture.models import (
    CaptureArtifact,
    CaptureArtifactUpload,
    CaptureCloudStatus,
    CaptureCredential,
    CaptureCredentialIssue,
    CaptureTranscriptUpload,
    CaptureTurnUploadResult,
)
from codealmanac.cloud.repositories.models import (
    CloudRepository,
    CloudRepositoryPage,
    CloudRepositoryTriggerPolicy,
)
from codealmanac.cloud.runs.models import (
    CloudRun,
    CloudRunEvent,
    CloudRunPage,
    CloudRunSource,
)
from codealmanac.core.models import AppConfig
from codealmanac.core.paths import default_jobs_path
from codealmanac.engine.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
)
from codealmanac.engine.harnesses.requests import RunHarnessRequest
from codealmanac.engine.workspaces.models import GitWorktreeCheckout
from codealmanac.integrations.setup.instructions import CODEALMANAC_START
from codealmanac.job_worker import main as job_worker_main
from codealmanac.jobs.ledger.models import (
    JobOperation,
    JobStatus,
    JobWorkerSpawnResult,
)
from codealmanac.jobs.ledger.requests import (
    ListJobsRequest,
    ShowJobRequest,
    SpawnJobWorkerRequest,
)
from codealmanac.local.control.models import (
    ControlDeliveryMode,
    ControlRunEventKind,
    ControlRunStatus,
    LocalGitState,
    TriggerEventKind,
    TriggerEventStatus,
)
from codealmanac.local.control.requests import (
    AppendControlRunEventRequest,
    CreateControlRunRequest,
    ListTriggerEventsRequest,
    RecordTriggerEventRequest,
    SetBranchPolicyRequest,
    UpdateControlRunRequest,
    UpsertRepositoryRequest,
)
from codealmanac.local.delivery.execution.models import (
    LocalDeliveryCommit,
    LocalDeliveryHead,
    LocalDeliveryPatch,
    LocalDeliveryWorkingTree,
)
from codealmanac.local.runs.worker.requests import SpawnLocalWorkerRequest
from codealmanac.local.setup.models import LocalRepositoryState
from codealmanac.local_trigger import main as local_trigger_main
from codealmanac.local_worker import main as local_worker_main
from codealmanac.services.updates.models import (
    PackageCommandResult,
    PackageInstallMetadata,
)
from codealmanac.wiki.workspaces.identity import workspace_id_for
from codealmanac.wiki.workspaces.requests import InitializeWorkspaceRequest
from codealmanac.workflows.ingest.requests import RunIngestRequest


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


class CliInitHarnessAdapter:
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
        almanac_root = request.cwd / "almanac"
        if (request.cwd / "docs/almanac/pages").is_dir():
            almanac_root = request.cwd / "docs/almanac"
        page = almanac_root / "pages/cli-init-note.md"
        page.write_text(
            """---
title: CLI Init Note
topics: [concepts]
sources: []
---
# CLI Init Note

The public CLI initialized the first wiki.
""",
            encoding="utf-8",
        )
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="initialized through CLI",
            summary="initialized through CLI",
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
        self.requests: list[SpawnJobWorkerRequest] = []

    def spawn(self, request: SpawnJobWorkerRequest) -> JobWorkerSpawnResult:
        self.requests.append(request)
        return JobWorkerSpawnResult(
            child_pid=5151,
            command=("fake-codealmanac-worker",),
        )


class CliLocalWorkerSpawner:
    def __init__(self):
        self.requests: list[SpawnLocalWorkerRequest] = []

    def spawn(self, request: SpawnLocalWorkerRequest) -> JobWorkerSpawnResult:
        self.requests.append(request)
        return JobWorkerSpawnResult(
            child_pid=6262,
            command=("fake-codealmanac-local-worker",),
        )


class CliBrowserOpener:
    def __init__(self):
        self.opened: list[str] = []

    def open(self, url: str) -> bool:
        self.opened.append(url)
        return True


class CliCloudAuthClient:
    def __init__(self):
        self.session_id = uuid4()
        self.started = 0
        self.polled: list[UUID] = []
        self.seen_tokens: list[str] = []

    def start_login(self, *, api_url: str) -> CloudLoginSession:
        self.started += 1
        return CloudLoginSession(
            session_id=self.session_id,
            user_code="ABCD2345",
            verification_url="https://app.example.test/cli-login",
            expires_at=datetime(2026, 7, 2, 12, 10, tzinfo=UTC),
            status="pending",
        )

    def poll_login(self, *, api_url: str, session_id: UUID) -> CloudLoginSession:
        self.polled.append(session_id)
        return CloudLoginSession(
            session_id=session_id,
            user_code="ABCD2345",
            verification_url="https://app.example.test/cli-login",
            expires_at=datetime(2026, 7, 2, 12, 10, tzinfo=UTC),
            status="complete",
            token="alm_secret",
        )

    def me(self, *, api_url: str, token: str) -> CloudIdentity:
        self.seen_tokens.append(token)
        return CloudIdentity(
            api_url=api_url,
            github_user_id=10,
            github_login="rohans0509",
        )

    def logout(self, *, api_url: str, token: str) -> CloudIdentity:
        return self.me(api_url=api_url, token=token)


class CliCloudCaptureClient:
    def __init__(self):
        self.issued: list[str] = []
        self.revoked: list[str] = []
        self.artifacts: list[CaptureArtifactUpload] = []
        self.turns: list[CaptureTranscriptUpload] = []

    def issue_capture_credential(
        self,
        *,
        api_url: str,
        cli_token: str,
        name: str,
    ) -> CaptureCredentialIssue:
        assert cli_token == "alm_secret"
        self.issued.append(name)
        return CaptureCredentialIssue(
            credential=capture_credential(name=name),
            token="cap_secret",
        )

    def capture_status(
        self,
        *,
        api_url: str,
        cli_token: str,
    ) -> CaptureCloudStatus:
        assert cli_token == "alm_secret"
        return CaptureCloudStatus(
            credentials=(capture_credential(name="CodeAlmanac capture"),)
        )

    def revoke_capture_credential(
        self,
        *,
        api_url: str,
        cli_token: str,
        capture_token: str,
    ) -> bool:
        assert cli_token == "alm_secret"
        self.revoked.append(capture_token)
        return True

    def upload_capture_artifact(
        self,
        *,
        api_url: str,
        capture_token: str,
        artifact: CaptureArtifactUpload,
    ) -> CaptureArtifact:
        assert capture_token == "cap_secret"
        self.artifacts.append(artifact)
        return CaptureArtifact(
            ref="source-artifacts://capture/cli-test.jsonl",
            sha256="0" * 64,
            size_bytes=len(artifact.body),
            content_type=artifact.content_type,
        )

    def upload_capture_turn(
        self,
        *,
        api_url: str,
        capture_token: str,
        turn: CaptureTranscriptUpload,
    ) -> CaptureTurnUploadResult:
        assert capture_token == "cap_secret"
        self.turns.append(turn)
        return CaptureTurnUploadResult(
            accepted=True,
            routed=False,
            routing_status=turn.routing_status,
            message_count=0,
        )


class CliCloudRepositoriesClient:
    def __init__(self):
        self.repo_lists: list[tuple[int | None, str | None]] = []
        self.resolves: list[str] = []
        self.lists: list[int] = []
        self.upserts: list[tuple[int, str, bool | None, str | None]] = []

    def list_repositories(
        self,
        *,
        api_url: str,
        cli_token: str,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> CloudRepositoryPage:
        assert cli_token == "alm_secret"
        self.repo_lists.append((limit, cursor))
        return CloudRepositoryPage(
            items=(
                CloudRepository(
                    repo_id=1,
                    account_id=10,
                    full_name="AlmanacCode/codealmanac",
                    default_branch="main",
                ),
            ),
            next_cursor=None,
        )

    def resolve_repository(
        self,
        *,
        api_url: str,
        cli_token: str,
        full_name: str,
    ) -> CloudRepository:
        assert cli_token == "alm_secret"
        self.resolves.append(full_name)
        return CloudRepository(
            repo_id=1,
            account_id=10,
            full_name=full_name,
            default_branch="main",
        )

    def list_repository_triggers(
        self,
        *,
        api_url: str,
        cli_token: str,
        repo_id: int,
    ) -> tuple[CloudRepositoryTriggerPolicy, ...]:
        assert cli_token == "alm_secret"
        self.lists.append(repo_id)
        return (
            CloudRepositoryTriggerPolicy(
                repo_id=repo_id,
                branch="main",
                enabled=True,
                delivery_mode="commit",
            ),
        )

    def upsert_repository_trigger(
        self,
        *,
        api_url: str,
        cli_token: str,
        repo_id: int,
        branch: str,
        enabled: bool | None = None,
        delivery_mode=None,
    ) -> CloudRepositoryTriggerPolicy:
        assert cli_token == "alm_secret"
        self.upserts.append((repo_id, branch, enabled, delivery_mode))
        return CloudRepositoryTriggerPolicy(
            repo_id=repo_id,
            branch=branch,
            enabled=enabled if enabled is not None else True,
            delivery_mode=delivery_mode if delivery_mode is not None else "commit",
        )


class CliCloudRunsClient:
    def __init__(self):
        self.lists: list[tuple[int, int | None, str | None]] = []
        self.starts: list[tuple[int, str]] = []
        self.reads: list[UUID] = []
        self.cancels: list[UUID] = []
        self.retries: list[UUID] = []
        self.logs: list[UUID] = []

    def list_repository_runs(
        self,
        *,
        api_url: str,
        cli_token: str,
        repo_id: int,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> CloudRunPage:
        assert cli_token == "alm_secret"
        self.lists.append((repo_id, limit, cursor))
        return CloudRunPage(
            items=(cloud_run(UUID(int=1)),),
            next_cursor="next",
        )

    def start_repository_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        repo_id: int,
        branch: str,
    ) -> CloudRun:
        assert cli_token == "alm_secret"
        self.starts.append((repo_id, branch))
        return CloudRun(
            run_id=UUID(int=3),
            repo_id=repo_id,
            source=CloudRunSource(kind="branch", label=f"branch {branch}"),
            status="running",
            summary="queued manual branch update",
            created_at=datetime(2026, 7, 2, 12, tzinfo=UTC),
        )

    def read_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        run_id: UUID,
    ) -> CloudRun:
        assert cli_token == "alm_secret"
        self.reads.append(run_id)
        return cloud_run(run_id)

    def cancel_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        run_id: UUID,
    ) -> CloudRun:
        assert cli_token == "alm_secret"
        self.cancels.append(run_id)
        return CloudRun(
            run_id=run_id,
            repo_id=1,
            source=CloudRunSource(kind="branch", label="branch main"),
            status="cancelled",
            summary="cancelled by user",
            created_at=datetime(2026, 7, 2, 12, tzinfo=UTC),
            finished_at=datetime(2026, 7, 2, 12, 30, tzinfo=UTC),
        )

    def retry_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        run_id: UUID,
    ) -> CloudRun:
        assert cli_token == "alm_secret"
        self.retries.append(run_id)
        return CloudRun(
            run_id=UUID(int=4),
            repo_id=1,
            source=CloudRunSource(kind="branch", label="branch main"),
            status="running",
            summary="retry started",
            created_at=datetime(2026, 7, 2, 12, tzinfo=UTC),
        )

    def list_run_events(
        self,
        *,
        api_url: str,
        cli_token: str,
        run_id: UUID,
    ) -> tuple[CloudRunEvent, ...]:
        assert cli_token == "alm_secret"
        self.logs.append(run_id)
        return (
            CloudRunEvent(
                run_id=run_id,
                sequence=1,
                timestamp=datetime(2026, 7, 2, 12, tzinfo=UTC),
                kind="status",
                message="running",
                payload={"worker_call_id": "call-1"},
            ),
        )


def cloud_run(run_id: UUID) -> CloudRun:
    return CloudRun(
        run_id=run_id,
        repo_id=1,
        source=CloudRunSource(kind="branch", label="branch main"),
        status="running",
        summary="updating wiki",
        files_changed=("almanac/pages/api.md",),
        created_at=datetime(2026, 7, 2, 12, tzinfo=UTC),
    )


def capture_credential(*, name: str) -> CaptureCredential:
    return CaptureCredential(
        id=uuid4(),
        name=name,
        created_at=datetime(2026, 7, 2, 12, tzinfo=UTC),
        last_used_at=None,
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


def workspace_jobs_path(repo: Path) -> Path:
    return default_jobs_path() / workspace_id_for(repo)


class CliLocalGitStateProbe:
    def __init__(self, state: LocalGitState):
        self.state = state
        self.requests: list[Path] = []

    def read(self, cwd: Path) -> LocalGitState:
        self.requests.append(cwd)
        return self.state


class CliLocalRepositoryProbe:
    def __init__(self, state: LocalRepositoryState):
        self.state = state
        self.requests: list[Path] = []

    def read(self, cwd: Path) -> LocalRepositoryState:
        self.requests.append(cwd)
        return self.state


class CliLocalWorkerHarnessAdapter:
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
        page = request.cwd / "almanac/pages/local-worker-note.md"
        page.parent.mkdir(parents=True, exist_ok=True)
        page.write_text("# Local Worker\n", encoding="utf-8")
        return HarnessRunResult(
            kind=HarnessKind.CODEX,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="Update local worker note",
            summary="Update local worker note",
            changed_files=(Path("almanac/pages/local-worker-note.md"),),
        )


class CliGitWorktreeManager:
    def add_detached(
        self,
        source_repo_path: Path,
        worktree_path: Path,
        commit_sha: str,
    ) -> GitWorktreeCheckout:
        worktree_path.mkdir(parents=True)
        return GitWorktreeCheckout(repo_path=worktree_path, head_sha=commit_sha)

    def remove(self, source_repo_path: Path, worktree_path: Path) -> None:
        return None


class CliLocalDeliveryManager:
    def __init__(self):
        self.head = LocalDeliveryHead(branch_name="dev", head_sha="head-1")
        self.commit = LocalDeliveryCommit(commit_sha="head-2")
        self.apply_calls: list[tuple[Path, Path, str, str, str | None]] = []
        self.working_tree_calls: list[tuple[Path, Path, str]] = []

    def read_head(self, repo_path: Path) -> LocalDeliveryHead:
        return self.head

    def collect_patch(
        self,
        worker_repo_path: Path,
        almanac_root: Path,
    ) -> LocalDeliveryPatch:
        return LocalDeliveryPatch(
            patch_text="diff --git a/almanac/pages/a.md b/almanac/pages/a.md\n",
            changed_paths=(Path("almanac/pages/a.md"),),
        )

    def apply_patch_and_commit(
        self,
        repo_path: Path,
        almanac_root: Path,
        patch_text: str,
        commit_subject: str,
        commit_body: str | None,
    ) -> LocalDeliveryCommit:
        self.apply_calls.append(
            (repo_path, almanac_root, patch_text, commit_subject, commit_body)
        )
        return self.commit

    def apply_patch_to_working_tree(
        self,
        repo_path: Path,
        almanac_root: Path,
        patch_text: str,
    ) -> LocalDeliveryWorkingTree:
        self.working_tree_calls.append((repo_path, almanac_root, patch_text))
        return LocalDeliveryWorkingTree(
            changed_paths=(Path("almanac/pages/a.md"),),
        )


def local_repository_state(repo: Path) -> LocalRepositoryState:
    return LocalRepositoryState(
        cwd=repo,
        available=True,
        repository_root=repo,
        branch_name="dev",
        head_sha="head-1",
        provider="github",
        owner_login="AlmanacCode",
        name="codealmanac",
        full_name="AlmanacCode/codealmanac",
        default_branch="main",
    )


def test_cli_open_commands_use_current_checkout_and_browser_handoff(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    browser = CliBrowserOpener()
    repositories_client = CliCloudRepositoriesClient()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        cloud_auth_client=CliCloudAuthClient(),
        cloud_repositories_client=repositories_client,
        local_repository_probe=CliLocalRepositoryProbe(local_repository_state(repo)),
        browser_opener=browser,
    )
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["login", "--timeout", "0", "--poll-every", "0"]) == 0
    capsys.readouterr()

    assert main(["open", "--app-url", "https://app.example.test", "--no-browser"]) == 0
    open_output = capsys.readouterr()
    assert (
        "url: https://app.example.test/dashboard/accounts/10/repositories/1/wiki\n"
        in open_output.out
    )
    assert browser.opened == []
    assert repositories_client.resolves == ["AlmanacCode/codealmanac"]

    assert main([]) == 0
    bare_output = capsys.readouterr()
    assert (
        "opened: https://www.codealmanac.com/dashboard/accounts/10/repositories/1/wiki\n"
        in bare_output.out
    )
    assert browser.opened == [
        "https://www.codealmanac.com/dashboard/accounts/10/repositories/1/wiki"
    ]

    assert (
        main(
            [
                "repo",
                "setup",
                "--app-url",
                "https://app.example.test",
                "--no-browser",
            ]
        )
        == 0
    )
    setup_output = capsys.readouterr()
    assert (
        "url: https://app.example.test/setup/repo?"
        "provider=github&owner=AlmanacCode&repo=codealmanac\n" in setup_output.out
    )

    assert (
        main(
            [
                "repo",
                "open",
                "settings",
                "--app-url",
                "https://app.example.test",
                "--no-browser",
            ]
        )
        == 0
    )
    settings_output = capsys.readouterr()
    assert (
        "url: https://app.example.test/setup/repo?"
        "provider=github&owner=AlmanacCode&repo=codealmanac&target=settings\n"
        in settings_output.out
    )

    assert (
        main(
            [
                "repo",
                "open",
                "github",
                "--no-browser",
                "--json",
            ]
        )
        == 0
    )
    github_output = json.loads(capsys.readouterr().out)
    assert github_output["url"] == "https://github.com/AlmanacCode/codealmanac"
    assert github_output["opened"] is False


def test_cli_open_without_login_prints_public_wiki_resolver(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    browser = CliBrowserOpener()
    repositories_client = CliCloudRepositoriesClient()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        cloud_repositories_client=repositories_client,
        local_repository_probe=CliLocalRepositoryProbe(local_repository_state(repo)),
        browser_opener=browser,
    )
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["open", "--app-url", "https://app.example.test", "--no-browser"]) == 0

    output = capsys.readouterr()
    assert "url: https://app.example.test/wiki/github/AlmanacCode/codealmanac\n" in (
        output.out
    )
    assert browser.opened == []
    assert repositories_client.resolves == []


def test_cli_init_creates_wiki_and_prints_name(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "My Repo"
    repo.mkdir()
    initialize_git(repo)
    adapter = CliInitHarnessAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(adapter,),
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    exit_code = main(
        [
            "init",
            str(repo),
            "--description",
            "cli test",
            "--using",
            "codex",
            "--guidance",
            "Make one page.",
        ]
    )

    captured = capsys.readouterr()
    assert exit_code == 0
    assert "initialized my-repo: done\n" in captured.out
    assert "summary: initialized through CLI\n" in captured.out
    assert "Make one page." in adapter.requests[0].prompt
    assert (repo / "almanac/pages/cli-init-note.md").is_file()
    assert (isolated_home / ".codealmanac/registry.json").is_file()


def test_cli_init_accepts_configured_root(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    initialize_git(repo)
    adapter = CliInitHarnessAdapter()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(adapter,),
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    exit_code = main(["init", str(repo), "--root", "docs/almanac", "--using", "codex"])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert "initialized repo: done\n" in captured.out
    assert "index: 2 pages" in captured.out
    assert adapter.requests[0].cwd == repo
    assert (repo / "docs/almanac/pages/getting-started.md").is_file()


def test_cli_init_background_queues_run_and_spawns_worker(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    initialize_git(repo)
    harness = CliInitHarnessAdapter()
    spawner = CliWorkerSpawner()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json"),
        harness_adapters=(harness,),
        worker_spawner=spawner,
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["init", str(repo), "--using", "codex", "--background", "--json"]) == 0

    output = capsys.readouterr()
    data = json.loads(output.out)
    job = app.jobs.show(ShowJobRequest(cwd=repo, job_id=data["job_id"]))

    assert data["status"] == "queued"
    assert data["child_pid"] == 5151
    assert job.operation == JobOperation.INIT
    assert job.status == JobStatus.QUEUED
    assert harness.requests == []
    assert spawner.requests == [SpawnJobWorkerRequest(cwd=repo, wiki=None)]


def test_cli_build_command_is_not_public():
    parser = build_parser()

    with pytest.raises(SystemExit) as exit_info:
        parser.parse_args(["build"])

    assert exit_info.value.code == 2


def test_cli_setup_and_uninstall_codex_instructions(
    isolated_home: Path,
    capsys,
):
    exit_code = main(["setup", "--yes", "--skip-login", "--target", "codex"])

    captured = capsys.readouterr()
    agents_path = isolated_home / ".codex/AGENTS.md"
    assert exit_code == 0
    assert "CodeAlmanac setup" in captured.out
    assert "\x1b[38;5;255m" in captured.out
    assert "█████" in captured.out
    assert "Cloud setup and agent instructions." in captured.out
    assert "Agent instructions" in captured.out
    assert "codex" in captured.out
    assert "Next steps" in captured.out
    assert "╭" in captured.out
    assert "╰" in captured.out
    assert "codealmanac capture enable" in captured.out
    assert "codealmanac repo setup" in captured.out
    assert "codealmanac automation install" not in captured.out
    assert "Scheduled automation" not in captured.out
    assert CODEALMANAC_START in agents_path.read_text(encoding="utf-8")

    second_exit = main(["setup", "--yes", "--skip-login", "--target", "codex"])
    second = capsys.readouterr()
    assert second_exit == 0
    assert "Codex instructions already installed" in second.out

    uninstall_exit = main(["uninstall", "--yes", "--target", "codex"])
    uninstall = capsys.readouterr()
    assert uninstall_exit == 0
    assert "CodeAlmanac uninstall" in uninstall.out
    assert "Removed artifacts" in uninstall.out
    assert not agents_path.exists()


def test_cli_uninstall_rejects_root_automation_flags():
    parser = build_parser()

    with pytest.raises(SystemExit) as exit_info:
        parser.parse_args(["uninstall", "--keep-automation"])

    assert exit_info.value.code == 2


def test_cli_uninstall_json_has_no_automation_fields(capsys):
    exit_code = main(["uninstall", "--yes", "--json"])

    captured = capsys.readouterr()
    assert exit_code == 0
    payload = json.loads(captured.out)
    assert "kept_automation" not in payload
    assert "automation_uninstall" not in payload


def test_cli_cloud_login_whoami_and_logout(
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    client = CliCloudAuthClient()
    browser = CliBrowserOpener()
    app = create_app(
        AppConfig(auth_path=isolated_home / ".codealmanac/auth.json"),
        cloud_auth_client=client,
        browser_opener=browser,
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    login_exit = main(
        [
            "login",
            "--api-url",
            "https://api.example.test",
            "--timeout",
            "0",
            "--poll-every",
            "0",
        ]
    )
    login = capsys.readouterr()

    whoami_exit = main(["whoami", "--api-url", "https://api.example.test"])
    whoami = capsys.readouterr()

    logout_exit = main(["logout", "--api-url", "https://api.example.test"])
    logout = capsys.readouterr()

    assert login_exit == 0
    assert "Open: https://app.example.test/cli-login" in login.out
    assert "Code: ABCD2345" in login.out
    assert "Signed in as rohans0509" in login.out
    assert whoami_exit == 0
    assert "Signed in as rohans0509" in whoami.out
    assert logout_exit == 0
    assert "Signed out rohans0509" in logout.out
    assert client.started == 1
    assert client.polled == [client.session_id]
    assert client.seen_tokens == ["alm_secret", "alm_secret", "alm_secret"]
    assert browser.opened == []


def test_cli_cloud_auth_store_migrates_legacy_token_field(
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    auth_path = isolated_home / ".codealmanac/auth.json"
    auth_path.parent.mkdir(parents=True)
    auth_path.write_text(
        json.dumps(
            {
                "api_url": "https://api.example.test",
                "token": "legacy_secret",
                "github_user_id": 10,
                "github_login": "rohans0509",
                "logged_in_at": "2026-07-02T12:00:00Z",
            }
        ),
        encoding="utf-8",
    )
    client = CliCloudAuthClient()
    app = create_app(
        AppConfig(auth_path=auth_path),
        cloud_auth_client=client,
        browser_opener=CliBrowserOpener(),
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["whoami", "--api-url", "https://api.example.test"]) == 0
    output = capsys.readouterr()

    assert "Signed in as rohans0509" in output.out
    assert client.seen_tokens == ["legacy_secret"]


def test_cli_setup_is_cloud_first_without_repo_detection(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    outside_repo = tmp_path / "outside"
    outside_repo.mkdir()
    client = CliCloudAuthClient()
    browser = CliBrowserOpener()
    app = create_app(
        AppConfig(auth_path=isolated_home / ".codealmanac/auth.json"),
        cloud_auth_client=client,
        browser_opener=browser,
    )
    monkeypatch.chdir(outside_repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    exit_code = main(
        [
            "setup",
            "--yes",
            "--api-url",
            "https://api.example.test",
            "--login-timeout",
            "0",
            "--login-poll-every",
            "0",
            "--target",
            "codex",
        ]
    )

    output = capsys.readouterr()
    assert exit_code == 0
    assert "Cloud" in output.out
    assert "Open: https://app.example.test/cli-login" in output.out
    assert "Code: ABCD2345" in output.out
    assert "rohans0509" in output.out
    assert "Agent instructions" in output.out
    assert client.started == 1
    assert browser.opened == []


def test_cli_capture_enable_status_hook_and_disable(
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    auth_client = CliCloudAuthClient()
    capture_client = CliCloudCaptureClient()
    app = create_app(
        AppConfig(
            auth_path=isolated_home / ".codealmanac/auth.json",
            capture_path=isolated_home / ".codealmanac/capture.json",
            capture_events_path=isolated_home / ".codealmanac/capture-events",
        ),
        cloud_auth_client=auth_client,
        cloud_capture_client=capture_client,
        browser_opener=CliBrowserOpener(),
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)
    monkeypatch.setattr("codealmanac.capture_hook.create_app", lambda: app)

    assert (
        main(
            [
                "login",
                "--api-url",
                "https://api.example.test",
                "--timeout",
                "0",
                "--poll-every",
                "0",
            ]
        )
        == 0
    )
    capsys.readouterr()

    assert (
        main(
            [
                "capture",
                "enable",
                "--target",
                "codex",
                "--api-url",
                "https://api.example.test",
                "--json",
            ]
        )
        == 0
    )
    enabled = json.loads(capsys.readouterr().out)

    assert enabled["credential_present"] is True
    assert enabled["providers"] == ["codex"]
    assert capture_client.issued == ["CodeAlmanac capture"]
    assert (isolated_home / ".codex/hooks.json").is_file()
    assert "codealmanac-capture-hook --provider codex" in (
        isolated_home / ".codex/hooks.json"
    ).read_text(encoding="utf-8")

    assert (
        main(
            [
                "capture",
                "status",
                "--check-cloud",
                "--api-url",
                "https://api.example.test",
                "--json",
            ]
        )
        == 0
    )
    status = json.loads(capsys.readouterr().out)

    assert status["signed_in"] is True
    assert status["credential_present"] is True
    assert status["hooks"][0]["installed"] is True
    assert status["cloud_credentials"][0]["name"] == "CodeAlmanac capture"

    transcript = isolated_home / "codex-session.jsonl"
    transcript.write_text(
        json.dumps(
            {
                "timestamp": "2026-07-02T12:00:00Z",
                "payload": {"id": "sess_1", "cwd": str(isolated_home)},
            }
        )
        + "\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(
        "sys.stdin",
        StringIO(
            json.dumps(
                {
                    "session_id": "sess_1",
                    "transcript_path": str(transcript),
                    "cwd": str(isolated_home),
                    "hook_event_name": "Stop",
                    "turn_id": "turn_1",
                }
            )
        ),
    )

    assert capture_hook_main(["--provider", "codex"]) == 0
    hook = json.loads(capsys.readouterr().out)

    assert hook["session_id"] == "sess_1"
    assert hook["upload_status"] == "uploaded"
    assert capture_client.artifacts[0].body == transcript.read_bytes()
    assert (
        capture_client.turns[0].artifact_ref
        == "source-artifacts://capture/cli-test.jsonl"
    )
    assert capture_client.turns[0].routing_status == "missing_repo"
    assert (isolated_home / ".codealmanac/capture-events/events.jsonl").is_file()

    assert main(["capture", "inspect", "--json"]) == 0
    inspect = json.loads(capsys.readouterr().out)

    assert inspect["events"][0]["session_id"] == "sess_1"
    assert inspect["events"][0]["upload_status"] == "uploaded"

    assert (
        main(
            [
                "capture",
                "disable",
                "--target",
                "codex",
                "--api-url",
                "https://api.example.test",
                "--json",
            ]
        )
        == 0
    )
    disabled = json.loads(capsys.readouterr().out)

    assert disabled["credential_removed"] is True
    assert disabled["revoked_remote"] is True
    assert capture_client.revoked == ["cap_secret"]


def test_cli_root_status_reports_cloud_repo_and_capture(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    auth_client = CliCloudAuthClient()
    capture_client = CliCloudCaptureClient()
    repositories_client = CliCloudRepositoriesClient()
    app = create_app(
        AppConfig(
            auth_path=isolated_home / ".codealmanac/auth.json",
            capture_path=isolated_home / ".codealmanac/capture.json",
            capture_events_path=isolated_home / ".codealmanac/capture-events",
        ),
        cloud_auth_client=auth_client,
        cloud_capture_client=capture_client,
        cloud_repositories_client=repositories_client,
        browser_opener=CliBrowserOpener(),
        local_repository_probe=CliLocalRepositoryProbe(local_repository_state(repo)),
    )
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert (
        main(
            [
                "login",
                "--api-url",
                "https://api.example.test",
                "--timeout",
                "0",
                "--poll-every",
                "0",
            ]
        )
        == 0
    )
    capsys.readouterr()

    assert (
        main(
            [
                "capture",
                "enable",
                "--target",
                "codex",
                "--api-url",
                "https://api.example.test",
                "--json",
            ]
        )
        == 0
    )
    capsys.readouterr()

    assert (
        main(
            [
                "status",
                "--check-cloud",
                "--api-url",
                "https://api.example.test",
            ]
        )
        == 0
    )
    output = capsys.readouterr()

    assert "Cloud: signed in as rohans0509\n" in output.out
    assert "Repository: AlmanacCode/codealmanac dev\n" in output.out
    assert "Triggers: 1\n" in output.out
    assert "Capture: credential installed\n" in output.out
    assert "Providers: codex\n" in output.out
    assert "Capture cloud credentials: 1 active\n" in output.out
    assert repositories_client.resolves == ["AlmanacCode/codealmanac"]
    assert repositories_client.lists == [1]


def test_cli_root_status_json_reports_signed_out_capture(
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    app = create_app(
        AppConfig(
            auth_path=isolated_home / ".codealmanac/auth.json",
            capture_path=isolated_home / ".codealmanac/capture.json",
            capture_events_path=isolated_home / ".codealmanac/capture-events",
        )
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["status", "--api-url", "https://api.example.test", "--json"]) == 0
    status = json.loads(capsys.readouterr().out)

    assert status["auth"]["authenticated"] is False
    assert status["auth"]["api_url"] == "https://api.example.test"
    assert status["repo"] is None
    assert status["capture"]["signed_in"] is False
    assert status["capture"]["credential_present"] is False


def test_cli_repo_status_triggers_and_delivery(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    auth_client = CliCloudAuthClient()
    repositories_client = CliCloudRepositoriesClient()
    app = create_app(
        AppConfig(auth_path=isolated_home / ".codealmanac/auth.json"),
        cloud_auth_client=auth_client,
        cloud_repositories_client=repositories_client,
        local_repository_probe=CliLocalRepositoryProbe(local_repository_state(repo)),
    )
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert (
        main(
            [
                "login",
                "--api-url",
                "https://api.example.test",
                "--timeout",
                "0",
                "--poll-every",
                "0",
            ]
        )
        == 0
    )
    capsys.readouterr()

    assert (
        main(
            [
                "repo",
                "list",
                "--limit",
                "5",
                "--cursor",
                "0",
                "--api-url",
                "https://api.example.test",
            ]
        )
        == 0
    )
    repos = capsys.readouterr()
    assert "AlmanacCode/codealmanac\t1\t10\n" in repos.out
    assert repositories_client.repo_lists == [(5, "0")]

    assert main(["repo", "status", "--api-url", "https://api.example.test"]) == 0
    status = capsys.readouterr()
    assert "checkout: AlmanacCode/codealmanac dev head-1\n" in status.out
    assert "cloud repository: AlmanacCode/codealmanac\n" in status.out
    assert "triggers: 1\n" in status.out

    assert (
        main(
            [
                "repo",
                "triggers",
                "list",
                "--api-url",
                "https://api.example.test",
            ]
        )
        == 0
    )
    listed = capsys.readouterr()
    assert "main\tenabled\tcommit\n" in listed.out

    assert (
        main(
            [
                "repo",
                "triggers",
                "enable",
                "release/1.4",
                "--delivery",
                "pr",
                "--api-url",
                "https://api.example.test",
                "--json",
            ]
        )
        == 0
    )
    enabled = json.loads(capsys.readouterr().out)
    assert enabled["trigger"]["branch"] == "release/1.4"
    assert enabled["trigger"]["enabled"] is True
    assert enabled["trigger"]["delivery_mode"] == "pr"

    assert (
        main(
            [
                "repo",
                "triggers",
                "disable",
                "release/1.4",
                "--api-url",
                "https://api.example.test",
            ]
        )
        == 0
    )
    disabled = capsys.readouterr()
    assert "branch: release/1.4\n" in disabled.out
    assert "triggers: disabled\n" in disabled.out

    assert (
        main(
            [
                "repo",
                "delivery",
                "set",
                "--branch",
                "release/1.4",
                "--mode",
                "commit",
                "--api-url",
                "https://api.example.test",
            ]
        )
        == 0
    )
    delivery = capsys.readouterr()
    assert "delivery: commit\n" in delivery.out
    assert repositories_client.upserts == [
        (1, "release/1.4", True, "pr"),
        (1, "release/1.4", False, None),
        (1, "release/1.4", None, "commit"),
    ]


def test_cli_cloud_runs_list_show_cancel_and_logs(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    auth_client = CliCloudAuthClient()
    repositories_client = CliCloudRepositoriesClient()
    runs_client = CliCloudRunsClient()
    app = create_app(
        AppConfig(auth_path=isolated_home / ".codealmanac/auth.json"),
        cloud_auth_client=auth_client,
        cloud_repositories_client=repositories_client,
        cloud_runs_client=runs_client,
        local_repository_probe=CliLocalRepositoryProbe(local_repository_state(repo)),
    )
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert (
        main(
            [
                "login",
                "--api-url",
                "https://api.example.test",
                "--timeout",
                "0",
                "--poll-every",
                "0",
            ]
        )
        == 0
    )
    capsys.readouterr()

    assert (
        main(
            [
                "runs",
                "list",
                "--limit",
                "5",
                "--api-url",
                "https://api.example.test",
            ]
        )
        == 0
    )
    listed = capsys.readouterr()
    assert f"{UUID(int=1)}\trunning\tbranch main\tupdating wiki\n" in listed.out
    assert "next_cursor: next\n" in listed.err

    assert (
        main(
            [
                "runs",
                "start",
                "--branch",
                "release/1.4",
                "--api-url",
                "https://api.example.test",
            ]
        )
        == 0
    )
    started = capsys.readouterr()
    assert f"id: {UUID(int=3)}\n" in started.out
    assert "status: running\n" in started.out
    assert "source: branch release/1.4\n" in started.out

    assert (
        main(
            [
                "runs",
                "show",
                str(UUID(int=2)),
                "--api-url",
                "https://api.example.test",
            ]
        )
        == 0
    )
    detail = capsys.readouterr()
    assert f"id: {UUID(int=2)}\n" in detail.out
    assert "status: running\n" in detail.out
    assert "- almanac/pages/api.md\n" in detail.out

    assert (
        main(
            [
                "runs",
                "cancel",
                str(UUID(int=2)),
                "--api-url",
                "https://api.example.test",
            ]
        )
        == 0
    )
    cancelled = capsys.readouterr()
    assert f"id: {UUID(int=2)}\n" in cancelled.out
    assert "status: cancelled\n" in cancelled.out
    assert "summary: cancelled by user\n" in cancelled.out

    assert (
        main(
            [
                "runs",
                "retry",
                str(UUID(int=2)),
                "--api-url",
                "https://api.example.test",
            ]
        )
        == 0
    )
    retried = capsys.readouterr()
    assert f"id: {UUID(int=4)}\n" in retried.out
    assert "status: running\n" in retried.out
    assert "summary: retry started\n" in retried.out

    assert (
        main(
            [
                "runs",
                "logs",
                str(UUID(int=2)),
                "--api-url",
                "https://api.example.test",
                "--json",
            ]
        )
        == 0
    )
    events = json.loads(capsys.readouterr().out)

    assert events[0]["message"] == "running"
    assert runs_client.lists == [(1, 5, None)]
    assert runs_client.starts == [(1, "release/1.4")]
    assert runs_client.reads == [UUID(int=2)]
    assert runs_client.cancels == [UUID(int=2)]
    assert runs_client.retries == [UUID(int=2)]
    assert runs_client.logs == [UUID(int=2)]


def test_cli_local_setup_registers_current_checkout(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    probe = CliLocalRepositoryProbe(
        LocalRepositoryState(
            cwd=repo,
            available=True,
            repository_root=repo,
            branch_name="dev",
            head_sha="head-1",
            provider="github",
            owner_login="AlmanacCode",
            name="codealmanac",
            full_name="AlmanacCode/codealmanac",
            default_branch="main",
        )
    )
    app = create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            control_db_path=isolated_home / ".codealmanac/control.sqlite",
        ),
        local_repository_probe=probe,
    )
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert (
        main(
            [
                "local",
                "setup",
                "--delivery",
                "working-tree",
                "--skip-hooks",
                "--json",
            ]
        )
        == 0
    )

    output = capsys.readouterr()
    data = json.loads(output.out)

    assert data["repository"]["full_name"] == "AlmanacCode/codealmanac"
    assert data["branch"]["name"] == "dev"
    assert data["branch"]["delivery_mode"] == "working_tree"
    assert data["hooks"] is None
    assert probe.requests == [repo]


def test_cli_local_status_reports_current_checkout(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    probe = CliLocalRepositoryProbe(local_repository_state(repo))
    app = create_app(
        AppConfig(control_db_path=isolated_home / ".codealmanac/control.sqlite"),
        local_repository_probe=probe,
    )
    repository = app.control.upsert_repository(
        UpsertRepositoryRequest(
            provider="github",
            owner_login="AlmanacCode",
            name="codealmanac",
            full_name="AlmanacCode/codealmanac",
            almanac_root=Path("almanac"),
            local_root_path=repo,
        )
    )
    app.control.set_branch_policy(
        SetBranchPolicyRequest(repository_id=repository.id, name="dev")
    )
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["local", "status"]) == 0

    output = capsys.readouterr()

    assert "checkout: AlmanacCode/codealmanac dev head-1\n" in output.out
    assert "repository: configured AlmanacCode/codealmanac\n" in output.out
    assert "branch: configured dev\n" in output.out
    assert "delivery: commit\n" in output.out


def test_cli_local_triggers_list_and_enable(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(control_db_path=isolated_home / ".codealmanac/control.sqlite"),
        local_repository_probe=CliLocalRepositoryProbe(local_repository_state(repo)),
    )
    repository = app.control.upsert_repository(
        UpsertRepositoryRequest(
            provider="github",
            owner_login="AlmanacCode",
            name="codealmanac",
            full_name="AlmanacCode/codealmanac",
            almanac_root=Path("almanac"),
            local_root_path=repo,
        )
    )
    app.control.set_branch_policy(
        SetBranchPolicyRequest(
            repository_id=repository.id,
            name="dev",
            trigger_enabled=False,
            delivery_mode=ControlDeliveryMode.WORKING_TREE,
        )
    )
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["local", "triggers", "list"]) == 0
    list_output = capsys.readouterr()
    assert "dev\tdisabled\tworking-tree\n" in list_output.out

    assert (
        main(
            [
                "local",
                "triggers",
                "enable",
                "main",
                "--delivery",
                "working-tree",
                "--json",
            ]
        )
        == 0
    )
    enable_output = capsys.readouterr()
    data = json.loads(enable_output.out)

    assert data["branch"]["name"] == "main"
    assert data["branch"]["trigger_enabled"] is True
    assert data["branch"]["delivery_mode"] == "working_tree"


def test_cli_local_delivery_set_and_trigger_disable(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(control_db_path=isolated_home / ".codealmanac/control.sqlite"),
        local_repository_probe=CliLocalRepositoryProbe(local_repository_state(repo)),
    )
    repository = app.control.upsert_repository(
        UpsertRepositoryRequest(
            provider="github",
            owner_login="AlmanacCode",
            name="codealmanac",
            full_name="AlmanacCode/codealmanac",
            almanac_root=Path("almanac"),
            local_root_path=repo,
        )
    )
    app.control.set_branch_policy(
        SetBranchPolicyRequest(repository_id=repository.id, name="dev")
    )
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert (
        main(
            [
                "local",
                "delivery",
                "set",
                "--branch",
                "dev",
                "--mode",
                "working-tree",
            ]
        )
        == 0
    )
    delivery_output = capsys.readouterr()
    assert "branch: dev\n" in delivery_output.out
    assert "triggers: enabled\n" in delivery_output.out
    assert "delivery: working-tree\n" in delivery_output.out

    assert main(["local", "triggers", "disable", "dev", "--json"]) == 0
    disable_output = capsys.readouterr()
    data = json.loads(disable_output.out)

    assert data["branch"]["trigger_enabled"] is False
    assert data["branch"]["delivery_mode"] == "working_tree"


def test_cli_local_jobs_list_show_and_logs(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(control_db_path=isolated_home / ".codealmanac/control.sqlite")
    )
    repository = app.control.upsert_repository(
        UpsertRepositoryRequest(
            provider="github",
            owner_login="AlmanacCode",
            name="codealmanac",
            full_name="AlmanacCode/codealmanac",
            almanac_root=Path("almanac"),
            local_root_path=repo,
        )
    )
    branch = app.control.set_branch_policy(
        SetBranchPolicyRequest(repository_id=repository.id, name="dev")
    )
    run = app.control.create_run(
        CreateControlRunRequest(
            repository_id=repository.id,
            branch_id=branch.id,
            expected_head_sha="head-1",
        )
    )
    succeeded = app.control.update_run(
        UpdateControlRunRequest(
            run_id=run.id,
            status=ControlRunStatus.SUCCEEDED,
            summary="updated local wiki",
        )
    )
    app.control.append_run_event(
        AppendControlRunEventRequest(
            run_id=run.id,
            kind=ControlRunEventKind.STATUS,
            message="delivered local commit head-2",
        )
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["local", "runs", "list", "--json"]) == 0
    list_output = capsys.readouterr()
    list_data = json.loads(list_output.out)

    assert list_data[0]["run"]["id"] == succeeded.id
    assert list_data[0]["repository"]["full_name"] == "AlmanacCode/codealmanac"
    assert list_data[0]["branch"]["name"] == "dev"

    assert main(["local", "runs", "show", run.id]) == 0
    show_output = capsys.readouterr()
    assert f"id: {run.id}\n" in show_output.out
    assert "repo: AlmanacCode/codealmanac\n" in show_output.out
    assert "summary: updated local wiki\n" in show_output.out

    assert main(["local", "runs", "logs", run.id]) == 0
    logs_output = capsys.readouterr()
    assert "1\tstatus\tdelivered local commit head-2\n" in logs_output.out


def test_cli_local_runs_start_runs_manual_local_worker(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    harness = CliLocalWorkerHarnessAdapter()
    delivery = CliLocalDeliveryManager()
    app = create_app(
        AppConfig(
            control_db_path=isolated_home / ".codealmanac/control.sqlite",
            run_artifacts_path=isolated_home / ".codealmanac/runs",
            engine_workspaces_path=isolated_home / ".codealmanac/workspaces",
        ),
        local_repository_probe=CliLocalRepositoryProbe(local_repository_state(repo)),
        git_worktree_manager=CliGitWorktreeManager(),
        harness_adapters=(harness,),
        git_delivery_manager=delivery,
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
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["local", "runs", "start", "--json"]) == 0

    output = capsys.readouterr()
    data = json.loads(output.out)

    assert data["started"] is True
    assert data["trigger"]["kind"] == "manual"
    assert data["worker"]["processed"] is True
    assert data["worker"]["run"]["status"] == "succeeded"
    assert harness.requests[0].cwd == (
        isolated_home / ".codealmanac/workspaces" / data["worker"]["run"]["id"] / "repo"
    )
    assert delivery.apply_calls[0][3] == "docs almanac: update local worker note"


def test_cli_setup_skip_instructions_json(capsys):
    exit_code = main(
        ["setup", "--yes", "--skip-login", "--skip-instructions", "--json"]
    )

    captured = capsys.readouterr()
    assert exit_code == 0
    payload = json.loads(captured.out)
    assert payload["skipped_instructions"] is True
    assert payload["changes"] == []
    assert payload["plan"]["default_harness"] == "codex"
    assert payload["plan"]["instruction_targets"] == ["codex", "claude"]
    assert "automation" not in payload["plan"]
    assert "automation_install" not in payload
    assert ["codealmanac", "capture", "enable"] in [
        command["command"] for command in payload["plan"]["next_commands"]
    ]


def test_cli_setup_rejects_root_automation_flags():
    parser = build_parser()

    with pytest.raises(SystemExit) as exit_info:
        parser.parse_args(
            [
                "setup",
                "--yes",
                "--skip-login",
                "--install-automation",
                "--sync-every",
                "1m",
            ]
        )

    assert exit_info.value.code == 2


def test_cli_setup_yes_does_not_force_browser_open():
    parser = build_parser()

    yes_args = parser.parse_args(["setup", "--yes"])
    no_browser_args = parser.parse_args(["setup", "--no-browser"])
    json_args = parser.parse_args(["setup", "--json"])

    assert setup_login_browser_mode(yes_args) == "prompt"
    assert setup_login_browser_mode(no_browser_args) == "never"
    assert setup_login_browser_mode(json_args) == "silent"


def test_cli_list_outputs_registered_wikis(
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
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    exit_code = main(["list"])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert captured.out == f"repo\t{repo}\talmanac\n"


def test_cli_list_json_reports_registry_status(
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
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["list", "--json"]) == 0

    captured = capsys.readouterr()
    assert '"name": "repo"' in captured.out
    assert '"almanac_root": "almanac"' in captured.out
    assert '"status": "available"' in captured.out


def test_cli_list_drop_removes_selected_wiki(
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
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["list", "--drop", "repo"]) == 0
    drop_output = capsys.readouterr()
    assert drop_output.out == f"dropped repo\t{repo}\talmanac\n"

    assert main(["list"]) == 0
    list_output = capsys.readouterr()
    assert list_output.out == ""


def test_cli_list_drop_missing_removes_unreachable_wikis(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    live_repo = tmp_path / "live"
    missing_repo = tmp_path / "missing"
    live_repo.mkdir()
    missing_repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=live_repo, name="live")
    )
    app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=missing_repo, name="missing")
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)
    shutil.rmtree(missing_repo)

    assert main(["list", "--drop-missing"]) == 0
    drop_output = capsys.readouterr()
    assert drop_output.out == f"dropped missing\t{missing_repo}\talmanac\n"

    assert main(["list"]) == 0
    list_output = capsys.readouterr()
    assert list_output.out == f"live\t{live_repo}\talmanac\n"


def test_cli_reindex_command(
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
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    app.index.ensure_fresh(app.workspaces.resolve(repo).workspace_id)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

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
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=first, name="first")
    )
    app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=second, name="second")
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

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
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    app.index.ensure_fresh(app.workspaces.resolve(repo).workspace_id)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)
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
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    app.index.ensure_fresh(app.workspaces.resolve(repo).workspace_id)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)
    (repo / "almanac/manual/README.md").write_text(
        "local manual edit\n",
        encoding="utf-8",
    )
    monkeypatch.chdir(repo)

    assert main(["doctor"]) == 0

    output = capsys.readouterr()
    assert "info manual differs: README.md" in output.out
    assert "codealmanac init --force refreshes the wiki" in output.out


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


def test_cli_help_is_cloud_first_and_hides_compatibility_commands(capsys):
    parser = build_parser()

    with pytest.raises(SystemExit) as exit_info:
        parser.parse_args(["--help"])

    output = capsys.readouterr()
    assert exit_info.value.code == 0
    assert "CodeAlmanac wikis for GitHub repositories" in output.out
    assert output.out.index("\n    setup") < output.out.index("\n    local")
    assert output.out.index("\n    setup") < output.out.index("\n    status")
    assert output.out.index("\n    status") < output.out.index("\n    local")
    assert output.out.index("\n    repo") < output.out.index("\n    local")
    assert "serve" in output.out
    assert "automation" not in output.out
    assert "jobs" not in output.out
    assert "sync" not in output.out
    assert "ingest" not in output.out
    assert "garden" not in output.out
    assert "dev" not in output.out

    parser.parse_args(["status"])
    with pytest.raises(SystemExit) as jobs_exit:
        parser.parse_args(["jobs"])
    with pytest.raises(SystemExit) as sync_exit:
        parser.parse_args(["sync", "status"])
    with pytest.raises(SystemExit) as automation_exit:
        parser.parse_args(["automation", "status"])
    with pytest.raises(SystemExit) as capture_hook_exit:
        parser.parse_args(["__capture-hook", "--provider", "codex"])
    with pytest.raises(SystemExit) as run_worker_exit:
        parser.parse_args(["__run-worker", "--cwd", "."])
    assert jobs_exit.value.code == 2
    assert sync_exit.value.code == 2
    assert automation_exit.value.code == 2
    assert capture_hook_exit.value.code == 2
    assert run_worker_exit.value.code == 2


def test_cli_local_help_uses_runs_language(capsys):
    parser = build_parser()

    with pytest.raises(SystemExit) as exit_info:
        parser.parse_args(["local", "--help"])

    output = capsys.readouterr()
    assert exit_info.value.code == 0
    assert "runs" in output.out
    assert "triggers" in output.out
    assert "automation" not in output.out
    assert "sync" not in output.out
    assert "update" not in output.out
    assert "jobs" not in output.out


def test_cli_lifecycle_dev_commands_are_hidden_from_public_parser():
    parser = build_parser()

    with pytest.raises(SystemExit) as ingest_exit:
        parser.parse_args(["ingest", "note.md"])
    with pytest.raises(SystemExit) as garden_exit:
        parser.parse_args(["garden"])

    ingest_args = parser.parse_args(["dev", "ingest", "note.md"])
    garden_args = parser.parse_args(["dev", "garden"])

    assert ingest_exit.value.code == 2
    assert garden_exit.value.code == 2
    assert ingest_args.command == "dev"
    assert ingest_args.dev_command == "ingest"
    assert ingest_args.inputs == ["note.md"]
    assert garden_args.command == "dev"
    assert garden_args.dev_command == "garden"


def test_cli_dev_ingest_runs_workflow_with_selected_harness(
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
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert (
        main(
            [
                "dev",
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


def test_cli_dev_ingest_uses_configured_default_harness(
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
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
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

    assert main(["dev", "ingest", "note.md"]) == 0

    output = capsys.readouterr()
    assert "ingested " in output.out
    assert adapter.requests[0].kind == HarnessKind.CODEX
    assert (repo / "almanac/pages/cli-ingest-note.md").is_file()


def test_cli_dev_ingest_background_queues_run_and_spawns_worker(
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
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert (
        main(
            [
                "dev",
                "ingest",
                "note.md",
                "--using",
                "codex",
                "--background",
                "--json",
            ]
        )
        == 0
    )

    output = capsys.readouterr()
    data = json.loads(output.out)
    job = app.jobs.show(ShowJobRequest(cwd=repo, job_id=data["job_id"]))

    assert data["status"] == "queued"
    assert data["child_pid"] == 5151
    assert job.status == JobStatus.QUEUED
    assert harness.requests == []
    assert spawner.requests == [SpawnJobWorkerRequest(cwd=repo, wiki=None)]
    assert (workspace_jobs_path(repo) / f"{job.job_id}.spec.json").is_file()


def test_cli_dev_garden_runs_workflow_with_selected_harness(
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
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert (
        main(
            [
                "dev",
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


def test_cli_dev_garden_background_plain_output(
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
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    monkeypatch.chdir(repo)
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    assert main(["dev", "garden", "--using", "codex", "--background"]) == 0

    output = capsys.readouterr()
    job = app.jobs.list(ListJobsRequest(cwd=repo))[0]

    assert f"queued {job.job_id}: queued" in output.out
    assert "worker_pid: 5151" in output.out
    assert job.operation == JobOperation.GARDEN
    assert harness.requests == []
    assert spawner.requests == [SpawnJobWorkerRequest(cwd=repo, wiki=None)]


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
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    initialize_git(repo)
    commit_all(repo, "initial wiki")
    queued = app.workflows.queue.queue_ingest(
        RunIngestRequest(
            cwd=repo,
            inputs=("note.md",),
            harness=HarnessKind.CODEX,
        )
    )
    monkeypatch.setattr("codealmanac.job_worker.create_app", lambda: app)

    assert job_worker_main(["--cwd", str(repo)]) == 0

    job = app.jobs.show(ShowJobRequest(cwd=repo, job_id=queued.job_id))

    assert job.status == JobStatus.DONE
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
    monkeypatch.setattr("codealmanac.local_trigger.create_app", lambda: app)

    assert (
        local_trigger_main(
            [
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


def test_cli_hidden_record_local_trigger_spawns_worker_for_recorded_event(
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
    spawner = CliLocalWorkerSpawner()
    app = create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            control_db_path=isolated_home / ".codealmanac/control.sqlite",
        ),
        local_git_state_probe=probe,
        local_worker_spawner=spawner,
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
    branch = app.control.set_branch_policy(
        SetBranchPolicyRequest(
            repository_id=repository.id,
            name="dev",
            trigger_enabled=True,
            delivery_mode=ControlDeliveryMode.COMMIT,
        )
    )
    monkeypatch.setattr("codealmanac.local_trigger.create_app", lambda: app)

    assert (
        local_trigger_main(
            [
                "--cwd",
                str(repo),
                "--kind",
                "local_post_commit",
                "--spawn-worker",
                "--json",
            ]
        )
        == 0
    )

    output = capsys.readouterr()
    data = json.loads(output.out)

    assert data["recorded"] is True
    assert data["worker"]["child_pid"] == 6262
    assert spawner.requests == [
        SpawnLocalWorkerRequest(
            cwd=repo,
            repository_id=repository.id,
            branch_id=branch.id,
        )
    ]


def test_cli_hidden_record_local_trigger_does_not_spawn_worker_when_ignored(
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
    spawner = CliLocalWorkerSpawner()
    app = create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            control_db_path=isolated_home / ".codealmanac/control.sqlite",
        ),
        local_git_state_probe=probe,
        local_worker_spawner=spawner,
    )
    app.control.upsert_repository(
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
    monkeypatch.setattr("codealmanac.local_trigger.create_app", lambda: app)

    assert (
        local_trigger_main(
            [
                "--cwd",
                str(repo),
                "--kind",
                "local_post_commit",
                "--spawn-worker",
                "--json",
            ]
        )
        == 0
    )

    output = capsys.readouterr()
    data = json.loads(output.out)

    assert data["recorded"] is False
    assert data["reason"] == "branch_not_configured"
    assert "worker" not in data
    assert spawner.requests == []


def test_cli_hidden_run_local_worker_returns_json_noop(
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    app = create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            control_db_path=isolated_home / ".codealmanac/control.sqlite",
        )
    )
    monkeypatch.setattr("codealmanac.local_worker.create_app", lambda: app)

    assert local_worker_main(["--json"]) == 0

    output = capsys.readouterr()
    data = json.loads(output.out)

    assert data["processed"] is False
    assert data["reason"] == "no_pending_trigger"
    assert data["run"] is None


def test_cli_hidden_run_local_worker_processes_one_trigger(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    harness = CliLocalWorkerHarnessAdapter()
    delivery = CliLocalDeliveryManager()
    app = create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            control_db_path=isolated_home / ".codealmanac/control.sqlite",
            run_artifacts_path=isolated_home / ".codealmanac/runs",
            engine_workspaces_path=isolated_home / ".codealmanac/workspaces",
        ),
        git_worktree_manager=CliGitWorktreeManager(),
        harness_adapters=(harness,),
        git_delivery_manager=delivery,
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
    branch = app.control.set_branch_policy(
        SetBranchPolicyRequest(
            repository_id=repository.id,
            name="dev",
            trigger_enabled=True,
            delivery_mode=ControlDeliveryMode.COMMIT,
        )
    )
    app.control.record_trigger_event(
        RecordTriggerEventRequest(
            repository_id=repository.id,
            branch_name="dev",
            kind=TriggerEventKind.LOCAL_POST_COMMIT,
            head_sha="head-1",
        )
    )
    monkeypatch.setattr("codealmanac.local_worker.create_app", lambda: app)

    assert (
        local_worker_main(
            [
                "--repository-id",
                repository.id,
                "--branch-id",
                branch.id,
                "--json",
            ]
        )
        == 0
    )

    output = capsys.readouterr()
    data = json.loads(output.out)

    assert data["processed"] is True
    assert data["run"]["status"] == ControlRunStatus.SUCCEEDED.value
    assert data["engine"]["executed"] is True
    assert data["delivery"]["delivered"] is True
    assert harness.requests[0].cwd == (
        isolated_home / ".codealmanac/workspaces" / data["run"]["id"] / "repo"
    )
    assert delivery.apply_calls[0][3] == "docs almanac: update local worker note"


def test_cli_search_and_show_read_current_repo_wiki(
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
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)
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
