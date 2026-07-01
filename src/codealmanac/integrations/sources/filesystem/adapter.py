from pathlib import Path

from codealmanac.core.paths import normalize_path
from codealmanac.integrations.command import CommandRunner, SubprocessCommandRunner
from codealmanac.integrations.sources.filesystem.documents import (
    UnreadableTextError,
    read_text_document,
)
from codealmanac.integrations.sources.filesystem.listing import read_directory_document
from codealmanac.integrations.sources.filesystem.rendering import (
    render_directory_files,
    render_directory_metadata,
    render_file_metadata,
    render_tree,
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
            return self._inspect_directory(
                request.cwd,
                request.ref,
                request.context.ignored_directories,
            )
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
        cwd = normalize_path(cwd)
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

    def _inspect_directory(
        self,
        cwd: Path,
        ref: SourceRef,
        ignored_directories: tuple[Path, ...],
    ) -> SourceRuntime:
        cwd = normalize_path(cwd)
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
            ignored_directories,
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
