from datetime import UTC, datetime
from pathlib import Path

from codealmanac.core.errors import (
    NoRepositorySelected,
    NotFoundError,
    ValidationFailed,
)
from codealmanac.core.paths import normalize_path
from codealmanac.services.repositories.identity import (
    repository_id_for,
    repository_name_for,
)
from codealmanac.services.repositories.models import (
    RegisteredRepositories,
    RegisteredRepository,
    Repository,
)
from codealmanac.services.repositories.requests import (
    RegisterRepositoryRequest,
    SelectRepositoryRequest,
)
from codealmanac.services.repositories.roots import (
    DEFAULT_ALMANAC_ROOT,
    RepositoryTarget,
    initialized_repository_at,
)
from codealmanac.services.repositories.selection import (
    contains_path,
    entry_by_exact_path,
    select_repository_record,
)
from codealmanac.services.repositories.state import repository_state
from codealmanac.services.repositories.store import RepositoryStore


class RepositoriesService:
    def __init__(self, store: RepositoryStore):
        self.store = store

    def prepare_repository_target(
        self,
        path: Path,
    ) -> RepositoryTarget:
        normalized = normalize_path(path)
        if normalized.is_file():
            raise ValidationFailed(f"repository path must be a directory: {normalized}")
        return RepositoryTarget(
            root_path=normalized,
            almanac_root=DEFAULT_ALMANAC_ROOT,
            almanac_path=normalized / DEFAULT_ALMANAC_ROOT,
        )

    def register(self, request: RegisterRepositoryRequest) -> Repository:
        root_path = normalize_path(request.root_path)
        almanac_path = root_path / DEFAULT_ALMANAC_ROOT
        existing = entry_by_exact_path(root_path, self.store.list())
        name = repository_name_for(
            root_path,
            request.name or (existing.name if existing is not None else None),
        )
        description = (
            request.description.strip()
            or (existing.description if existing is not None else "")
        )
        repository = Repository(
            repository_id=repository_id_for(root_path),
            name=name,
            description=description,
            root_path=root_path,
            almanac_root=DEFAULT_ALMANAC_ROOT,
            almanac_path=almanac_path,
            registered_at=(
                existing.registered_at if existing is not None else datetime.now(UTC)
            ),
        )
        return self.store.remember(repository).to_repository()

    def get(self, repository_id: str) -> Repository:
        entry = self.store.find_by_repository_id(repository_id)
        if entry is None:
            raise NotFoundError("repository", repository_id)
        return entry.to_repository()

    def find_by_path(self, path: Path) -> Repository | None:
        entry = self.store.find_by_path(path)
        if entry is None:
            return None
        return entry.to_repository()

    def select(self, request: SelectRepositoryRequest) -> Repository:
        entries = self.store.list()
        selected = select_repository_record(request, entries)
        if selected is not None:
            return selected.to_repository()
        raise NotFoundError("repository", request.name)

    def resolve(self, path: Path) -> Repository:
        normalized = normalize_path(path)
        exact = entry_by_exact_path(normalized, self.store.list())
        if exact is not None:
            return exact.to_repository()
        raise NoRepositorySelected()

    def select_operation_repository(
        self,
        cwd: Path,
        repository_name: str | None,
    ) -> Repository:
        if repository_name is None:
            return self.resolve(cwd)
        return self.select(SelectRepositoryRequest(name=repository_name))

    def resolve_read_repository(self, path: Path) -> Repository:
        registered = self.find_by_path(path)
        if registered is not None:
            return registered
        normalized = normalize_path(path)
        match = initialized_repository_at(normalized)
        if match is not None:
            return self.register(
                RegisterRepositoryRequest(
                    root_path=match.root_path,
                )
            )
        raise NoRepositorySelected()

    def select_read_repository(
        self,
        cwd: Path,
        repository_name: str | None,
    ) -> Repository:
        if repository_name is None:
            return self.resolve_read_repository(cwd)
        return self.select(SelectRepositoryRequest(name=repository_name))

    def validate_path(self, repository_id: str, path: Path) -> Path:
        repository = self.get(repository_id)
        normalized = normalize_path(path)
        if not contains_path(repository.root_path, normalized):
            raise ValidationFailed(
                f"path is outside repository {repository.name}: {normalized}"
            )
        return normalized

    def list(self) -> list[Repository]:
        return [entry.to_repository() for entry in self.store.list()]

    def list_registered(self) -> RegisteredRepositories:
        repositories = [entry.to_repository() for entry in self.store.list()]
        return RegisteredRepositories(
            repositories=tuple(
                RegisteredRepository(
                    repository=repository,
                    state=repository_state(repository),
                )
                for repository in repositories
            )
        )

    @property
    def database_path(self) -> Path:
        return self.store.database_path
