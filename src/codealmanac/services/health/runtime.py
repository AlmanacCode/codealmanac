from pathlib import Path

from codealmanac.services.health.models import ValidationIssue

RUNTIME_FILES = ("index.db", "index.db-wal", "index.db-shm")
RUNTIME_DIRS = ("jobs", "runs")


def runtime_state_issues(almanac_path: Path) -> tuple[ValidationIssue, ...]:
    issues: list[ValidationIssue] = []
    for name in RUNTIME_FILES:
        path = almanac_path / name
        if path.exists():
            issues.append(runtime_issue(almanac_path, path))
    for name in RUNTIME_DIRS:
        path = almanac_path / name
        if path.exists():
            issues.append(runtime_issue(almanac_path, path))
    return tuple(issues)


def runtime_issue(almanac_path: Path, path: Path) -> ValidationIssue:
    return ValidationIssue(
        category="runtime_state",
        message="runtime state belongs under ~/.codealmanac/",
        path=path.relative_to(almanac_path).as_posix(),
    )
