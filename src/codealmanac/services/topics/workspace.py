from pathlib import Path

from codealmanac.services.workspaces.models import Workspace
from codealmanac.services.workspaces.requests import SelectWorkspaceRequest
from codealmanac.services.workspaces.service import WorkspacesService


def resolve_topic_workspace(
    workspaces: WorkspacesService,
    cwd: Path,
    wiki: str | None,
) -> Workspace:
    if wiki is None:
        return workspaces.resolve(cwd)
    return workspaces.select(SelectWorkspaceRequest(selector=wiki, base_path=cwd))
