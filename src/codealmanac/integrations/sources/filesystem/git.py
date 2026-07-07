import subprocess
from pathlib import Path

from pathspec.gitignore import GitIgnoreSpec

from codealmanac.integrations.command import CommandResult, CommandRunner, first_line
from codealmanac.integrations.sources.filesystem.ignore import should_skip_path
from codealmanac.integrations.sources.filesystem.paths import (
    display_path,
    is_relative_to,
)
from codealmanac.integrations.sources.filesystem.selection import (
    FilesystemDirectoryCandidate,
    FilesystemDirectoryFileState,
    directory_selection_group,
    ranked_directory_candidates,
)


def git_directory_candidates(
    root: Path,
    cwd: Path,
    runner: CommandRunner,
    timeout_seconds: int,
    ignore_spec: GitIgnoreSpec,
) -> tuple[FilesystemDirectoryCandidate, ...] | None:
    repository_root = git_repository_root(root, runner, timeout_seconds)
    if repository_root is None:
        return None
    try:
        pathspec = root.relative_to(repository_root).as_posix()
    except ValueError:
        return None
    if pathspec == ".":
        pathspec = "."
    result = run_git(
        runner,
        repository_root,
        (
            "ls-files",
            "-z",
            "--cached",
            "--others",
            "--exclude-standard",
            "--full-name",
            "--",
            pathspec,
        ),
        timeout_seconds,
    )
    if result is None:
        return None
    changed_statuses = git_changed_statuses(
        repository_root,
        root,
        pathspec,
        runner,
        timeout_seconds,
    )
    candidates: list[FilesystemDirectoryCandidate] = []
    seen: set[Path] = set()
    for value in result.stdout.split("\0"):
        if not value:
            continue
        path = repository_root / value
        if path in seen:
            continue
        if not is_relative_to(path, root):
            continue
        if should_skip_path(path, cwd, root, ignore_spec):
            continue
        if path.is_file():
            seen.add(path)
            git_status = changed_statuses.get(path)
            state = FilesystemDirectoryFileState.UNCHANGED
            if git_status is not None:
                state = FilesystemDirectoryFileState.CHANGED
            candidates.append(
                FilesystemDirectoryCandidate(
                    path=path,
                    display_path=display_path(path, cwd),
                    selection_group=directory_selection_group(path, root),
                    state=state,
                    git_status=git_status,
                )
            )
    return ranked_directory_candidates(tuple(candidates))


def git_changed_statuses(
    repository_root: Path,
    root: Path,
    pathspec: str,
    runner: CommandRunner,
    timeout_seconds: int,
) -> dict[Path, str]:
    result = run_git(
        runner,
        repository_root,
        (
            "--no-optional-locks",
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
            "--",
            pathspec,
        ),
        timeout_seconds,
    )
    if result is None:
        return {}
    statuses: dict[Path, str] = {}
    for relative_path, status in parse_git_status_z(result.stdout):
        path = repository_root / relative_path
        if is_relative_to(path, root):
            statuses[path] = status
    return statuses


def parse_git_status_z(stdout: str) -> tuple[tuple[str, str], ...]:
    parts = stdout.split("\0")
    parsed: list[tuple[str, str]] = []
    index = 0
    while index < len(parts):
        entry = parts[index]
        index += 1
        if not entry or len(entry) < 4 or entry[2] != " ":
            continue
        status = entry[:2]
        relative_path = entry[3:]
        parsed.append((relative_path, status))
        if "R" in status or "C" in status:
            index += 1
    return tuple(parsed)


def git_repository_root(
    root: Path,
    runner: CommandRunner,
    timeout_seconds: int,
) -> Path | None:
    result = run_git(runner, root, ("rev-parse", "--show-toplevel"), timeout_seconds)
    if result is None:
        return None
    text = first_line(result.stdout)
    if not text:
        return None
    repository_root = Path(text).expanduser().resolve(strict=False)
    if not is_relative_to(root, repository_root):
        return None
    return repository_root


def run_git(
    runner: CommandRunner,
    cwd: Path,
    args: tuple[str, ...],
    timeout_seconds: int,
) -> CommandResult | None:
    try:
        result = runner.run("git", args, cwd, timeout_seconds)
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        return None
    return result
