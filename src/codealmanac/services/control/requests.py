from pathlib import Path

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.control.models import (
    ControlDeliveryMode,
    ControlRunEventKind,
    ControlRunStatus,
    TriggerEventKind,
    TriggerEventStatus,
)


class EnsureControlSchemaRequest(CodeAlmanacModel):
    pass


class ReadControlSchemaStatusRequest(CodeAlmanacModel):
    ensure: bool = True


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
    result_ref: str | None = None
    summary: str | None = None
    commit_subject: str | None = None
    commit_body: str | None = None
    error: str | None = None

    @field_validator("run_id")
    @classmethod
    def require_run_id(cls, value: str) -> str:
        return required_text(value, "run id")


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


class ListControlRunEventsRequest(CodeAlmanacModel):
    run_id: str

    @field_validator("run_id")
    @classmethod
    def require_run_id(cls, value: str) -> str:
        return required_text(value, "run id")


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
