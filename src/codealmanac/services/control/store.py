from datetime import UTC, datetime
from pathlib import Path

from codealmanac.core.errors import NotFoundError
from codealmanac.core.paths import normalize_path
from codealmanac.database import SQLiteConnection, user_version
from codealmanac.services.control.models import (
    BranchRecord,
    ControlSchemaStatus,
    RecordTriggerEventResult,
    RepositoryRecord,
    TriggerEventRecord,
    TriggerEventStatus,
)
from codealmanac.services.control.records import (
    branch_from_row,
    branch_id_for,
    repository_from_row,
    repository_id_for,
    trigger_event_from_row,
    trigger_event_id,
)
from codealmanac.services.control.requests import (
    ListTriggerEventsRequest,
    RecordLocalTriggerRequest,
    RecordTriggerEventRequest,
    SetBranchPolicyRequest,
    UpsertRepositoryRequest,
)
from codealmanac.services.control.schema import CONTROL_TABLES, connect_control


class ControlStore:
    def __init__(self, path: Path):
        self.path = path

    def ensure_ready(self) -> ControlSchemaStatus:
        with connect_control(self.path) as connection:
            return ControlSchemaStatus(
                path=self.path,
                user_version=user_version(connection),
                tables=control_tables(connection),
            )

    def status(self, ensure: bool) -> ControlSchemaStatus:
        if ensure:
            return self.ensure_ready()
        if not self.path.exists():
            return ControlSchemaStatus(path=self.path, user_version=0, tables=())
        with connect_control(self.path) as connection:
            return ControlSchemaStatus(
                path=self.path,
                user_version=user_version(connection),
                tables=control_tables(connection),
            )

    def upsert_repository(
        self,
        request: UpsertRepositoryRequest,
    ) -> RepositoryRecord:
        repository_id = repository_id_for(request.provider, request.full_name)
        now = current_timestamp()
        local_root_path = (
            str(normalize_path(request.local_root_path))
            if request.local_root_path is not None
            else None
        )
        with connect_control(self.path) as connection:
            connection.execute(
                """
                INSERT INTO repositories (
                  id,
                  provider,
                  provider_repo_id,
                  owner_login,
                  owner_type,
                  name,
                  full_name,
                  default_branch,
                  almanac_root,
                  local_root_path,
                  created_at,
                  updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  provider = excluded.provider,
                  provider_repo_id = excluded.provider_repo_id,
                  owner_login = excluded.owner_login,
                  owner_type = excluded.owner_type,
                  name = excluded.name,
                  full_name = excluded.full_name,
                  default_branch = excluded.default_branch,
                  almanac_root = excluded.almanac_root,
                  local_root_path = excluded.local_root_path,
                  updated_at = excluded.updated_at
                """,
                (
                    repository_id,
                    request.provider,
                    request.provider_repo_id,
                    request.owner_login,
                    request.owner_type,
                    request.name,
                    request.full_name,
                    request.default_branch,
                    str(request.almanac_root),
                    local_root_path,
                    now,
                    now,
                ),
            )
            return self.repository_by_id(connection, repository_id)

    def set_branch_policy(
        self,
        request: SetBranchPolicyRequest,
    ) -> BranchRecord:
        branch_id = branch_id_for(request.repository_id, request.name)
        now = current_timestamp()
        with connect_control(self.path) as connection:
            self.repository_by_id(connection, request.repository_id)
            connection.execute(
                """
                INSERT INTO branches (
                  id,
                  repository_id,
                  name,
                  trigger_enabled,
                  delivery_mode,
                  last_seen_head_sha,
                  created_at,
                  updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  trigger_enabled = excluded.trigger_enabled,
                  delivery_mode = excluded.delivery_mode,
                  last_seen_head_sha = COALESCE(
                    excluded.last_seen_head_sha,
                    branches.last_seen_head_sha
                  ),
                  updated_at = excluded.updated_at
                """,
                (
                    branch_id,
                    request.repository_id,
                    request.name,
                    int(request.trigger_enabled),
                    request.delivery_mode.value,
                    request.last_seen_head_sha,
                    now,
                    now,
                ),
            )
            return self.branch_by_id(connection, branch_id)

    def record_trigger_event(
        self,
        request: RecordTriggerEventRequest,
    ) -> RecordTriggerEventResult:
        now = current_timestamp()
        with connect_control(self.path) as connection:
            return self.record_trigger_event_in_connection(
                connection,
                request,
                now,
            )

    def record_local_trigger(
        self,
        request: RecordLocalTriggerRequest,
    ) -> RecordTriggerEventResult:
        now = current_timestamp()
        with connect_control(self.path) as connection:
            repository = self.repository_by_local_root_path(
                connection,
                request.repository_root,
            )
            if repository is None:
                return RecordTriggerEventResult(
                    recorded=False,
                    reason="repository_not_configured",
                )
            return self.record_trigger_event_in_connection(
                connection,
                RecordTriggerEventRequest(
                    repository_id=repository.id,
                    branch_name=request.branch_name,
                    kind=request.kind,
                    head_sha=request.head_sha,
                    previous_head_sha=request.previous_head_sha,
                    payload_ref=request.payload_ref,
                ),
                now,
            )

    def record_trigger_event_in_connection(
        self,
        connection: SQLiteConnection,
        request: RecordTriggerEventRequest,
        now: str,
    ) -> RecordTriggerEventResult:
        branch = self.branch_by_name(
            connection,
            request.repository_id,
            request.branch_name,
        )
        if branch is None or not branch.trigger_enabled:
            if branch is not None:
                self.update_branch_last_seen(
                    connection,
                    branch.id,
                    request.head_sha,
                    now,
                )
            return RecordTriggerEventResult(
                recorded=False,
                reason="branch_not_configured",
            )
        if branch.last_triggered_head_sha == request.head_sha:
            self.update_branch_last_seen(
                connection,
                branch.id,
                request.head_sha,
                now,
            )
            return RecordTriggerEventResult(
                recorded=False,
                reason="duplicate_head",
            )
        connection.execute(
            """
            UPDATE trigger_events
            SET status = ?
            WHERE branch_id = ?
              AND status = ?
              AND head_sha != ?
            """,
            (
                TriggerEventStatus.SUPERSEDED.value,
                branch.id,
                TriggerEventStatus.PENDING.value,
                request.head_sha,
            ),
        )
        event_id = trigger_event_id()
        connection.execute(
            """
            INSERT INTO trigger_events (
              id,
              repository_id,
              branch_id,
              kind,
              head_sha,
              previous_head_sha,
              payload_ref,
              status,
              created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                request.repository_id,
                branch.id,
                request.kind.value,
                request.head_sha,
                request.previous_head_sha,
                request.payload_ref,
                TriggerEventStatus.PENDING.value,
                now,
            ),
        )
        connection.execute(
            """
            UPDATE branches
            SET last_seen_head_sha = ?,
                last_triggered_head_sha = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (request.head_sha, request.head_sha, now, branch.id),
        )
        return RecordTriggerEventResult(
            recorded=True,
            event=self.trigger_event_by_id(connection, event_id),
        )

    def list_trigger_events(
        self,
        request: ListTriggerEventsRequest,
    ) -> tuple[TriggerEventRecord, ...]:
        clauses: list[str] = []
        arguments: list[str] = []
        if request.repository_id is not None:
            clauses.append("repository_id = ?")
            arguments.append(request.repository_id)
        if request.branch_id is not None:
            clauses.append("branch_id = ?")
            arguments.append(request.branch_id)
        if request.statuses:
            placeholders = ", ".join("?" for _ in request.statuses)
            clauses.append(f"status IN ({placeholders})")
            arguments.extend(status.value for status in request.statuses)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        with connect_control(self.path) as connection:
            rows = connection.execute(
                f"""
                SELECT *
                FROM trigger_events
                {where}
                ORDER BY created_at, id
                """,
                arguments,
            ).fetchall()
        return tuple(trigger_event_from_row(row) for row in rows)

    def repository_by_id(
        self,
        connection: SQLiteConnection,
        repository_id: str,
    ) -> RepositoryRecord:
        row = connection.execute(
            "SELECT * FROM repositories WHERE id = ?",
            (repository_id,),
        ).fetchone()
        if row is None:
            raise NotFoundError("repository", repository_id)
        return repository_from_row(row)

    def branch_by_id(
        self,
        connection: SQLiteConnection,
        branch_id: str,
    ) -> BranchRecord:
        row = connection.execute(
            "SELECT * FROM branches WHERE id = ?",
            (branch_id,),
        ).fetchone()
        if row is None:
            raise NotFoundError("branch", branch_id)
        return branch_from_row(row)

    def branch_by_name(
        self,
        connection: SQLiteConnection,
        repository_id: str,
        name: str,
    ) -> BranchRecord | None:
        row = connection.execute(
            """
            SELECT *
            FROM branches
            WHERE repository_id = ?
              AND name = ?
            """,
            (repository_id, name),
        ).fetchone()
        if row is None:
            return None
        return branch_from_row(row)

    def repository_by_local_root_path(
        self,
        connection: SQLiteConnection,
        root_path: Path,
    ) -> RepositoryRecord | None:
        row = connection.execute(
            """
            SELECT *
            FROM repositories
            WHERE local_root_path = ?
            """,
            (str(normalize_path(root_path)),),
        ).fetchone()
        if row is None:
            return None
        return repository_from_row(row)

    def trigger_event_by_id(
        self,
        connection: SQLiteConnection,
        event_id: str,
    ) -> TriggerEventRecord:
        row = connection.execute(
            "SELECT * FROM trigger_events WHERE id = ?",
            (event_id,),
        ).fetchone()
        if row is None:
            raise NotFoundError("trigger event", event_id)
        return trigger_event_from_row(row)

    def update_branch_last_seen(
        self,
        connection: SQLiteConnection,
        branch_id: str,
        head_sha: str,
        updated_at: str,
    ) -> None:
        connection.execute(
            """
            UPDATE branches
            SET last_seen_head_sha = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (head_sha, updated_at, branch_id),
        )


def control_tables(connection: SQLiteConnection) -> tuple[str, ...]:
    rows = connection.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name IN ({placeholders})
        ORDER BY name
        """.format(placeholders=", ".join("?" for _ in CONTROL_TABLES)),
        CONTROL_TABLES,
    ).fetchall()
    return tuple(row["name"] for row in rows)


def current_timestamp() -> str:
    return datetime.now(UTC).isoformat()
