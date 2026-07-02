from datetime import UTC, datetime
from pathlib import Path

from pydantic import Field, field_validator, model_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.runs.models import RunId


def utc_now() -> datetime:
    return datetime.now(UTC)


class SourceBundleSessionInput(CodeAlmanacModel):
    session_id: str
    provider: str
    provider_session_id: str
    source_ref: str

    @field_validator(
        "session_id",
        "provider",
        "provider_session_id",
        "source_ref",
    )
    @classmethod
    def require_text(cls, value: str) -> str:
        return required_text(value, "source bundle session text")


class SourceBundleSessionFile(CodeAlmanacModel):
    session_id: str
    provider: str
    provider_session_id: str
    source_ref: str
    path: Path

    @field_validator(
        "session_id",
        "provider",
        "provider_session_id",
        "source_ref",
    )
    @classmethod
    def require_text(cls, value: str) -> str:
        return required_text(value, "source bundle session file text")

    @field_validator("path")
    @classmethod
    def require_relative_path(cls, value: Path) -> Path:
        if value.is_absolute() or ".." in value.parts:
            raise ValueError("source bundle paths must be relative")
        return value


class SourceBundleManifest(CodeAlmanacModel):
    version: int = 1
    run_id: RunId
    branch_id: str
    sessions: tuple[SourceBundleSessionFile, ...] = ()
    created_at: datetime = Field(default_factory=utc_now)

    @field_validator("branch_id")
    @classmethod
    def require_branch_id(cls, value: str) -> str:
        return required_text(value, "source bundle branch id")

    @model_validator(mode="after")
    def validate_version(self) -> "SourceBundleManifest":
        if self.version != 1:
            raise ValueError("source bundle manifest version must be 1")
        return self


class MaterializedSourceBundle(CodeAlmanacModel):
    root_path: Path
    manifest_path: Path
    sessions_path: Path
    manifest: SourceBundleManifest

    @property
    def session_count(self) -> int:
        return len(self.manifest.sessions)
