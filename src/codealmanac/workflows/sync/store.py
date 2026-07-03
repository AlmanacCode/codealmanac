from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from pydantic import ValidationError

from codealmanac.wiki.workspaces.identity import workspace_id_for
from codealmanac.workflows.sync.models import SyncLedger

SYNC_LEDGER_VERSION = 1


class SyncLedgerStore:
    def __init__(self, jobs_path: Path | None = None):
        self.jobs_path = jobs_path

    def load(self, repo_root: Path, almanac_path: Path) -> SyncLedger:
        for path in self.ledger_paths_for_read(repo_root, almanac_path):
            try:
                return SyncLedger.model_validate_json(path.read_text(encoding="utf-8"))
            except (OSError, ValidationError, ValueError):
                continue
        return empty_ledger()

    def save(
        self,
        repo_root: Path,
        almanac_path: Path,
        ledger: SyncLedger,
        now: datetime,
    ) -> SyncLedger:
        updated = ledger.model_copy(update={"updated_at": now})
        path = self.primary_ledger_path(repo_root, almanac_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
        try:
            temporary.write_text(
                updated.model_dump_json(indent=2),
                encoding="utf-8",
            )
            temporary.replace(path)
        finally:
            if temporary.exists():
                temporary.unlink()
        return updated

    def primary_ledger_path(self, repo_root: Path, almanac_path: Path) -> Path:
        if self.jobs_path is None:
            return legacy_sync_ledger_path(almanac_path)
        return self.jobs_path / workspace_id_for(repo_root) / "sync-ledger.json"

    def ledger_paths_for_read(
        self,
        repo_root: Path,
        almanac_path: Path,
    ) -> tuple[Path, ...]:
        primary = self.primary_ledger_path(repo_root, almanac_path)
        legacy = legacy_sync_ledger_path(almanac_path)
        if primary == legacy:
            return (primary,)
        return (primary, legacy)


def legacy_sync_ledger_path(almanac_path: Path) -> Path:
    return almanac_path / "jobs" / "sync-ledger.json"


def empty_ledger() -> SyncLedger:
    return SyncLedger(
        version=SYNC_LEDGER_VERSION,
        updated_at=datetime.fromtimestamp(0, UTC),
        sessions={},
    )
