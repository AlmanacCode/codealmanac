from datetime import UTC, datetime
from pathlib import Path

from codealmanac.core.errors import NotFoundError
from codealmanac.core.paths import normalize_path
from codealmanac.database import SQLiteConnection, user_version
from codealmanac.services.control.models import (
    BranchRecord,
    ClaimNextTriggerResult,
    ControlRunEventRecord,
    ControlRunRecord,
    ControlRunStatus,
    ControlSchemaStatus,
    RecordTriggerEventResult,
    RepositoryRecord,
    TriggerEventRecord,
    TriggerEventStatus,
)
from codealmanac.services.control.records import (
    branch_from_row,
    branch_id_for,
    control_run_event_from_row,
    control_run_from_row,
    control_run_id,
    repository_from_row,
    repository_id_for,
    trigger_event_from_row,
    trigger_event_id,
)
from codealmanac.services.control.requests import (
    AppendControlRunEventRequest,
    ClaimNextTriggerRequest,
    CreateControlRunRequest,
    ListControlRunEventsRequest,
    ListTriggerEventsRequest,
    RecordLocalTriggerRequest,
    RecordTriggerEventRequest,
    SetBranchPolicyRequest,
    UpdateControlRunRequest,
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

    def create_run(self, request: CreateControlRunRequest) -> ControlRunRecord:
        run_id = control_run_id()
        now = current_timestamp()
        with connect_control(self.path) as connection:
            self.repository_by_id(connection, request.repository_id)
            self.branch_by_id(connection, request.branch_id)
            connection.execute(
                """
                INSERT INTO runs (
                  id,
                  repository_id,
                  branch_id,
                  trigger_event_id,
                  operation,
                  status,
                  expected_head_sha,
                  source_bundle_ref,
                  request_ref,
                  started_at,
                  created_at,
                  updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    request.repository_id,
                    request.branch_id,
                    request.trigger_event_id,
                    request.operation,
                    request.status.value,
                    request.expected_head_sha,
                    request.source_bundle_ref,
                    request.request_ref,
                    now if request.status is ControlRunStatus.RUNNING else None,
                    now,
                    now,
                ),
            )
            return self.run_by_id(connection, run_id)

    def update_run(self, request: UpdateControlRunRequest) -> ControlRunRecord:
        now = current_timestamp()
        with connect_control(self.path) as connection:
            existing = self.run_by_id(connection, request.run_id)
            status = request.status or existing.status
            started_at = existing.started_at
            if started_at is None and status is ControlRunStatus.RUNNING:
                started_at = datetime.fromisoformat(now)
            finished_at = existing.finished_at
            if status in TERMINAL_RUN_STATUSES and finished_at is None:
                finished_at = datetime.fromisoformat(now)
            connection.execute(
                """
                UPDATE runs
                SET status = ?,
                    result_ref = COALESCE(?, result_ref),
                    summary = COALESCE(?, summary),
                    commit_subject = COALESCE(?, commit_subject),
                    commit_body = COALESCE(?, commit_body),
                    error = COALESCE(?, error),
                    started_at = ?,
                    finished_at = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    status.value,
                    request.result_ref,
                    request.summary,
                    request.commit_subject,
                    request.commit_body,
                    request.error,
                    started_at.isoformat() if started_at is not None else None,
                    finished_at.isoformat() if finished_at is not None else None,
                    now,
                    request.run_id,
                ),
            )
            return self.run_by_id(connection, request.run_id)

    def append_run_event(
        self,
        request: AppendControlRunEventRequest,
    ) -> ControlRunEventRecord:
        now = current_timestamp()
        with connect_control(self.path) as connection:
            self.run_by_id(connection, request.run_id)
            row = connection.execute(
                """
                SELECT COALESCE(MAX(sequence), 0) + 1
                FROM run_events
                WHERE run_id = ?
                """,
                (request.run_id,),
            ).fetchone()
            sequence = int(row[0])
            connection.execute(
                """
                INSERT INTO run_events (
                  run_id,
                  sequence,
                  timestamp,
                  kind,
                  message,
                  event_json,
                  artifact_ref
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    request.run_id,
                    sequence,
                    now,
                    request.kind.value,
                    request.message,
                    request.event_json,
                    request.artifact_ref,
                ),
            )
            return self.run_event_by_sequence(connection, request.run_id, sequence)

    def list_run_events(
        self,
        request: ListControlRunEventsRequest,
    ) -> tuple[ControlRunEventRecord, ...]:
        with connect_control(self.path) as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM run_events
                WHERE run_id = ?
                ORDER BY sequence
                """,
                (request.run_id,),
            ).fetchall()
        return tuple(control_run_event_from_row(row) for row in rows)

    def claim_next_trigger(
        self,
        request: ClaimNextTriggerRequest,
    ) -> ClaimNextTriggerResult:
        now = current_timestamp()
        with connect_control(self.path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            clauses = ["status = ?"]
            arguments = [TriggerEventStatus.PENDING.value]
            if request.repository_id is not None:
                clauses.append("repository_id = ?")
                arguments.append(request.repository_id)
            if request.branch_id is not None:
                clauses.append("branch_id = ?")
                arguments.append(request.branch_id)
            row = connection.execute(
                f"""
                SELECT *
                FROM trigger_events
                WHERE {" AND ".join(clauses)}
                ORDER BY created_at, id
                LIMIT 1
                """,
                arguments,
            ).fetchone()
            if row is None:
                return ClaimNextTriggerResult(
                    claimed=False,
                    reason="no_pending_trigger",
                )
            trigger = trigger_event_from_row(row)
            connection.execute(
                """
                UPDATE trigger_events
                SET status = ?,
                    claimed_at = ?
                WHERE id = ?
                """,
                (TriggerEventStatus.CLAIMED.value, now, trigger.id),
            )
            run_id = control_run_id()
            connection.execute(
                """
                INSERT INTO runs (
                  id,
                  repository_id,
                  branch_id,
                  trigger_event_id,
                  operation,
                  status,
                  expected_head_sha,
                  source_bundle_ref,
                  request_ref,
                  created_at,
                  updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    trigger.repository_id,
                    trigger.branch_id,
                    trigger.id,
                    request.operation,
                    ControlRunStatus.QUEUED.value,
                    trigger.head_sha,
                    request.source_bundle_ref,
                    request.request_ref,
                    now,
                    now,
                ),
            )
            return ClaimNextTriggerResult(
                claimed=True,
                trigger=self.trigger_event_by_id(connection, trigger.id),
                run=self.run_by_id(connection, run_id),
            )

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

    def run_by_id(
        self,
        connection: SQLiteConnection,
        run_id: str,
    ) -> ControlRunRecord:
        row = connection.execute(
            "SELECT * FROM runs WHERE id = ?",
            (run_id,),
        ).fetchone()
        if row is None:
            raise NotFoundError("run", run_id)
        return control_run_from_row(row)

    def run_event_by_sequence(
        self,
        connection: SQLiteConnection,
        run_id: str,
        sequence: int,
    ) -> ControlRunEventRecord:
        row = connection.execute(
            """
            SELECT *
            FROM run_events
            WHERE run_id = ?
              AND sequence = ?
            """,
            (run_id, sequence),
        ).fetchone()
        if row is None:
            raise NotFoundError("run event", f"{run_id}:{sequence}")
        return control_run_event_from_row(row)

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


TERMINAL_RUN_STATUSES = frozenset(
    (
        ControlRunStatus.SUCCEEDED,
        ControlRunStatus.FAILED,
        ControlRunStatus.STALE,
        ControlRunStatus.CANCELLED,
    )
)
