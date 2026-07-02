import sqlite3
from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.core.paths import default_control_db_path
from codealmanac.services.control.requests import ReadControlSchemaStatusRequest
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
