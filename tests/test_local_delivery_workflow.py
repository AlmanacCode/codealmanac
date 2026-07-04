from pathlib import Path

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.engine.runs.models import (
    EngineRunStatus,
)
from codealmanac.engine.runs.requests import (
    PrepareEngineRunRequest,
    WriteEngineRunResultRequest,
)
from codealmanac.local.control.models import (
    ControlDeliveryMode,
    ControlRunEventKind,
    ControlRunStatus,
)
from codealmanac.local.control.requests import (
    CreateControlRunRequest,
    GetControlRunRequest,
    ListControlRunEventsRequest,
    SetBranchPolicyRequest,
    UpsertRepositoryRequest,
)
from codealmanac.local.delivery.execution.models import (
    LocalDeliveryCommit,
    LocalDeliveryHead,
    LocalDeliveryPatch,
    LocalDeliveryWorkingTree,
)
from codealmanac.local.delivery.execution.requests import DeliverLocalRunRequest
from codealmanac.local.delivery.ledger.models import DeliveryStatus


class FakeGitDeliveryManager:
    def __init__(
        self,
        head: LocalDeliveryHead,
        patch: LocalDeliveryPatch,
        commit: LocalDeliveryCommit | None = None,
    ):
        self.head = head
        self.patch = patch
        self.commit = commit or LocalDeliveryCommit(commit_sha="head-2")
        self.collect_calls: list[tuple[Path, Path]] = []
        self.apply_calls: list[tuple[Path, Path, str, str, str | None]] = []
        self.working_tree_calls: list[tuple[Path, Path, str]] = []

    def read_head(self, repo_path: Path) -> LocalDeliveryHead:
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


def test_local_delivery_applies_patch_and_marks_run_succeeded(
    tmp_path: Path,
    isolated_home: Path,
):
    fake_git = FakeGitDeliveryManager(
        head=LocalDeliveryHead(branch_name="dev", head_sha="head-1"),
        patch=LocalDeliveryPatch(
            patch_text="diff --git a/almanac/pages/a.md b/almanac/pages/a.md\n",
            changed_paths=(Path("almanac/pages/a.md"),),
        ),
    )
    app, run, repo_path = local_delivery_app(tmp_path, isolated_home, fake_git)
    write_engine_result(app, run.id)

    result = app.workflows.local_delivery.deliver(DeliverLocalRunRequest(run_id=run.id))
    events = app.control.list_run_events(ListControlRunEventsRequest(run_id=run.id))

    assert result.delivered is True
    assert result.commit_sha == "head-2"
    assert result.run.status is ControlRunStatus.SUCCEEDED
    assert result.delivery.status is DeliveryStatus.SUCCEEDED
    assert result.delivery.commit_sha == "head-2"
    assert fake_git.apply_calls == [
        (
            repo_path,
            Path("almanac"),
            "diff --git a/almanac/pages/a.md b/almanac/pages/a.md\n",
            "docs almanac: update architecture notes",
            "Updated architecture notes.",
        )
    ]
    assert tuple(event.kind for event in events) == (ControlRunEventKind.STATUS,)
    assert events[0].message == "delivered local commit head-2"


def test_local_delivery_marks_run_stale_when_branch_head_moved(
    tmp_path: Path,
    isolated_home: Path,
):
    fake_git = FakeGitDeliveryManager(
        head=LocalDeliveryHead(branch_name="dev", head_sha="head-2"),
        patch=LocalDeliveryPatch(patch_text="", changed_paths=()),
    )
    app, run, _repo_path = local_delivery_app(tmp_path, isolated_home, fake_git)
    write_engine_result(app, run.id)

    result = app.workflows.local_delivery.deliver(DeliverLocalRunRequest(run_id=run.id))
    stale_run = app.control.get_run(GetControlRunRequest(run_id=run.id))

    assert result.delivered is False
    assert result.reason == "expected_head_changed"
    assert result.delivery.status is DeliveryStatus.SKIPPED
    assert result.delivery.delivered_head_sha == "head-2"
    assert stale_run.status is ControlRunStatus.STALE
    assert fake_git.collect_calls == []
    assert fake_git.apply_calls == []


def test_local_delivery_can_apply_patch_to_working_tree(
    tmp_path: Path,
    isolated_home: Path,
):
    fake_git = FakeGitDeliveryManager(
        head=LocalDeliveryHead(branch_name="dev", head_sha="head-1"),
        patch=LocalDeliveryPatch(
            patch_text="diff --git a/almanac/pages/a.md b/almanac/pages/a.md\n",
            changed_paths=(Path("almanac/pages/a.md"),),
        ),
    )
    app, run, repo_path = local_delivery_app(
        tmp_path,
        isolated_home,
        fake_git,
        delivery_mode=ControlDeliveryMode.WORKING_TREE,
    )
    write_engine_result(app, run.id)

    result = app.workflows.local_delivery.deliver(DeliverLocalRunRequest(run_id=run.id))
    events = app.control.list_run_events(ListControlRunEventsRequest(run_id=run.id))

    assert result.delivered is True
    assert result.commit_sha is None
    assert result.run.status is ControlRunStatus.SUCCEEDED
    assert result.delivery.status is DeliveryStatus.SUCCEEDED
    assert result.delivery.commit_sha is None
    assert result.delivery.delivered_head_sha == "head-1"
    assert fake_git.apply_calls == []
    assert fake_git.working_tree_calls == [
        (
            repo_path,
            Path("almanac"),
            "diff --git a/almanac/pages/a.md b/almanac/pages/a.md\n",
        )
    ]
    assert tuple(event.kind for event in events) == (ControlRunEventKind.STATUS,)
    assert events[0].message == "delivered local working tree changes"


def test_local_delivery_skips_empty_worker_diff(
    tmp_path: Path,
    isolated_home: Path,
):
    fake_git = FakeGitDeliveryManager(
        head=LocalDeliveryHead(branch_name="dev", head_sha="head-1"),
        patch=LocalDeliveryPatch(patch_text="", changed_paths=()),
    )
    app, run, _repo_path = local_delivery_app(tmp_path, isolated_home, fake_git)
    write_engine_result(app, run.id)

    result = app.workflows.local_delivery.deliver(DeliverLocalRunRequest(run_id=run.id))

    assert result.delivered is False
    assert result.reason == "no_wiki_changes"
    assert result.run.status is ControlRunStatus.SUCCEEDED
    assert result.delivery.status is DeliveryStatus.SKIPPED
    assert result.delivery.summary == "no wiki changes to deliver"
    assert fake_git.apply_calls == []


def local_delivery_app(
    tmp_path: Path,
    isolated_home: Path,
    fake_git,
    delivery_mode: ControlDeliveryMode = ControlDeliveryMode.COMMIT,
):
    app = create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            control_db_path=isolated_home / ".codealmanac/control.sqlite",
            run_artifacts_path=isolated_home / ".codealmanac/runs",
            engine_workspaces_path=isolated_home / ".codealmanac/workspaces",
        ),
        git_delivery_manager=fake_git,
    )
    repo_path = tmp_path / "repo"
    repo_path.mkdir()
    repository = app.control.upsert_repository(
        UpsertRepositoryRequest(
            provider="github",
            owner_login="AlmanacCode",
            name="codealmanac",
            full_name="AlmanacCode/codealmanac",
            almanac_root=Path("almanac"),
            local_root_path=repo_path,
        )
    )
    branch = app.control.set_branch_policy(
        SetBranchPolicyRequest(
            repository_id=repository.id,
            name="dev",
            delivery_mode=delivery_mode,
        )
    )
    run = app.control.create_run(
        CreateControlRunRequest(
            repository_id=repository.id,
            branch_id=branch.id,
            expected_head_sha="head-1",
        )
    )
    return app, run, repo_path


def write_engine_result(app, run_id: str) -> None:
    app.engine.runs.prepare(
        PrepareEngineRunRequest(
            run_id=run_id,
            repository_id="repo-1",
            branch_id="branch-1",
            repository_full_name="AlmanacCode/codealmanac",
            branch_name="dev",
            expected_head_sha="head-1",
            repo_path=Path("/tmp/repo"),
            almanac_root=Path("almanac"),
            sources_path=Path("/tmp/sources"),
        )
    )
    app.engine.runs.write_result(
        WriteEngineRunResultRequest(
            run_id=run_id,
            status=EngineRunStatus.SUCCEEDED,
            summary="updated architecture notes",
            commit_subject="docs almanac: update architecture notes",
            commit_body="Updated architecture notes.",
        )
    )
