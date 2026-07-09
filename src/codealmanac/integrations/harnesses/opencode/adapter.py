import subprocess
from pathlib import Path

from codealmanac.integrations.command import (
    CommandRunner,
    SubprocessCommandRunner,
    first_line,
)
from codealmanac.integrations.harnesses.opencode.client import (
    OPENCODE_COMMAND,
    OpencodeClient,
)
from codealmanac.services.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
)
from codealmanac.services.harnesses.ports import HarnessEventSink
from codealmanac.services.harnesses.requests import RunHarnessRequest

OPENCODE_VERSION_TIMEOUT_SECONDS = 10
OPENCODE_INSTALL_REPAIR = "install the OpenCode CLI: npm install -g opencode-ai"
OPENCODE_VERSION_REPAIR = (
    "check `opencode --version` — reinstall with `npm install -g opencode-ai` "
    "if it fails"
)


class OpencodeHarnessAdapter:
    kind = HarnessKind.OPENCODE

    def __init__(
        self,
        runner: CommandRunner | None = None,
        command: str = OPENCODE_COMMAND,
        version_timeout_seconds: int = OPENCODE_VERSION_TIMEOUT_SECONDS,
        client: OpencodeClient | None = None,
    ):
        self.runner = runner or SubprocessCommandRunner()
        self.command = command
        self.version_timeout_seconds = version_timeout_seconds
        self.client = client or OpencodeClient(command=command)

    def check(self) -> HarnessReadiness:
        try:
            result = self.runner.run(
                self.command,
                ("--version",),
                Path.cwd(),
                self.version_timeout_seconds,
            )
        except FileNotFoundError:
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message="opencode not found on PATH",
                repair=OPENCODE_INSTALL_REPAIR,
            )
        except subprocess.TimeoutExpired:
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message="opencode --version timed out",
                repair=OPENCODE_VERSION_REPAIR,
            )
        if result.returncode != 0:
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message=first_line(result.stderr, result.stdout)
                or f"opencode --version exited {result.returncode}",
                repair=OPENCODE_VERSION_REPAIR,
            )
        # opencode auth list always exits 0 and prints TUI-formatted text even
        # with zero credentials, so it can't answer "is this ready" the way
        # codex login status / claude auth status can. GET /config/providers
        # on a briefly-started server is the structured alternative — see
        # docs/plans/2026-07-07-opencode-harness.md "Spike findings".
        return self.client.check_providers(Path.cwd())

    def run(
        self,
        request: RunHarnessRequest,
        on_event: HarnessEventSink | None = None,
    ) -> HarnessRunResult:
        return self.client.run(request, on_event)
