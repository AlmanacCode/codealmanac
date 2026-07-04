import json
from pathlib import Path

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.engine.workspaces.models import GitWorktreeCheckout
from codealmanac.local.control.models import (
    ControlRunEventKind,
    ControlRunStatus,
    SessionProvider,
    TriggerEventKind,
    TriggerEventStatus,
)
from codealmanac.local.control.requests import (
    LinkTurnBranchRequest,
    ListControlRunEventsRequest,
    ListTriggerEventsRequest,
    RecordTriggerEventRequest,
    SetBranchPolicyRequest,
    UpsertRepositoryRequest,
    UpsertSessionRequest,
    UpsertTurnRequest,
)


class FakeGitWorktreeManager:
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


def test_prepare_next_local_run_returns_noop_without_pending_trigger(
    isolated_home: Path,
):
    app = local_run_app(isolated_home)

    result = app.workflows.local_run_preparation.prepare_next()

    assert result.prepared is False
    assert result.reason == "no_pending_trigger"
    assert result.run is None


def test_prepare_next_local_run_claims_trigger_and_prepares_engine_request(
    tmp_path: Path,
    isolated_home: Path,
):
    app = local_run_app(isolated_home)
    repo_path = tmp_path / "repo"
    repo_path.mkdir()
    repository = register_repository(app, repo_path)
    branch = app.control.set_branch_policy(
        SetBranchPolicyRequest(repository_id=repository.id, name="dev")
    )
    transcript = tmp_path / "session.jsonl"
    transcript.write_text('{"role":"user","content":"update docs"}\n', "utf-8")
    session = app.control.upsert_session(
        UpsertSessionRequest(
            provider=SessionProvider.CODEX,
            provider_session_id="codex-session",
            source_ref=transcript.as_uri(),
        )
    )
    turn = app.control.upsert_turn(
        UpsertTurnRequest(session_id=session.id, sequence=1)
    )
    app.control.link_turn_branch(
        LinkTurnBranchRequest(
            turn_id=turn.id,
            branch_id=branch.id,
            detector="test",
        )
    )
    trigger = app.control.record_trigger_event(
        RecordTriggerEventRequest(
            repository_id=repository.id,
            branch_name="dev",
            kind=TriggerEventKind.LOCAL_POST_COMMIT,
            head_sha="abc123",
        )
    )

    result = app.workflows.local_run_preparation.prepare_next()

    assert result.prepared is True
    assert result.trigger is not None
    assert result.trigger.id == trigger.event.id
    assert result.repository == repository
    assert result.branch is not None
    assert result.branch.id == branch.id
    assert result.run is not None
    assert result.run.status is ControlRunStatus.QUEUED
    assert result.run.source_bundle_ref is not None
    assert result.run.request_ref is not None
    assert result.run.source_bundle_ref.startswith("file://")
    assert result.run.request_ref.startswith("file://")
    assert result.engine_workspace is not None
    assert result.engine_workspace.paths.repo_path.is_dir()
    assert result.engine_workspace.paths.sources_path.is_dir()
    assert result.engine_workspace.paths.run_path.is_dir()
    assert result.source_bundle is not None
    assert result.source_bundle.root_path == result.engine_workspace.paths.sources_path
    assert result.source_bundle.session_count == 1
    assert result.source_bundle.manifest_path.is_file()
    bundle_session = result.source_bundle.manifest.sessions[0]
    copied_session = result.source_bundle.root_path / bundle_session.path
    manifest = json.loads(
        result.source_bundle.manifest_path.read_text(encoding="utf-8")
    )
    assert copied_session.read_text("utf-8") == (
        '{"role":"user","content":"update docs"}\n'
    )
    assert manifest["sessions"][0]["provider_session_id"] == "codex-session"
    assert result.engine_run is not None
    assert result.engine_run.paths.request_path.is_file()
    assert result.engine_run.request.repo_path == (
        result.engine_workspace.paths.repo_path
    )
    assert result.engine_run.request.sources_path == (
        result.engine_workspace.paths.sources_path
    )
    assert result.engine_run.request.source_bundle_ref == result.run.source_bundle_ref

    events = app.control.list_trigger_events(
        ListTriggerEventsRequest(statuses=(TriggerEventStatus.CLAIMED,))
    )
    run_events = app.control.list_run_events(
        ListControlRunEventsRequest(run_id=result.run.id)
    )

    assert tuple(event.id for event in events) == (trigger.event.id,)
    assert tuple(event.kind for event in run_events) == (
        ControlRunEventKind.STATUS,
        ControlRunEventKind.STATUS,
    )
    assert run_events[0].message == "materialized local source bundle with 1 sessions"
    assert run_events[0].artifact_ref == result.run.source_bundle_ref
    assert run_events[1].message == "prepared local engine workspace"
    assert run_events[1].artifact_ref == result.run.request_ref


def test_prepare_next_local_run_marks_claimed_run_failed_without_local_root(
    isolated_home: Path,
):
    app = local_run_app(isolated_home)
    repository = register_repository(app, None)
    app.control.set_branch_policy(
        SetBranchPolicyRequest(repository_id=repository.id, name="dev")
    )
    app.control.record_trigger_event(
        RecordTriggerEventRequest(
            repository_id=repository.id,
            branch_name="dev",
            kind=TriggerEventKind.LOCAL_POST_COMMIT,
            head_sha="abc123",
        )
    )

    result = app.workflows.local_run_preparation.prepare_next()

    assert result.prepared is False
    assert result.reason == "preparation_failed"
    assert result.run is not None
    assert result.run.status is ControlRunStatus.FAILED
    assert result.run.error == "repository local_root_path is required"

    events = app.control.list_run_events(
        ListControlRunEventsRequest(run_id=result.run.id)
    )

    assert tuple(event.kind for event in events) == (ControlRunEventKind.ERROR,)
    assert events[0].message == "repository local_root_path is required"


def local_run_app(isolated_home: Path):
    return create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            control_db_path=isolated_home / ".codealmanac/control.sqlite",
            run_artifacts_path=isolated_home / ".codealmanac/runs",
            engine_workspaces_path=isolated_home / ".codealmanac/workspaces",
        ),
        git_worktree_manager=FakeGitWorktreeManager(),
    )


def register_repository(app, local_root_path: Path | None):
    return app.control.upsert_repository(
        UpsertRepositoryRequest(
            provider="github",
            owner_login="AlmanacCode",
            name="codealmanac",
            full_name="AlmanacCode/codealmanac",
            almanac_root=Path("almanac"),
            local_root_path=local_root_path,
        )
    )
