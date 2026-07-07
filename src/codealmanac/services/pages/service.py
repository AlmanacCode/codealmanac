from codealmanac.core.errors import NotFoundError
from codealmanac.services.index.models import PageView
from codealmanac.services.index.service import IndexService
from codealmanac.services.pages.requests import ShowPageRequest
from codealmanac.services.repositories.service import RepositoriesService


class PagesService:
    def __init__(self, repositories: RepositoriesService, index: IndexService):
        self.repositories = repositories
        self.index = index

    def show(self, request: ShowPageRequest) -> PageView:
        repository = self.repositories.select_for_read(
            request.cwd,
            request.repository_name,
        )
        page = self.index.get_page(repository.repository_id, request.slug)
        if page is None:
            raise NotFoundError("page", request.slug)
        return page
