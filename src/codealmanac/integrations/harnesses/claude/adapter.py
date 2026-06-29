import subprocess
from pathlib import Path
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest

CLAUDE_COMMAND = "claude"
CLAUDE_RUN_TIMEOUT_SECONDS = 900
CLAUDE_STATUS_TIMEOUT_SECONDS = 10
CLAUDE_ALLOWED_TOOLS = "Read,Write,Edit,MultiEdit,Glob,Grep,LS"


class CommandResult(CodeAlmanacModel):
    returncode: int
    stdout: str = ""
    stderr: str = ""


class CommandRunner(Protocol):
    def run(
        self,
        command: str,
        args: tuple[str, ...],
        cwd: Path,
        timeout_seconds: int,
        stdin: str | None = None,
    ) -> CommandResult:
        """Run a local command and return captured text output."""


class SubprocessCommandRunner:
    def run(
        self,
        command: str,
        args: tuple[str, ...],
        cwd: Path,
        timeout_seconds: int,
        stdin: str | None = None,
    ) -> CommandResult:
        completed = subprocess.run(
            (command, *args),
            cwd=cwd,
            text=True,
            input=stdin,
            capture_output=True,
            timeout=timeout_seconds,
            check=False,
        )
        return CommandResult(
            returncode=completed.returncode,
            stdout=completed.stdout,
            stderr=completed.stderr,
        )


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
        if parsed.is_error or parsed.subtype not in {None, "success"}:
            return failed_result(parsed.result, changed_files)
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text=parsed.result,
            summary=first_line(parsed.result),
            changed_files=changed_files,
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
) -> HarnessRunResult:
    return HarnessRunResult(
        kind=HarnessKind.CLAUDE,
        status=HarnessRunStatus.FAILED,
        output_text=output_text,
        changed_files=changed_files,
    )


def git_status_snapshot(
    runner: CommandRunner,
    cwd: Path,
) -> frozenset[Path]:
    try:
        result = runner.run(
            "git",
            ("-C", str(cwd), "status", "--porcelain=v1", "-z", "--untracked-files=all"),
            cwd,
            10,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return frozenset()
    if result.returncode != 0:
        return frozenset()
    return frozenset(parse_git_status_paths(result.stdout))


def parse_git_status_paths(value: str) -> tuple[Path, ...]:
    paths: list[Path] = []
    fields = [field for field in value.split("\0") if field]
    skip_next = False
    for field in fields:
        if skip_next:
            skip_next = False
            continue
        if len(field) < 4:
            continue
        status = field[:2]
        path_text = field[3:]
        paths.append(Path(path_text))
        if status[0] in {"R", "C"} or status[1] in {"R", "C"}:
            skip_next = True
    return tuple(paths)


def changed_paths(
    cwd: Path,
    before: frozenset[Path],
    after: frozenset[Path],
) -> tuple[Path, ...]:
    changed = sorted(after - before, key=lambda item: str(item))
    return tuple(cwd / path for path in changed)


def first_line(*values: str) -> str:
    for value in values:
        lines = [line.strip() for line in value.splitlines() if line.strip()]
        if lines:
            return lines[0]
    return ""
