from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.engine.run_ids import EngineRunId
from codealmanac.local.runs.artifacts.models import (
    COMMIT_SUBJECT_PREFIX,
    EngineChangedFile,
    EngineRunStatus,
)


class PrepareEngineRunRequest(CodeAlmanacModel):
    run_id: EngineRunId
    repository_id: str
    branch_id: str
    repository_full_name: str
    branch_name: str
    expected_head_sha: str
    repo_path: Path
    almanac_root: Path
    sources_path: Path
    operation: str = "update"
    source_bundle_ref: str | None = None
    commit_subject_prefix: str = COMMIT_SUBJECT_PREFIX

    @field_validator(
        "repository_id",
        "branch_id",
        "repository_full_name",
        "branch_name",
        "expected_head_sha",
        "operation",
        "commit_subject_prefix",
    )
    @classmethod
    def require_text(cls, value: str) -> str:
        return required_text(value, "engine run request text")

    @field_validator("source_bundle_ref")
    @classmethod
    def require_optional_source_ref(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "source bundle ref")


class WriteEngineRunResultRequest(CodeAlmanacModel):
    run_id: EngineRunId
    status: EngineRunStatus
    summary: str | None = None
    commit_subject: str | None = None
    commit_body: str | None = None
    changed_files: tuple[EngineChangedFile, ...] = ()
    error: str | None = None
    result_artifact_refs: tuple[str, ...] = ()

    @field_validator("summary", "commit_subject", "commit_body", "error")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "engine run result text")

    @field_validator("result_artifact_refs")
    @classmethod
    def require_result_artifact_refs(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        for item in value:
            required_text(item, "engine run result artifact ref")
        return value


class ReadEngineRunRequest(CodeAlmanacModel):
    run_id: EngineRunId
