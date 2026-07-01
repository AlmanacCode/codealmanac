import re
from datetime import date, datetime
from typing import Any

import frontmatter
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator
from yaml import YAMLError

from codealmanac.services.wiki.models import (
    PageSource,
    PageSourceType,
    ParsedFrontmatter,
)

SOURCE_TARGET_FIELDS: dict[PageSourceType, tuple[str, ...]] = {
    PageSourceType.FILE: ("path",),
    PageSourceType.WEB: ("url",),
    PageSourceType.COMMIT: ("commit", "sha", "ref"),
    PageSourceType.PR: ("pr", "number", "url"),
    PageSourceType.ISSUE: ("issue", "number", "url"),
    PageSourceType.CONVERSATION: ("path", "run_id", "session_id"),
    PageSourceType.WIKI: ("page", "slug", "path"),
    PageSourceType.MANUAL: ("path", "page", "title"),
}


def parse_frontmatter(raw: str) -> ParsedFrontmatter:
    try:
        post = frontmatter.loads(raw)
        fields = FrontmatterFields.model_validate(post.metadata)
    except (YAMLError, ValueError, ValidationError):
        return ParsedFrontmatter(body=raw)
    return ParsedFrontmatter(
        page_id=fields.page_id,
        title=fields.title,
        summary=fields.summary,
        topics=fields.topics,
        files=fields.files,
        sources=fields.sources,
        body=post.content,
    )


def strip_frontmatter(raw: str) -> str:
    return parse_frontmatter(raw).body


def first_h1(body: str) -> str | None:
    for line in body.splitlines()[:40]:
        match = re.match(r"^#\s+(.+?)\s*#*\s*$", line)
        if match is not None:
            return match.group(1)
    return None


class FrontmatterFields(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)

    page_id: str | None = None
    title: str | None = None
    summary: str | None = None
    topics: tuple[str, ...] = ()
    files: tuple[str, ...] = ()
    sources: tuple[PageSource, ...] = ()

    @field_validator("page_id", "title", "summary", mode="before")
    @classmethod
    def optional_text(cls, value: Any) -> str | None:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return None

    @field_validator("topics", "files", mode="before")
    @classmethod
    def text_tuple(cls, value: Any) -> tuple[str, ...]:
        if not isinstance(value, list | tuple):
            return ()
        values: list[str] = []
        for item in value:
            if isinstance(item, str) and item.strip():
                values.append(item.strip())
        return tuple(values)

    @field_validator("sources", mode="before")
    @classmethod
    def source_tuple(cls, value: Any) -> tuple[PageSource, ...]:
        if not isinstance(value, list | tuple):
            return ()
        sources: list[PageSource] = []
        for item in value:
            source = parse_source_item(item)
            if source is not None:
                sources.append(source)
        return tuple(sources)


def parse_source_item(value: Any) -> PageSource | None:
    if not isinstance(value, dict):
        return None
    source_id = text_field(value, "id")
    raw_type = text_field(value, "type")
    if source_id is None or raw_type is None:
        return None
    try:
        source_type = PageSourceType(raw_type)
    except ValueError:
        return None
    target = source_target(value, source_type)
    return PageSource(
        source_id=source_id,
        source_type=source_type,
        target=target,
        title=text_field(value, "title"),
        retrieved_at=scalar_text_field(value, "retrieved_at"),
        note=text_field(value, "note"),
    )


def source_target(value: dict[Any, Any], source_type: PageSourceType) -> str | None:
    for field in (*SOURCE_TARGET_FIELDS[source_type], "target"):
        target = text_or_number_field(value, field)
        if target is not None:
            return target
    return None


def text_field(value: dict[Any, Any], key: str) -> str | None:
    field = value.get(key)
    if isinstance(field, str) and field.strip():
        return field.strip()
    return None


def text_or_number_field(value: dict[Any, Any], key: str) -> str | None:
    text = text_field(value, key)
    if text is not None:
        return text
    field = value.get(key)
    if isinstance(field, int | float):
        return str(field)
    return None


def scalar_text_field(value: dict[Any, Any], key: str) -> str | None:
    text = text_field(value, key)
    if text is not None:
        return text
    field = value.get(key)
    if isinstance(field, datetime | date):
        return field.isoformat()
    if isinstance(field, int | float):
        return str(field)
    return None
