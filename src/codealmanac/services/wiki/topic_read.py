from pathlib import Path

import yaml as pyyaml
from pydantic import ValidationError
from yaml import YAMLError

from codealmanac.core.errors import error_summary
from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.wiki.topic_models import TopicDefinition, TopicsYaml


class TopicsYamlRead(CodeAlmanacModel):
    """Reads stay lenient; the parse error travels with the empty result."""

    topics: tuple[TopicDefinition, ...] = ()
    error: str | None = None


def read_topics_yaml(almanac_path: Path) -> TopicsYamlRead:
    path = almanac_path / "topics.yaml"
    if not path.is_file():
        return TopicsYamlRead()
    try:
        parsed = pyyaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except (OSError, YAMLError) as error:
        return TopicsYamlRead(error=error_summary(error))
    if not isinstance(parsed, dict):
        return TopicsYamlRead(error="topics.yaml must be a YAML mapping")
    try:
        model = TopicsYaml.model_validate(parsed)
    except ValidationError as error:
        return TopicsYamlRead(error=error_summary(error))
    return TopicsYamlRead(topics=tuple(topic for topic in model.topics if topic.slug))


def load_topics_yaml(almanac_path: Path) -> tuple[TopicDefinition, ...]:
    return read_topics_yaml(almanac_path).topics
