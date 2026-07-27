import re
from collections.abc import Iterator
from pathlib import Path

from codealmanac.core.errors import ValidationFailed

RESERVED_WIKI_SOURCE_DIRS = frozenset({"manual", "jobs"})


def looks_like_dir(raw: str) -> bool:
    return raw.strip().replace("\\", "/").endswith("/")


def normalize_reference_path(raw: str, is_dir: bool) -> str:
    return normalize_reference_shape(raw, is_dir).casefold()


def normalize_reference_path_preserving_case(raw: str, is_dir: bool) -> str:
    return normalize_reference_shape(raw, is_dir)


def normalize_reference_shape(raw: str, is_dir: bool) -> str:
    text = raw.strip().replace("\\", "/")
    while text.startswith("./"):
        text = text[2:]
    text = re.sub(r"/+", "/", text)
    text = text.lstrip("/")
    if ".." in text.split("/"):
        return ""
    text = text.rstrip("/")
    if is_dir and text:
        return f"{text}/"
    return text


def parent_folder_prefixes(file_path: str) -> list[str]:
    prefixes: list[str] = []
    cursor = 0
    while True:
        index = file_path.find("/", cursor)
        if index == -1:
            return prefixes
        prefixes.append(file_path[: index + 1])
        cursor = index + 1


def escape_glob_meta(input_path: str) -> str:
    return re.sub(r"([*?\[])", r"[\1]", input_path)


def iter_page_paths(almanac_path: Path) -> Iterator[Path]:
    if not almanac_path.is_dir():
        return
    for path in sorted(almanac_path.rglob("*.md")):
        if is_reserved_page_path(almanac_path, path):
            continue
        yield path


def is_reserved_page_path(almanac_path: Path, path: Path) -> bool:
    try:
        relative = path.relative_to(almanac_path)
    except ValueError:
        return True
    directories = relative.parts[:-1]
    return bool(directories) and directories[0] in RESERVED_WIKI_SOURCE_DIRS


def page_id_for_path(almanac_path: Path, page_path: Path) -> str:
    relative = page_path.relative_to(almanac_path)
    if relative.suffix != ".md":
        raise ValidationFailed(f"wiki page must be markdown: {page_path}")
    if any(part in {"", ".", ".."} for part in relative.parts):
        raise ValidationFailed(f"invalid wiki page path: {page_path}")
    if relative.name == "README.md":
        if len(relative.parts) == 1:
            return "README"
        return Path(*relative.parts[:-1]).as_posix()
    return relative.with_suffix("").as_posix()
