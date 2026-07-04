from pathlib import Path

from codealmanac.core.errors import ExecutionFailed
from codealmanac.engine.workspaces.models import GitWorktreeCheckout
from codealmanac.integrations.command import (
    CommandRunner,
    SubprocessCommandRunner,
    first_line,
)

GIT_WORKTREE_TIMEOUT_SECONDS = 60


class GitDetachedWorktreeManager:
    def __init__(
        self,
        runner: CommandRunner | None = None,
        timeout_seconds: int = GIT_WORKTREE_TIMEOUT_SECONDS,
    ):
        self.runner = runner or SubprocessCommandRunner()
        self.timeout_seconds = timeout_seconds

    def add_detached(
        self,
        source_repo_path: Path,
        worktree_path: Path,
        commit_sha: str,
    ) -> GitWorktreeCheckout:
        worktree_path.parent.mkdir(parents=True, exist_ok=True)
        self._git(
            source_repo_path,
            ("worktree", "add", "--detach", str(worktree_path), commit_sha),
        )
        head_sha = self._git(worktree_path, ("rev-parse", "HEAD")).stdout.strip()
        if head_sha != commit_sha:
            raise ExecutionFailed("Git worktree HEAD did not match expected head SHA")
        return GitWorktreeCheckout(repo_path=worktree_path, head_sha=head_sha)

    def remove(self, source_repo_path: Path, worktree_path: Path) -> None:
        if not worktree_path.exists():
            return
        self._git(
            source_repo_path,
            ("worktree", "remove", "--force", str(worktree_path)),
        )

    def _git(self, cwd: Path, args: tuple[str, ...]):
        result = self.runner.run("git", args, cwd, self.timeout_seconds)
        if result.returncode != 0:
            message = first_line(result.stderr, result.stdout)
            raise ExecutionFailed(message or f"git {' '.join(args)} failed")
        return result
