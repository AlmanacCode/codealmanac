from codealmanac.database.sqlite import SQLiteRow
from codealmanac.services.runs.models import RunRecord, RunSpec


def run_record_from_row(row: SQLiteRow) -> RunRecord:
    return RunRecord.model_validate_json(row["record_json"])


def run_spec_from_row(row: SQLiteRow) -> RunSpec | None:
    if row["spec_json"] is None:
        return None
    return RunSpec.model_validate_json(row["spec_json"])


def run_spec_json(spec: RunSpec | None) -> str | None:
    if spec is None:
        return None
    return spec.model_dump_json()


def run_record_json(record: RunRecord) -> str:
    return record.model_dump_json()
