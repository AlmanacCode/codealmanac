from datetime import datetime
from enum import StrEnum
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text


class ControlDeliveryMode(StrEnum):
    WORKING_TREE = "working_tree"
    COMMIT = "commit"
    PR = "pr"


class TriggerEventKind(StrEnum):
    CLOUD_WEBHOOK = "cloud_webhook"
    LOCAL_POST_COMMIT = "local_post_commit"
    LOCAL_POST_MERGE = "local_post_merge"
    LOCAL_POST_REWRITE = "local_post_rewrite"
    MANUAL = "manual"


class TriggerEventStatus(StrEnum):
    PENDING = "pending"
    CLAIMED = "claimed"
    IGNORED = "ignored"
    SUPERSEDED = "superseded"


class ControlRunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    STALE = "stale"
    CANCELLED = "cancelled"


class ControlRunEventKind(StrEnum):
    STATUS = "status"
    MESSAGE = "message"
    TOOL = "tool"
    OUTPUT = "output"
    ERROR = "error"


class RepositoryRecord(CodeAlmanacModel):
    id: str
    provider: str
    provider_repo_id: str | None = None
    owner_login: str
    owner_type: str | None = None
    name: str
    full_name: str
    default_branch: str | None = None
    almanac_root: Path
    local_root_path: Path | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("id")
    @classmethod
    def require_id(cls, value: str) -> str:
        return required_text(value, "repository id")

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


class BranchRecord(CodeAlmanacModel):
    id: str
    repository_id: str
    name: str
    trigger_enabled: bool
    delivery_mode: ControlDeliveryMode
    last_seen_head_sha: str | None = None
    last_triggered_head_sha: str | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("id")
    @classmethod
    def require_id(cls, value: str) -> str:
        return required_text(value, "branch id")

    @field_validator("repository_id")
    @classmethod
    def require_repository_id(cls, value: str) -> str:
        return required_text(value, "branch repository_id")

    @field_validator("name")
    @classmethod
    def require_name(cls, value: str) -> str:
        return required_text(value, "branch name")


class TriggerEventRecord(CodeAlmanacModel):
    id: str
    repository_id: str
    branch_id: str
    kind: TriggerEventKind
    head_sha: str
    previous_head_sha: str | None = None
    payload_ref: str | None = None
    status: TriggerEventStatus
    created_at: datetime
    claimed_at: datetime | None = None

    @field_validator("id")
    @classmethod
    def require_id(cls, value: str) -> str:
        return required_text(value, "trigger event id")

    @field_validator("repository_id")
    @classmethod
    def require_repository_id(cls, value: str) -> str:
        return required_text(value, "trigger event repository_id")

    @field_validator("branch_id")
    @classmethod
    def require_branch_id(cls, value: str) -> str:
        return required_text(value, "trigger event branch_id")

    @field_validator("head_sha")
    @classmethod
    def require_head_sha(cls, value: str) -> str:
        return required_text(value, "trigger event head_sha")


class RecordTriggerEventResult(CodeAlmanacModel):
    recorded: bool
    reason: str | None = None
    event: TriggerEventRecord | None = None


class LocalGitState(CodeAlmanacModel):
    cwd: Path
    available: bool
    repository_root: Path | None = None
    branch_name: str | None = None
    head_sha: str | None = None
    unavailable_reason: str | None = None


class ControlRunRecord(CodeAlmanacModel):
    id: str
    repository_id: str
    branch_id: str
    trigger_event_id: str | None = None
    operation: str
    status: ControlRunStatus
    expected_head_sha: str | None = None
    source_bundle_ref: str | None = None
    request_ref: str | None = None
    result_ref: str | None = None
    summary: str | None = None
    commit_subject: str | None = None
    commit_body: str | None = None
    error: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("id")
    @classmethod
    def require_id(cls, value: str) -> str:
        return required_text(value, "run id")

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


class ControlRunEventRecord(CodeAlmanacModel):
    run_id: str
    sequence: int
    timestamp: datetime
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


class ClaimNextTriggerResult(CodeAlmanacModel):
    claimed: bool
    reason: str | None = None
    trigger: TriggerEventRecord | None = None
    run: ControlRunRecord | None = None


class ControlSchemaStatus(CodeAlmanacModel):
    path: Path
    user_version: int
    tables: tuple[str, ...]
