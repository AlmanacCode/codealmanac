from codealmanac.services.index.models import SearchPageResult
from codealmanac.services.index.requests import SearchIndexRequest
from codealmanac.services.index.service import IndexService
from codealmanac.services.search.requests import SearchPagesRequest
from codealmanac.services.workspaces.requests import SelectWorkspaceRequest
from codealmanac.services.workspaces.service import WorkspacesService


class SearchService:
    def __init__(self, workspaces: WorkspacesService, index: IndexService):
        self.workspaces = workspaces
        self.index = index

    def search(self, request: SearchPagesRequest) -> tuple[SearchPageResult, ...]:
        if request.wiki is None:
            workspace = self.workspaces.resolve(request.cwd)
        else:
            workspace = self.workspaces.select(
                SelectWorkspaceRequest(selector=request.wiki, base_path=request.cwd)
            )
        return self.index.search(
            workspace.workspace_id,
            SearchIndexRequest(
                query=request.query,
                topics=request.topics,
                mentions=request.mentions,
                limit=request.limit,
            ),
        )
