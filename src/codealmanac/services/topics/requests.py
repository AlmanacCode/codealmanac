from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text


class ListTopicsRequest(CodeAlmanacModel):
    cwd: Path
    wiki: str | None = None


class ShowTopicRequest(CodeAlmanacModel):
    cwd: Path
    slug: str
    wiki: str | None = None
    include_descendants: bool = False

    @field_validator("slug")
    @classmethod
    def require_slug(cls, value: str) -> str:
        return required_text(value, "topic")
