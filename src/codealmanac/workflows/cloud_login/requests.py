from typing import Literal

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.cloud_auth.models import (
    DEFAULT_CLOUD_API_URL,
    normalize_api_url,
)

CloudLoginBrowserMode = Literal["prompt", "never", "open", "silent"]


class RunCloudLoginRequest(CodeAlmanacModel):
    api_url: str = DEFAULT_CLOUD_API_URL
    no_browser: bool = False
    browser_mode: CloudLoginBrowserMode = "prompt"
    timeout_seconds: float = Field(default=120.0, ge=0)
    poll_interval_seconds: float = Field(default=2.0, ge=0)
    force: bool = False

    @field_validator("api_url")
    @classmethod
    def normalize_api_url(cls, value: str) -> str:
        return normalize_api_url(value)
