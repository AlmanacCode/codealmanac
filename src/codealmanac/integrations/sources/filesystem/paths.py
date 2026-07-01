from pathlib import Path


def display_path(path: Path, cwd: Path) -> str:
    if is_relative_to(path, cwd):
        relative = path.relative_to(cwd)
        if str(relative) == ".":
            return "."
        return relative.as_posix()
    return str(path)


def is_relative_to(path: Path, base: Path) -> bool:
    try:
        path.relative_to(base)
    except ValueError:
        return False
    return True
