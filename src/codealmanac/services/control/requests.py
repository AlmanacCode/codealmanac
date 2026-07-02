import json
from datetime import datetime
from pathlib import Path

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.control.models import (
    ControlDeliveryMode,
    ControlRunEventKind,
    ControlRunStatus,
    SessionProvider,
    TriggerEventKind,
    TriggerEventStatus,
)


class ReadControlSchemaStatusRequest(CodeAlmanacModel):
    ensure: bool = True


class GetRepositoryRequest(CodeAlmanacModel):
    repository_id: str

    @field_validator("repository_id")
    @classmethod
    def require_repository_id(cls, value: str) -> str:
        return required_text(value, "repository id")


class FindRepositoryByLocalRootRequest(CodeAlmanacModel):
    root_path: Path


class GetBranchRequest(CodeAlmanacModel):
    branch_id: str

    @field_validator("branch_id")
    @classmethod
    def require_branch_id(cls, value: str) -> str:
        return required_text(value, "branch id")


class FindBranchByNameRequest(CodeAlmanacModel):
    repository_id: str
    name: str

    @field_validator("repository_id")
    @classmethod
    def require_repository_id(cls, value: str) -> str:
        return required_text(value, "branch repository_id")

    @field_validator("name")
    @classmethod
    def require_name(cls, value: str) -> str:
        return required_text(value, "branch name")


class GetControlRunRequest(CodeAlmanacModel):
    run_id: str

    @field_validator("run_id")
    @classmethod
    def require_run_id(cls, value: str) -> str:
        return required_text(value, "run id")


class ListBranchSessionsRequest(CodeAlmanacModel):
    branch_id: str

    @field_validator("branch_id")
    @classmethod
    def require_branch_id(cls, value: str) -> str:
        return required_text(value, "branch id")


class UpsertRepositoryRequest(CodeAlmanacModel):
    provider: str
    owner_login: str
    name: str
    full_name: str
    almanac_root: Path
    provider_repo_id: str | None = None
    owner_type: str | None = None
    default_branch: str | None = None
    local_root_path: Path | None = None

    @field_validator("provider")
    @classmethod
    def require_provider(cls, value: str) -> str:
        return required_text(value, "repository provider")

    @field_validator("owner_login")
    @classmethod
    def require_owner_login(cls, value: str) -> str:
        return required_text(value, "repository owner_login")

    @field_validator("name")
    @classmethod
    def require_name(cls, value: str) -> str:
        return required_text(value, "repository name")

    @field_validator("full_name")
    @classmethod
    def require_full_name(cls, value: str) -> str:
        return required_text(value, "repository full_name")


class SetBranchPolicyRequest(CodeAlmanacModel):
    repository_id: str
    name: str
    trigger_enabled: bool = True
    delivery_mode: ControlDeliveryMode = ControlDeliveryMode.COMMIT
    last_seen_head_sha: str | None = None

    @field_validator("repository_id")
    @classmethod
    def require_repository_id(cls, value: str) -> str:
        return required_text(value, "branch repository_id")

    @field_validator("name")
    @classmethod
    def require_name(cls, value: str) -> str:
        return required_text(value, "branch name")


class RecordTriggerEventRequest(CodeAlmanacModel):
    repository_id: str
    branch_name: str
    kind: TriggerEventKind
    head_sha: str
    previous_head_sha: str | None = None
    payload_ref: str | None = None
    allow_duplicate_head: bool = False
    replace_pending: bool = False

    @field_validator("repository_id")
    @classmethod
    def require_repository_id(cls, value: str) -> str:
        return required_text(value, "trigger repository_id")

    @field_validator("branch_name")
    @classmethod
    def require_branch_name(cls, value: str) -> str:
        return required_text(value, "trigger branch_name")

    @field_validator("head_sha")
    @classmethod
    def require_head_sha(cls, value: str) -> str:
        return required_text(value, "trigger head_sha")


class ListTriggerEventsRequest(CodeAlmanacModel):
    repository_id: str | None = None
    branch_id: str | None = None
    statuses: tuple[TriggerEventStatus, ...] = Field(default_factory=tuple)


class RecordLocalTriggerRequest(CodeAlmanacModel):
    repository_root: Path
    branch_name: str
    kind: TriggerEventKind
    head_sha: str
    previous_head_sha: str | None = None
    payload_ref: str | None = None

    @field_validator("branch_name")
    @classmethod
    def require_branch_name(cls, value: str) -> str:
        return required_text(value, "local trigger branch_name")

    @field_validator("head_sha")
    @classmethod
    def require_head_sha(cls, value: str) -> str:
        return required_text(value, "local trigger head_sha")


class RecordCurrentGitTriggerRequest(CodeAlmanacModel):
    cwd: Path
    kind: TriggerEventKind
    previous_head_sha: str | None = None
    payload_ref: str | None = None


class CreateControlRunRequest(CodeAlmanacModel):
    repository_id: str
    branch_id: str
    operation: str = "update"
    status: ControlRunStatus = ControlRunStatus.QUEUED
    trigger_event_id: str | None = None
    expected_head_sha: str | None = None
    source_bundle_ref: str | None = None
    request_ref: str | None = None

    @field_validator("repository_id")
    @classmethod
    def require_repository_id(cls, value: str) -> str:
        return required_text(value, "run repository_id")

    @field_validator("branch_id")
    @classmethod
    def require_branch_id(cls, value: str) -> str:
        return required_text(value, "run branch_id")

    @field_validator("operation")
    @classmethod
    def require_operation(cls, value: str) -> str:
        return required_text(value, "run operation")


class UpdateControlRunRequest(CodeAlmanacModel):
    run_id: str
    status: ControlRunStatus | None = None
    source_bundle_ref: str | None = None
    request_ref: str | None = None
    result_ref: str | None = None
    summary: str | None = None
    commit_subject: str | None = None
    commit_body: str | None = None
    error: str | None = None

    @field_validator("run_id")
    @classmethod
    def require_run_id(cls, value: str) -> str:
        return required_text(value, "run id")

    @field_validator(
        "source_bundle_ref",
        "request_ref",
        "result_ref",
        "summary",
        "commit_subject",
        "commit_body",
        "error",
    )
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "run update text")


class AppendControlRunEventRequest(CodeAlmanacModel):
    run_id: str
    kind: ControlRunEventKind
    message: str
    event_json: str | None = None
    artifact_ref: str | None = None

    @field_validator("run_id")
    @classmethod
    def require_run_id(cls, value: str) -> str:
        return required_text(value, "run event run_id")

    @field_validator("message")
    @classmethod
    def require_message(cls, value: str) -> str:
        return required_text(value, "run event message")


class UpsertSessionRequest(CodeAlmanacModel):
    provider: SessionProvider
    provider_session_id: str
    source_ref: str
    started_at: datetime | None = None
    ended_at: datetime | None = None

    @field_validator("provider_session_id")
    @classmethod
    def require_provider_session_id(cls, value: str) -> str:
        return required_text(value, "provider session id")

    @field_validator("source_ref")
    @classmethod
    def require_source_ref(cls, value: str) -> str:
        return required_text(value, "session source ref")


class UpsertTurnRequest(CodeAlmanacModel):
    session_id: str
    sequence: int
    provider_turn_id: str | None = None
    created_at: datetime | None = None
    metadata_json: str = "{}"

    @field_validator("session_id")
    @classmethod
    def require_session_id(cls, value: str) -> str:
        return required_text(value, "turn session id")

    @field_validator("sequence")
    @classmethod
    def require_positive_sequence(cls, value: int) -> int:
        if value < 1:
            raise ValueError("turn sequence must be positive")
        return value

    @field_validator("provider_turn_id")
    @classmethod
    def require_optional_provider_turn_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "provider turn id")

    @field_validator("metadata_json")
    @classmethod
    def require_json_object(cls, value: str) -> str:
        metadata = json.loads(required_text(value, "turn metadata json"))
        if not isinstance(metadata, dict):
            raise ValueError("turn metadata_json must be a JSON object")
        return value


class LinkTurnBranchRequest(CodeAlmanacModel):
    turn_id: str
    branch_id: str
    confidence: float = 1.0
    detector: str

    @field_validator("turn_id")
    @classmethod
    def require_turn_id(cls, value: str) -> str:
        return required_text(value, "turn id")

    @field_validator("branch_id")
    @classmethod
    def require_branch_id(cls, value: str) -> str:
        return required_text(value, "branch id")

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, value: float) -> float:
        if value < 0 or value > 1:
            raise ValueError("turn branch confidence must be between 0 and 1")
        return value

    @field_validator("detector")
    @classmethod
    def require_detector(cls, value: str) -> str:
        return required_text(value, "turn branch detector")


class ListControlRunEventsRequest(CodeAlmanacModel):
    run_id: str

    @field_validator("run_id")
    @classmethod
    def require_run_id(cls, value: str) -> str:
        return required_text(value, "run id")


class ListControlRunsRequest(CodeAlmanacModel):
    repository_id: str | None = None
    branch_id: str | None = None
    statuses: tuple[ControlRunStatus, ...] = Field(default_factory=tuple)
    limit: int = 20

    @field_validator("repository_id", "branch_id")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "run list filter")

    @field_validator("limit")
    @classmethod
    def require_valid_limit(cls, value: int) -> int:
        if value < 1 or value > 100:
            raise ValueError("run list limit must be between 1 and 100")
        return value


class ClaimNextTriggerRequest(CodeAlmanacModel):
    repository_id: str | None = None
    branch_id: str | None = None
    operation: str = "update"
    source_bundle_ref: str | None = None
    request_ref: str | None = None

    @field_validator("operation")
    @classmethod
    def require_operation(cls, value: str) -> str:
        return required_text(value, "claim operation")
