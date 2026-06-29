import subprocess
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, field_validator

from codealmanac.core.text import required_text
from codealmanac.integrations.command import (
    CommandResult,
    CommandRunner,
    SubprocessCommandRunner,
    first_line,
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
    HarnessRunStatus,
    HarnessTranscriptRef,
    terminal_harness_event,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest

CLAUDE_COMMAND = "claude"
CLAUDE_RUN_TIMEOUT_SECONDS = 900
CLAUDE_STATUS_TIMEOUT_SECONDS = 10
CLAUDE_ALLOWED_TOOLS = "Read,Write,Edit,MultiEdit,Glob,Grep,LS"


class ClaudeAuthStatus(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)

    logged_in: bool = Field(validation_alias="loggedIn")
    auth_method: str | None = Field(default=None, validation_alias="authMethod")

    @classmethod
    def from_json(cls, value: str) -> "ClaudeAuthStatus":
        return cls.model_validate_json(value)


class ClaudeCliResult(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)

    type: str
    subtype: str | None = None
    is_error: bool = False
    result: str
    session_id: str | None = None

    @field_validator("result")
    @classmethod
    def require_result(cls, value: str) -> str:
        return required_text(value, "Claude result")


class ClaudeCliHarnessAdapter:
    kind = HarnessKind.CLAUDE

    def __init__(
        self,
        runner: CommandRunner | None = None,
        command: str = CLAUDE_COMMAND,
        run_timeout_seconds: int = CLAUDE_RUN_TIMEOUT_SECONDS,
        status_timeout_seconds: int = CLAUDE_STATUS_TIMEOUT_SECONDS,
    ):
        self.runner = runner or SubprocessCommandRunner()
        self.command = command
        self.run_timeout_seconds = run_timeout_seconds
        self.status_timeout_seconds = status_timeout_seconds

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
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message=first_line(result.stderr, result.stdout)
                or f"claude auth status exited {result.returncode}",
            )
        try:
            status = ClaudeAuthStatus.from_json(result.stdout)
        except ValueError as error:
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message=str(error),
            )
        if not status.logged_in:
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message="claude is not logged in",
            )
        return HarnessReadiness(
            kind=self.kind,
            available=True,
            message=status.auth_method or "claude authenticated",
        )

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        before = git_status_snapshot(self.runner, request.cwd)
        try:
            result = self.runner.run(
                self.command,
                claude_print_args(),
                request.cwd,
                self.run_timeout_seconds,
                request.prompt,
            )
        except FileNotFoundError:
            return failed_result("claude not found on PATH")
        except subprocess.TimeoutExpired:
            return failed_result("claude run timed out")
        after = git_status_snapshot(self.runner, request.cwd)
        changed_files = changed_paths(request.cwd, before, after)
        if result.returncode != 0:
            return failed_result(
                first_line(result.stderr, result.stdout)
                or f"claude exited {result.returncode}",
                changed_files,
            )
        try:
            parsed = ClaudeCliResult.model_validate_json(result.stdout)
        except ValueError as error:
            return failed_result(
                f"claude returned invalid JSON: {error}",
                changed_files,
            )
        transcript = claude_transcript_ref(parsed.session_id)
        if parsed.is_error or parsed.subtype not in {None, "success"}:
            return failed_result(parsed.result, changed_files, transcript)
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text=parsed.result,
            summary=first_line(parsed.result),
            changed_files=changed_files,
            transcript=transcript,
            events=(
                terminal_harness_event(
                    self.kind,
                    HarnessRunStatus.SUCCEEDED,
                    parsed.result,
                ),
            ),
        )


def claude_print_args() -> tuple[str, ...]:
    return (
        "-p",
        "--output-format",
        "json",
        "--no-session-persistence",
        "--permission-mode",
        "acceptEdits",
        "--tools",
        CLAUDE_ALLOWED_TOOLS,
    )


def failed_result(
    output_text: str,
    changed_files: tuple[Path, ...] = (),
    transcript: HarnessTranscriptRef | None = None,
) -> HarnessRunResult:
    return HarnessRunResult(
        kind=HarnessKind.CLAUDE,
        status=HarnessRunStatus.FAILED,
        output_text=output_text,
        changed_files=changed_files,
        transcript=transcript,
        events=(
            terminal_harness_event(
                HarnessKind.CLAUDE,
                HarnessRunStatus.FAILED,
                output_text,
            ),
        ),
    )


def claude_transcript_ref(session_id: str | None) -> HarnessTranscriptRef | None:
    if session_id is None:
        return None
    return HarnessTranscriptRef(kind=HarnessKind.CLAUDE, session_id=session_id)


__all__ = [
    "CLAUDE_ALLOWED_TOOLS",
    "ClaudeCliHarnessAdapter",
    "CommandResult",
    "claude_print_args",
    "parse_git_status_paths",
]
