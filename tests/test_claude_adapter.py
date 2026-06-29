import subprocess
from pathlib import Path

from codealmanac.app import create_app
from codealmanac.integrations.harnesses.claude.adapter import (
    CLAUDE_ALLOWED_TOOLS,
    ClaudeCliHarnessAdapter,
    CommandResult,
    claude_print_args,
    parse_git_status_paths,
)
from codealmanac.services.harnesses.models import HarnessKind, HarnessRunStatus
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


def test_claude_adapter_reports_ready_when_auth_status_is_logged_in(tmp_path: Path):
    runner = FakeCommandRunner(
        (
            CommandResult(
                returncode=0,
                stdout='{"loggedIn": true, "authMethod": "claude.ai"}',
            ),
        )
    )
    adapter = ClaudeCliHarnessAdapter(runner=runner)

    readiness = adapter.check()

    assert readiness.kind == HarnessKind.CLAUDE
    assert readiness.available is True
    assert readiness.message == "claude.ai"
    assert runner.calls[0][1] == ("auth", "status")


def test_claude_adapter_reports_not_ready_when_command_is_missing(tmp_path: Path):
    runner = FakeCommandRunner((FileNotFoundError("missing"),))
    adapter = ClaudeCliHarnessAdapter(runner=runner)

    readiness = adapter.check()

    assert readiness.available is False
    assert readiness.message == "claude not found on PATH"


def test_claude_adapter_runs_print_json_and_reports_git_changes(tmp_path: Path):
    runner = FakeCommandRunner(
        (
            CommandResult(returncode=0, stdout=""),
            CommandResult(
                returncode=0,
                stdout=(
                    '{"type": "result", "subtype": "success", '
                    '"is_error": false, "result": "updated wiki"}'
                ),
            ),
            CommandResult(
                returncode=0,
                stdout="?? .almanac/pages/new-page.md\0 M src/app.py\0",
            ),
        )
    )
    adapter = ClaudeCliHarnessAdapter(runner=runner)

    result = adapter.run(
        RunHarnessRequest(
            kind=HarnessKind.CLAUDE,
            cwd=tmp_path,
            prompt="Update the wiki.",
            title="Ingest note",
        )
    )

    claude_call = runner.calls[1]
    assert claude_call[0] == "claude"
    assert claude_call[1] == claude_print_args()
    assert claude_call[4] == "Update the wiki."
    assert CLAUDE_ALLOWED_TOOLS in claude_call[1]
    assert result.status == HarnessRunStatus.SUCCEEDED
    assert result.output_text == "updated wiki"
    assert result.changed_files == (
        tmp_path / ".almanac/pages/new-page.md",
        tmp_path / "src/app.py",
    )


def test_claude_adapter_returns_failed_result_for_invalid_json(tmp_path: Path):
    runner = FakeCommandRunner(
        (
            CommandResult(returncode=1, stderr="not a git repo"),
            CommandResult(returncode=0, stdout="not-json"),
            CommandResult(returncode=1, stderr="not a git repo"),
        )
    )
    adapter = ClaudeCliHarnessAdapter(runner=runner)

    result = adapter.run(
        RunHarnessRequest(
            kind=HarnessKind.CLAUDE,
            cwd=tmp_path,
            prompt="Update the wiki.",
        )
    )

    assert result.status == HarnessRunStatus.FAILED
    assert result.output_text.startswith("claude returned invalid JSON:")


def test_claude_adapter_returns_failed_result_for_timeout(tmp_path: Path):
    runner = FakeCommandRunner(
        (
            CommandResult(returncode=1, stderr="not a git repo"),
            subprocess.TimeoutExpired("claude", 1),
        )
    )
    adapter = ClaudeCliHarnessAdapter(runner=runner)

    result = adapter.run(
        RunHarnessRequest(
            kind=HarnessKind.CLAUDE,
            cwd=tmp_path,
            prompt="Update the wiki.",
        )
    )

    assert result.status == HarnessRunStatus.FAILED
    assert result.output_text == "claude run timed out"


def test_parse_git_status_paths_handles_renames():
    paths = parse_git_status_paths("R  new.md\0old.md\0?? added.md\0")

    assert paths == (Path("new.md"), Path("added.md"))


def test_create_app_wires_default_claude_adapter():
    app = create_app()

    adapter = app.harnesses.adapter_for(HarnessKind.CLAUDE)

    assert adapter.kind == HarnessKind.CLAUDE
