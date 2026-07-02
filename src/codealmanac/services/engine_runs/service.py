from codealmanac.core.errors import NotFoundError
from codealmanac.services.engine_runs.models import (
    EngineRunRequest,
    EngineRunResult,
    PreparedEngineRun,
)
from codealmanac.services.engine_runs.requests import (
    PrepareEngineRunRequest,
    ReadEngineRunRequest,
    WriteEngineRunResultRequest,
)
from codealmanac.services.engine_runs.store import EngineRunsStore


class EngineRunsService:
    def __init__(self, store: EngineRunsStore):
        self.store = store

    def prepare(self, request: PrepareEngineRunRequest) -> PreparedEngineRun:
        paths = self.store.paths(request.run_id)
        engine_request = EngineRunRequest(
            run_id=request.run_id,
            operation=request.operation,
            repository_id=request.repository_id,
            branch_id=request.branch_id,
            repository_full_name=request.repository_full_name,
            branch_name=request.branch_name,
            expected_head_sha=request.expected_head_sha,
            repo_path=request.repo_path,
            almanac_root=request.almanac_root,
            sources_path=request.sources_path,
            run_path=paths.run_path,
            source_bundle_ref=request.source_bundle_ref,
            commit_subject_prefix=request.commit_subject_prefix,
        )
        written_paths = self.store.write_request(engine_request)
        return PreparedEngineRun(request=engine_request, paths=written_paths)

    def read_request(self, request: ReadEngineRunRequest) -> EngineRunRequest:
        engine_request = self.store.read_request(request.run_id)
        if engine_request is None:
            raise NotFoundError("engine run request", request.run_id)
        return engine_request

    def write_result(
        self,
        request: WriteEngineRunResultRequest,
    ) -> EngineRunResult:
        if self.store.read_request(request.run_id) is None:
            raise NotFoundError("engine run request", request.run_id)
        result = EngineRunResult(
            run_id=request.run_id,
            status=request.status,
            summary=request.summary,
            commit_subject=request.commit_subject,
            commit_body=request.commit_body,
            changed_files=request.changed_files,
            error=request.error,
            result_artifact_refs=request.result_artifact_refs,
        )
        self.store.write_result(result)
        return result

    def read_result(self, request: ReadEngineRunRequest) -> EngineRunResult:
        result = self.store.read_result(request.run_id)
        if result is None:
            raise NotFoundError("engine run result", request.run_id)
        return result
