import shutil
import subprocess
from pathlib import Path

import pytest

from codealmanac.integrations.workspaces.git.probe import (
    parse_git_status,
    state_from_status,
)
from codealmanac.integrations.workspaces.git.state import GitLocalStateProbe
from codealmanac.services.workspaces.models import WorkspacePathState


def test_parse_git_status_handles_renames_and_untracked_paths():
    changes = parse_git_status("R  new.md\0old.md\0?? docs/note.md\0")

    assert tuple(change.path for change in changes) == (
        Path("new.md"),
        Path("docs/note.md"),
    )
    assert tuple(change.state for change in changes) == (
        WorkspacePathState.RENAMED,
        WorkspacePathState.UNTRACKED,
    )


def test_state_from_status_maps_common_porcelain_states():
    assert state_from_status(" M") == WorkspacePathState.MODIFIED
    assert state_from_status("A ") == WorkspacePathState.ADDED
    assert state_from_status(" D") == WorkspacePathState.DELETED
    assert state_from_status("??") == WorkspacePathState.UNTRACKED


def test_git_local_state_probe_reads_root_branch_and_head(tmp_path: Path):
    if shutil.which("git") is None:
        pytest.skip("git is required for this integration test")
    repo = tmp_path / "repo"
    repo.mkdir()
    run_git(repo, "init", "-q")
    run_git(repo, "config", "user.email", "test@example.com")
    run_git(repo, "config", "user.name", "Test User")
    run_git(repo, "checkout", "-b", "dev")
    (repo / "README.md").write_text("hello\n", encoding="utf-8")
    (repo / "subdir").mkdir()
    run_git(repo, "add", "README.md")
    run_git(repo, "commit", "-m", "initial", "--quiet")
    expected_head = subprocess.run(
        ("git", "rev-parse", "HEAD"),
        cwd=repo,
        text=True,
        capture_output=True,
        check=True,
    ).stdout.strip()

    state = GitLocalStateProbe().read(repo / "subdir")

    assert state.available is True
    assert state.repository_root == repo.resolve()
    assert state.branch_name == "dev"
    assert state.head_sha == expected_head


def test_git_local_state_probe_reports_unavailable_outside_repo(tmp_path: Path):
    state = GitLocalStateProbe().read(tmp_path)

    assert state.available is False
    assert state.repository_root is None
    assert state.unavailable_reason is not None


def run_git(repo: Path, *args: str) -> None:
    subprocess.run(
        ("git", *args),
        cwd=repo,
        text=True,
        capture_output=True,
        check=True,
    )
