from collections.abc import Iterable
from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.paths import normalize_path

DEFAULT_ALMANAC_ROOT = Path("almanac")
CONVENTIONAL_ALMANAC_ROOTS = (
    DEFAULT_ALMANAC_ROOT,
    Path("docs/almanac"),
    Path(".almanac"),
)
ALMANAC_ROOT_MARKER_FILE = "topics.yaml"
ALMANAC_ROOT_MARKER_DIR = "pages"


class AlmanacRootMatch(CodeAlmanacModel):
    repo_root: Path
    almanac_root: Path
    almanac_path: Path


def normalize_almanac_root(value: Path | str | None) -> Path:
    if value is None:
        return DEFAULT_ALMANAC_ROOT
    path = Path(value)
    if path.is_absolute():
        raise ValueError("Almanac root must be a repo-relative path")
    if len(path.parts) == 0:
        raise ValueError("Almanac root must name a directory")
    if any(part in {"..", "~"} for part in path.parts):
        raise ValueError("Almanac root must stay inside the repo")
    return Path(*path.parts)


def normalized_almanac_roots(values: Iterable[Path | str]) -> tuple[Path, ...]:
    roots: list[Path] = []
    for value in values:
        root = normalize_almanac_root(value)
        if root not in roots:
            roots.append(root)
    if len(roots) == 0:
        roots.append(DEFAULT_ALMANAC_ROOT)
    return tuple(roots)


def nearest_almanac_root(
    path: Path,
    almanac_roots: Iterable[Path | str] = (DEFAULT_ALMANAC_ROOT,),
) -> AlmanacRootMatch | None:
    current = normalize_path(path)
    if current.is_file():
        current = current.parent
    roots = normalized_almanac_roots(almanac_roots)
    for candidate in [current, *current.parents]:
        for almanac_root in roots:
            almanac_path = candidate / almanac_root
            if is_initialized_almanac_root(almanac_path):
                return AlmanacRootMatch(
                    repo_root=candidate,
                    almanac_root=almanac_root,
                    almanac_path=normalize_path(almanac_path),
                )
    return None


def is_initialized_almanac_root(path: Path) -> bool:
    if not path.is_dir():
        return False
    return (
        (path / ALMANAC_ROOT_MARKER_FILE).is_file()
        and (path / ALMANAC_ROOT_MARKER_DIR).is_dir()
    )


def validate_almanac_root_field(value: Path | str | None) -> Path:
    try:
        return normalize_almanac_root(value)
    except ValueError as error:
        raise ValueError(str(error)) from error
