from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.cloud_auth.models import normalize_api_url

CaptureProvider = Literal["codex", "claude"]


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

