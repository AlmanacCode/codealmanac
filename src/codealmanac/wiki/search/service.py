from codealmanac.wiki.index.models import SearchPageResult
from codealmanac.wiki.index.requests import SearchIndexRequest
from codealmanac.wiki.index.service import IndexService
from codealmanac.wiki.search.requests import SearchPagesRequest
from codealmanac.wiki.workspaces.requests import SelectWorkspaceRequest
from codealmanac.wiki.workspaces.service import WorkspacesService


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
