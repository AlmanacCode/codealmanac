import sqlite3
from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.core.paths import default_control_db_path
from codealmanac.local.control.models import (
    ControlDeliveryMode,
    ControlRunEventKind,
    ControlRunStatus,
    LocalGitState,
    SessionProvider,
    TriggerEventKind,
    TriggerEventStatus,
)
from codealmanac.local.control.requests import (
    AppendControlRunEventRequest,
    ClaimNextTriggerRequest,
    CreateControlRunRequest,
    FindBranchByNameRequest,
    FindRepositoryByLocalRootRequest,
    GetControlRunRequest,
    LinkTurnBranchRequest,
    ListBranchesRequest,
    ListBranchSessionsRequest,
    ListControlRunEventsRequest,
    ListControlRunsRequest,
    ListTriggerEventsRequest,
    ReadControlSchemaStatusRequest,
    RecordCurrentGitTriggerRequest,
    RecordTriggerEventRequest,
    SetBranchPolicyRequest,
    UpdateControlRunRequest,
    UpsertRepositoryRequest,
    UpsertSessionRequest,
    UpsertTurnRequest,
)
from codealmanac.local.control.schema import (
    CONTROL_SCHEMA_VERSION,
    CONTROL_TABLES,
)
from codealmanac.wiki.index.schema import index_db_path
from codealmanac.wiki.workspaces.requests import InitializeWorkspaceRequest


def test_default_control_db_path_uses_codealmanac_home(isolated_home: Path):
    expected = isolated_home / ".codealmanac/control.sqlite"

    assert default_control_db_path() == expected
    assert AppConfig().control_db_path == expected


def test_control_service_creates_launch_schema(isolated_home: Path):
    path = isolated_home / ".codealmanac/control.sqlite"
    app = create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            control_db_path=path,
        )
    )

    status = app.control.ensure_ready()

    assert path.is_file()
    assert status.path == path
    assert status.user_version == CONTROL_SCHEMA_VERSION
    assert set(status.tables) == set(CONTROL_TABLES)


def test_control_status_can_read_without_creating_db(isolated_home: Path):
    path = isolated_home / ".codealmanac/control.sqlite"
    app = create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            control_db_path=path,
        )
    )

    status = app.control.status(ReadControlSchemaStatusRequest(ensure=False))

    assert status.path == path
    assert status.user_version == 0
    assert status.tables == ()
    assert not path.exists()


def test_control_db_constraints_reject_invalid_launch_vocabulary(
    isolated_home: Path,
):
    path = isolated_home / ".codealmanac/control.sqlite"
    app = create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            control_db_path=path,
        )
    )
    app.control.ensure_ready()
    now = "2026-07-02T00:00:00Z"

    with sqlite3.connect(path) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute(
            """
            INSERT INTO repositories (
              id,
              provider,
              owner_login,
              name,
              full_name,
              almanac_root,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "repo-1",
                "github",
                "AlmanacCode",
                "codealmanac",
                "AlmanacCode/codealmanac",
                "almanac",
                now,
                now,
            ),
        )

        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """
                INSERT INTO branches (
                  id,
                  repository_id,
                  name,
                  delivery_mode,
                  created_at,
                  updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                ("branch-bad", "repo-1", "dev", "email", now, now),
            )

        connection.execute(
            """
            INSERT INTO branches (
              id,
              repository_id,
              name,
              delivery_mode,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("branch-1", "repo-1", "dev", "commit", now, now),
        )

        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """
                INSERT INTO runs (
                  id,
                  repository_id,
                  branch_id,
                  operation,
                  status,
                  created_at,
                  updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "run-bad",
                    "repo-1",
                    "branch-1",
                    "update",
                    "done",
                    now,
                    now,
                ),
            )


def test_control_db_is_separate_from_workspace_query_index(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    control_path = isolated_home / ".codealmanac/control.sqlite"
    app = create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            control_db_path=control_path,
        )
    )

    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    workspace = app.workspaces.resolve(repo)
    control_status = app.control.ensure_ready()

    assert control_status.path == control_path
    assert index_db_path(workspace.almanac_path) == repo / "almanac/index.db"
    assert control_status.path != index_db_path(workspace.almanac_path)


def test_control_upserts_repository_and_branch_policy(
    tmp_path: Path,
    isolated_home: Path,
):
    app = control_app(isolated_home)
    repo_path = tmp_path / "repo"
    repo_path.mkdir()

    repository = register_repository(app, repo_path)
    branch = app.control.set_branch_policy(
        SetBranchPolicyRequest(
            repository_id=repository.id,
            name="dev",
            trigger_enabled=True,
            delivery_mode=ControlDeliveryMode.COMMIT,
            last_seen_head_sha="abc123",
        )
    )

    assert repository.id.startswith("repo_")
    assert repository.full_name == "AlmanacCode/codealmanac"
    assert repository.local_root_path == repo_path.resolve()
    assert branch.id.startswith("branch_")
    assert branch.repository_id == repository.id
    assert branch.name == "dev"
    assert branch.trigger_enabled is True
    assert branch.delivery_mode is ControlDeliveryMode.COMMIT
    assert branch.last_seen_head_sha == "abc123"


def test_control_finds_repository_and_branch_for_local_checkout(
    tmp_path: Path,
    isolated_home: Path,
):
    app = control_app(isolated_home)
    repo_path = tmp_path / "repo"
    repository = register_repository(app, repo_path)
    branch = app.control.set_branch_policy(
        SetBranchPolicyRequest(repository_id=repository.id, name="dev")
    )

    found_repository = app.control.find_repository_by_local_root(
        FindRepositoryByLocalRootRequest(root_path=repo_path / "src" / "..")
    )
    found_branch = app.control.find_branch_by_name(
        FindBranchByNameRequest(repository_id=repository.id, name="dev")
    )
    missing_branch = app.control.find_branch_by_name(
        FindBranchByNameRequest(repository_id=repository.id, name="main")
    )

    assert found_repository == repository
    assert found_branch == branch
    assert missing_branch is None


def test_control_lists_repository_branches_in_name_order(
    tmp_path: Path,
    isolated_home: Path,
):
    app = control_app(isolated_home)
    repository = register_repository(app, tmp_path / "repo")
    other = register_repository(
        app,
        tmp_path / "other",
        name="other",
        full_name="AlmanacCode/other",
    )
    app.control.set_branch_policy(
        SetBranchPolicyRequest(repository_id=repository.id, name="main")
    )
    app.control.set_branch_policy(
        SetBranchPolicyRequest(
            repository_id=repository.id,
            name="dev",
            delivery_mode=ControlDeliveryMode.WORKING_TREE,
        )
    )
    app.control.set_branch_policy(
        SetBranchPolicyRequest(repository_id=other.id, name="other")
    )

    branches = app.control.list_branches(
        ListBranchesRequest(repository_id=repository.id)
    )

    assert tuple(branch.name for branch in branches) == ("dev", "main")
    assert tuple(branch.repository_id for branch in branches) == (
        repository.id,
        repository.id,
    )
    assert branches[0].delivery_mode is ControlDeliveryMode.WORKING_TREE


def test_disabled_branch_does_not_record_trigger_event(
    tmp_path: Path,
    isolated_home: Path,
):
    app = control_app(isolated_home)
    repository = register_repository(app, tmp_path / "repo")
    app.control.set_branch_policy(
        SetBranchPolicyRequest(
            repository_id=repository.id,
            name="dev",
            trigger_enabled=False,
            delivery_mode=ControlDeliveryMode.COMMIT,
        )
    )

    result = app.control.record_trigger_event(
        RecordTriggerEventRequest(
            repository_id=repository.id,
            branch_name="dev",
            kind=TriggerEventKind.LOCAL_POST_COMMIT,
            head_sha="head-1",
            previous_head_sha="head-0",
        )
    )

    assert result.recorded is False
    assert result.reason == "branch_not_configured"
    assert result.event is None
    assert app.control.list_trigger_events() == ()


def test_enabled_branch_records_pending_trigger_event(
    tmp_path: Path,
    isolated_home: Path,
):
    app = control_app(isolated_home)
    repository = register_repository(app, tmp_path / "repo")
    branch = app.control.set_branch_policy(
        SetBranchPolicyRequest(
            repository_id=repository.id,
            name="dev",
            trigger_enabled=True,
            delivery_mode=ControlDeliveryMode.COMMIT,
        )
    )

    result = app.control.record_trigger_event(
        RecordTriggerEventRequest(
            repository_id=repository.id,
            branch_name="dev",
            kind=TriggerEventKind.LOCAL_POST_COMMIT,
            head_sha="head-1",
            previous_head_sha="head-0",
            payload_ref="file:///tmp/payload.json",
        )
    )

    assert result.recorded is True
    assert result.reason is None
    assert result.event is not None
    assert result.event.repository_id == repository.id
    assert result.event.branch_id == branch.id
    assert result.event.kind is TriggerEventKind.LOCAL_POST_COMMIT
    assert result.event.head_sha == "head-1"
    assert result.event.previous_head_sha == "head-0"
    assert result.event.payload_ref == "file:///tmp/payload.json"
    assert result.event.status is TriggerEventStatus.PENDING
    pending = app.control.list_trigger_events(
        ListTriggerEventsRequest(statuses=(TriggerEventStatus.PENDING,))
    )
    assert tuple(event.id for event in pending) == (result.event.id,)


def test_duplicate_head_does_not_record_second_trigger_event(
    tmp_path: Path,
    isolated_home: Path,
):
    app = control_app(isolated_home)
    repository = register_repository(app, tmp_path / "repo")
    app.control.set_branch_policy(
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

    duplicate = app.control.record_trigger_event(
        RecordTriggerEventRequest(
            repository_id=repository.id,
            branch_name="dev",
            kind=TriggerEventKind.LOCAL_POST_COMMIT,
            head_sha="head-1",
        )
    )

    assert duplicate.recorded is False
    assert duplicate.reason == "duplicate_head"
    assert len(app.control.list_trigger_events()) == 1


def test_manual_trigger_can_replace_pending_same_head_trigger(
    tmp_path: Path,
    isolated_home: Path,
):
    app = control_app(isolated_home)
    repository = register_repository(app, tmp_path / "repo")
    app.control.set_branch_policy(
        SetBranchPolicyRequest(
            repository_id=repository.id,
            name="dev",
            trigger_enabled=True,
            delivery_mode=ControlDeliveryMode.COMMIT,
        )
    )
    original = app.control.record_trigger_event(
        RecordTriggerEventRequest(
            repository_id=repository.id,
            branch_name="dev",
            kind=TriggerEventKind.LOCAL_POST_COMMIT,
            head_sha="head-1",
        )
    ).event
    assert original is not None

    manual = app.control.record_trigger_event(
        RecordTriggerEventRequest(
            repository_id=repository.id,
            branch_name="dev",
            kind=TriggerEventKind.MANUAL,
            head_sha="head-1",
            allow_duplicate_head=True,
            replace_pending=True,
        )
    )

    events = app.control.list_trigger_events()
    status_by_id = {event.id: event.status for event in events}
    pending = app.control.list_trigger_events(
        ListTriggerEventsRequest(statuses=(TriggerEventStatus.PENDING,))
    )

    assert manual.recorded is True
    assert manual.event is not None
    assert manual.event.kind is TriggerEventKind.MANUAL
    assert manual.event.head_sha == "head-1"
    assert status_by_id[original.id] is TriggerEventStatus.SUPERSEDED
    assert tuple(event.id for event in pending) == (manual.event.id,)


def test_new_trigger_supersedes_older_pending_event(
    tmp_path: Path,
    isolated_home: Path,
):
    app = control_app(isolated_home)
    repository = register_repository(app, tmp_path / "repo")
    app.control.set_branch_policy(
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

    app.control.record_trigger_event(
        RecordTriggerEventRequest(
            repository_id=repository.id,
            branch_name="dev",
            kind=TriggerEventKind.LOCAL_POST_MERGE,
            head_sha="head-2",
            previous_head_sha="head-1",
        )
    )

    events = app.control.list_trigger_events()
    status_by_head = {event.head_sha: event.status for event in events}
    pending = app.control.list_trigger_events(
        ListTriggerEventsRequest(statuses=(TriggerEventStatus.PENDING,))
    )

    assert status_by_head == {
        "head-1": TriggerEventStatus.SUPERSEDED,
        "head-2": TriggerEventStatus.PENDING,
    }
    assert tuple(event.head_sha for event in pending) == ("head-2",)


def test_record_current_git_trigger_uses_probe_state(
    tmp_path: Path,
    isolated_home: Path,
):
    repo_path = tmp_path / "repo"
    probe = FakeLocalGitStateProbe(
        LocalGitState(
            cwd=repo_path,
            available=True,
            repository_root=repo_path,
            branch_name="dev",
            head_sha="head-1",
        )
    )
    app = control_app(isolated_home, probe)
    repository = register_repository(app, repo_path)
    app.control.set_branch_policy(
        SetBranchPolicyRequest(
            repository_id=repository.id,
            name="dev",
            trigger_enabled=True,
            delivery_mode=ControlDeliveryMode.COMMIT,
        )
    )

    result = app.control.record_current_git_trigger(
        RecordCurrentGitTriggerRequest(
            cwd=repo_path / "src",
            kind=TriggerEventKind.LOCAL_POST_COMMIT,
        )
    )

    assert result.recorded is True
    assert result.event is not None
    assert result.event.head_sha == "head-1"
    assert probe.requests == [repo_path / "src"]


def test_record_current_git_trigger_noops_when_git_state_unavailable(
    tmp_path: Path,
    isolated_home: Path,
):
    repo_path = tmp_path / "repo"
    app = control_app(
        isolated_home,
        FakeLocalGitStateProbe(
            LocalGitState(
                cwd=repo_path,
                available=False,
                unavailable_reason="not a git repo",
            )
        ),
    )

    result = app.control.record_current_git_trigger(
        RecordCurrentGitTriggerRequest(
            cwd=repo_path,
            kind=TriggerEventKind.LOCAL_POST_COMMIT,
        )
    )

    assert result.recorded is False
    assert result.reason == "git_state_unavailable"
    assert app.control.list_trigger_events() == ()


def test_record_current_git_trigger_noops_when_repo_is_not_configured(
    tmp_path: Path,
    isolated_home: Path,
):
    repo_path = tmp_path / "repo"
    app = control_app(
        isolated_home,
        FakeLocalGitStateProbe(
            LocalGitState(
                cwd=repo_path,
                available=True,
                repository_root=repo_path,
                branch_name="dev",
                head_sha="head-1",
            )
        ),
    )

    result = app.control.record_current_git_trigger(
        RecordCurrentGitTriggerRequest(
            cwd=repo_path,
            kind=TriggerEventKind.LOCAL_POST_COMMIT,
        )
    )

    assert result.recorded is False
    assert result.reason == "repository_not_configured"
    assert app.control.list_trigger_events() == ()


def test_control_run_ledger_creates_updates_and_logs_run_events(
    tmp_path: Path,
    isolated_home: Path,
):
    app = control_app(isolated_home)
    repository = register_repository(app, tmp_path / "repo")
    branch = app.control.set_branch_policy(
        SetBranchPolicyRequest(
            repository_id=repository.id,
            name="dev",
            trigger_enabled=True,
            delivery_mode=ControlDeliveryMode.COMMIT,
        )
    )
    trigger_result = app.control.record_trigger_event(
        RecordTriggerEventRequest(
            repository_id=repository.id,
            branch_name="dev",
            kind=TriggerEventKind.LOCAL_POST_COMMIT,
            head_sha="head-1",
        )
    )
    assert trigger_result.event is not None

    run = app.control.create_run(
        CreateControlRunRequest(
            repository_id=repository.id,
            branch_id=branch.id,
            trigger_event_id=trigger_result.event.id,
            expected_head_sha="head-1",
            source_bundle_ref="file:///bundle",
            request_ref="file:///request.json",
        )
    )
    first = app.control.append_run_event(
        AppendControlRunEventRequest(
            run_id=run.id,
            kind=ControlRunEventKind.STATUS,
            message="queued update",
        )
    )
    second = app.control.append_run_event(
        AppendControlRunEventRequest(
            run_id=run.id,
            kind=ControlRunEventKind.MESSAGE,
            message="selected sources",
            event_json='{"sources": 3}',
            artifact_ref="file:///events/2.json",
        )
    )
    running = app.control.update_run(
        UpdateControlRunRequest(
            run_id=run.id,
            status=ControlRunStatus.RUNNING,
        )
    )
    succeeded = app.control.update_run(
        UpdateControlRunRequest(
            run_id=run.id,
            status=ControlRunStatus.SUCCEEDED,
            result_ref="file:///result.json",
            summary="updated wiki",
            commit_subject="docs almanac: update dev wiki",
            commit_body="Refresh pages from the trigger bundle.",
        )
    )
    events = app.control.list_run_events(ListControlRunEventsRequest(run_id=run.id))

    assert run.id.startswith("run_")
    assert run.status is ControlRunStatus.QUEUED
    assert run.trigger_event_id == trigger_result.event.id
    assert run.expected_head_sha == "head-1"
    assert first.sequence == 1
    assert second.sequence == 2
    assert second.event_json == '{"sources": 3}'
    assert second.artifact_ref == "file:///events/2.json"
    assert running.status is ControlRunStatus.RUNNING
    assert running.started_at is not None
    assert succeeded.status is ControlRunStatus.SUCCEEDED
    assert succeeded.result_ref == "file:///result.json"
    assert succeeded.summary == "updated wiki"
    assert succeeded.commit_subject == "docs almanac: update dev wiki"
    assert succeeded.finished_at is not None
    assert tuple(event.sequence for event in events) == (1, 2)


def test_control_lists_runs_with_filters_and_limit(
    tmp_path: Path,
    isolated_home: Path,
):
    app = control_app(isolated_home)
    repository = register_repository(app, tmp_path / "repo")
    dev = app.control.set_branch_policy(
        SetBranchPolicyRequest(repository_id=repository.id, name="dev")
    )
    main = app.control.set_branch_policy(
        SetBranchPolicyRequest(repository_id=repository.id, name="main")
    )
    dev_run = app.control.create_run(
        CreateControlRunRequest(repository_id=repository.id, branch_id=dev.id)
    )
    main_run = app.control.update_run(
        UpdateControlRunRequest(
            run_id=app.control.create_run(
                CreateControlRunRequest(
                    repository_id=repository.id,
                    branch_id=main.id,
                )
            ).id,
            status=ControlRunStatus.SUCCEEDED,
        )
    )

    all_runs = app.control.list_runs(ListControlRunsRequest(limit=10))
    queued_runs = app.control.list_runs(
        ListControlRunsRequest(statuses=(ControlRunStatus.QUEUED,))
    )
    dev_runs = app.control.list_runs(ListControlRunsRequest(branch_id=dev.id))
    limited = app.control.list_runs(ListControlRunsRequest(limit=1))

    assert tuple(run.id for run in all_runs) == (main_run.id, dev_run.id)
    assert tuple(run.id for run in queued_runs) == (dev_run.id,)
    assert tuple(run.id for run in dev_runs) == (dev_run.id,)
    assert len(limited) == 1


def test_claim_next_trigger_returns_empty_result_without_pending_trigger(
    isolated_home: Path,
):
    app = control_app(isolated_home)

    result = app.control.claim_next_trigger()

    assert result.claimed is False
    assert result.reason == "no_pending_trigger"
    assert result.trigger is None
    assert result.run is None


def test_claim_next_trigger_marks_trigger_claimed_and_creates_queued_run(
    tmp_path: Path,
    isolated_home: Path,
):
    app = control_app(isolated_home)
    repository = register_repository(app, tmp_path / "repo")
    branch = app.control.set_branch_policy(
        SetBranchPolicyRequest(
            repository_id=repository.id,
            name="dev",
            trigger_enabled=True,
            delivery_mode=ControlDeliveryMode.COMMIT,
        )
    )
    trigger = app.control.record_trigger_event(
        RecordTriggerEventRequest(
            repository_id=repository.id,
            branch_name="dev",
            kind=TriggerEventKind.LOCAL_POST_COMMIT,
            head_sha="head-1",
        )
    ).event
    assert trigger is not None

    claim = app.control.claim_next_trigger(
        ClaimNextTriggerRequest(
            branch_id=branch.id,
            source_bundle_ref="file:///bundle",
            request_ref="file:///request.json",
        )
    )
    second = app.control.claim_next_trigger(
        ClaimNextTriggerRequest(branch_id=branch.id)
    )
    claimed_events = app.control.list_trigger_events(
        ListTriggerEventsRequest(statuses=(TriggerEventStatus.CLAIMED,))
    )

    assert claim.claimed is True
    assert claim.trigger is not None
    assert claim.trigger.id == trigger.id
    assert claim.trigger.status is TriggerEventStatus.CLAIMED
    assert claim.trigger.claimed_at is not None
    assert claim.run is not None
    assert claim.run.status is ControlRunStatus.QUEUED
    assert claim.run.trigger_event_id == trigger.id
    assert claim.run.branch_id == branch.id
    assert claim.run.expected_head_sha == "head-1"
    assert claim.run.source_bundle_ref == "file:///bundle"
    assert claim.run.request_ref == "file:///request.json"
    assert second.claimed is False
    assert tuple(event.id for event in claimed_events) == (trigger.id,)


def test_control_lists_distinct_full_sessions_for_branch(
    tmp_path: Path,
    isolated_home: Path,
):
    app = control_app(isolated_home)
    repository = register_repository(app, tmp_path / "repo")
    dev = app.control.set_branch_policy(
        SetBranchPolicyRequest(repository_id=repository.id, name="dev")
    )
    main = app.control.set_branch_policy(
        SetBranchPolicyRequest(repository_id=repository.id, name="main")
    )
    dev_session = app.control.upsert_session(
        UpsertSessionRequest(
            provider=SessionProvider.CODEX,
            provider_session_id="codex-dev",
            source_ref=(tmp_path / "codex-dev.jsonl").as_uri(),
        )
    )
    other_session = app.control.upsert_session(
        UpsertSessionRequest(
            provider=SessionProvider.CLAUDE,
            provider_session_id="claude-main",
            source_ref=(tmp_path / "claude-main.jsonl").as_uri(),
        )
    )
    dev_turn_1 = app.control.upsert_turn(
        UpsertTurnRequest(session_id=dev_session.id, sequence=1)
    )
    dev_turn_2 = app.control.upsert_turn(
        UpsertTurnRequest(session_id=dev_session.id, sequence=2)
    )
    main_turn = app.control.upsert_turn(
        UpsertTurnRequest(session_id=other_session.id, sequence=1)
    )
    app.control.link_turn_branch(
        LinkTurnBranchRequest(
            turn_id=dev_turn_1.id,
            branch_id=dev.id,
            detector="test",
        )
    )
    app.control.link_turn_branch(
        LinkTurnBranchRequest(
            turn_id=dev_turn_2.id,
            branch_id=dev.id,
            detector="test",
        )
    )
    app.control.link_turn_branch(
        LinkTurnBranchRequest(
            turn_id=main_turn.id,
            branch_id=main.id,
            detector="test",
        )
    )

    sessions = app.control.list_sessions_for_branch(
        ListBranchSessionsRequest(branch_id=dev.id)
    )

    assert sessions == (dev_session,)


def test_new_trigger_marks_active_runs_for_old_head_stale(
    tmp_path: Path,
    isolated_home: Path,
):
    app = control_app(isolated_home)
    repository = register_repository(app, tmp_path / "repo")
    branch = app.control.set_branch_policy(
        SetBranchPolicyRequest(
            repository_id=repository.id,
            name="dev",
            trigger_enabled=True,
            delivery_mode=ControlDeliveryMode.COMMIT,
        )
    )
    queued = app.control.create_run(
        CreateControlRunRequest(
            repository_id=repository.id,
            branch_id=branch.id,
            expected_head_sha="head-1",
        )
    )
    running = app.control.update_run(
        UpdateControlRunRequest(
            run_id=app.control.create_run(
                CreateControlRunRequest(
                    repository_id=repository.id,
                    branch_id=branch.id,
                    expected_head_sha="head-1",
                )
            ).id,
            status=ControlRunStatus.RUNNING,
        )
    )
    same_head = app.control.create_run(
        CreateControlRunRequest(
            repository_id=repository.id,
            branch_id=branch.id,
            expected_head_sha="head-2",
        )
    )
    terminal = app.control.update_run(
        UpdateControlRunRequest(
            run_id=app.control.create_run(
                CreateControlRunRequest(
                    repository_id=repository.id,
                    branch_id=branch.id,
                    expected_head_sha="head-1",
                )
            ).id,
            status=ControlRunStatus.SUCCEEDED,
        )
    )

    app.control.record_trigger_event(
        RecordTriggerEventRequest(
            repository_id=repository.id,
            branch_name="dev",
            kind=TriggerEventKind.LOCAL_POST_COMMIT,
            head_sha="head-2",
        )
    )

    stale_queued = app.control.get_run(GetControlRunRequest(run_id=queued.id))
    stale_running = app.control.get_run(GetControlRunRequest(run_id=running.id))
    preserved_same_head = app.control.get_run(GetControlRunRequest(run_id=same_head.id))
    preserved_terminal = app.control.get_run(GetControlRunRequest(run_id=terminal.id))
    queued_events = app.control.list_run_events(
        ListControlRunEventsRequest(run_id=queued.id)
    )
    running_events = app.control.list_run_events(
        ListControlRunEventsRequest(run_id=running.id)
    )

    assert stale_queued.status is ControlRunStatus.STALE
    assert stale_running.status is ControlRunStatus.STALE
    assert stale_queued.finished_at is not None
    assert stale_running.finished_at is not None
    assert stale_queued.error == "branch advanced to head-2; run marked stale"
    assert stale_running.error == "branch advanced to head-2; run marked stale"
    assert preserved_same_head.status is ControlRunStatus.QUEUED
    assert preserved_terminal.status is ControlRunStatus.SUCCEEDED
    assert tuple(event.kind for event in queued_events) == (ControlRunEventKind.STATUS,)
    assert tuple(event.kind for event in running_events) == (
        ControlRunEventKind.STATUS,
    )
    assert queued_events[0].message == "branch advanced to head-2; run marked stale"
    assert running_events[0].message == "branch advanced to head-2; run marked stale"


def control_app(isolated_home: Path, probe=None):
    return create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            control_db_path=isolated_home / ".codealmanac/control.sqlite",
        ),
        local_git_state_probe=probe,
    )


def register_repository(
    app,
    repo_path: Path,
    *,
    name: str = "codealmanac",
    full_name: str = "AlmanacCode/codealmanac",
):
    repo_path.mkdir(exist_ok=True)
    return app.control.upsert_repository(
        UpsertRepositoryRequest(
            provider="github",
            owner_login="AlmanacCode",
            name=name,
            full_name=full_name,
            default_branch="dev",
            almanac_root=Path("almanac"),
            local_root_path=repo_path,
        )
    )


class FakeLocalGitStateProbe:
    def __init__(self, state: LocalGitState):
        self.state = state
        self.requests: list[Path] = []

    def read(self, cwd: Path) -> LocalGitState:
        self.requests.append(cwd)
        return self.state
