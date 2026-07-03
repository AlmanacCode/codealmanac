from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text


class ShowPageRequest(CodeAlmanacModel):
    cwd: Path
    slug: str
    wiki: str | None = None

    @field_validator("slug")
    @classmethod
    def require_slug(cls, value: str) -> str:
        return required_text(value, "slug")
