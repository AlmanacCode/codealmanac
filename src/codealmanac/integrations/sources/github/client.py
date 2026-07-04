import subprocess
from pathlib import Path

from pydantic import ValidationError

from codealmanac.core.errors import ExecutionFailed
from codealmanac.engine.sources.models import SourceRef
from codealmanac.integrations.command import CommandRunner, SubprocessCommandRunner
from codealmanac.integrations.sources.github.models import (
    ISSUE_FIELDS,
    PULL_REQUEST_FIELDS,
    GitHubIssuePayload,
    GitHubPullRequestPayload,
)
from codealmanac.integrations.sources.github.targets import github_target_args
from codealmanac.integrations.sources.runtime import surface_process_error

GITHUB_RUNTIME_TIMEOUT_SECONDS = 30


class GitHubClient:
    def __init__(
        self,
        runner: CommandRunner | None = None,
        timeout_seconds: int = GITHUB_RUNTIME_TIMEOUT_SECONDS,
    ):
        self.runner = runner or SubprocessCommandRunner()
        self.timeout_seconds = timeout_seconds

    def pull_request(
        self,
        cwd: Path,
        ref: SourceRef,
    ) -> tuple[GitHubPullRequestPayload, str]:
        target_args = github_target_args(ref)
        payload = self._gh_json(
            cwd,
            ("pr", "view", *target_args, "--json", PULL_REQUEST_FIELDS),
            GitHubPullRequestPayload,
        )
        diff = self._gh_text(
            cwd,
            ("pr", "diff", *target_args, "--patch", "--color", "never"),
        )
        return payload, diff

    def issue(self, cwd: Path, ref: SourceRef) -> GitHubIssuePayload:
        target_args = github_target_args(ref)
        return self._gh_json(
            cwd,
            ("issue", "view", *target_args, "--json", ISSUE_FIELDS),
            GitHubIssuePayload,
        )

    def _gh_json(
        self,
        cwd: Path,
        args: tuple[str, ...],
        model: type[GitHubPullRequestPayload] | type[GitHubIssuePayload],
    ) -> GitHubPullRequestPayload | GitHubIssuePayload:
        try:
            return model.model_validate_json(self._gh_text(cwd, args))
        except ValidationError:
            raise

    def _gh_text(self, cwd: Path, args: tuple[str, ...]) -> str:
        try:
            result = self.runner.run("gh", args, cwd, self.timeout_seconds)
        except FileNotFoundError as error:
            raise ExecutionFailed("gh not found on PATH") from error
        except subprocess.TimeoutExpired as error:
            raise ExecutionFailed(f"gh {' '.join(args)} timed out") from error
        if result.returncode != 0:
            raise ExecutionFailed(
                f"gh {' '.join(args)} failed: {surface_process_error(result)}"
            )
        return result.stdout.strip()
