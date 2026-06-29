from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from pydantic import ValidationError

from codealmanac.core.errors import NotFoundError
from codealmanac.services.runs.models import (
    RunEventKind,
    RunLogEvent,
    RunOperation,
    RunRecord,
    RunStatus,
)


class RunStore:
    def create(
        self,
        almanac_path: Path,
        workspace_id: str,
        operation: RunOperation,
        title: str | None,
    ) -> RunRecord:
        now = datetime.now(UTC)
        run_id = new_run_id(operation, now)
        record = RunRecord(
            run_id=run_id,
            workspace_id=workspace_id,
            operation=operation,
            status=RunStatus.QUEUED,
            title=title,
            created_at=now,
            updated_at=now,
            log_path=run_log_reference_path(run_id),
        )
        write_record(almanac_path, record)
        append_event(
            almanac_path,
            RunLogEvent(
                run_id=run_id,
                sequence=1,
                timestamp=now,
                kind=RunEventKind.STATUS,
                message=f"queued {operation.value}",
            ),
        )
        return record

    def list(self, almanac_path: Path, limit: int | None) -> tuple[RunRecord, ...]:
        records = sorted(
            iter_records(almanac_path),
            key=lambda record: (record.created_at, record.run_id),
            reverse=True,
        )
        if limit is not None:
            return tuple(records[:limit])
        return tuple(records)

    def read(self, almanac_path: Path, run_id: str) -> RunRecord:
        record = read_record(almanac_path, run_id)
        if record is None:
            raise NotFoundError("run", run_id)
        return record

    def log(self, almanac_path: Path, run_id: str) -> tuple[RunLogEvent, ...]:
        self.read(almanac_path, run_id)
        return tuple(iter_events(almanac_path, run_id))

    def append(
        self,
        almanac_path: Path,
        run_id: str,
        kind: RunEventKind,
        message: str,
    ) -> RunLogEvent:
        record = self.read(almanac_path, run_id)
        event = RunLogEvent(
            run_id=run_id,
            sequence=next_sequence(almanac_path, run_id),
            timestamp=datetime.now(UTC),
            kind=kind,
            message=message,
        )
        append_event(almanac_path, event)
        write_record(
            almanac_path,
            record.model_copy(update={"updated_at": event.timestamp}),
        )
        return event

    def finish(
        self,
        almanac_path: Path,
        run_id: str,
        status: RunStatus,
        summary: str | None,
        error: str | None,
    ) -> RunRecord:
        record = self.read(almanac_path, run_id)
        now = datetime.now(UTC)
        finished = record.model_copy(
            update={
                "status": status,
                "summary": summary,
                "error": error,
                "updated_at": now,
                "finished_at": now,
            }
        )
        write_record(almanac_path, finished)
        append_event(
            almanac_path,
            RunLogEvent(
                run_id=run_id,
                sequence=next_sequence(almanac_path, run_id),
                timestamp=now,
                kind=RunEventKind.STATUS,
                message=status.value,
            ),
        )
        return finished


def new_run_id(operation: RunOperation, now: datetime) -> str:
    stamp = now.strftime("%Y%m%d%H%M%S")
    return f"{operation.value}-{stamp}-{uuid4().hex[:8]}"


def runs_dir(almanac_path: Path) -> Path:
    return almanac_path / "jobs"


def run_record_path(almanac_path: Path, run_id: str) -> Path:
    return runs_dir(almanac_path) / f"{run_id}.json"


def run_log_path(almanac_path: Path, run_id: str) -> Path:
    return runs_dir(almanac_path) / f"{run_id}.jsonl"


def run_log_reference_path(run_id: str) -> Path:
    return Path(".almanac/jobs") / f"{run_id}.jsonl"


def write_record(almanac_path: Path, record: RunRecord) -> None:
    path = run_record_path(almanac_path, record.run_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        temporary.write_text(record.model_dump_json(indent=2), encoding="utf-8")
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()


def read_record(almanac_path: Path, run_id: str) -> RunRecord | None:
    path = run_record_path(almanac_path, run_id)
    if not path.is_file():
        return None
    try:
        return RunRecord.model_validate_json(path.read_text(encoding="utf-8"))
    except (OSError, ValidationError, ValueError):
        return None


def iter_records(almanac_path: Path) -> tuple[RunRecord, ...]:
    directory = runs_dir(almanac_path)
    if not directory.is_dir():
        return ()
    records: list[RunRecord] = []
    for path in sorted(directory.glob("*.json")):
        run_id = path.stem
        record = read_record(almanac_path, run_id)
        if record is not None:
            records.append(record)
    return tuple(records)


def append_event(almanac_path: Path, event: RunLogEvent) -> None:
    path = run_log_path(almanac_path, event.run_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as file:
        file.write(event.model_dump_json())
        file.write("\n")


def iter_events(almanac_path: Path, run_id: str) -> tuple[RunLogEvent, ...]:
    path = run_log_path(almanac_path, run_id)
    if not path.is_file():
        return ()
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return ()
    events: list[RunLogEvent] = []
    for line in lines:
        if not line.strip():
            continue
        try:
            events.append(RunLogEvent.model_validate_json(line))
        except (ValidationError, ValueError):
            continue
    return tuple(events)


def next_sequence(almanac_path: Path, run_id: str) -> int:
    return len(iter_events(almanac_path, run_id)) + 1
