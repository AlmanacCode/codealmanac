import shutil
import stat
import subprocess
from pathlib import Path

import pytest

from codealmanac.integrations.workspaces.git.hooks import (
    LOCAL_TRIGGER_END,
    LOCAL_TRIGGER_START,
    FileLocalGitHookManager,
)
from codealmanac.local.hooks.models import LocalGitHookName
from codealmanac.local.hooks.requests import (
    InstallLocalHooksRequest,
    UninstallLocalHooksRequest,
)
from codealmanac.local.hooks.service import LocalHooksService


def test_local_hooks_install_default_git_trigger_hooks(tmp_path: Path):
    repo = make_git_repo(tmp_path)
    service = LocalHooksService(FileLocalGitHookManager())

    result = service.install(InstallLocalHooksRequest(repo_root=repo))

    assert tuple(change.hook for change in result.changes) == (
        LocalGitHookName.POST_COMMIT,
        LocalGitHookName.POST_MERGE,
        LocalGitHookName.POST_REWRITE,
    )
    assert all(change.changed for change in result.changes)
    for hook in LocalGitHookName:
        text = hook_path(repo, hook).read_text(encoding="utf-8")
        assert "codealmanac-local-trigger" in text
        assert f"--kind {trigger_kind_for(hook)}" in text
        assert "--spawn-worker" in text
        assert LOCAL_TRIGGER_START in text
        assert LOCAL_TRIGGER_END in text
        assert hook_path(repo, hook).stat().st_mode & stat.S_IXUSR


def test_local_hooks_install_is_idempotent(tmp_path: Path):
    repo = make_git_repo(tmp_path)
    service = LocalHooksService(FileLocalGitHookManager())

    service.install(InstallLocalHooksRequest(repo_root=repo))
    second = service.install(InstallLocalHooksRequest(repo_root=repo))

    assert all(not change.changed for change in second.changes)


def test_local_hooks_preserve_user_hook_content_and_uninstall_block(
    tmp_path: Path,
):
    repo = make_git_repo(tmp_path)
    service = LocalHooksService(FileLocalGitHookManager())
    post_commit = hook_path(repo, LocalGitHookName.POST_COMMIT)
    post_commit.write_text("#!/bin/sh\necho user hook\n", encoding="utf-8")

    service.install(
        InstallLocalHooksRequest(
            repo_root=repo,
            hooks=(LocalGitHookName.POST_COMMIT,),
        )
    )
    installed = post_commit.read_text(encoding="utf-8")
    removed = service.uninstall(
        UninstallLocalHooksRequest(
            repo_root=repo,
            hooks=(LocalGitHookName.POST_COMMIT,),
        )
    )

    uninstalled = post_commit.read_text(encoding="utf-8")
    assert "echo user hook" in installed
    assert LOCAL_TRIGGER_START in installed
    assert removed.changes[0].changed is True
    assert "echo user hook" in uninstalled
    assert LOCAL_TRIGGER_START not in uninstalled
    assert "codealmanac-local-trigger" not in uninstalled


def make_git_repo(tmp_path: Path) -> Path:
    if shutil.which("git") is None:
        pytest.skip("git is required for this integration test")
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(("git", "init", "-q"), cwd=repo, check=True)
    return repo


def hook_path(repo: Path, hook: LocalGitHookName) -> Path:
    return repo / ".git/hooks" / hook.value


def trigger_kind_for(hook: LocalGitHookName) -> str:
    if hook is LocalGitHookName.POST_COMMIT:
        return "local_post_commit"
    if hook is LocalGitHookName.POST_MERGE:
        return "local_post_merge"
    if hook is LocalGitHookName.POST_REWRITE:
        return "local_post_rewrite"
    raise AssertionError(f"unexpected hook: {hook.value}")
