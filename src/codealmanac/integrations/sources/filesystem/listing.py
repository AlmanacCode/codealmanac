import subprocess
from collections.abc import Iterator
from contextlib import suppress
from pathlib import Path

from pathspec.gitignore import GitIgnoreSpec

from codealmanac.integrations.command import CommandResult, CommandRunner, first_line
from codealmanac.integrations.sources.filesystem.documents import (
    FilesystemDirectoryDocument,
    FilesystemTextDocument,
    UnreadableTextError,
    read_text_document,
)
from codealmanac.integrations.sources.filesystem.paths import (
    display_path,
    is_relative_to,
)
from codealmanac.integrations.sources.filesystem.selection import (
    FilesystemDirectoryCandidate,
    FilesystemDirectoryFileState,
    FilesystemDirectoryListingSource,
    FilesystemDirectorySelectionPolicy,
    directory_selection_group,
    ranked_directory_candidates,
)

DEFAULT_IGNORE_PATTERNS = (
    ".git/",
    "node_modules/",
    ".venv/",
    "venv/",
    "__pycache__/",
    ".mypy_cache/",
    ".pytest_cache/",
    ".ruff_cache/",
    ".gitignore",
    ".env",
    ".env.*",
    "*.pyc",
    ".DS_Store",
)


def read_directory_document(
    root: Path,
    cwd: Path,
    max_file_bytes: int,
    max_directory_files: int,
    runner: CommandRunner,
    git_timeout_seconds: int,
    ignored_directories: tuple[Path, ...],
) -> FilesystemDirectoryDocument:
    ignore_spec = ignore_spec_for(root, cwd, ignored_directories)
    listing_source = FilesystemDirectoryListingSource.WALK
    selection_policy = FilesystemDirectorySelectionPolicy.DIVERSE
    candidates = ranked_directory_candidates(
        tuple(walk_file_candidates(root, cwd, ignore_spec))
    )
    git_candidates = git_directory_candidates(
        root,
        cwd,
        runner,
        git_timeout_seconds,
        ignore_spec,
    )
    if git_candidates is not None:
        listing_source = FilesystemDirectoryListingSource.GIT
        selection_policy = FilesystemDirectorySelectionPolicy.CHANGED_THEN_DIVERSE
        candidates = git_candidates
    files: list[FilesystemTextDocument] = []
    skipped_count = 0
    file_list_truncated = False
    changed_count = sum(
        1
        for candidate in candidates
        if candidate.state == FilesystemDirectoryFileState.CHANGED
    )
    for candidate in candidates:
        if len(files) >= max_directory_files:
            file_list_truncated = True
            break
        try:
            files.append(
                read_text_document(
                    candidate.path,
                    cwd,
                    max_file_bytes,
                    candidate.state,
                    candidate.git_status,
                )
            )
        except (OSError, UnreadableTextError):
            skipped_count += 1
    return FilesystemDirectoryDocument(
        path=root,
        display_path=display_path(root, cwd),
        listing_source=listing_source,
        selection_policy=selection_policy,
        changed_count=changed_count,
        files=tuple(files),
        skipped_count=skipped_count,
        file_list_truncated=file_list_truncated,
    )


def walk_file_candidates(
    root: Path,
    cwd: Path,
    ignore_spec: GitIgnoreSpec,
) -> Iterator[FilesystemDirectoryCandidate]:
    for path in walk_files(root, cwd, ignore_spec):
        yield FilesystemDirectoryCandidate(
            path=path,
            display_path=display_path(path, cwd),
            selection_group=directory_selection_group(path, root),
        )


def walk_files(
    root: Path,
    cwd: Path,
    ignore_spec: GitIgnoreSpec,
) -> Iterator[Path]:
    for child in sorted_children(root):
        if should_skip_path(child, cwd, root, ignore_spec):
            continue
        if child.is_symlink():
            continue
        if child.is_dir():
            yield from walk_files(child, cwd, ignore_spec)
            continue
        if child.is_file():
            yield child


def sorted_children(path: Path) -> tuple[Path, ...]:
    try:
        return tuple(sorted(path.iterdir(), key=lambda child: child.name.casefold()))
    except OSError:
        return ()


def git_directory_candidates(
    root: Path,
    cwd: Path,
    runner: CommandRunner,
    timeout_seconds: int,
    ignore_spec: GitIgnoreSpec,
) -> tuple[FilesystemDirectoryCandidate, ...] | None:
    repo_root = git_repo_root(root, runner, timeout_seconds)
    if repo_root is None:
        return None
    try:
        pathspec = root.relative_to(repo_root).as_posix()
    except ValueError:
        return None
    if pathspec == ".":
        pathspec = "."
    result = run_git(
        runner,
        repo_root,
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
        repo_root,
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
        path = repo_root / value
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
    repo_root: Path,
    root: Path,
    pathspec: str,
    runner: CommandRunner,
    timeout_seconds: int,
) -> dict[Path, str]:
    result = run_git(
        runner,
        repo_root,
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
        path = repo_root / relative_path
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


def git_repo_root(
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
    repo_root = Path(text).expanduser().resolve(strict=False)
    if not is_relative_to(root, repo_root):
        return None
    return repo_root


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


def should_skip_path(
    path: Path,
    cwd: Path,
    root: Path,
    ignore_spec: GitIgnoreSpec,
) -> bool:
    return ignore_spec.match_file(ignore_key(path, cwd, root))


def ignore_key(path: Path, cwd: Path, root: Path) -> str:
    base = cwd if is_relative_to(path, cwd) else root
    return path.relative_to(base).as_posix()


def ignore_spec_for(
    root: Path,
    cwd: Path,
    ignored_directories: tuple[Path, ...],
) -> GitIgnoreSpec:
    lines = list(DEFAULT_IGNORE_PATTERNS)
    lines.extend(ignored_directory_patterns(ignored_directories))
    gitignore = cwd / ".gitignore" if is_relative_to(root, cwd) else root / ".gitignore"
    if gitignore.is_file():
        with suppress(OSError):
            lines.extend(gitignore.read_text(encoding="utf-8").splitlines())
    return GitIgnoreSpec.from_lines(lines)


def ignored_directory_patterns(
    ignored_directories: tuple[Path, ...],
) -> tuple[str, ...]:
    return tuple(
        f"{directory.as_posix().rstrip('/')}/" for directory in ignored_directories
    )
