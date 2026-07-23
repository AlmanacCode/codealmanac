from pathlib import Path

from codealmanac.core.paths import normalize_path
from codealmanac.database.local import open_local_database
from codealmanac.services.repositories.identity import project_id_for
from codealmanac.services.repositories.models import Repository, RepositoryRecord

from codealmanac.services.repositories.records import (
    repository_record_for,
    repository_record_from_row,
    repository_values,
)
from codealmanac.services.repositories.tables import REPOSITORY_TABLES


class RepositoryStore:
    def __init__(self, database_path: Path):
        self.database_path = normalize_path(database_path)

    def remember(self, repository: Repository) -> RepositoryRecord:
        record = repository_record_for(repository)
        project_id = project_id_for(record.name)
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO projects (project_id, name, description, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    description = excluded.description
                """,
                (
                    project_id,
                    record.name,
                    record.description,
                    record.registered_at.isoformat(),
                ),
            )
            connection.execute(
                """
                INSERT INTO workspaces (workspace_id, project_id, root_path, almanac_root, registered_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(workspace_id) DO UPDATE SET
                    root_path = excluded.root_path,
                    almanac_root = excluded.almanac_root
                """,
                (
                    f"ws_{record.repository_id}",
                    project_id,
                    record.path.as_posix(),
                    record.almanac_root.as_posix(),
                    record.registered_at.isoformat(),
                ),
            )
            connection.execute(
                """
                INSERT INTO repositories (
                    repository_id,
                    name,
                    description,
                    root_path,
                    almanac_root,
                    registered_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(root_path) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    almanac_root = excluded.almanac_root,
                    registered_at = repositories.registered_at
                """,
                repository_values(record),
            )

            connection.commit()
        return record


    def find_by_repository_id(self, repository_id: str) -> RepositoryRecord | None:
        with self.connect() as connection:
            row = connection.execute(
                """
                SELECT repository_id, name, description, root_path, almanac_root,
                       registered_at
                FROM repositories
                WHERE repository_id = ?
                """,
                (repository_id,),
            ).fetchone()
        if row is None:
            return None
        return repository_record_from_row(row)

    def find_by_root_path(self, path: Path) -> RepositoryRecord | None:
        normalized = normalize_path(path)
        with self.connect() as connection:
            row = connection.execute(
                """
                SELECT repository_id, name, description, root_path, almanac_root,
                       registered_at
                FROM repositories
                WHERE root_path = ?
                """,
                (normalized.as_posix(),),
            ).fetchone()
        if row is None:
            return None
        return repository_record_from_row(row)

    def list(self) -> list[RepositoryRecord]:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT repository_id, name, description, root_path, almanac_root,
                       registered_at
                FROM repositories
                ORDER BY name COLLATE NOCASE, root_path
                """
            ).fetchall()
        return [repository_record_from_row(row) for row in rows]

    def connect(self):
        return open_local_database(self.database_path, REPOSITORY_TABLES)

