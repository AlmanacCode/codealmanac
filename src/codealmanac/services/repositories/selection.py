from pathlib import Path

from codealmanac.core.errors import ConflictError
from codealmanac.core.paths import normalize_path
from codealmanac.services.repositories.models import RepositoryRecord
from codealmanac.services.repositories.requests import SelectRepositoryRequest


def entry_by_name(
    name: str,
    entries: list[RepositoryRecord],
) -> RepositoryRecord | None:
    matches = [entry for entry in entries if entry.name.casefold() == name.casefold()]
    if len(matches) > 1:
        raise ConflictError(f"repository name is ambiguous: {name}")
    if len(matches) == 1:
        return matches[0]
    return None


def select_repository_record(
    request: SelectRepositoryRequest,
    entries: list[RepositoryRecord],
) -> RepositoryRecord | None:
    selected = entry_by_name(request.name, entries)
    if selected is not None:
        return selected
    return None


def entry_by_exact_path(
    path: Path,
    entries: list[RepositoryRecord],
) -> RepositoryRecord | None:
    for entry in entries:
        if same_path(entry.path, path):
            return entry
    return None


def contains_path(root_path: Path, path: Path) -> bool:
    return path == root_path or root_path in path.parents


def same_path(left: Path, right: Path) -> bool:
    return normalize_path(left) == normalize_path(right)
