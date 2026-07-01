import os
import subprocess
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field

from codealmanac.integrations.command import (
    CommandResult,
    CommandRunner,
    SubprocessCommandRunner,
    first_line,
)
from codealmanac.integrations.harnesses.claude.client import (
    CLAUDE_COMMAND,
    CLAUDE_RUN_TIMEOUT_SECONDS,
    ClaudeSdkClient,
)
from codealmanac.integrations.harnesses.git_status import (
    changed_paths,
    git_status_snapshot,
    parse_git_status_paths,
)
from codealmanac.services.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest

CLAUDE_STATUS_TIMEOUT_SECONDS = 10
ANTHROPIC_API_KEY = "ANTHROPIC_API_KEY"


class ClaudeAuthStatus(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)

    logged_in: bool = Field(validation_alias="loggedIn")
    auth_method: str | None = Field(default=None, validation_alias="authMethod")
    email: str | None = None

    @classmethod
    def from_json(cls, value: str) -> "ClaudeAuthStatus":
        return cls.model_validate_json(value)


class ClaudeSdkHarnessAdapter:
    kind = HarnessKind.CLAUDE

    def __init__(
        self,
        runner: CommandRunner | None = None,
        command: str = CLAUDE_COMMAND,
        run_timeout_seconds: float = CLAUDE_RUN_TIMEOUT_SECONDS,
        status_timeout_seconds: int = CLAUDE_STATUS_TIMEOUT_SECONDS,
        client: ClaudeSdkClient | None = None,
    ):
        self.runner = runner or SubprocessCommandRunner()
        self.command = command
        self.run_timeout_seconds = run_timeout_seconds
        self.status_timeout_seconds = status_timeout_seconds
        self.client = client or ClaudeSdkClient(
            command=command,
            run_timeout_seconds=run_timeout_seconds,
        )

    def check(self) -> HarnessReadiness:
        try:
            result = self.runner.run(
                self.command,
                ("auth", "status"),
                Path.cwd(),
                self.status_timeout_seconds,
            )
        except FileNotFoundError:
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message="claude not found on PATH",
            )
        except subprocess.TimeoutExpired:
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message="claude auth status timed out",
            )
        if result.returncode != 0:
            if has_anthropic_api_key():
                return api_key_readiness()
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message=first_line(result.stderr, result.stdout)
                or f"claude auth status exited {result.returncode}",
            )
        try:
            status = ClaudeAuthStatus.from_json(result.stdout)
        except ValueError as error:
            if has_anthropic_api_key():
                return api_key_readiness()
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message=str(error),
            )
        if not status.logged_in:
            if has_anthropic_api_key():
                return api_key_readiness()
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message="claude is not logged in",
            )
        return HarnessReadiness(
            kind=self.kind,
            available=True,
            message=status.email or status.auth_method or "claude authenticated",
        )

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        before = git_status_snapshot(self.runner, request.cwd)
        result = self.client.run(request)
        after = git_status_snapshot(self.runner, request.cwd)
        return result.model_copy(
            update={"changed_files": changed_paths(request.cwd, before, after)}
        )


def has_anthropic_api_key() -> bool:
    return os.environ.get(ANTHROPIC_API_KEY, "") != ""


def api_key_readiness() -> HarnessReadiness:
    return HarnessReadiness(
        kind=HarnessKind.CLAUDE,
        available=True,
        message=f"{ANTHROPIC_API_KEY} set",
    )


__all__ = [
    "ANTHROPIC_API_KEY",
    "CLAUDE_COMMAND",
    "CLAUDE_RUN_TIMEOUT_SECONDS",
    "CLAUDE_STATUS_TIMEOUT_SECONDS",
    "ClaudeSdkHarnessAdapter",
    "CommandResult",
    "parse_git_status_paths",
]
