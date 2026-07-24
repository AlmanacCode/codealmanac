from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import (
    CodeAlmanacModel,
    NonNegativeLimit,
    RequiredNonNegativeLimit,
)
from codealmanac.core.text import required_text
from codealmanac.services.repositories.models import RepositoryName
from codealmanac.services.runs.models import RunId
from codealmanac.services.wiki.paths import (
    looks_like_dir,
    normalize_reference_path_preserving_case,
)


class ViewerOverviewRequest(CodeAlmanacModel):
    cwd: Path
    repository_name: RepositoryName | None = None
    page_limit: int = 30
    include_repositories: bool = True

    @field_validator("page_limit")
    @classmethod
    def non_negative_page_limit(cls, value: int) -> int:
        if value < 0:
            raise ValueError("page_limit must be non-negative")
        return value


class ViewerPageRequest(CodeAlmanacModel):
    cwd: Path
    slug: str
    repository_name: RepositoryName | None = None

    @field_validator("slug")
    @classmethod
    def require_slug(cls, value: str) -> str:
        return required_text(value, "slug")


class ViewerSearchRequest(CodeAlmanacModel):
    cwd: Path
    repository_name: RepositoryName | None = None
    query: str | None = None
    limit: RequiredNonNegativeLimit = 50


class ViewerFileRequest(CodeAlmanacModel):
    cwd: Path
    path: str
    repository_name: RepositoryName | None = None
    limit: RequiredNonNegativeLimit = 50

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


class ViewerTopicRequest(CodeAlmanacModel):
    cwd: Path
    slug: str
    repository_name: RepositoryName | None = None
    include_descendants: bool = False

    @field_validator("slug")
    @classmethod
    def require_slug(cls, value: str) -> str:
        return required_text(value, "topic slug")


class ViewerJobsRequest(CodeAlmanacModel):
    cwd: Path
    repository_name: RepositoryName | None = None
    limit: NonNegativeLimit = None


class ViewerJobRequest(CodeAlmanacModel):
    cwd: Path
    run_id: RunId
    repository_name: RepositoryName | None = None
