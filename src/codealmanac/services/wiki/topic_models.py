from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator

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


def title_for_slug(slug: str) -> str:
    return " ".join(part.capitalize() for part in slug.split("-") if part)
