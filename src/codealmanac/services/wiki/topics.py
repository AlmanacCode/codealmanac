from io import StringIO
from pathlib import Path
from typing import Any
from uuid import uuid4

import yaml as pyyaml
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator
from ruamel.yaml import YAML
from ruamel.yaml.comments import CommentedMap, CommentedSeq
from yaml import YAMLError

from codealmanac.core.errors import ValidationFailed
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
        parsed = pyyaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except (OSError, YAMLError):
        return ()
    if not isinstance(parsed, dict):
        return ()
    try:
        model = TopicsYaml.model_validate(parsed)
    except ValidationError:
        return ()
    return tuple(topic for topic in model.topics if topic.slug)


class TopicsYamlFile:
    def __init__(
        self,
        path: Path,
        data: CommentedMap,
        topics: CommentedSeq,
        line_ending: str,
    ):
        self.path = path
        self.data = data
        self.topics = topics
        self.line_ending = line_ending

    @property
    def definitions(self) -> tuple[TopicDefinition, ...]:
        try:
            model = TopicsYaml.model_validate(self.data)
        except ValidationError as error:
            raise ValidationFailed(f"invalid topics.yaml: {error}") from error
        return tuple(topic for topic in model.topics if topic.slug)

    def has_entry(self, slug: str) -> bool:
        return self.entry_for(slug) is not None

    def ensure_topic(self, slug: str, title: str | None = None) -> None:
        if self.has_entry(slug):
            return
        entry = CommentedMap()
        entry["slug"] = slug
        entry["title"] = title or title_for_slug(slug)
        entry["parents"] = CommentedSeq()
        self.topics.append(entry)

    def set_description(self, slug: str, description: str | None) -> None:
        entry = self.required_entry(slug)
        if description:
            entry["description"] = description
            return
        if "description" in entry:
            del entry["description"]

    def maybe_update_default_title(self, slug: str, title: str) -> None:
        entry = self.required_entry(slug)
        default_title = title_for_slug(slug)
        current_title = entry.get("title")
        if current_title in (None, default_title) and title != default_title:
            entry["title"] = title

    def add_parent(self, child: str, parent: str) -> bool:
        entry = self.required_entry(child)
        parents = parent_sequence(entry)
        if parent in {str(item) for item in parents}:
            return False
        parents.append(parent)
        entry["parents"] = parents
        return True

    def remove_parent(self, child: str, parent: str) -> bool:
        entry = self.entry_for(child)
        if entry is None:
            return False
        parents = parent_sequence(entry)
        removed = False
        for index in range(len(parents) - 1, -1, -1):
            if str(parents[index]) == parent:
                del parents[index]
                removed = True
        entry["parents"] = parents
        return removed

    def rename_topic(self, old_slug: str, new_slug: str) -> bool:
        changed = False
        entry = self.entry_for(old_slug)
        if entry is not None:
            entry["slug"] = new_slug
            if entry.get("title") == title_for_slug(old_slug):
                entry["title"] = title_for_slug(new_slug)
            changed = True
        for item in self.topics:
            if not isinstance(item, CommentedMap):
                continue
            parents = parent_sequence(item)
            next_parents = replace_parent_slug(parents, old_slug, new_slug)
            if next_parents != tuple(str(parent) for parent in parents):
                item["parents"] = CommentedSeq(next_parents)
                changed = True
        return changed

    def delete_topic(self, slug: str) -> bool:
        changed = False
        for index in range(len(self.topics) - 1, -1, -1):
            item = self.topics[index]
            if (
                isinstance(item, CommentedMap)
                and to_kebab_case(str(item.get("slug"))) == slug
            ):
                del self.topics[index]
                changed = True
        for item in self.topics:
            if not isinstance(item, CommentedMap):
                continue
            parents = parent_sequence(item)
            next_parents = tuple(
                str(parent) for parent in parents if str(parent) != slug
            )
            if next_parents != tuple(str(parent) for parent in parents):
                item["parents"] = CommentedSeq(next_parents)
                changed = True
        return changed

    def write(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        yaml = YAML(typ="rt")
        yaml.preserve_quotes = True
        output = StringIO()
        yaml.dump(self.data, output)
        text = output.getvalue()
        if self.line_ending != "\n":
            text = text.replace("\n", self.line_ending)
        temporary = self.path.with_name(f".{self.path.name}.{uuid4().hex}.tmp")
        temporary.write_text(text, encoding="utf-8")
        temporary.replace(self.path)

    def required_entry(self, slug: str) -> CommentedMap:
        entry = self.entry_for(slug)
        if entry is None:
            raise ValidationFailed(f'topic "{slug}" is missing from topics.yaml')
        return entry

    def entry_for(self, slug: str) -> CommentedMap | None:
        for item in self.topics:
            if (
                isinstance(item, CommentedMap)
                and to_kebab_case(str(item.get("slug"))) == slug
            ):
                return item
        return None


def load_topics_file(almanac_path: Path) -> TopicsYamlFile:
    path = almanac_path / "topics.yaml"
    raw = read_topics_text(path)
    line_ending = "\r\n" if "\r\n" in raw else "\n"
    yaml = YAML(typ="rt")
    yaml.preserve_quotes = True
    try:
        parsed = yaml.load(raw) if raw.strip() else CommentedMap()
    except Exception as error:
        raise ValidationFailed(f"invalid topics.yaml: {path}") from error
    if parsed is None:
        parsed = CommentedMap()
    if not isinstance(parsed, CommentedMap):
        raise ValidationFailed(f"topics.yaml must be a YAML mapping: {path}")
    topics = parsed.get("topics")
    if topics is None:
        topics = CommentedSeq()
        parsed["topics"] = topics
    if not isinstance(topics, CommentedSeq):
        raise ValidationFailed(f"topics.yaml topics must be a list: {path}")
    file = TopicsYamlFile(path, parsed, topics, line_ending)
    _ = file.definitions
    return file


def read_topics_text(path: Path) -> str:
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8")


def parent_sequence(entry: CommentedMap) -> CommentedSeq:
    existing = entry.get("parents")
    if isinstance(existing, CommentedSeq):
        return existing
    sequence = CommentedSeq()
    if isinstance(existing, list):
        sequence.extend(to_kebab_case(str(item)) for item in existing)
    return sequence


def replace_parent_slug(
    parents: CommentedSeq,
    old_slug: str,
    new_slug: str,
) -> tuple[str, ...]:
    replaced: list[str] = []
    for parent in parents:
        next_parent = new_slug if str(parent) == old_slug else str(parent)
        if next_parent not in replaced:
            replaced.append(next_parent)
    return tuple(replaced)


def title_for_slug(slug: str) -> str:
    return " ".join(part.capitalize() for part in slug.split("-") if part)
