from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.cloud_auth.models import (
    DEFAULT_CLOUD_API_URL,
    normalize_api_url,
)
from codealmanac.services.cloud_capture.models import (
    ALL_CAPTURE_PROVIDERS,
    CaptureProvider,
    unique_providers,
)


class CaptureRequest(CodeAlmanacModel):
    api_url: str = DEFAULT_CLOUD_API_URL

    @field_validator("api_url")
    @classmethod
    def normalize_api_url(cls, value: str) -> str:
        return normalize_api_url(value)


class CaptureStatusRequest(CaptureRequest):
    check_cloud: bool = False


class CaptureEnableRequest(CaptureRequest):
    providers: tuple[CaptureProvider, ...] = ALL_CAPTURE_PROVIDERS
    name: str = Field(default="CodeAlmanac capture", min_length=1)

    @field_validator("providers")
    @classmethod
    def validate_providers(
        cls,
        value: tuple[CaptureProvider, ...],
    ) -> tuple[CaptureProvider, ...]:
        return unique_providers(value)


class CaptureRepairRequest(CaptureEnableRequest):
    pass


class CaptureDisableRequest(CaptureRequest):
    providers: tuple[CaptureProvider, ...] = ALL_CAPTURE_PROVIDERS
    revoke_remote: bool = True

    @field_validator("providers")
    @classmethod
    def validate_providers(
        cls,
        value: tuple[CaptureProvider, ...],
    ) -> tuple[CaptureProvider, ...]:
        return unique_providers(value)


class CaptureHookRequest(CodeAlmanacModel):
    provider: CaptureProvider
    payload: dict[str, object]
