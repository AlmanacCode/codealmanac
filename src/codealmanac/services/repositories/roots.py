from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.paths import normalize_path

DEFAULT_ALMANAC_ROOT = Path("almanac")
ALMANAC_ROOT_MARKER_FILE = "topics.yaml"
ALMANAC_ROOT_MARKER_README = "README.md"


class RepositoryTarget(CodeAlmanacModel):
    root_path: Path
    almanac_root: Path
    almanac_path: Path


def require_default_almanac_root(value: Path | str | None) -> Path:
    if value is None:
        return DEFAULT_ALMANAC_ROOT
    path = Path(value)
    if path.is_absolute():
        raise ValueError("Almanac root must be a repo-relative path")
    if len(path.parts) == 0:
        raise ValueError("Almanac root must name a directory")
    if any(part in {"..", "~"} for part in path.parts):
        raise ValueError("Almanac root must stay inside the repo")
    normalized = Path(*path.parts)
    if normalized != DEFAULT_ALMANAC_ROOT:
        raise ValueError("Almanac root is fixed at almanac/")
    return normalized


def initialized_repository_at(path: Path) -> RepositoryTarget | None:
    current = normalize_path(path)
    almanac_path = current / DEFAULT_ALMANAC_ROOT
    if is_initialized_almanac_root(almanac_path):
        return RepositoryTarget(
            root_path=current,
            almanac_root=DEFAULT_ALMANAC_ROOT,
            almanac_path=normalize_path(almanac_path),
        )
    return None


def is_initialized_almanac_root(path: Path) -> bool:
    if not path.is_dir():
        return False
    return (
        (path / ALMANAC_ROOT_MARKER_FILE).is_file()
        and (path / ALMANAC_ROOT_MARKER_README).is_file()
    )
