import shutil
import subprocess
from pathlib import Path

import pytest

from codealmanac.core.errors import ValidationFailed
from codealmanac.integrations.workspaces.git.delivery import GitLocalDeliveryManager


def test_git_local_delivery_applies_worker_wiki_patch_as_commit(tmp_path: Path):
    if shutil.which("git") is None:
        pytest.skip("git is required for this integration test")
    repo = create_repo(tmp_path / "repo")
    worker = tmp_path / "worker"
    run_git(repo, "worktree", "add", "--detach", str(worker), "HEAD")
    (worker / "almanac/pages/index.md").write_text("updated\n", encoding="utf-8")
    (worker / "almanac/pages/new.md").write_text("new\n", encoding="utf-8")
    manager = GitLocalDeliveryManager()

    patch = manager.collect_patch(worker, Path("almanac"))
    commit = manager.apply_patch_and_commit(
        repo,
        Path("almanac"),
        patch.patch_text,
        "docs almanac: update wiki",
        "Updated wiki files.",
    )

    assert (repo / "almanac/pages/index.md").read_text(encoding="utf-8") == "updated\n"
    assert (repo / "almanac/pages/new.md").read_text(encoding="utf-8") == "new\n"
    assert git_stdout(repo, "rev-parse", "HEAD") == commit.commit_sha
    assert git_stdout(repo, "log", "-1", "--pretty=%s") == ("docs almanac: update wiki")


def test_git_local_delivery_applies_worker_wiki_patch_to_working_tree(
    tmp_path: Path,
):
    if shutil.which("git") is None:
        pytest.skip("git is required for this integration test")
    repo = create_repo(tmp_path / "repo")
    worker = tmp_path / "worker"
    original_head = git_stdout(repo, "rev-parse", "HEAD")
    run_git(repo, "worktree", "add", "--detach", str(worker), "HEAD")
    (worker / "almanac/pages/index.md").write_text("updated\n", encoding="utf-8")
    manager = GitLocalDeliveryManager()

    patch = manager.collect_patch(worker, Path("almanac"))
    result = manager.apply_patch_to_working_tree(
        repo,
        Path("almanac"),
        patch.patch_text,
    )

    assert (repo / "almanac/pages/index.md").read_text(encoding="utf-8") == "updated\n"
    assert git_stdout(repo, "rev-parse", "HEAD") == original_head
    assert result.changed_paths == (Path("almanac/pages/index.md"),)
    assert git_stdout(repo, "status", "--short") == "M almanac/pages/index.md"


def test_git_local_delivery_rejects_worker_changes_outside_almanac_root(
    tmp_path: Path,
):
    if shutil.which("git") is None:
        pytest.skip("git is required for this integration test")
    repo = create_repo(tmp_path / "repo")
    worker = tmp_path / "worker"
    run_git(repo, "worktree", "add", "--detach", str(worker), "HEAD")
    (worker / "README.md").write_text("unsafe\n", encoding="utf-8")

    with pytest.raises(ValidationFailed, match="outside configured Almanac root"):
        GitLocalDeliveryManager().collect_patch(worker, Path("almanac"))


def create_repo(repo: Path) -> Path:
    repo.mkdir()
    run_git(repo, "init", "-q")
    run_git(repo, "config", "user.email", "test@example.com")
    run_git(repo, "config", "user.name", "Test User")
    run_git(repo, "checkout", "-b", "dev")
    (repo / "almanac/pages").mkdir(parents=True)
    (repo / "almanac/pages/index.md").write_text("initial\n", encoding="utf-8")
    (repo / "README.md").write_text("safe\n", encoding="utf-8")
    run_git(repo, "add", ".")
    run_git(repo, "commit", "-m", "initial", "--quiet")
    return repo


def run_git(repo: Path, *args: str) -> None:
    subprocess.run(
        ("git", *args),
        cwd=repo,
        text=True,
        capture_output=True,
        check=True,
    )


def git_stdout(repo: Path, *args: str) -> str:
    return subprocess.run(
        ("git", *args),
        cwd=repo,
        text=True,
        capture_output=True,
        check=True,
    ).stdout.strip()
