from codealmanac.core.errors import NotFoundError
from codealmanac.core.slug import to_kebab_case
from codealmanac.wiki.index.models import PageView
from codealmanac.wiki.index.service import IndexService
from codealmanac.wiki.pages.requests import ShowPageRequest
from codealmanac.wiki.workspaces.requests import SelectWorkspaceRequest
from codealmanac.wiki.workspaces.service import WorkspacesService


class PagesService:
    def __init__(self, workspaces: WorkspacesService, index: IndexService):
        self.workspaces = workspaces
        self.index = index

    def show(self, request: ShowPageRequest) -> PageView:
        if request.wiki is None:
            workspace = self.workspaces.resolve(request.cwd)
        else:
            workspace = self.workspaces.select(
                SelectWorkspaceRequest(selector=request.wiki, base_path=request.cwd)
            )
        slug = to_kebab_case(request.slug)
        page = self.index.get_page(workspace.workspace_id, slug)
        if page is None:
            raise NotFoundError("page", request.slug)
        return page
