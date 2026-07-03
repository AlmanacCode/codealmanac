from pathlib import Path

from codealmanac.core.errors import NotFoundError
from codealmanac.wiki.viewer.models import ViewerWorkspace
from codealmanac.wiki.viewer.projections import viewer_workspace
from codealmanac.wiki.workspaces.models import Workspace, WorkspaceRegistryStatus
from codealmanac.wiki.workspaces.requests import SelectWorkspaceRequest
from codealmanac.wiki.workspaces.service import WorkspacesService


class ViewerWorkspaceScope:
    def __init__(self, workspaces: WorkspacesService):
        self.workspaces = workspaces

    def select(self, cwd: Path, wiki: str | None) -> Workspace:
        if wiki is None:
            return self.select_default(cwd)
        return self.workspaces.select(
            SelectWorkspaceRequest(selector=wiki, base_path=cwd)
        )

    def select_default(self, cwd: Path) -> Workspace:
        try:
            return self.workspaces.resolve(cwd)
        except NotFoundError:
            workspaces = self.available_registered()
            if workspaces:
                return workspaces[0]
            raise

    def navigation(
        self,
        selected: Workspace,
        include_all: bool,
    ) -> tuple[ViewerWorkspace, ...]:
        if not include_all:
            return (viewer_workspace(selected),)

        ordered = [selected]
        seen = {selected.workspace_id}
        for workspace in self.available_registered():
            if workspace.workspace_id in seen:
                continue
            seen.add(workspace.workspace_id)
            ordered.append(workspace)
        return tuple(viewer_workspace(workspace) for workspace in ordered)

    def available_registered(self) -> tuple[Workspace, ...]:
        registry = self.workspaces.list_registry()
        return tuple(
            item.workspace
            for item in registry.items
            if item.status == WorkspaceRegistryStatus.AVAILABLE
        )
