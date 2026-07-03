from pathlib import Path
from uuid import uuid4

from pydantic import ValidationError

from codealmanac.jobs.ledger.models import JobLogEvent, JobRecord, JobSpec
from codealmanac.jobs.ledger.paths import (
    job_log_path,
    job_record_path,
    job_spec_path,
    jobs_dir,
)


class JobLedgerIO:
    def write_record(self, job_dir: Path, record: JobRecord) -> None:
        path = job_record_path(job_dir, record.job_id)
        write_json_atomically(path, record.model_dump_json(indent=2))

    def delete_record(self, job_dir: Path, job_id: str) -> None:
        path = job_record_path(job_dir, job_id)
        path.unlink(missing_ok=True)

    def write_spec(self, job_dir: Path, job_id: str, spec: JobSpec) -> None:
        path = job_spec_path(job_dir, job_id)
        write_json_atomically(path, spec.model_dump_json(indent=2))

    def delete_spec(self, job_dir: Path, job_id: str) -> None:
        path = job_spec_path(job_dir, job_id)
        path.unlink(missing_ok=True)

    def read_record(self, job_dir: Path, job_id: str) -> JobRecord | None:
        path = job_record_path(job_dir, job_id)
        if not path.is_file():
            return None
        try:
            return JobRecord.model_validate_json(path.read_text(encoding="utf-8"))
        except (OSError, ValidationError, ValueError):
            return None

    def read_spec(self, job_dir: Path, job_id: str) -> JobSpec | None:
        path = job_spec_path(job_dir, job_id)
        if not path.is_file():
            return None
        try:
            return JobSpec.model_validate_json(path.read_text(encoding="utf-8"))
        except (OSError, ValidationError, ValueError):
            return None

    def iter_records(self, job_dir: Path) -> tuple[JobRecord, ...]:
        directory = jobs_dir(job_dir)
        if not directory.is_dir():
            return ()
        records: list[JobRecord] = []
        for path in sorted(directory.glob("*.json")):
            if path.name.endswith(".spec.json"):
                continue
            try:
                record = self.read_record(job_dir, path.stem)
            except ValidationError:
                continue
            if record is not None:
                records.append(record)
        return tuple(records)

    def append_event(self, job_dir: Path, event: JobLogEvent) -> None:
        path = job_log_path(job_dir, event.job_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as file:
            file.write(event.model_dump_json(exclude_none=True))
            file.write("\n")

    def iter_events(self, job_dir: Path, job_id: str) -> tuple[JobLogEvent, ...]:
        path = job_log_path(job_dir, job_id)
        if not path.is_file():
            return ()
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except OSError:
            return ()
        events: list[JobLogEvent] = []
        for line in lines:
            if not line.strip():
                continue
            try:
                events.append(JobLogEvent.model_validate_json(line))
            except (ValidationError, ValueError):
                continue
        return tuple(events)

    def next_sequence(self, job_dir: Path, job_id: str) -> int:
        return len(self.iter_events(job_dir, job_id)) + 1


def write_json_atomically(path: Path, payload: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        temporary.write_text(payload, encoding="utf-8")
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()
