import sqlite3
from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.core.paths import default_control_db_path
from codealmanac.services.control.models import (
    ControlDeliveryMode,
    LocalGitState,
    TriggerEventKind,
    TriggerEventStatus,
)
from codealmanac.services.control.requests import (
    ListTriggerEventsRequest,
    ReadControlSchemaStatusRequest,
    RecordCurrentGitTriggerRequest,
    RecordTriggerEventRequest,
    SetBranchPolicyRequest,
    UpsertRepositoryRequest,
)
from codealmanac.services.control.schema import (
    CONTROL_SCHEMA_VERSION,
    CONTROL_TABLES,
)
from codealmanac.services.index.schema import index_db_path
from codealmanac.services.workspaces.requests import InitializeWorkspaceRequest


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

    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
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


def control_app(isolated_home: Path, probe=None):
    return create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            control_db_path=isolated_home / ".codealmanac/control.sqlite",
        ),
        local_git_state_probe=probe,
    )


def register_repository(app, repo_path: Path):
    repo_path.mkdir(exist_ok=True)
    return app.control.upsert_repository(
        UpsertRepositoryRequest(
            provider="github",
            owner_login="AlmanacCode",
            name="codealmanac",
            full_name="AlmanacCode/codealmanac",
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
