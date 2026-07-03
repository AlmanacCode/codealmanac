from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.cloud_auth.models import (
    DEFAULT_CLOUD_API_URL,
    DEFAULT_CLOUD_APP_URL,
    normalize_api_url,
    normalize_app_url,
)
from codealmanac.workflows.cloud_open.models import CloudOpenTarget


class OpenCloudTargetRequest(CodeAlmanacModel):
    cwd: Path
    target: CloudOpenTarget = "wiki"
    api_url: str = DEFAULT_CLOUD_API_URL
    app_url: str = DEFAULT_CLOUD_APP_URL
    no_browser: bool = False

    @field_validator("api_url")
    @classmethod
    def normalize_api_url(cls, value: str) -> str:
        return normalize_api_url(value)

    @field_validator("app_url")
    @classmethod
    def normalize_app_url(cls, value: str) -> str:
        return normalize_app_url(value)
