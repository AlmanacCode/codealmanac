import shutil
import subprocess
from pathlib import Path
from typing import Protocol

from codealmanac.core.models import CodeAlmanacModel


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
        # Windows: npm-installed CLIs (codex/claude/opencode) ship as .cmd/.ps1
        # shims, and subprocess.run(shell=False) can't launch a bare command
        # name through CreateProcess the way a shell would. Resolving through
        # PATH/PATHEXT first fixes all three harnesses' check(), not just one.
        resolved = shutil.which(command) or command
        completed = subprocess.run(
            (resolved, *args),
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


def first_line(*values: str) -> str:
    for value in values:
        lines = [line.strip() for line in value.splitlines() if line.strip()]
        if lines:
            return lines[0]
    return ""
