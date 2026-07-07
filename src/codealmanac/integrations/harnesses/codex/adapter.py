import subprocess
from pathlib import Path

from codealmanac.integrations.command import (
    CommandRunner,
    SubprocessCommandRunner,
    first_line,
)
from codealmanac.integrations.harnesses.codex.app_server import (
    CodexAppServerClient,
)
from codealmanac.integrations.harnesses.git_status import (
    changed_paths,
    git_status_snapshot,
)
from codealmanac.services.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest

CODEX_COMMAND = "codex"
CODEX_STATUS_TIMEOUT_SECONDS = 10
CODEX_INSTALL_REPAIR = "install the Codex CLI: npm install -g @openai/codex"
CODEX_STATUS_REPAIR = (
    "check `codex --version` — reinstall with `npm install -g @openai/codex` "
    "if it fails, or sign in with `codex login`"
)


class CodexAppServerHarnessAdapter:
    kind = HarnessKind.CODEX

    def __init__(
        self,
        runner: CommandRunner | None = None,
        command: str = CODEX_COMMAND,
        status_timeout_seconds: int = CODEX_STATUS_TIMEOUT_SECONDS,
        app_server: CodexAppServerClient | None = None,
    ):
        self.runner = runner or SubprocessCommandRunner()
        self.command = command
        self.status_timeout_seconds = status_timeout_seconds
        self.app_server = app_server or CodexAppServerClient(command=command)

    def check(self) -> HarnessReadiness:
        try:
            result = self.runner.run(
                self.command,
                ("login", "status"),
                Path.cwd(),
                self.status_timeout_seconds,
            )
        except FileNotFoundError:
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message="codex not found on PATH",
                repair=CODEX_INSTALL_REPAIR,
            )
        except subprocess.TimeoutExpired:
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message="codex login status timed out",
                repair=CODEX_STATUS_REPAIR,
            )
        if result.returncode != 0:
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message=first_line(result.stderr, result.stdout)
                or f"codex login status exited {result.returncode}",
                repair=CODEX_STATUS_REPAIR,
            )
        return HarnessReadiness(
            kind=self.kind,
            available=True,
            message=first_line(result.stdout, result.stderr) or "codex authenticated",
        )

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        before = git_status_snapshot(self.runner, request.cwd)
        result = self.app_server.run(request)
        after = git_status_snapshot(self.runner, request.cwd)
        return result.model_copy(
            update={"changed_files": changed_paths(request.cwd, before, after)}
        )
