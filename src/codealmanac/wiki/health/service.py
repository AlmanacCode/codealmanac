from codealmanac.wiki.health.requests import HealthCheckRequest
from codealmanac.wiki.index.models import HealthReport
from codealmanac.wiki.index.service import IndexService
from codealmanac.wiki.workspaces.requests import SelectWorkspaceRequest
from codealmanac.wiki.workspaces.service import WorkspacesService


class HealthService:
    def __init__(self, workspaces: WorkspacesService, index: IndexService):
        self.workspaces = workspaces
        self.index = index

    def check(self, request: HealthCheckRequest) -> HealthReport:
        if request.wiki is None:
            workspace = self.workspaces.resolve(request.cwd)
        else:
            workspace = self.workspaces.select(
                SelectWorkspaceRequest(selector=request.wiki, base_path=request.cwd)
            )
        return self.index.health_report(workspace.workspace_id)
