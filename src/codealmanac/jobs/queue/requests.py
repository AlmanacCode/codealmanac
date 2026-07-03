from datetime import datetime, timedelta
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text


class DrainJobQueueRequest(CodeAlmanacModel):
    cwd: Path
    wiki: str | None = None
    owner: str = "codealmanac-worker"
    pid: int | None = None
    now: datetime | None = None
    stale_after: timedelta = timedelta(minutes=30)
    max_jobs: int | None = None

    @field_validator("owner")
    @classmethod
    def require_owner(cls, value: str) -> str:
        return required_text(value, "job queue owner")

    @field_validator("pid")
    @classmethod
    def positive_pid(cls, value: int | None) -> int | None:
        if value is not None and value <= 0:
            raise ValueError("job queue pid must be positive")
        return value

    @field_validator("stale_after")
    @classmethod
    def positive_stale_after(cls, value: timedelta) -> timedelta:
        if value.total_seconds() <= 0:
            raise ValueError("job queue stale_after must be positive")
        return value

    @field_validator("max_jobs")
    @classmethod
    def positive_max_jobs(cls, value: int | None) -> int | None:
        if value is not None and value <= 0:
            raise ValueError("max_jobs must be positive")
        return value
