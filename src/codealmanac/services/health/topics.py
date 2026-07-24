from pathlib import Path

from codealmanac.services.health.models import ValidationIssue
from codealmanac.services.wiki.topics import read_topics_yaml


def topics_file_issues(almanac_path: Path) -> tuple[ValidationIssue, ...]:
    error = read_topics_yaml(almanac_path).error
    if error is None:
        return ()
    return (
        ValidationIssue(
            category="topics_file",
            message=f"topics.yaml could not be read: {error}",
            path="topics.yaml",
        ),
    )
