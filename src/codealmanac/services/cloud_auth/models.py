from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text

DEFAULT_CLOUD_API_URL = "https://codealmanac-backend-docker.onrender.com"
DEFAULT_CLOUD_APP_URL = "https://codealmanac.com"

CloudLoginStatus = Literal["pending", "authorized", "complete", "expired"]
CloudLoginResultStatus = Literal[
    "signed_in",
    "already_signed_in",
    "expired",
    "timeout",
]


class CloudAuthState(CodeAlmanacModel):
    api_url: str = Field(min_length=1)
    access_token: str = Field(min_length=1)
    refresh_token: str | None = Field(default=None, min_length=1)
    github_user_id: int
    github_login: str = Field(min_length=1)
    logged_in_at: datetime

    @model_validator(mode="before")
    @classmethod
    def normalize_token_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        values = dict(data)
        if "access_token" not in values:
            access_token = values.get("accessToken") or values.get("token")
            if access_token is not None:
                values["access_token"] = access_token
        if "refresh_token" not in values:
            refresh_token = values.get("refreshToken")
            if refresh_token is not None:
                values["refresh_token"] = refresh_token
        values.pop("accessToken", None)
        values.pop("refreshToken", None)
        values.pop("token", None)
        return values

    @field_validator("api_url")
    @classmethod
    def normalize_api_url(cls, value: str) -> str:
        return normalize_api_url(value)

    @field_validator("github_login")
    @classmethod
    def require_github_login(cls, value: str) -> str:
        return required_text(value, "GitHub login")

    @property
    def token(self) -> str:
        return self.access_token


class CloudIdentity(CodeAlmanacModel):
    api_url: str
    github_user_id: int
    github_login: str

    @field_validator("api_url")
    @classmethod
    def normalize_api_url(cls, value: str) -> str:
        return normalize_api_url(value)


class CloudStatus(CodeAlmanacModel):
    api_url: str
    authenticated: bool
    github_user_id: int | None = None
    github_login: str | None = None

    @field_validator("api_url")
    @classmethod
    def normalize_api_url(cls, value: str) -> str:
        return normalize_api_url(value)


class CloudLoginSession(CodeAlmanacModel):
    session_id: UUID
    user_code: str
    verification_url: str
    expires_at: datetime
    status: CloudLoginStatus
    access_token: str | None = None
    refresh_token: str | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_token_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        values = dict(data)
        if "access_token" not in values:
            access_token = values.get("accessToken") or values.get("token")
            if access_token is not None:
                values["access_token"] = access_token
        if "refresh_token" not in values:
            refresh_token = values.get("refreshToken")
            if refresh_token is not None:
                values["refresh_token"] = refresh_token
        values.pop("accessToken", None)
        values.pop("refreshToken", None)
        values.pop("token", None)
        return values

    @property
    def token(self) -> str | None:
        return self.access_token


class CloudLoginResult(CodeAlmanacModel):
    api_url: str
    status: CloudLoginResultStatus
    github_user_id: int | None = None
    github_login: str | None = None
    verification_url: str | None = None
    user_code: str | None = None
    expires_at: datetime | None = None

    @field_validator("api_url")
    @classmethod
    def normalize_api_url(cls, value: str) -> str:
        return normalize_api_url(value)


class CloudLogoutResult(CodeAlmanacModel):
    api_url: str
    signed_out: bool
    github_user_id: int | None = None
    github_login: str | None = None

    @field_validator("api_url")
    @classmethod
    def normalize_api_url(cls, value: str) -> str:
        return normalize_api_url(value)


def normalize_api_url(value: str) -> str:
    text = required_text(value, "cloud API URL").rstrip("/")
    if not text.startswith(("https://", "http://")):
        raise ValueError("cloud API URL must start with http:// or https://")
    return text


def normalize_app_url(value: str) -> str:
    text = required_text(value, "cloud app URL").rstrip("/")
    if not text.startswith(("https://", "http://")):
        raise ValueError("cloud app URL must start with http:// or https://")
    return text
