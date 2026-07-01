from datetime import datetime, timedelta
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.sources.models import TranscriptApp
from codealmanac.workflows.sync.models import SyncExecution

DEFAULT_SYNC_PENDING_TIMEOUT = timedelta(hours=24)
DEFAULT_SYNC_MAX_FAILED_ATTEMPTS = 3


class SyncSelectionRequest(CodeAlmanacModel):
    cwd: Path
    apps: tuple[TranscriptApp, ...]
    quiet: timedelta
    wiki: str | None = None
    home: Path | None = None
    now: datetime | None = None
    pending_timeout: timedelta = DEFAULT_SYNC_PENDING_TIMEOUT
    max_failed_attempts: int = DEFAULT_SYNC_MAX_FAILED_ATTEMPTS

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

    @field_validator("max_failed_attempts")
    @classmethod
    def non_negative_max_failed_attempts(cls, value: int) -> int:
        if value < 0:
            raise ValueError("sync max failed attempts must be non-negative")
        return value


class RunSyncStatusRequest(SyncSelectionRequest):
    pass


class RunSyncRequest(SyncSelectionRequest):
    harness: HarnessKind
    execution: SyncExecution = SyncExecution.FOREGROUND
    claim_owner: str | None = None

    @field_validator("claim_owner")
    @classmethod
    def require_claim_owner(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "sync claim owner")
