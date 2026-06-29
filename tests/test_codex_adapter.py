import json
import subprocess
from pathlib import Path

from codealmanac.app import create_app
from codealmanac.integrations.command import CommandResult
from codealmanac.integrations.harnesses.codex.adapter import (
    CodexCliHarnessAdapter,
    codex_exec_args,
)
from codealmanac.services.harnesses.models import HarnessKind, HarnessRunStatus
from codealmanac.services.harnesses.requests import RunHarnessRequest


class FakeCommandRunner:
    def __init__(
        self,
        results: tuple[CommandResult | BaseException, ...],
        last_message: str | None = None,
        transcript_root: Path | None = None,
        transcript_id: str | None = None,
    ):
        self.results = list(results)
        self.last_message = last_message
        self.transcript_root = transcript_root
        self.transcript_id = transcript_id
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
        if command == "codex" and self.last_message is not None:
            output_path = Path(args[args.index("--output-last-message") + 1])
            output_path.write_text(self.last_message, encoding="utf-8")
        if command == "codex" and self.transcript_root is not None:
            transcript = self.transcript_root / "rollout.jsonl"
            transcript.parent.mkdir(parents=True, exist_ok=True)
            transcript.write_text(
                json.dumps(
                    {
                        "payload": {
                            "id": self.transcript_id or "codex-session",
                            "cwd": str(cwd),
                            "thread_source": "user",
                        }
                    }
                )
                + "\n",
                encoding="utf-8",
            )
        return result


def test_codex_adapter_reports_ready_when_login_status_succeeds():
    runner = FakeCommandRunner(
        (CommandResult(returncode=0, stdout="Logged in using ChatGPT\n"),)
    )
    adapter = CodexCliHarnessAdapter(runner=runner)

    readiness = adapter.check()

    assert readiness.kind == HarnessKind.CODEX
    assert readiness.available is True
    assert readiness.message == "Logged in using ChatGPT"
    assert runner.calls[0][1] == ("login", "status")


def test_codex_adapter_reports_not_ready_when_command_is_missing():
    runner = FakeCommandRunner((FileNotFoundError("missing"),))
    adapter = CodexCliHarnessAdapter(runner=runner)

    readiness = adapter.check()

    assert readiness.available is False
    assert readiness.message == "codex not found on PATH"


def test_codex_adapter_runs_exec_and_reports_git_changes(tmp_path: Path):
    sessions = tmp_path / "codex-sessions"
    runner = FakeCommandRunner(
        (
            CommandResult(returncode=0, stdout=""),
            CommandResult(returncode=0, stdout="codex diagnostics"),
            CommandResult(returncode=0, stdout="?? .almanac/pages/codex-note.md\0"),
        ),
        last_message="updated wiki",
        transcript_root=sessions,
        transcript_id="codex-session-1",
    )
    adapter = CodexCliHarnessAdapter(runner=runner, sessions_dir=sessions)

    result = adapter.run(
        RunHarnessRequest(
            kind=HarnessKind.CODEX,
            cwd=tmp_path,
            prompt="Update the wiki.",
            title="Ingest note",
        )
    )

    codex_call = runner.calls[1]
    assert codex_call[0] == "codex"
    assert codex_call[1] == codex_exec_args(
        tmp_path,
        Path(codex_call[1][codex_call[1].index("--output-last-message") + 1]),
    )
    assert "--config" in codex_call[1]
    assert "mcp_servers={}" in codex_call[1]
    assert 'approval_policy="never"' in codex_call[1]
    assert "--ephemeral" in codex_call[1]
    assert codex_call[4] == "Update the wiki."
    assert result.status == HarnessRunStatus.SUCCEEDED
    assert result.output_text == "updated wiki"
    assert result.transcript is not None
    assert result.transcript.kind == HarnessKind.CODEX
    assert result.transcript.session_id == "codex-session-1"
    assert result.transcript.transcript_path == sessions / "rollout.jsonl"
    assert result.changed_files == (tmp_path / ".almanac/pages/codex-note.md",)


def test_codex_adapter_returns_failed_result_when_final_message_is_missing(
    tmp_path: Path,
):
    runner = FakeCommandRunner(
        (
            CommandResult(returncode=1, stderr="not a git repo"),
            CommandResult(returncode=0, stdout="empty final"),
            CommandResult(returncode=1, stderr="not a git repo"),
        )
    )
    adapter = CodexCliHarnessAdapter(runner=runner)

    result = adapter.run(
        RunHarnessRequest(
            kind=HarnessKind.CODEX,
            cwd=tmp_path,
            prompt="Update the wiki.",
        )
    )

    assert result.status == HarnessRunStatus.FAILED
    assert result.output_text == "empty final"


def test_codex_adapter_returns_failed_result_for_timeout(tmp_path: Path):
    runner = FakeCommandRunner(
        (
            CommandResult(returncode=1, stderr="not a git repo"),
            subprocess.TimeoutExpired("codex", 1),
        )
    )
    adapter = CodexCliHarnessAdapter(runner=runner)

    result = adapter.run(
        RunHarnessRequest(
            kind=HarnessKind.CODEX,
            cwd=tmp_path,
            prompt="Update the wiki.",
        )
    )

    assert result.status == HarnessRunStatus.FAILED
    assert result.output_text == "codex run timed out"


def test_create_app_wires_default_codex_adapter():
    app = create_app()

    adapter = app.harnesses.adapter_for(HarnessKind.CODEX)

    assert adapter.kind == HarnessKind.CODEX
