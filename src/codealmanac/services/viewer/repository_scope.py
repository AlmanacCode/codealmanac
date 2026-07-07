from pathlib import Path

from codealmanac.core.errors import NotFoundError
from codealmanac.services.repositories.models import Repository, RepositoryState
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.viewer.models import ViewerRepository
from codealmanac.services.viewer.projections import viewer_repository


class ViewerRepositoryScope:
    def __init__(self, repositories: RepositoriesService):
        self.repositories = repositories

    def select(self, cwd: Path, repository_name: str | None) -> Repository:
        if repository_name is not None:
            return self.repositories.select_for_read(cwd, repository_name)
        return self.select_default(cwd)

    def select_default(self, cwd: Path) -> Repository:
        try:
            return self.repositories.select_for_read(cwd, None)
        except NotFoundError:
            repositories = self.available_registered()
            if repositories:
                return repositories[0]
            raise

    def navigation(
        self,
        selected: Repository,
        include_all: bool,
    ) -> tuple[ViewerRepository, ...]:
        if not include_all:
            return (viewer_repository(selected),)

        ordered = [selected]
        seen = {selected.repository_id}
        for repository in self.available_registered():
            if repository.repository_id in seen:
                continue
            seen.add(repository.repository_id)
            ordered.append(repository)
        return tuple(viewer_repository(repository) for repository in ordered)

    def available_registered(self) -> tuple[Repository, ...]:
        registered = self.repositories.list_registered()
        return tuple(
            item.repository
            for item in registered.repositories
            if item.state == RepositoryState.AVAILABLE
        )
