import shutil
import subprocess
from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.integrations.sources.filesystem import FilesystemSourceRuntimeAdapter
from codealmanac.services.sources.models import SourceRuntimeStatus
from codealmanac.services.sources.requests import (
    InspectSourceRuntimeRequest,
    ResolveSourcesRequest,
)


def test_filesystem_source_runtime_reads_text_file(tmp_path: Path):
    note = tmp_path / "notes.md"
    note.write_text("Keep the deployment rollback in the wiki.\n", encoding="utf-8")
    app = create_app(
        source_runtime_adapters=(FilesystemSourceRuntimeAdapter(),),
    )
    (brief,) = app.sources.resolve(
        ResolveSourcesRequest(cwd=tmp_path, inputs=("notes.md",))
    )

    runtime = app.sources.inspect_runtime(
        InspectSourceRuntimeRequest(cwd=tmp_path, ref=brief.ref)
    )

    assert runtime.status == SourceRuntimeStatus.AVAILABLE
    assert runtime.title == "File notes.md"
    assert "kind: file" in (runtime.content or "")
    assert "encoding:" in (runtime.content or "")
    assert "Keep the deployment rollback in the wiki." in (runtime.content or "")


def test_filesystem_source_runtime_reports_missing_path(tmp_path: Path):
    app = create_app(
        source_runtime_adapters=(FilesystemSourceRuntimeAdapter(),),
    )
    (brief,) = app.sources.resolve(
        ResolveSourcesRequest(cwd=tmp_path, inputs=("missing.md",))
    )

    runtime = app.sources.inspect_runtime(
        InspectSourceRuntimeRequest(cwd=tmp_path, ref=brief.ref)
    )

    assert runtime.status == SourceRuntimeStatus.UNAVAILABLE
    assert runtime.content is None
    assert runtime.diagnostics == (f"path not found: {tmp_path / 'missing.md'}",)


def test_filesystem_source_runtime_reports_binary_file(tmp_path: Path):
    binary = tmp_path / "image.bin"
    binary.write_bytes(bytes(range(256)))
    app = create_app(
        source_runtime_adapters=(FilesystemSourceRuntimeAdapter(),),
    )
    (brief,) = app.sources.resolve(
        ResolveSourcesRequest(cwd=tmp_path, inputs=("image.bin",))
    )

    runtime = app.sources.inspect_runtime(
        InspectSourceRuntimeRequest(cwd=tmp_path, ref=brief.ref)
    )

    assert runtime.status == SourceRuntimeStatus.UNAVAILABLE
    assert runtime.content is None
    assert runtime.diagnostics == ("file is not readable text: image.bin",)


def test_filesystem_source_runtime_reads_directory_with_ignores(tmp_path: Path):
    (tmp_path / ".gitignore").write_text("ignored.md\nbuild/\n", encoding="utf-8")
    (tmp_path / "src").mkdir()
    (tmp_path / "src/app.py").write_text("AUTH_RULE = 'keep'\n", encoding="utf-8")
    (tmp_path / "ignored.md").write_text("ignored note\n", encoding="utf-8")
    (tmp_path / "build").mkdir()
    (tmp_path / "build/generated.txt").write_text("generated\n", encoding="utf-8")
    (tmp_path / "node_modules/pkg").mkdir(parents=True)
    (tmp_path / "node_modules/pkg/index.js").write_text("dep\n", encoding="utf-8")
    (tmp_path / ".almanac/pages").mkdir(parents=True)
    (tmp_path / ".almanac/pages/wiki.md").write_text("wiki\n", encoding="utf-8")
    app = create_app(
        source_runtime_adapters=(FilesystemSourceRuntimeAdapter(max_directory_files=5),),
    )
    (brief,) = app.sources.resolve(ResolveSourcesRequest(cwd=tmp_path, inputs=(".",)))

    runtime = app.sources.inspect_runtime(
        InspectSourceRuntimeRequest(cwd=tmp_path, ref=brief.ref)
    )

    assert runtime.status == SourceRuntimeStatus.AVAILABLE
    assert runtime.title == "Directory ."
    assert "listing_source: walk" in (runtime.content or "")
    assert "src/app.py" in (runtime.content or "")
    assert "AUTH_RULE = 'keep'" in (runtime.content or "")
    assert "ignored.md" not in (runtime.content or "")
    assert "generated" not in (runtime.content or "")
    assert "node_modules" not in (runtime.content or "")
    assert ".almanac/pages/wiki.md" not in (runtime.content or "")


def test_filesystem_source_runtime_uses_git_directory_listing(
    tmp_path: Path,
):
    if shutil.which("git") is None:
        pytest.skip("git is required for this integration test")
    repo = tmp_path / "repo"
    repo.mkdir()
    run_git(repo, "init", "-q")
    (repo / ".gitignore").write_text("root-ignored.md\n", encoding="utf-8")
    (repo / "src").mkdir()
    (repo / "src/.gitignore").write_text("nested-secret.txt\n", encoding="utf-8")
    (repo / "src/keep.py").write_text("TRACKED = True\n", encoding="utf-8")
    (repo / "src/new-note.md").write_text("untracked source\n", encoding="utf-8")
    (repo / "src/nested-secret.txt").write_text("ignored nested\n", encoding="utf-8")
    (repo / ".almanac/pages").mkdir(parents=True)
    (repo / ".almanac/pages/wiki.md").write_text("wiki\n", encoding="utf-8")
    (repo / ".env").write_text("SECRET=1\n", encoding="utf-8")
    (repo / "root-ignored.md").write_text("ignored root\n", encoding="utf-8")
    run_git(repo, "add", "src/keep.py")
    app = create_app(
        source_runtime_adapters=(FilesystemSourceRuntimeAdapter(max_directory_files=10),)
    )
    (brief,) = app.sources.resolve(ResolveSourcesRequest(cwd=repo, inputs=("src",)))

    runtime = app.sources.inspect_runtime(
        InspectSourceRuntimeRequest(cwd=repo, ref=brief.ref)
    )

    content = runtime.content or ""
    assert runtime.status == SourceRuntimeStatus.AVAILABLE
    assert "listing_source: git" in content
    assert "src/keep.py" in content
    assert "TRACKED = True" in content
    assert "src/new-note.md" in content
    assert "untracked source" in content
    assert "nested-secret.txt" not in content
    assert ".gitignore" not in content
    assert ".almanac/pages/wiki.md" not in content
    assert "SECRET=1" not in content
    assert "root-ignored.md" not in content


def test_filesystem_source_runtime_bounds_directory_files(tmp_path: Path):
    for index in range(3):
        (tmp_path / f"note-{index}.md").write_text(
            f"note {index}\n",
            encoding="utf-8",
        )
    app = create_app(
        source_runtime_adapters=(FilesystemSourceRuntimeAdapter(max_directory_files=2),),
    )
    (brief,) = app.sources.resolve(ResolveSourcesRequest(cwd=tmp_path, inputs=(".",)))

    runtime = app.sources.inspect_runtime(
        InspectSourceRuntimeRequest(cwd=tmp_path, ref=brief.ref)
    )

    assert runtime.status == SourceRuntimeStatus.AVAILABLE
    assert runtime.truncated is True
    assert "file_list_truncated: true" in (runtime.content or "")
    assert "note-0.md" in (runtime.content or "")
    assert "note-1.md" in (runtime.content or "")
    assert "note-2.md" not in (runtime.content or "")


def test_filesystem_source_runtime_truncates_large_file(tmp_path: Path):
    note = tmp_path / "large.md"
    note.write_text("a" * 200, encoding="utf-8")
    app = create_app(
        source_runtime_adapters=(FilesystemSourceRuntimeAdapter(max_file_bytes=20),),
    )
    (brief,) = app.sources.resolve(
        ResolveSourcesRequest(cwd=tmp_path, inputs=("large.md",))
    )

    runtime = app.sources.inspect_runtime(
        InspectSourceRuntimeRequest(cwd=tmp_path, ref=brief.ref)
    )

    assert runtime.status == SourceRuntimeStatus.AVAILABLE
    assert runtime.truncated is True
    assert "bytes_truncated: true" in (runtime.content or "")


def run_git(repo: Path, *args: str) -> None:
    subprocess.run(
        ("git", *args),
        cwd=repo,
        text=True,
        capture_output=True,
        check=True,
    )
