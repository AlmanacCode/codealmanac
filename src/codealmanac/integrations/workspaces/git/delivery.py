from pathlib import Path

from codealmanac.core.errors import ExecutionFailed, ValidationFailed
from codealmanac.integrations.command import (
    CommandRunner,
    SubprocessCommandRunner,
    first_line,
)
from codealmanac.integrations.workspaces.git.probe import parse_git_status
from codealmanac.local.delivery.execution.models import (
    LocalDeliveryCommit,
    LocalDeliveryHead,
    LocalDeliveryPatch,
    LocalDeliveryWorkingTree,
)

GIT_DELIVERY_TIMEOUT_SECONDS = 60


class GitLocalDeliveryManager:
    def __init__(
        self,
        runner: CommandRunner | None = None,
        timeout_seconds: int = GIT_DELIVERY_TIMEOUT_SECONDS,
    ):
        self.runner = runner or SubprocessCommandRunner()
        self.timeout_seconds = timeout_seconds

    def read_head(self, repo_path: Path) -> LocalDeliveryHead:
        branch_name = self._git(repo_path, ("branch", "--show-current")).stdout.strip()
        if branch_name == "":
            raise ExecutionFailed("detached HEAD has no branch")
        head_sha = self._git(repo_path, ("rev-parse", "HEAD")).stdout.strip()
        if head_sha == "":
            raise ExecutionFailed("git HEAD is empty")
        return LocalDeliveryHead(branch_name=branch_name, head_sha=head_sha)

    def collect_patch(
        self,
        worker_repo_path: Path,
        almanac_root: Path,
    ) -> LocalDeliveryPatch:
        changes = parse_git_status(
            self._git(
                worker_repo_path,
                ("status", "--porcelain=v1", "-z", "--untracked-files=all"),
            ).stdout
        )
        changed_paths = tuple(change.path for change in changes)
        unsafe = tuple(
            path for path in changed_paths if not path_is_under(path, almanac_root)
        )
        if unsafe:
            raise ValidationFailed(
                "worker changed file outside configured Almanac root: "
                f"{format_paths(unsafe)}"
            )
        if not changed_paths:
            return LocalDeliveryPatch(patch_text="", changed_paths=())
        untracked = tuple(
            path
            for change in changes
            if change.status == "??" and path_is_under(change.path, almanac_root)
            for path in (change.path,)
        )
        if untracked:
            self._git(worker_repo_path, ("add", "-N", "--", *path_args(untracked)))
        patch = self._git(
            worker_repo_path,
            ("diff", "--binary", "HEAD", "--", almanac_root.as_posix()),
        ).stdout
        return LocalDeliveryPatch(
            patch_text=patch,
            changed_paths=tuple(
                sorted(changed_paths, key=lambda item: item.as_posix())
            ),
        )

    def apply_patch_and_commit(
        self,
        repo_path: Path,
        almanac_root: Path,
        patch_text: str,
        commit_subject: str,
        commit_body: str | None,
    ) -> LocalDeliveryCommit:
        if patch_text.strip() == "":
            raise ValidationFailed("delivery patch is empty")
        self.validate_almanac_root_clean(repo_path, almanac_root)
        self._git(repo_path, ("apply", "--index", "-"), stdin=patch_text)
        commit_args = ("commit", "--only", "-m", commit_subject)
        if commit_body is not None:
            commit_args = (*commit_args, "-m", commit_body)
        self._git(repo_path, (*commit_args, "--", almanac_root.as_posix()))
        commit_sha = self._git(repo_path, ("rev-parse", "HEAD")).stdout.strip()
        return LocalDeliveryCommit(commit_sha=commit_sha)

    def apply_patch_to_working_tree(
        self,
        repo_path: Path,
        almanac_root: Path,
        patch_text: str,
    ) -> LocalDeliveryWorkingTree:
        if patch_text.strip() == "":
            raise ValidationFailed("delivery patch is empty")
        self.validate_almanac_root_clean(repo_path, almanac_root)
        self._git(repo_path, ("apply", "-"), stdin=patch_text)
        status = self._git(
            repo_path,
            ("status", "--porcelain=v1", "-z", "--", almanac_root.as_posix()),
        ).stdout
        changed_paths = tuple(change.path for change in parse_git_status(status))
        return LocalDeliveryWorkingTree(
            changed_paths=tuple(sorted(changed_paths, key=lambda item: item.as_posix()))
        )

    def validate_almanac_root_clean(self, repo_path: Path, almanac_root: Path) -> None:
        status = self._git(
            repo_path,
            ("status", "--porcelain=v1", "-z", "--", almanac_root.as_posix()),
        ).stdout
        if status:
            raise ValidationFailed(
                "delivery requires a clean configured Almanac root before applying"
            )

    def _git(
        self,
        cwd: Path,
        args: tuple[str, ...],
        stdin: str | None = None,
    ):
        result = self.runner.run("git", args, cwd, self.timeout_seconds, stdin=stdin)
        if result.returncode != 0:
            message = first_line(result.stderr, result.stdout)
            raise ExecutionFailed(message or f"git {' '.join(args)} failed")
        return result


def path_is_under(path: Path, parent: Path) -> bool:
    return path == parent or parent in path.parents


def path_args(paths: tuple[Path, ...]) -> tuple[str, ...]:
    return tuple(path.as_posix() for path in paths)


def format_paths(paths: tuple[Path, ...]) -> str:
    return ", ".join(path.as_posix() for path in paths)
