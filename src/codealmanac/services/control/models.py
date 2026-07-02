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


class ControlSchemaStatus(CodeAlmanacModel):
    path: Path
    user_version: int
    tables: tuple[str, ...]
