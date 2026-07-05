from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.core.errors import ValidationFailed
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
    ControlDeliveryMode,
    ControlRunEventKind,
    ControlRunStatus,
    TriggerEventKind,
    TriggerEventStatus,
)
from codealmanac.local.control.requests import (
    AppendControlRunEventRequest,
    CreateControlRunRequest,
    ListControlRunEventsRequest,
    ListTriggerEventsRequest,
    SetBranchPolicyRequest,
    UpsertRepositoryRequest,
)
from codealmanac.local.delivery.execution.models import (
    LocalDeliveryCommit,
    LocalDeliveryHead,
    LocalDeliveryPatch,
    LocalDeliveryWorkingTree,
)
from codealmanac.local.runs.kinds import LocalRunKind
from codealmanac.local.runs.requests import (
    CancelLocalRunRequest,
    RetryLocalRunRequest,
    StartLocalRunRequest,
)
from codealmanac.local.setup.models import LocalRepositoryState
from codealmanac.local.status.requests import ReadLocalStatusRequest


class FakeLocalRepositoryProbe:
    def __init__(self, state: LocalRepositoryState):
        self.state = state

    def read(self, cwd: Path) -> LocalRepositoryState:
        return self.state


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
        page = request.cwd / "almanac/pages/local-update.md"
        page.parent.mkdir(parents=True, exist_ok=True)
        page.write_text("# Local Update\n", encoding="utf-8")
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="Update local wiki",
            summary="Update local wiki",
            changed_files=(Path("almanac/pages/local-update.md"),),
        )


class FakeGitDeliveryManager:
    def __init__(self):
        self.head = LocalDeliveryHead(branch_name="dev", head_sha="head-1")
        self.apply_calls: list[tuple[Path, Path, str, str, str | None]] = []

    def read_head(self, repo_path: Path) -> LocalDeliveryHead:
        return self.head

    def collect_patch(
        self,
        worker_repo_path: Path,
        almanac_root: Path,
    ) -> LocalDeliveryPatch:
        return LocalDeliveryPatch(
            patch_text=(
                "diff --git a/almanac/pages/local-update.md "
                "b/almanac/pages/local-update.md\n"
            ),
            changed_paths=(Path("almanac/pages/local-update.md"),),
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
        return LocalDeliveryCommit(commit_sha="head-2")

    def apply_patch_to_working_tree(
        self,
        repo_path: Path,
        almanac_root: Path,
        patch_text: str,
    ) -> LocalDeliveryWorkingTree:
        raise AssertionError("commit delivery should be used by this test")


def test_local_runs_start_creates_manual_trigger_and_runs_worker(
    tmp_path: Path,
    isolated_home: Path,
):
    app, repo, _harness, delivery = local_runs_app(tmp_path, isolated_home)

    result = app.workflows.local_runs.start(StartLocalRunRequest(cwd=repo))
    events = app.control.list_run_events(
        ListControlRunEventsRequest(run_id=result.worker.run.id)
    )
    triggers = app.control.list_trigger_events(
        ListTriggerEventsRequest(statuses=(TriggerEventStatus.CLAIMED,))
    )

    assert result.started is True
    assert result.trigger is not None
    assert result.trigger.kind is TriggerEventKind.MANUAL
    assert result.worker is not None
    assert result.worker.run is not None
    assert result.worker.run.status is ControlRunStatus.SUCCEEDED
    assert tuple(trigger.id for trigger in triggers) == (result.trigger.id,)
    assert delivery.apply_calls[0][3] == "docs almanac: update local wiki"
    assert tuple(event.kind for event in events) == (
        ControlRunEventKind.STATUS,
        ControlRunEventKind.STATUS,
        ControlRunEventKind.STATUS,
        ControlRunEventKind.OUTPUT,
        ControlRunEventKind.STATUS,
        ControlRunEventKind.STATUS,
    )
    assert tuple(event.message for event in events) == (
        "materialized local source bundle with 0 sessions",
        "prepared local engine workspace",
        "started local engine worker",
        "codex succeeded: Update local wiki",
        "completed local engine worker; delivery pending",
        "delivered local commit head-2",
    )


def test_local_runs_start_can_rerun_same_head_after_previous_success(
    tmp_path: Path,
    isolated_home: Path,
):
    app, repo, _harness, _delivery = local_runs_app(tmp_path, isolated_home)

    first = app.workflows.local_runs.start(StartLocalRunRequest(cwd=repo))
    second = app.workflows.local_runs.start(StartLocalRunRequest(cwd=repo))
    triggers = app.control.list_trigger_events(
        ListTriggerEventsRequest(statuses=(TriggerEventStatus.CLAIMED,))
    )

    assert first.started is True
    assert second.started is True
    assert first.trigger is not None
    assert second.trigger is not None
    assert first.trigger.head_sha == second.trigger.head_sha == "head-1"
    assert len(triggers) == 2


def test_local_runs_start_does_not_start_when_branch_has_active_run(
    tmp_path: Path,
    isolated_home: Path,
):
    app, repo, _harness, _delivery = local_runs_app(tmp_path, isolated_home)
    branch = app.workflows.local_status.status(ReadLocalStatusRequest(cwd=repo)).branch
    assert branch is not None
    active = app.control.create_run(
        CreateControlRunRequest(
            repository_id=branch.repository_id,
            branch_id=branch.id,
            expected_head_sha="head-1",
        )
    )
    app.control.append_run_event(
        AppendControlRunEventRequest(
            run_id=active.id,
            kind=ControlRunEventKind.STATUS,
            message="queued manually",
        )
    )

    result = app.workflows.local_runs.start(StartLocalRunRequest(cwd=repo))

    assert result.started is False
    assert result.reason == "active_run_exists"
    assert result.active_run == active
    assert app.control.list_trigger_events() == ()


def test_local_runs_cancel_marks_active_run_cancelled(
    tmp_path: Path,
    isolated_home: Path,
):
    app, repo, _harness, _delivery = local_runs_app(tmp_path, isolated_home)
    branch = app.workflows.local_status.status(ReadLocalStatusRequest(cwd=repo)).branch
    assert branch is not None
    active = app.control.create_run(
        CreateControlRunRequest(
            repository_id=branch.repository_id,
            branch_id=branch.id,
            expected_head_sha="head-1",
        )
    )

    result = app.workflows.local_runs.cancel(
        CancelLocalRunRequest(run_id=active.id)
    )
    events = app.control.list_run_events(
        ListControlRunEventsRequest(run_id=active.id)
    )

    assert result.run.status is ControlRunStatus.CANCELLED
    assert result.run.error == "cancelled by user"
    assert tuple(event.message for event in events) == ("cancelled local run",)


def test_local_runs_retry_starts_fresh_manual_run_for_same_branch(
    tmp_path: Path,
    isolated_home: Path,
):
    app, repo, _harness, _delivery = local_runs_app(tmp_path, isolated_home)
    first = app.workflows.local_runs.start(StartLocalRunRequest(cwd=repo))
    assert first.worker is not None

    second = app.workflows.local_runs.retry(
        RetryLocalRunRequest(run_id=first.worker.run.id)
    )

    assert second.started is True
    assert second.worker is not None
    assert second.worker.run.id != first.worker.run.id
    assert second.worker.run.status is ControlRunStatus.SUCCEEDED


def test_local_runs_start_requires_configured_branch(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(control_db_path=isolated_home / ".codealmanac/control.sqlite"),
        local_repository_probe=FakeLocalRepositoryProbe(available_state(repo)),
    )

    with pytest.raises(ValidationFailed, match="current checkout is not configured"):
        app.workflows.local_runs.start(StartLocalRunRequest(cwd=repo))


def test_local_runs_start_uses_garden_kind(
    tmp_path: Path,
    isolated_home: Path,
):
    app, repo, harness, _delivery = local_runs_app(tmp_path, isolated_home)

    result = app.workflows.local_runs.start(
        StartLocalRunRequest(cwd=repo, kind=LocalRunKind.GARDEN)
    )

    assert result.started is True
    assert result.worker is not None
    assert result.worker.run is not None
    assert result.worker.run.kind == "garden"
    assert "# Garden Operation" in harness.requests[0].prompt


def local_runs_app(tmp_path: Path, isolated_home: Path):
    repo = tmp_path / "repo"
    repo.mkdir()
    harness = FakeHarnessAdapter()
    delivery = FakeGitDeliveryManager()
    app = create_app(
        AppConfig(
            control_db_path=isolated_home / ".codealmanac/control.sqlite",
            run_artifacts_path=isolated_home / ".codealmanac/runs",
            engine_workspaces_path=isolated_home / ".codealmanac/workspaces",
        ),
        local_repository_probe=FakeLocalRepositoryProbe(available_state(repo)),
        git_worktree_manager=FakeGitWorktreeManager(),
        harness_adapters=(harness,),
        git_delivery_manager=delivery,
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
            trigger_enabled=True,
            delivery_mode=ControlDeliveryMode.COMMIT,
        )
    )
    return app, repo, harness, delivery


def available_state(repo: Path) -> LocalRepositoryState:
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
