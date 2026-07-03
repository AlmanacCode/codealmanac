import shutil
from pathlib import Path

from codealmanac.engine.run_ids import EngineRunId
from codealmanac.engine.worker_workspaces.models import WorkerWorkspacePaths

REPO_DIR_NAME = "repo"
SOURCES_DIR_NAME = "sources"
RUN_DIR_NAME = "run"


class WorkerWorkspacesStore:
    def __init__(self, root_path: Path):
        self.root_path = root_path

    def paths(self, run_id: EngineRunId) -> WorkerWorkspacePaths:
        root_path = self.root_path / run_id
        return WorkerWorkspacePaths(
            run_id=run_id,
            root_path=root_path,
            repo_path=root_path / REPO_DIR_NAME,
            sources_path=root_path / SOURCES_DIR_NAME,
            run_path=root_path / RUN_DIR_NAME,
        )

    def exists(self, paths: WorkerWorkspacePaths) -> bool:
        return paths.root_path.exists()

    def create_non_repo_dirs(self, paths: WorkerWorkspacePaths) -> None:
        paths.sources_path.mkdir(parents=True, exist_ok=True)
        paths.run_path.mkdir(parents=True, exist_ok=True)

    def remove_tree(self, paths: WorkerWorkspacePaths) -> None:
        shutil.rmtree(paths.root_path, ignore_errors=True)
