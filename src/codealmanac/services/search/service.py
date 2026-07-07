from codealmanac.services.index.models import SearchPageResult
from codealmanac.services.index.requests import SearchIndexRequest
from codealmanac.services.index.service import IndexService
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.search.requests import SearchPagesRequest


class SearchService:
    def __init__(self, repositories: RepositoriesService, index: IndexService):
        self.repositories = repositories
        self.index = index

    def search(self, request: SearchPagesRequest) -> tuple[SearchPageResult, ...]:
        repository = self.repositories.select_for_read(
            request.cwd,
            request.repository_name,
        )
        return self.index.search(
            repository.repository_id,
            SearchIndexRequest(
                query=request.query,
                topics=request.topics,
                mentions=request.mentions,
                limit=request.limit,
            ),
        )
