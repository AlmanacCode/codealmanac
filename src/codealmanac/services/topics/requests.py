from pathlib import Path
from typing import Any

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.slug import to_kebab_case
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


class CreateTopicRequest(CodeAlmanacModel):
    cwd: Path
    name: str
    parents: tuple[str, ...] = ()
    wiki: str | None = None

    @field_validator("name")
    @classmethod
    def require_name(cls, value: str) -> str:
        return required_text(value, "topic")

    @field_validator("parents", mode="before")
    @classmethod
    def canonical_parents(cls, value: Any) -> tuple[str, ...]:
        if value is None:
            return ()
        if not isinstance(value, list | tuple):
            raise ValueError("parents must be a list")
        parents = tuple(dict.fromkeys(to_kebab_case(str(item)) for item in value))
        return tuple(parent for parent in parents if parent)


class DescribeTopicRequest(CodeAlmanacModel):
    cwd: Path
    slug: str
    description: str
    wiki: str | None = None

    @field_validator("slug")
    @classmethod
    def require_slug(cls, value: str) -> str:
        slug = to_kebab_case(required_text(value, "topic"))
        if not slug:
            raise ValueError("topic must contain slug-able characters")
        return slug

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str) -> str:
        return value.strip()


class LinkTopicRequest(CodeAlmanacModel):
    cwd: Path
    child: str
    parent: str
    wiki: str | None = None

    @field_validator("child", "parent")
    @classmethod
    def canonical_topic(cls, value: str) -> str:
        slug = to_kebab_case(required_text(value, "topic"))
        if not slug:
            raise ValueError("topic must contain slug-able characters")
        return slug


class UnlinkTopicRequest(LinkTopicRequest):
    pass
