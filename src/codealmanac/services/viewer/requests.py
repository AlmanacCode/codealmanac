from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.wiki.paths import (
    looks_like_dir,
    normalize_reference_path_preserving_case,
)


class ViewerOverviewRequest(CodeAlmanacModel):
    cwd: Path
    wiki: str | None = None
    page_limit: int = 30

    @field_validator("page_limit")
    @classmethod
    def non_negative_page_limit(cls, value: int) -> int:
        if value < 0:
            raise ValueError("page_limit must be non-negative")
        return value


class ViewerPageRequest(CodeAlmanacModel):
    cwd: Path
    slug: str
    wiki: str | None = None

    @field_validator("slug")
    @classmethod
    def require_slug(cls, value: str) -> str:
        return required_text(value, "slug")


class ViewerSearchRequest(CodeAlmanacModel):
    cwd: Path
    wiki: str | None = None
    query: str | None = None
    limit: int = 50

    @field_validator("limit")
    @classmethod
    def non_negative_limit(cls, value: int) -> int:
        if value < 0:
            raise ValueError("limit must be non-negative")
        return value


class ViewerFileRequest(CodeAlmanacModel):
    cwd: Path
    path: str
    wiki: str | None = None
    limit: int = 50

    @field_validator("path")
    @classmethod
    def normalize_file_path(cls, value: str) -> str:
        path = required_text(value, "file path")
        normalized = normalize_reference_path_preserving_case(
            path,
            looks_like_dir(path),
        )
        if not normalized:
            raise ValueError("file path must be repo-relative")
        return normalized

    @field_validator("limit")
    @classmethod
    def non_negative_limit(cls, value: int) -> int:
        if value < 0:
            raise ValueError("limit must be non-negative")
        return value


class ViewerTopicRequest(CodeAlmanacModel):
    cwd: Path
    slug: str
    wiki: str | None = None
    include_descendants: bool = False

    @field_validator("slug")
    @classmethod
    def require_slug(cls, value: str) -> str:
        return required_text(value, "topic slug")
