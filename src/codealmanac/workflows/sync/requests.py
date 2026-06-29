from datetime import datetime, timedelta
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.sources.models import TranscriptApp


class SyncSelectionRequest(CodeAlmanacModel):
    cwd: Path
    apps: tuple[TranscriptApp, ...]
    quiet: timedelta
    wiki: str | None = None
    home: Path | None = None
    now: datetime | None = None
    pending_timeout: timedelta = timedelta(hours=24)

    @field_validator("apps")
    @classmethod
    def require_apps(
        cls,
        value: tuple[TranscriptApp, ...],
    ) -> tuple[TranscriptApp, ...]:
        if len(value) == 0:
            raise ValueError("at least one sync app is required")
        return value

    @field_validator("quiet", "pending_timeout")
    @classmethod
    def non_negative_duration(cls, value: timedelta) -> timedelta:
        if value.total_seconds() < 0:
            raise ValueError("sync duration must be non-negative")
        return value


class RunSyncStatusRequest(SyncSelectionRequest):
    pass


class RunSyncRequest(SyncSelectionRequest):
    harness: HarnessKind
    claim_owner: str | None = None

    @field_validator("claim_owner")
    @classmethod
    def require_claim_owner(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "sync claim owner")
