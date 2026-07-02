from pathlib import Path
from uuid import uuid4

from pydantic import ValidationError

from codealmanac.services.engine_runs.models import (
    EngineRunArtifactPaths,
    EngineRunRequest,
    EngineRunResult,
)
from codealmanac.services.runs.models import RunId

REQUEST_FILE_NAME = "request.json"
RESULT_FILE_NAME = "result.json"
ARTIFACTS_DIR_NAME = "artifacts"


class EngineRunsStore:
    def __init__(self, root_path: Path):
        self.root_path = root_path

    def paths(self, run_id: RunId) -> EngineRunArtifactPaths:
        run_path = self.root_path / run_id
        return EngineRunArtifactPaths(
            run_id=run_id,
            run_path=run_path,
            request_path=run_path / REQUEST_FILE_NAME,
            result_path=run_path / RESULT_FILE_NAME,
            artifacts_path=run_path / ARTIFACTS_DIR_NAME,
        )

    def write_request(self, request: EngineRunRequest) -> EngineRunArtifactPaths:
        paths = self.paths(request.run_id)
        paths.artifacts_path.mkdir(parents=True, exist_ok=True)
        write_json_atomically(paths.request_path, request.model_dump_json(indent=2))
        return paths

    def read_request(self, run_id: RunId) -> EngineRunRequest | None:
        path = self.paths(run_id).request_path
        if not path.is_file():
            return None
        try:
            return EngineRunRequest.model_validate_json(path.read_text("utf-8"))
        except (OSError, ValidationError, ValueError):
            return None

    def write_result(self, result: EngineRunResult) -> EngineRunArtifactPaths:
        paths = self.paths(result.run_id)
        paths.artifacts_path.mkdir(parents=True, exist_ok=True)
        write_json_atomically(paths.result_path, result.model_dump_json(indent=2))
        return paths

    def read_result(self, run_id: RunId) -> EngineRunResult | None:
        path = self.paths(run_id).result_path
        if not path.is_file():
            return None
        try:
            return EngineRunResult.model_validate_json(path.read_text("utf-8"))
        except (OSError, ValidationError, ValueError):
            return None


def write_json_atomically(path: Path, payload: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        temporary.write_text(payload, encoding="utf-8")
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()
