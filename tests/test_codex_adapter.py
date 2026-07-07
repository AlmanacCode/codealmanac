import subprocess
from pathlib import Path

from codealmanac.app import create_app
from codealmanac.integrations.command import CommandResult
from codealmanac.integrations.harnesses.codex.adapter import (
    CodexAppServerHarnessAdapter,
)
from codealmanac.services.harnesses.models import (
    HarnessKind,
    HarnessRunResult,
    HarnessRunStatus,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest


class FakeCommandRunner:
    def __init__(self, results: tuple[CommandResult | BaseException, ...]):
        self.results = list(results)
        self.calls: list[tuple[str, tuple[str, ...], Path, int, str | None]] = []

    def run(
        self,
        command: str,
        args: tuple[str, ...],
        cwd: Path,
        timeout_seconds: int,
        stdin: str | None = None,
    ) -> CommandResult:
        self.calls.append((command, args, cwd, timeout_seconds, stdin))
        result = self.results.pop(0)
        if isinstance(result, BaseException):
            raise result
        return result


class FakeAppServer:
    def __init__(self, result: HarnessRunResult):
        self.result = result
        self.requests: list[RunHarnessRequest] = []

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        self.requests.append(request)
        return self.result


def test_codex_adapter_reports_ready_when_login_status_succeeds():
    runner = FakeCommandRunner(
        (CommandResult(returncode=0, stdout="Logged in using ChatGPT\n"),)
    )
    adapter = CodexAppServerHarnessAdapter(runner=runner)

    readiness = adapter.check()

    assert readiness.kind == HarnessKind.CODEX
    assert readiness.available is True
    assert readiness.message == "Logged in using ChatGPT"
    assert runner.calls[0][1] == ("login", "status")


def test_codex_adapter_reports_not_ready_when_command_is_missing():
    runner = FakeCommandRunner((FileNotFoundError("missing"),))
    adapter = CodexAppServerHarnessAdapter(runner=runner)

    readiness = adapter.check()

    assert readiness.available is False
    assert readiness.message == "codex not found on PATH"


def test_codex_adapter_reports_not_ready_when_login_status_times_out():
    runner = FakeCommandRunner((subprocess.TimeoutExpired("codex", 1),))
    adapter = CodexAppServerHarnessAdapter(runner=runner)

    readiness = adapter.check()

    assert readiness.available is False
    assert readiness.message == "codex login status timed out"


def test_codex_adapter_wraps_app_server_run_with_git_change_detection(
    tmp_path: Path,
):
    runner = FakeCommandRunner(
        (
            CommandResult(returncode=0, stdout=""),
            CommandResult(returncode=0, stdout="?? almanac/codex-note.md\0"),
        )
    )
    app_server = FakeAppServer(
        HarnessRunResult(
            kind=HarnessKind.CODEX,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="updated wiki",
            summary="updated wiki",
        )
    )
    adapter = CodexAppServerHarnessAdapter(runner=runner, app_server=app_server)
    request = RunHarnessRequest(
        kind=HarnessKind.CODEX,
        model="gpt-5.5",
        cwd=tmp_path,
        prompt="Update the wiki.",
        title="Ingest note",
    )

    result = adapter.run(request)

    assert app_server.requests == [request]
    assert result.status == HarnessRunStatus.SUCCEEDED
    assert result.output_text == "updated wiki"
    assert result.changed_files == (tmp_path / "almanac/codex-note.md",)
    assert runner.calls[0][0] == "git"
    assert runner.calls[1][0] == "git"


def test_create_app_wires_default_codex_app_server_adapter():
    app = create_app()

    adapter = app.harnesses.adapter_for(HarnessKind.CODEX)

    assert isinstance(adapter, CodexAppServerHarnessAdapter)
