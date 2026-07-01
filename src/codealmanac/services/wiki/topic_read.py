from pathlib import Path

import yaml as pyyaml
from pydantic import ValidationError
from yaml import YAMLError

from codealmanac.services.wiki.topic_models import TopicDefinition, TopicsYaml


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
