from enum import StrEnum

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text


class HarnessActorRole(StrEnum):
    ROOT = "root"
    HELPER = "helper"
    UNKNOWN = "unknown"


class HarnessActorConfidence(StrEnum):
    PROVIDER = "provider"
    DERIVED = "derived"
    UNKNOWN = "unknown"


class HarnessRunActor(CodeAlmanacModel):
    thread_id: str | None = None
    role: HarnessActorRole
    parent_thread_id: str | None = None
    label: str | None = None
    confidence: HarnessActorConfidence

    @field_validator("thread_id", "parent_thread_id", "label")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "harness actor text")
