from hashlib import sha256
from uuid import uuid4

from codealmanac.database import SQLiteRow
from codealmanac.services.control.models import (
    BranchRecord,
    ControlRunEventRecord,
    ControlRunRecord,
    RepositoryRecord,
    SessionRecord,
    TriggerEventRecord,
    TurnRecord,
)


def repository_id_for(provider: str, full_name: str) -> str:
    return stable_control_id("repo", provider, full_name)


def branch_id_for(repository_id: str, name: str) -> str:
    return stable_control_id("branch", repository_id, name)


def session_id_for(provider: str, provider_session_id: str) -> str:
    return stable_control_id("session", provider, provider_session_id)


def turn_id_for(session_id: str, sequence: int) -> str:
    return stable_control_id("turn", session_id, str(sequence))


def trigger_event_id() -> str:
    return f"trigger_{uuid4().hex}"


def control_run_id() -> str:
    return f"run_{uuid4().hex}"


def stable_control_id(prefix: str, *parts: str) -> str:
    digest = sha256("\0".join(part.casefold() for part in parts).encode()).hexdigest()
    return f"{prefix}_{digest[:16]}"


def repository_from_row(row: SQLiteRow) -> RepositoryRecord:
    return RepositoryRecord.model_validate(dict(row))


def branch_from_row(row: SQLiteRow) -> BranchRecord:
    return BranchRecord.model_validate(dict(row))


def trigger_event_from_row(row: SQLiteRow) -> TriggerEventRecord:
    return TriggerEventRecord.model_validate(dict(row))


def control_run_from_row(row: SQLiteRow) -> ControlRunRecord:
    return ControlRunRecord.model_validate(dict(row))


def control_run_event_from_row(row: SQLiteRow) -> ControlRunEventRecord:
    return ControlRunEventRecord.model_validate(dict(row))


def session_from_row(row: SQLiteRow) -> SessionRecord:
    return SessionRecord.model_validate(dict(row))


def turn_from_row(row: SQLiteRow) -> TurnRecord:
    return TurnRecord.model_validate(dict(row))
