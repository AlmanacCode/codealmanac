from datetime import datetime
from pathlib import Path
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from codealmanac.cloud.auth.models import normalize_api_url
from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text

CaptureProvider = Literal["codex", "claude"]
CaptureBranchSource = Literal["transcript", "git_fallback", "missing"]
CaptureRoutingStatus = Literal["routable", "missing_branch", "missing_repo"]
CaptureUploadStatus = Literal["not_attempted", "uploaded", "skipped", "failed"]


class CaptureCredential(CodeAlmanacModel):
    id: UUID
    name: str
    created_at: datetime | None = None
    last_used_at: datetime | None = None


class CaptureCredentialIssue(CodeAlmanacModel):
    credential: CaptureCredential
    token: str = Field(min_length=1)


class CaptureCloudStatus(CodeAlmanacModel):
    credentials: tuple[CaptureCredential, ...] = ()


class CaptureState(CodeAlmanacModel):
    api_url: str = Field(min_length=1)
    token: str = Field(min_length=1)
    created_at: datetime
    providers: tuple[CaptureProvider, ...]

    @field_validator("api_url")
    @classmethod
    def normalize_api_url(cls, value: str) -> str:
        return normalize_api_url(value)

    @field_validator("providers")
    @classmethod
    def require_providers(
        cls,
        value: tuple[CaptureProvider, ...],
    ) -> tuple[CaptureProvider, ...]:
        return unique_providers(value)


class CaptureHookStatus(CodeAlmanacModel):
    provider: CaptureProvider
    installed: bool
    path: str
    message: str


class CaptureHookChange(CaptureHookStatus):
    changed: bool


class CaptureStatus(CodeAlmanacModel):
    api_url: str
    signed_in: bool
    credential_present: bool
    providers: tuple[CaptureProvider, ...] = ()
    hooks: tuple[CaptureHookStatus, ...] = ()
    cloud_credentials: tuple[CaptureCredential, ...] = ()

    @field_validator("api_url")
    @classmethod
    def normalize_api_url(cls, value: str) -> str:
        return normalize_api_url(value)


class CaptureEnableResult(CodeAlmanacModel):
    api_url: str
    providers: tuple[CaptureProvider, ...]
    credential_present: bool
    hooks: tuple[CaptureHookChange, ...]


class CaptureDisableResult(CodeAlmanacModel):
    api_url: str
    providers: tuple[CaptureProvider, ...]
    credential_removed: bool
    revoked_remote: bool
    hooks: tuple[CaptureHookChange, ...]


class CaptureHookEvent(CodeAlmanacModel):
    provider: CaptureProvider
    session_id: str | None = None
    transcript_path: str | None = None
    cwd: str | None = None
    hook_event_name: str | None = None
    turn_id: str | None = None
    received_at: datetime
    upload_status: CaptureUploadStatus = "not_attempted"
    upload_error: str | None = None
    artifact_ref: str | None = None
    repo_full_name: str | None = None
    branch: str | None = None
    routing_status: CaptureRoutingStatus | None = None


class CaptureInspectResult(CodeAlmanacModel):
    events: tuple[CaptureHookEvent, ...]


class CaptureArtifactUpload(CodeAlmanacModel):
    provider: CaptureProvider
    provider_session_id: str = Field(min_length=1)
    transcript_path: Path
    first_cwd: str = Field(min_length=1)
    content_type: str = "application/jsonl"
    body: bytes


class CaptureArtifact(CodeAlmanacModel):
    ref: str = Field(min_length=1)
    sha256: str = Field(min_length=64, max_length=64)
    size_bytes: int = Field(ge=0)
    content_type: str = Field(min_length=1)


class CaptureRepositoryState(CodeAlmanacModel):
    cwd: str
    repo_available: bool
    repo_full_name: str | None = None
    branch: str | None = None
    head_sha: str | None = None
    unavailable_reason: str | None = None


class CaptureTranscriptUpload(CodeAlmanacModel):
    provider: CaptureProvider
    provider_session_id: str = Field(min_length=1)
    provider_turn_id: str = Field(min_length=1)
    transcript_path_hash: str = Field(min_length=64, max_length=64)
    first_cwd: str = Field(min_length=1)
    repo_full_name: str | None = None
    branch: str | None = None
    branch_source: CaptureBranchSource
    routing_status: CaptureRoutingStatus
    head_sha: str | None = None
    started_at: datetime
    completed_at: datetime | None = None
    artifact_ref: str = Field(min_length=1)

    @model_validator(mode="after")
    def validate_routing(self) -> "CaptureTranscriptUpload":
        if self.routing_status == "routable" and (
            self.repo_full_name is None or self.branch is None
        ):
            raise ValueError("routable capture turns require a repository and branch")
        if self.routing_status == "missing_branch" and self.branch is not None:
            raise ValueError("missing_branch capture turns cannot include a branch")
        if self.routing_status == "missing_repo" and self.repo_full_name is not None:
            raise ValueError("missing_repo capture turns cannot include a repository")
        return self


class CaptureTurnUploadResult(CodeAlmanacModel):
    accepted: bool
    routed: bool
    routing_status: CaptureRoutingStatus
    source_id: UUID | None = None
    turn_id: UUID | None = None
    message_count: int = 0


def unique_providers(
    providers: tuple[CaptureProvider, ...],
) -> tuple[CaptureProvider, ...]:
    unique: list[CaptureProvider] = []
    for provider in providers:
        required_text(provider, "capture provider")
        if provider not in unique:
            unique.append(provider)
    if len(unique) == 0:
        raise ValueError("at least one capture provider is required")
    return tuple(unique)


ALL_CAPTURE_PROVIDERS: tuple[CaptureProvider, ...] = ("codex", "claude")
