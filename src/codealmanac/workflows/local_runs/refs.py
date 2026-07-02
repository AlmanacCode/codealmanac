from pathlib import Path


def path_ref(path: Path) -> str:
    return path.resolve(strict=False).as_uri()


def first_line(value: str) -> str:
    for line in value.splitlines():
        stripped = line.strip()
        if stripped:
            return stripped
    return ""
