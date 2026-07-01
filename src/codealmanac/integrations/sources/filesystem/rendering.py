from enum import StrEnum

from codealmanac.integrations.sources.filesystem.documents import (
    FilesystemDirectoryDocument,
    FilesystemTextDocument,
)


class FilesystemRuntimeKind(StrEnum):
    FILE = "file"
    DIRECTORY = "directory"


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
            f"selection_policy: {document.selection_policy.value}",
            f"files_included: {len(document.files)}",
            f"changed_files_available: {document.changed_count}",
            f"files_skipped: {document.skipped_count}",
            f"file_list_truncated: {str(document.file_list_truncated).lower()}",
        )
    )


def render_tree(files: tuple[FilesystemTextDocument, ...]) -> str:
    if len(files) == 0:
        return "(no readable files)"
    return "\n".join(
        (
            f"- {file.display_path} [{file.selection_state.value}] "
            f"({file.size_bytes} bytes, {file.encoding})"
        )
        for file in files
    )


def render_directory_files(document: FilesystemDirectoryDocument) -> str:
    if len(document.files) == 0:
        return "(no readable files)"
    return "\n\n".join(
        f"### {file.display_path}\n\n{file.text}" for file in document.files
    )
