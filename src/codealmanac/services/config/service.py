from pathlib import Path

from codealmanac.core.errors import NotFoundError
from codealmanac.core.paths import normalize_path
from codealmanac.services.config.models import CodeAlmanacConfig
from codealmanac.services.config.requests import LoadConfigRequest
from codealmanac.services.config.store import ConfigStore
from codealmanac.wiki.workspaces.requests import SelectWorkspaceRequest
from codealmanac.wiki.workspaces.service import WorkspacesService

PROJECT_CONFIG_NAME = "config.toml"


class ConfigService:
    def __init__(
        self,
        workspaces: WorkspacesService,
        store: ConfigStore,
        user_config_path: Path,
    ):
        self.workspaces = workspaces
        self.store = store
        self.user_config_path = user_config_path

    def load(self, request: LoadConfigRequest) -> CodeAlmanacConfig:
        project_config_path = self._project_config_path(request)
        paths = config_source_paths(
            user_config_path=normalize_path(self.user_config_path),
            project_config_path=project_config_path,
        )
        return self.store.load(paths)

    def _project_config_path(self, request: LoadConfigRequest) -> Path | None:
        if request.wiki is not None:
            workspace = self.workspaces.select(
                SelectWorkspaceRequest(
                    selector=request.wiki,
                    base_path=request.cwd,
                )
            )
            return workspace.almanac_path / PROJECT_CONFIG_NAME
        try:
            workspace = self.workspaces.resolve(request.cwd)
        except (NotFoundError, OSError):
            return None
        return workspace.almanac_path / PROJECT_CONFIG_NAME


def config_source_paths(
    user_config_path: Path,
    project_config_path: Path | None,
) -> tuple[Path, ...]:
    if project_config_path is None:
        return (user_config_path,)
    return (project_config_path, user_config_path)
