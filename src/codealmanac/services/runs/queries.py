from pathlib import Path

from codealmanac.services.runs.io import RunLedgerIO
from codealmanac.services.runs.models import QueuedRun, RunRecord, RunStatus


def list_run_records(
    ledger: RunLedgerIO,
    almanac_path: Path,
    limit: int | None,
) -> tuple[RunRecord, ...]:
    records = sorted(
        ledger.iter_records(almanac_path),
        key=lambda record: (record.created_at, record.run_id),
        reverse=True,
    )
    if limit is not None:
        return tuple(records[:limit])
    return tuple(records)


def next_spec_backed_queued_run(
    ledger: RunLedgerIO,
    almanac_path: Path,
) -> QueuedRun | None:
    records = sorted(
        ledger.iter_records(almanac_path),
        key=lambda record: (record.created_at, record.run_id),
    )
    for record in records:
        if record.status != RunStatus.QUEUED:
            continue
        spec = ledger.read_spec(almanac_path, record.run_id)
        if spec is None:
            continue
        return QueuedRun(record=record, spec=spec)
    return None
