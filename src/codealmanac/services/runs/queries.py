from codealmanac.database.sqlite import SQLiteConnection, SQLiteRow
from codealmanac.services.runs.models import (
    QueuedRun,
    RunRecord,
    RunSpec,
    RunStatus,
)


def list_run_records(
    connection: SQLiteConnection,
    limit: int | None,
    repository_id: str | None = None,
) -> tuple[RunRecord, ...]:
    query = """
        SELECT record_json
        FROM runs
    """
    parameters: tuple[object, ...]
    if repository_id is None:
        parameters = ()
    else:
        query = f"{query} WHERE repository_id = ?"
        parameters = (repository_id,)
    query = f"""
        {query}
        ORDER BY created_at DESC, run_id DESC
    """
    if limit is not None:
        query = f"{query} LIMIT ?"
        parameters = (*parameters, limit)
    rows = connection.execute(query, parameters).fetchall()
    return tuple(run_record_from_row(row) for row in rows)


def read_run_record(
    connection: SQLiteConnection,
    run_id: str,
) -> RunRecord | None:
    row = connection.execute(
        "SELECT record_json FROM runs WHERE run_id = ?",
        (run_id,),
    ).fetchone()
    if row is None:
        return None
    return run_record_from_row(row)


def read_run_spec(
    connection: SQLiteConnection,
    run_id: str,
) -> RunSpec | None:
    result = read_run_with_spec(connection, run_id)
    if result is None:
        return None
    return result[1]


def read_run_with_spec(
    connection: SQLiteConnection,
    run_id: str,
) -> tuple[RunRecord, RunSpec | None] | None:
    row = connection.execute(
        "SELECT record_json, spec_json FROM runs WHERE run_id = ?",
        (run_id,),
    ).fetchone()
    if row is None:
        return None
    spec = None
    if row["spec_json"] is not None:
        spec = RunSpec.model_validate_json(row["spec_json"])
    return (run_record_from_row(row), spec)


def next_queued_run(connection: SQLiteConnection) -> QueuedRun | None:
    row = connection.execute(
        """
        SELECT record_json, spec_json
        FROM runs
        WHERE status = ? AND spec_json IS NOT NULL
        ORDER BY created_at ASC, run_id ASC
        LIMIT 1
        """,
        (RunStatus.QUEUED.value,),
    ).fetchone()
    if row is None:
        return None
    return QueuedRun(
        record=run_record_from_row(row),
        spec=RunSpec.model_validate_json(row["spec_json"]),
    )


def count_queued_runs_before(
    connection: SQLiteConnection,
    record: RunRecord,
) -> int:
    row = connection.execute(
        """
        SELECT COUNT(*)
        FROM runs
        WHERE status = ?
          AND spec_json IS NOT NULL
          AND (
            created_at < ?
            OR (created_at = ? AND run_id < ?)
          )
        """,
        (
            RunStatus.QUEUED.value,
            record.created_at.isoformat(),
            record.created_at.isoformat(),
            record.run_id,
        ),
    ).fetchone()
    return int(row[0])


def run_record_from_row(row: SQLiteRow) -> RunRecord:
    return RunRecord.model_validate_json(row["record_json"])
