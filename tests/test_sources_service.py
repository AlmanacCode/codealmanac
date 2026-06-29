from pathlib import Path

import pytest
from pydantic import ValidationError

from codealmanac.app import create_app
from codealmanac.core.errors import ValidationFailed
from codealmanac.services.sources.models import (
    SourceKind,
    SourceProvenanceKind,
)
from codealmanac.services.sources.requests import ResolveSourcesRequest


def test_sources_resolve_local_files_directories_and_missing_paths(tmp_path: Path):
    app = create_app()
    note = tmp_path / "notes.md"
    note.write_text("important design note\n", encoding="utf-8")
    folder = tmp_path / "folder"
    folder.mkdir()

    briefs = app.sources.resolve(
        ResolveSourcesRequest(
            cwd=tmp_path,
            inputs=("notes.md", "folder", "missing.md"),
        )
    )

    assert [brief.ref.kind for brief in briefs] == [
        SourceKind.PATH_FILE,
        SourceKind.PATH_DIRECTORY,
        SourceKind.PATH_UNKNOWN,
    ]
    assert briefs[0].ref.path == note
    assert briefs[0].ref.exists is True
    assert briefs[0].ref.fingerprint is not None
    assert briefs[0].provenance_kind == SourceProvenanceKind.FILE
    assert briefs[1].ref.path == folder
    assert briefs[1].provenance_kind == SourceProvenanceKind.DIRECTORY
    assert briefs[2].ref.exists is False
    assert briefs[2].provenance_kind == SourceProvenanceKind.MISSING_PATH


def test_sources_resolve_github_refs_and_urls(tmp_path: Path):
    app = create_app()

    briefs = app.sources.resolve(
        ResolveSourcesRequest(
            cwd=tmp_path,
            inputs=(
                "github:pr:42",
                "github:issue:7",
                "https://github.com/openai/codex/pull/12",
                "https://github.com/openai/codex/issues/13",
                "HTTPS://example.com/post",
                "https://example.com/post",
            ),
        )
    )

    assert [brief.ref.kind for brief in briefs] == [
        SourceKind.GITHUB_PULL_REQUEST,
        SourceKind.GITHUB_ISSUE,
        SourceKind.GITHUB_PULL_REQUEST,
        SourceKind.GITHUB_ISSUE,
        SourceKind.WEB_URL,
        SourceKind.WEB_URL,
    ]
    assert briefs[0].ref.number == 42
    assert briefs[1].ref.number == 7
    assert briefs[2].ref.repository == "openai/codex"
    assert briefs[2].ref.url == "https://github.com/openai/codex/pull/12"
    assert briefs[3].ref.url == "https://github.com/openai/codex/issues/13"
    assert briefs[4].ref.url == "https://example.com/post"
    assert briefs[5].provenance_kind == SourceProvenanceKind.URL


def test_sources_resolve_git_and_transcript_refs(tmp_path: Path):
    app = create_app()

    briefs = app.sources.resolve(
        ResolveSourcesRequest(
            cwd=tmp_path,
            inputs=(
                "git:range:main..feature",
                "git:diff",
                "git:diff:HEAD~1",
                "transcript:codex-session-123",
            ),
        )
    )

    assert [brief.ref.kind for brief in briefs] == [
        SourceKind.GIT_RANGE,
        SourceKind.GIT_DIFF,
        SourceKind.GIT_DIFF,
        SourceKind.TRANSCRIPT,
    ]
    assert briefs[0].ref.revision_range == "main..feature"
    assert briefs[1].ref.revision_range == "working-tree"
    assert briefs[2].ref.revision_range == "HEAD~1"
    assert briefs[3].ref.transcript == "codex-session-123"


def test_sources_reject_malformed_source_refs(tmp_path: Path):
    app = create_app()

    with pytest.raises(ValidationFailed):
        app.sources.resolve(
            ResolveSourcesRequest(cwd=tmp_path, inputs=("github:pr:x",))
        )

    with pytest.raises(ValidationFailed):
        app.sources.resolve(ResolveSourcesRequest(cwd=tmp_path, inputs=("git:range:",)))

    with pytest.raises(ValidationFailed):
        app.sources.resolve(
            ResolveSourcesRequest(cwd=tmp_path, inputs=("transcript:",))
        )

    with pytest.raises(ValidationFailed):
        app.sources.resolve(ResolveSourcesRequest(cwd=tmp_path, inputs=("https://",)))


def test_sources_request_requires_inputs(tmp_path: Path):
    with pytest.raises(ValidationError):
        ResolveSourcesRequest(cwd=tmp_path, inputs=())
