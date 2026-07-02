from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from uuid import uuid4

from pydantic import Field, field_validator, model_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.runs.models import RunId

COMMIT_SUBJECT_PREFIX = "docs almanac:"


def utc_now() -> datetime:
    return datetime.now(UTC)


class EngineRunStatus(StrEnum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    STALE = "stale"
    CANCELLED = "cancelled"


class EngineFileChangeKind(StrEnum):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"


class EngineChangedFile(CodeAlmanacModel):
    path: Path
    kind: EngineFileChangeKind
    summary: str | None = None

    @field_validator("path")
    @classmethod
    def require_relative_path(cls, value: Path) -> Path:
        if value.is_absolute() or ".." in value.parts:
            raise ValueError("changed file path must be repo-relative")
        return value

    @field_validator("summary")
    @classmethod
    def require_optional_summary(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "changed file summary")


class EngineRunArtifactPaths(CodeAlmanacModel):
    run_id: RunId
    run_path: Path
    request_path: Path
    result_path: Path
    artifacts_path: Path


class EngineRunRequest(CodeAlmanacModel):
    version: int = 1
    request_id: str = Field(default_factory=lambda: f"engine_req_{uuid4().hex}")
    run_id: RunId
    operation: str = "update"
    repository_id: str
    branch_id: str
    repository_full_name: str
    branch_name: str
    expected_head_sha: str
    repo_path: Path
    almanac_root: Path
    sources_path: Path
    run_path: Path
    source_bundle_ref: str | None = None
    commit_subject_prefix: str = COMMIT_SUBJECT_PREFIX
    created_at: datetime = Field(default_factory=utc_now)

    @field_validator(
        "request_id",
        "operation",
        "repository_id",
        "branch_id",
        "repository_full_name",
        "branch_name",
        "expected_head_sha",
        "commit_subject_prefix",
    )
    @classmethod
    def require_text(cls, value: str) -> str:
        return required_text(value, "engine run request text")

    @field_validator("source_bundle_ref")
    @classmethod
    def require_optional_ref(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "source bundle ref")

    @model_validator(mode="after")
    def validate_version_and_commit_prefix(self) -> "EngineRunRequest":
        if self.version != 1:
            raise ValueError("engine run request version must be 1")
        if self.commit_subject_prefix != COMMIT_SUBJECT_PREFIX:
            raise ValueError(
                f"commit subject prefix must be {COMMIT_SUBJECT_PREFIX!r}"
            )
        return self


class EngineRunResult(CodeAlmanacModel):
    version: int = 1
    result_id: str = Field(default_factory=lambda: f"engine_res_{uuid4().hex}")
    run_id: RunId
    status: EngineRunStatus
    summary: str | None = None
    commit_subject: str | None = None
    commit_body: str | None = None
    changed_files: tuple[EngineChangedFile, ...] = ()
    error: str | None = None
    result_artifact_refs: tuple[str, ...] = ()
    finished_at: datetime = Field(default_factory=utc_now)

    @field_validator("result_id")
    @classmethod
    def require_result_id(cls, value: str) -> str:
        return required_text(value, "engine run result id")

    @field_validator("summary", "commit_body", "error")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "engine run result text")

    @field_validator("commit_subject")
    @classmethod
    def require_commit_subject_style(cls, value: str | None) -> str | None:
        if value is None:
            return None
        subject = required_text(value, "engine run commit subject")
        if not subject.startswith(COMMIT_SUBJECT_PREFIX):
            raise ValueError(
                f"commit subject must start with {COMMIT_SUBJECT_PREFIX!r}"
            )
        return subject

    @field_validator("result_artifact_refs")
    @classmethod
    def require_result_artifact_refs(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        for item in value:
            required_text(item, "engine run result artifact ref")
        return value

    @model_validator(mode="after")
    def validate_version(self) -> "EngineRunResult":
        if self.version != 1:
            raise ValueError("engine run result version must be 1")
        return self


class PreparedEngineRun(CodeAlmanacModel):
    request: EngineRunRequest
    paths: EngineRunArtifactPaths
