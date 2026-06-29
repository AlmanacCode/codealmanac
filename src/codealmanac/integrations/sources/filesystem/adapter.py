import subprocess
from collections.abc import Iterator
from contextlib import suppress
from enum import StrEnum
from pathlib import Path

from charset_normalizer import from_bytes
from pathspec.gitignore import GitIgnoreSpec
from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.integrations.command import (
    CommandRunner,
    SubprocessCommandRunner,
    first_line,
)
from codealmanac.integrations.sources.runtime import (
    bounded_text,
    source_runtime_section,
)
from codealmanac.services.sources.models import (
    SourceKind,
    SourceRef,
    SourceRuntime,
    SourceRuntimeStatus,
)
from codealmanac.services.sources.requests import InspectSourceRuntimeRequest

DEFAULT_MAX_FILE_BYTES = 200_000
DEFAULT_MAX_DIRECTORY_FILES = 25
DEFAULT_MAX_CHARS = 60_000
GIT_DIRECTORY_LIST_TIMEOUT_SECONDS = 10
DEFAULT_IGNORE_PATTERNS = (
    ".git/",
    ".almanac/",
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


class FilesystemRuntimeKind(StrEnum):
    FILE = "file"
    DIRECTORY = "directory"


class FilesystemDirectoryListingSource(StrEnum):
    GIT = "git"
    WALK = "walk"


class FilesystemTextDocument(CodeAlmanacModel):
    path: Path
    display_path: str
    size_bytes: int
    encoding: str
    text: str
    bytes_truncated: bool = False

    @field_validator("display_path", "encoding", "text")
    @classmethod
    def require_text_fields(cls, value: str) -> str:
        return required_text(value, "filesystem runtime document")

    @field_validator("size_bytes")
    @classmethod
    def non_negative_size(cls, value: int) -> int:
        if value < 0:
            raise ValueError("filesystem runtime file size must be non-negative")
        return value


class FilesystemDirectoryDocument(CodeAlmanacModel):
    path: Path
    display_path: str
    listing_source: FilesystemDirectoryListingSource
    files: tuple[FilesystemTextDocument, ...]
    skipped_count: int = 0
    file_list_truncated: bool = False

    @field_validator("display_path")
    @classmethod
    def require_display_path(cls, value: str) -> str:
        return required_text(value, "filesystem runtime directory")

    @field_validator("skipped_count")
    @classmethod
    def non_negative_skipped_count(cls, value: int) -> int:
        if value < 0:
            raise ValueError("filesystem runtime skipped count must be non-negative")
        return value


class UnreadableTextError(Exception):
    pass


class FilesystemSourceRuntimeAdapter:
    def __init__(
        self,
        runner: CommandRunner | None = None,
        max_file_bytes: int = DEFAULT_MAX_FILE_BYTES,
        max_directory_files: int = DEFAULT_MAX_DIRECTORY_FILES,
        max_chars: int = DEFAULT_MAX_CHARS,
        git_timeout_seconds: int = GIT_DIRECTORY_LIST_TIMEOUT_SECONDS,
    ):
        self.runner = runner or SubprocessCommandRunner()
        self.max_file_bytes = max_file_bytes
        self.max_directory_files = max_directory_files
        self.max_chars = max_chars
        self.git_timeout_seconds = git_timeout_seconds

    def supports(self, ref: SourceRef) -> bool:
        return ref.kind in {
            SourceKind.PATH_FILE,
            SourceKind.PATH_DIRECTORY,
            SourceKind.PATH_UNKNOWN,
        }

    def inspect(self, request: InspectSourceRuntimeRequest) -> SourceRuntime:
        if request.ref.kind == SourceKind.PATH_FILE:
            return self._inspect_file(request.cwd, request.ref)
        if request.ref.kind == SourceKind.PATH_DIRECTORY:
            return self._inspect_directory(request.cwd, request.ref)
        if request.ref.kind == SourceKind.PATH_UNKNOWN:
            return unavailable_runtime(
                request.ref,
                "Path unavailable",
                missing_path_diagnostic(request.ref),
            )
        return SourceRuntime(
            ref=request.ref,
            status=SourceRuntimeStatus.SKIPPED,
            title=f"Unsupported filesystem source {request.ref.identity}",
        )

    def _inspect_file(self, cwd: Path, ref: SourceRef) -> SourceRuntime:
        path = ref.path
        if path is None:
            return unavailable_runtime(
                ref,
                "File unavailable",
                "file source requires a path",
            )
        if not path.is_file():
            return unavailable_runtime(
                ref,
                "File unavailable",
                f"path not found: {path}",
            )
        try:
            document = read_text_document(path, cwd, self.max_file_bytes)
        except (OSError, UnreadableTextError) as error:
            return unavailable_runtime(ref, "File unavailable", first_error_line(error))
        content, truncated = bounded_text(
            "\n\n".join(
                (
                    source_runtime_section(
                        "metadata",
                        render_file_metadata(document),
                    ),
                    source_runtime_section("content", document.text),
                )
            ),
            self.max_chars,
        )
        return SourceRuntime(
            ref=ref,
            status=SourceRuntimeStatus.AVAILABLE,
            title=f"File {document.display_path}",
            content=content,
            truncated=truncated or document.bytes_truncated,
        )

    def _inspect_directory(self, cwd: Path, ref: SourceRef) -> SourceRuntime:
        path = ref.path
        if path is None:
            return unavailable_runtime(
                ref,
                "Directory unavailable",
                "directory source requires a path",
            )
        if not path.is_dir():
            return unavailable_runtime(
                ref,
                "Directory unavailable",
                f"path not found: {path}",
            )
        document = read_directory_document(
            path,
            cwd,
            self.max_file_bytes,
            self.max_directory_files,
            self.runner,
            self.git_timeout_seconds,
        )
        content, truncated = bounded_text(
            "\n\n".join(
                (
                    source_runtime_section(
                        "metadata",
                        render_directory_metadata(document),
                    ),
                    source_runtime_section("tree", render_tree(document.files)),
                    source_runtime_section("files", render_directory_files(document)),
                )
            ),
            self.max_chars,
        )
        return SourceRuntime(
            ref=ref,
            status=SourceRuntimeStatus.AVAILABLE,
            title=f"Directory {document.display_path}",
            content=content,
            truncated=(
                truncated
                or document.file_list_truncated
                or any(file.bytes_truncated for file in document.files)
            ),
        )


def read_text_document(
    path: Path,
    cwd: Path,
    max_file_bytes: int,
) -> FilesystemTextDocument:
    size_bytes = path.stat().st_size
    with path.open("rb") as file:
        raw = file.read(max_file_bytes + 1)
    bytes_truncated = len(raw) > max_file_bytes
    if bytes_truncated:
        raw = raw[:max_file_bytes]
    if len(raw) == 0:
        return FilesystemTextDocument(
            path=path,
            display_path=display_path(path, cwd),
            size_bytes=size_bytes,
            encoding="utf-8",
            text="(empty file)",
            bytes_truncated=False,
        )
    match = from_bytes(raw).best()
    if match is None:
        raise UnreadableTextError(
            f"file is not readable text: {display_path(path, cwd)}"
        )
    text = str(match)
    if text.strip() == "":
        text = "(empty file)"
    return FilesystemTextDocument(
        path=path,
        display_path=display_path(path, cwd),
        size_bytes=size_bytes,
        encoding=match.encoding,
        text=text,
        bytes_truncated=bytes_truncated,
    )


def read_directory_document(
    root: Path,
    cwd: Path,
    max_file_bytes: int,
    max_directory_files: int,
    runner: CommandRunner,
    git_timeout_seconds: int,
) -> FilesystemDirectoryDocument:
    ignore_spec = ignore_spec_for(root, cwd)
    listing_source = FilesystemDirectoryListingSource.WALK
    paths: Iterator[Path] = walk_files(root, cwd, ignore_spec)
    git_paths = git_directory_files(root, cwd, runner, git_timeout_seconds)
    if git_paths is not None:
        listing_source = FilesystemDirectoryListingSource.GIT
        paths = iter(git_paths)
    files: list[FilesystemTextDocument] = []
    skipped_count = 0
    file_list_truncated = False
    for path in paths:
        if len(files) >= max_directory_files:
            file_list_truncated = True
            break
        try:
            files.append(read_text_document(path, cwd, max_file_bytes))
        except (OSError, UnreadableTextError):
            skipped_count += 1
    return FilesystemDirectoryDocument(
        path=root,
        display_path=display_path(root, cwd),
        listing_source=listing_source,
        files=tuple(files),
        skipped_count=skipped_count,
        file_list_truncated=file_list_truncated,
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


def git_directory_files(
    root: Path,
    cwd: Path,
    runner: CommandRunner,
    timeout_seconds: int,
) -> tuple[Path, ...] | None:
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
    default_spec = GitIgnoreSpec.from_lines(DEFAULT_IGNORE_PATTERNS)
    paths: list[Path] = []
    seen: set[Path] = set()
    for value in result.stdout.split("\0"):
        if not value:
            continue
        path = repo_root / value
        if path in seen:
            continue
        if not is_relative_to(path, root):
            continue
        if should_skip_path(path, cwd, root, default_spec):
            continue
        if path.is_file():
            seen.add(path)
            paths.append(path)
    return tuple(sorted(paths, key=lambda path: display_path(path, cwd).casefold()))


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
):
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


def ignore_spec_for(root: Path, cwd: Path) -> GitIgnoreSpec:
    lines = list(DEFAULT_IGNORE_PATTERNS)
    gitignore = cwd / ".gitignore" if is_relative_to(root, cwd) else root / ".gitignore"
    if gitignore.is_file():
        with suppress(OSError):
            lines.extend(gitignore.read_text(encoding="utf-8").splitlines())
    return GitIgnoreSpec.from_lines(lines)


def render_file_metadata(document: FilesystemTextDocument) -> str:
    return "\n".join(
        (
            f"kind: {FilesystemRuntimeKind.FILE.value}",
            f"path: {document.display_path}",
            f"size_bytes: {document.size_bytes}",
            f"encoding: {document.encoding}",
            f"bytes_truncated: {str(document.bytes_truncated).lower()}",
        )
    )


def render_directory_metadata(document: FilesystemDirectoryDocument) -> str:
    return "\n".join(
        (
            f"kind: {FilesystemRuntimeKind.DIRECTORY.value}",
            f"path: {document.display_path}",
            f"listing_source: {document.listing_source.value}",
            f"files_included: {len(document.files)}",
            f"files_skipped: {document.skipped_count}",
            f"file_list_truncated: {str(document.file_list_truncated).lower()}",
        )
    )


def render_tree(files: tuple[FilesystemTextDocument, ...]) -> str:
    if len(files) == 0:
        return "(no readable files)"
    return "\n".join(
        f"- {file.display_path} ({file.size_bytes} bytes, {file.encoding})"
        for file in files
    )


def render_directory_files(document: FilesystemDirectoryDocument) -> str:
    if len(document.files) == 0:
        return "(no readable files)"
    return "\n\n".join(
        f"### {file.display_path}\n\n{file.text}" for file in document.files
    )


def missing_path_diagnostic(ref: SourceRef) -> str:
    if ref.path is None:
        return "path source requires a path"
    return f"path not found: {ref.path}"


def unavailable_runtime(
    ref: SourceRef,
    title: str,
    diagnostic: str,
) -> SourceRuntime:
    return SourceRuntime(
        ref=ref,
        status=SourceRuntimeStatus.UNAVAILABLE,
        title=title,
        diagnostics=(diagnostic,),
    )


def first_error_line(error: Exception) -> str:
    lines = [line.strip() for line in str(error).splitlines() if line.strip()]
    if len(lines) == 0:
        return error.__class__.__name__
    return lines[0]


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
