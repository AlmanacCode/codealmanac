from datetime import datetime, timedelta
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.sources.models import TranscriptApp

DEFAULT_SYNC_INTERVAL = timedelta(hours=5)


class SyncSelectionRequest(CodeAlmanacModel):
    apps: tuple[TranscriptApp, ...]
    repository_name: str | None = None
    home: Path | None = None
    now: datetime | None = None
    interval: timedelta = DEFAULT_SYNC_INTERVAL

    @field_validator("apps")
    @classmethod
    def require_apps(
        cls,
        value: tuple[TranscriptApp, ...],
    ) -> tuple[TranscriptApp, ...]:
        if len(value) == 0:
            raise ValueError("at least one sync app is required")
        return value

    @field_validator("interval")
    @classmethod
    def positive_interval(cls, value: timedelta) -> timedelta:
        if value.total_seconds() <= 0:
            raise ValueError("sync interval must be positive")
        return value


class SyncStatusRequest(SyncSelectionRequest):
    pass


class SyncRequest(SyncSelectionRequest):
    harness: HarnessKind
    model: str
    auto_commit: bool = True
