from datetime import UTC, datetime
from pathlib import Path

from codealmanac.core.paths import normalize_path
from codealmanac.database.sqlite import SQLiteRow
from codealmanac.services.repositories.models import Repository, RepositoryRecord


def repository_record_for(repository: Repository) -> RepositoryRecord:
    return RepositoryRecord(
        name=repository.name,
        description=repository.description,
        path=repository.root_path,
        almanac_root=repository.almanac_root,
        registered_at=repository.registered_at,
        repository_id=repository.repository_id,
    )


def repository_values(
    record: RepositoryRecord,
) -> tuple[str, str, str, str, str, str]:
    return (
        record.repository_id,
        record.name,
        record.description,
        record.path.as_posix(),
        record.almanac_root.as_posix(),
        record.registered_at.isoformat(),
    )


def repository_record_from_row(row: SQLiteRow) -> RepositoryRecord:
    return RepositoryRecord(
        repository_id=str(row["repository_id"]),
        name=str(row["name"]),
        description=str(row["description"]),
        path=normalize_path(Path(str(row["root_path"]))),
        almanac_root=Path(str(row["almanac_root"])),
        registered_at=datetime.fromisoformat(str(row["registered_at"])).astimezone(
            UTC
        ),
    )
