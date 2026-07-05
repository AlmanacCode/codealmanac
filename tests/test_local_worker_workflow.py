from collections.abc import Callable
from pathlib import Path

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.engine.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
)
from codealmanac.engine.harnesses.requests import RunHarnessRequest
from codealmanac.engine.workspaces.models import GitWorktreeCheckout
from codealmanac.local.control.models import (
    ControlRunStatus,
    TriggerEventKind,
)
from codealmanac.local.control.requests import (
    ListControlRunsRequest,
    RecordTriggerEventRequest,
    SetBranchPolicyRequest,
    UpdateControlRunRequest,
    UpsertRepositoryRequest,
)
from codealmanac.local.delivery.execution.models import (
    LocalDeliveryCommit,
    LocalDeliveryHead,
    LocalDeliveryPatch,
)
from codealmanac.local.runs.worker.requests import RunNextLocalWorkerRequest


class FakeGitWorktreeManager:
    def add_detached(
        self,
        source_repo_path: Path,
        worktree_path: Path,
        commit_sha: str,
    ) -> GitWorktreeCheckout:
        worktree_path.mkdir(parents=True)
        (worktree_path / "almanac/pages").mkdir(parents=True)
        (worktree_path / "almanac/topics.yaml").write_text(
            "topics: []\n",
            encoding="utf-8",
        )
        return GitWorktreeCheckout(repo_path=worktree_path, head_sha=commit_sha)

    def remove(self, source_repo_path: Path, worktree_path: Path) -> None:
        return None


class FakeHarnessAdapter:
    kind = HarnessKind.CODEX

    def __init__(
        self,
        result: HarnessRunResult,
        on_run: Callable[[], None] | None = None,
    ):
        self.result = result
        self.on_run = on_run
        self.requests: list[RunHarnessRequest] = []

    def check(self) -> HarnessReadiness:
        return HarnessReadiness(
            kind=self.kind,
            available=True,
            message="fake ready",
        )

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        self.requests.append(request)
        if self.on_run is not None:
            self.on_run()
        for path in self.result.changed_files:
            target = request.cwd / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("# Updated\n", encoding="utf-8")
        return self.result


class InvalidWikiHarnessAdapter(FakeHarnessAdapter):
    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        self.requests.append(request)
        page = request.cwd / "almanac/pages/a.md"
        page.parent.mkdir(parents=True, exist_ok=True)
        page.write_text(
            """---
title: Invalid Local Page
sources:
  - id: local
    type: file
    path: src/app.py
    note: Records the boundary: bad YAML.
---
# Invalid Local Page
""",
            encoding="utf-8",
        )
        return self.result


class FakeGitDeliveryManager:
    def __init__(self):
        self.head = LocalDeliveryHead(branch_name="dev", head_sha="head-1")
        self.patch = LocalDeliveryPatch(
            patch_text="diff --git a/almanac/pages/a.md b/almanac/pages/a.md\n",
            changed_paths=(Path("almanac/pages/a.md"),),
        )
        self.commit = LocalDeliveryCommit(commit_sha="head-2")
        self.read_calls: list[Path] = []
        self.collect_calls: list[tuple[Path, Path]] = []
        self.apply_calls: list[tuple[Path, Path, str, str, str | None]] = []

    def read_head(self, repo_path: Path) -> LocalDeliveryHead:
        self.read_calls.append(repo_path)
        return self.head

    def collect_patch(
        self,
        worker_repo_path: Path,
        almanac_root: Path,
    ) -> LocalDeliveryPatch:
        self.collect_calls.append((worker_repo_path, almanac_root))
        return self.patch

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


def test_local_worker_returns_noop_without_pending_trigger(isolated_home: Path):
    fake_harness = FakeHarnessAdapter(success_result())
    fake_delivery = FakeGitDeliveryManager()
    app, _repo_path, _repository, _branch = local_worker_app(
        isolated_home,
        fake_harness,
        fake_delivery,
    )

    result = app.workflows.local_worker.run_next()

    assert result.processed is False
    assert result.reason == "no_pending_trigger"
    assert result.run is None
    assert fake_harness.requests == []
    assert fake_delivery.apply_calls == []


def test_local_worker_prepares_executes_and_delivers_one_trigger(
    isolated_home: Path,
):
    fake_harness = FakeHarnessAdapter(success_result())
    fake_delivery = FakeGitDeliveryManager()
    app, repo_path, repository, _branch = local_worker_app(
        isolated_home,
        fake_harness,
        fake_delivery,
    )
    record_trigger(app, repository.id, "head-1")

    result = app.workflows.local_worker.run_next(
        RunNextLocalWorkerRequest(title="Local update")
    )

    assert result.processed is True
    assert result.reason is None
    assert result.preparation is not None
    assert result.engine is not None
    assert result.delivery is not None
    assert result.delivery.delivered is True
    assert result.run is not None
    assert result.run.status is ControlRunStatus.SUCCEEDED
    assert fake_harness.requests[0].cwd == (
        result.preparation.engine_workspace.paths.repo_path
    )
    assert fake_harness.requests[0].title == "Local update"
    assert fake_delivery.read_calls == [repo_path]
    assert fake_delivery.apply_calls[0][0] == repo_path
    assert fake_delivery.apply_calls[0][3] == "docs almanac: update wiki page"
    assert not result.preparation.engine_workspace.paths.root_path.exists()


def test_local_worker_marks_claimed_run_failed_when_preparation_fails(
    isolated_home: Path,
):
    fake_harness = FakeHarnessAdapter(success_result())
    fake_delivery = FakeGitDeliveryManager()
    app, _repo_path, repository, _branch = local_worker_app(
        isolated_home,
        fake_harness,
        fake_delivery,
        has_local_root=False,
    )
    record_trigger(app, repository.id, "head-1")

    result = app.workflows.local_worker.run_next()

    assert result.processed is True
    assert result.reason == "preparation_failed"
    assert result.run is not None
    assert result.run.status is ControlRunStatus.FAILED
    assert result.engine is None
    assert result.delivery is None
    assert fake_harness.requests == []
    assert fake_delivery.apply_calls == []


def test_local_worker_skips_delivery_when_engine_fails(isolated_home: Path):
    fake_harness = FakeHarnessAdapter(
        HarnessRunResult(
            kind=HarnessKind.CODEX,
            status=HarnessRunStatus.FAILED,
            output_text="engine failed",
            summary="engine failed",
        )
    )
    fake_delivery = FakeGitDeliveryManager()
    app, _repo_path, repository, _branch = local_worker_app(
        isolated_home,
        fake_harness,
        fake_delivery,
    )
    record_trigger(app, repository.id, "head-1")

    result = app.workflows.local_worker.run_next()

    assert result.processed is True
    assert result.reason == "engine_failed"
    assert result.run is not None
    assert result.run.status is ControlRunStatus.FAILED
    assert result.engine is not None
    assert result.delivery is None
    assert fake_delivery.apply_calls == []
    assert not result.preparation.engine_workspace.paths.root_path.exists()


def test_local_worker_skips_delivery_when_run_is_cancelled_during_engine(
    isolated_home: Path,
):
    fake_delivery = FakeGitDeliveryManager()
    fake_harness = FakeHarnessAdapter(success_result())
    app, _repo_path, repository, _branch = local_worker_app(
        isolated_home,
        fake_harness,
        fake_delivery,
    )

    def cancel_running_run() -> None:
        running = app.control.list_runs(
            ListControlRunsRequest(
                statuses=(ControlRunStatus.RUNNING,),
                limit=1,
            )
        )[0]
        app.control.update_run(
            UpdateControlRunRequest(
                run_id=running.id,
                status=ControlRunStatus.CANCELLED,
                error="cancelled by user",
            )
        )

    fake_harness.on_run = cancel_running_run
    record_trigger(app, repository.id, "head-1")

    result = app.workflows.local_worker.run_next()

    assert result.processed is True
    assert result.reason == "run_cancelled"
    assert result.run is not None
    assert result.run.status is ControlRunStatus.CANCELLED
    assert result.delivery is None
    assert fake_delivery.apply_calls == []
    assert not result.preparation.engine_workspace.paths.root_path.exists()


def test_local_worker_skips_delivery_when_engine_writes_invalid_wiki(
    isolated_home: Path,
):
    fake_harness = InvalidWikiHarnessAdapter(success_result())
    fake_delivery = FakeGitDeliveryManager()
    app, _repo_path, repository, _branch = local_worker_app(
        isolated_home,
        fake_harness,
        fake_delivery,
    )
    record_trigger(app, repository.id, "head-1")

    result = app.workflows.local_worker.run_next()

    assert result.processed is True
    assert result.reason == "engine_failed"
    assert result.run is not None
    assert result.run.status is ControlRunStatus.FAILED
    assert result.run.error is not None
    assert result.run.error.startswith("wiki validation failed:")
    assert result.delivery is None
    assert fake_delivery.apply_calls == []


def test_local_worker_skips_delivery_when_run_stales_during_engine(
    isolated_home: Path,
):
    fake_delivery = FakeGitDeliveryManager()
    stale_recorder: dict[str, Callable[[], None] | None] = {"callback": None}
    fake_harness = FakeHarnessAdapter(
        success_result(),
        on_run=lambda: stale_recorder["callback"](),
    )
    app, _repo_path, repository, _branch = local_worker_app(
        isolated_home,
        fake_harness,
        fake_delivery,
    )
    stale_recorder["callback"] = lambda: record_trigger(app, repository.id, "head-2")
    record_trigger(app, repository.id, "head-1")

    result = app.workflows.local_worker.run_next()

    assert result.processed is True
    assert result.reason == "run_stale"
    assert result.run is not None
    assert result.run.status is ControlRunStatus.STALE
    assert result.delivery is None
    assert fake_delivery.read_calls == []
    assert fake_delivery.apply_calls == []


def local_worker_app(
    isolated_home: Path,
    fake_harness: FakeHarnessAdapter,
    fake_delivery: FakeGitDeliveryManager,
    has_local_root: bool = True,
):
    repo_path = isolated_home / "repo"
    repo_path.mkdir()
    app = create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            control_db_path=isolated_home / ".codealmanac/control.sqlite",
            run_artifacts_path=isolated_home / ".codealmanac/runs",
            engine_workspaces_path=isolated_home / ".codealmanac/workspaces",
        ),
        git_worktree_manager=FakeGitWorktreeManager(),
        harness_adapters=(fake_harness,),
        git_delivery_manager=fake_delivery,
    )
    repository = app.control.upsert_repository(
        UpsertRepositoryRequest(
            provider="github",
            owner_login="AlmanacCode",
            name="codealmanac",
            full_name="AlmanacCode/codealmanac",
            almanac_root=Path("almanac"),
            local_root_path=repo_path if has_local_root else None,
        )
    )
    branch = app.control.set_branch_policy(
        SetBranchPolicyRequest(repository_id=repository.id, name="dev")
    )
    return app, repo_path, repository, branch


def success_result() -> HarnessRunResult:
    return HarnessRunResult(
        kind=HarnessKind.CODEX,
        status=HarnessRunStatus.SUCCEEDED,
        output_text="Update wiki page",
        summary="Update wiki page",
        changed_files=(Path("almanac/pages/a.md"),),
    )


def record_trigger(app, repository_id: str, head_sha: str):
    return app.control.record_trigger_event(
        RecordTriggerEventRequest(
            repository_id=repository_id,
            branch_name="dev",
            kind=TriggerEventKind.LOCAL_POST_COMMIT,
            head_sha=head_sha,
        )
    )
