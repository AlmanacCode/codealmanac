from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel


class SearchIndexRequest(CodeAlmanacModel):
    query: str | None = None
    topics: tuple[str, ...] = ()
    mentions: str | None = None
    limit: int | None = None

    @field_validator("limit")
    @classmethod
    def non_negative_limit(cls, value: int | None) -> int | None:
        if value is not None and value < 0:
            raise ValueError("limit must be non-negative")
        return value


class ReindexRequest(CodeAlmanacModel):
    cwd: Path
    wiki: str | None = None
