from pathlib import Path

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.control.models import (
    ControlDeliveryMode,
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
