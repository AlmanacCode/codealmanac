from uuid import UUID

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text


class ListCloudRunsForRepoRequest(CodeAlmanacModel):
    api_url: str = Field(min_length=1)
    repo_id: int = Field(gt=0)
    limit: int | None = None
    cursor: str | None = None

    @field_validator("limit")
    @classmethod
    def positive_limit(cls, value: int | None) -> int | None:
        if value is not None and value <= 0:
            raise ValueError("limit must be positive")
        return value


class StartCloudRunForRepoRequest(CodeAlmanacModel):
    api_url: str = Field(min_length=1)
    repo_id: int = Field(gt=0)
    branch: str = Field(min_length=1)

    @field_validator("branch")
    @classmethod
    def require_branch(cls, value: str) -> str:
        required_text(value, "cloud run branch")
        if value.strip() != value:
            raise ValueError("branch cannot have leading or trailing whitespace")
        return value


class ReadCloudRunRequest(CodeAlmanacModel):
    api_url: str = Field(min_length=1)
    run_id: UUID


class CancelCloudRunRequest(CodeAlmanacModel):
    api_url: str = Field(min_length=1)
    run_id: UUID


class RetryCloudRunRequest(CodeAlmanacModel):
    api_url: str = Field(min_length=1)
    run_id: UUID


class ListCloudRunEventsRequest(CodeAlmanacModel):
    api_url: str = Field(min_length=1)
    run_id: UUID
