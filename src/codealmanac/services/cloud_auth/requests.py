from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.cloud_auth.models import (
    DEFAULT_CLOUD_API_URL,
    normalize_api_url,
)


class CloudAuthRequest(CodeAlmanacModel):
    api_url: str = DEFAULT_CLOUD_API_URL

    @field_validator("api_url")
    @classmethod
    def normalize_api_url(cls, value: str) -> str:
        return normalize_api_url(value)


class CloudLoginStartRequest(CloudAuthRequest):
    pass


class CloudLoginPollRequest(CloudAuthRequest):
    session_id: UUID


class SaveCloudTokenRequest(CloudAuthRequest):
    access_token: str = Field(min_length=1)
    refresh_token: str | None = Field(default=None, min_length=1)
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

    @property
    def token(self) -> str:
        return self.access_token


class CloudStatusRequest(CloudAuthRequest):
    validate_remote: bool = True


class CloudLogoutRequest(CloudAuthRequest):
    pass
