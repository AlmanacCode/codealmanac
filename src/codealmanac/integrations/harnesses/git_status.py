import subprocess
from pathlib import Path

from codealmanac.integrations.command import CommandRunner


def git_status_snapshot(
    runner: CommandRunner,
    cwd: Path,
) -> frozenset[Path]:
    try:
        result = runner.run(
            "git",
            ("-C", str(cwd), "status", "--porcelain=v1", "-z", "--untracked-files=all"),
            cwd,
            10,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return frozenset()
    if result.returncode != 0:
        return frozenset()
    return frozenset(parse_git_status_paths(result.stdout))


def parse_git_status_paths(value: str) -> tuple[Path, ...]:
    paths: list[Path] = []
    fields = [field for field in value.split("\0") if field]
    skip_next = False
    for field in fields:
        if skip_next:
            skip_next = False
            continue
        if len(field) < 4:
            continue
        status = field[:2]
        path_text = field[3:]
        paths.append(Path(path_text))
        if status[0] in {"R", "C"} or status[1] in {"R", "C"}:
            skip_next = True
    return tuple(paths)


def changed_paths(
    cwd: Path,
    before: frozenset[Path],
    after: frozenset[Path],
) -> tuple[Path, ...]:
    changed = sorted(after - before, key=lambda item: str(item))
    return tuple(cwd / path for path in changed)
