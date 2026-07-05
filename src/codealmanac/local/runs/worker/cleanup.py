from contextlib import suppress

from codealmanac.engine.workspaces.requests import RemoveEngineWorkspaceRequest
from codealmanac.engine.workspaces.service import EngineWorkspacesService
from codealmanac.local.runs.preparation.models import LocalRunPreparationResult


def remove_engine_workspace(
    engine_workspaces: EngineWorkspacesService,
    preparation: LocalRunPreparationResult,
) -> None:
    if (
        preparation.run is None
        or preparation.repository is None
        or preparation.repository.local_root_path is None
    ):
        return
    with suppress(Exception):
        engine_workspaces.remove(
            RemoveEngineWorkspaceRequest(
                run_id=preparation.run.id,
                repository_root_path=preparation.repository.local_root_path,
            )
        )
