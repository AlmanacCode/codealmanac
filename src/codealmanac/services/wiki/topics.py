from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator
from yaml import YAMLError

from codealmanac.core.slug import to_kebab_case


class TopicDefinition(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)

    slug: str
    title: str | None = None
    description: str | None = None
    parents: tuple[str, ...] = ()

    @field_validator("slug", mode="before")
    @classmethod
    def canonical_slug(cls, value: Any) -> str:
        return to_kebab_case(str(value))

    @field_validator("title", "description", mode="before")
    @classmethod
    def optional_text(cls, value: Any) -> str | None:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return None

    @field_validator("parents", mode="before")
    @classmethod
    def parent_slugs(cls, value: Any) -> tuple[str, ...]:
        if not isinstance(value, list | tuple):
            return ()
        parents: list[str] = []
        for item in value:
            slug = to_kebab_case(str(item))
            if slug:
                parents.append(slug)
        return tuple(dict.fromkeys(parents))


class TopicsYaml(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)

    topics: tuple[TopicDefinition, ...] = ()


def load_topics_yaml(almanac_path: Path) -> tuple[TopicDefinition, ...]:
    path = almanac_path / "topics.yaml"
    if not path.is_file():
        return ()
    try:
        parsed = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except (OSError, YAMLError):
        return ()
    if not isinstance(parsed, dict):
        return ()
    try:
        model = TopicsYaml.model_validate(parsed)
    except ValidationError:
        return ()
    return tuple(topic for topic in model.topics if topic.slug)
