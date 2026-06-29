import subprocess
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from codealmanac.core.paths import normalize_path
from codealmanac.integrations.command import (
    CommandRunner,
    SubprocessCommandRunner,
    first_line,
)
from codealmanac.integrations.harnesses.git_status import (
    changed_paths,
    git_status_snapshot,
)
from codealmanac.integrations.sources.transcripts.codex import (
    CODEX_SESSIONS_DIR,
    read_codex_meta,
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

CODEX_COMMAND = "codex"
CODEX_RUN_TIMEOUT_SECONDS = 900
CODEX_STATUS_TIMEOUT_SECONDS = 10


class CodexCliHarnessAdapter:
    kind = HarnessKind.CODEX

    def __init__(
        self,
        runner: CommandRunner | None = None,
        command: str = CODEX_COMMAND,
        run_timeout_seconds: int = CODEX_RUN_TIMEOUT_SECONDS,
        status_timeout_seconds: int = CODEX_STATUS_TIMEOUT_SECONDS,
        sessions_dir: Path | None = None,
    ):
        self.runner = runner or SubprocessCommandRunner()
        self.command = command
        self.run_timeout_seconds = run_timeout_seconds
        self.status_timeout_seconds = status_timeout_seconds
        self.sessions_dir = sessions_dir

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
            )
        except subprocess.TimeoutExpired:
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message="codex login status timed out",
            )
        if result.returncode != 0:
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message=first_line(result.stderr, result.stdout)
                or f"codex login status exited {result.returncode}",
            )
        return HarnessReadiness(
            kind=self.kind,
            available=True,
            message=first_line(result.stdout, result.stderr) or "codex authenticated",
        )

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        before = git_status_snapshot(self.runner, request.cwd)
        started_at = datetime.now(UTC)
        try:
            with tempfile.TemporaryDirectory(prefix="codealmanac-codex-") as tempdir:
                output_path = Path(tempdir) / "last-message.txt"
                result = self.runner.run(
                    self.command,
                    codex_exec_args(request.cwd, output_path),
                    request.cwd,
                    self.run_timeout_seconds,
                    request.prompt,
                )
                output_text = output_file_text(output_path)
        except FileNotFoundError:
            return failed_result("codex not found on PATH")
        except subprocess.TimeoutExpired:
            return failed_result("codex run timed out")
        after = git_status_snapshot(self.runner, request.cwd)
        changed_files = changed_paths(request.cwd, before, after)
        transcript = locate_codex_transcript(
            request.cwd,
            self.sessions_dir,
            started_at,
        )
        if result.returncode != 0:
            return failed_result(
                first_line(result.stderr, result.stdout)
                or f"codex exited {result.returncode}",
                changed_files,
                transcript,
            )
        if output_text == "":
            return failed_result(
                first_line(result.stdout, result.stderr)
                or "codex produced no final message",
                changed_files,
                transcript,
            )
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text=output_text,
            summary=first_line(output_text),
            changed_files=changed_files,
            transcript=transcript,
            events=(
                terminal_harness_event(
                    self.kind,
                    HarnessRunStatus.SUCCEEDED,
                    output_text,
                ),
            ),
        )


def codex_exec_args(cwd: Path, output_path: Path) -> tuple[str, ...]:
    return (
        "exec",
        "--config",
        "mcp_servers={}",
        "--config",
        'approval_policy="never"',
        "--cd",
        str(cwd),
        "--ephemeral",
        "--sandbox",
        "workspace-write",
        "--ignore-rules",
        "--color",
        "never",
        "--output-last-message",
        str(output_path),
        "-",
    )


def output_file_text(path: Path) -> str:
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8").strip()


def failed_result(
    output_text: str,
    changed_files: tuple[Path, ...] = (),
    transcript: HarnessTranscriptRef | None = None,
) -> HarnessRunResult:
    return HarnessRunResult(
        kind=HarnessKind.CODEX,
        status=HarnessRunStatus.FAILED,
        output_text=output_text,
        changed_files=changed_files,
        transcript=transcript,
        events=(
            terminal_harness_event(
                HarnessKind.CODEX,
                HarnessRunStatus.FAILED,
                output_text,
            ),
        ),
    )


def locate_codex_transcript(
    cwd: Path,
    sessions_dir: Path | None,
    started_at: datetime,
) -> HarnessTranscriptRef | None:
    root = sessions_dir or Path.home() / CODEX_SESSIONS_DIR
    if not root.is_dir():
        return None
    matches: list[tuple[datetime, Path, str]] = []
    for path in root.rglob("*.jsonl"):
        try:
            modified_at = datetime.fromtimestamp(path.stat().st_mtime, UTC)
        except OSError:
            continue
        if modified_at < started_at:
            continue
        meta = read_codex_meta(path)
        if meta is None or meta.thread_source == "subagent":
            continue
        if normalize_path(Path(meta.cwd)) != normalize_path(cwd):
            continue
        matches.append((modified_at, path, meta.session_id))
    if len(matches) == 0:
        return None
    _, transcript_path, session_id = max(
        matches,
        key=lambda match: (match[0], str(match[1])),
    )
    return HarnessTranscriptRef(
        kind=HarnessKind.CODEX,
        session_id=session_id,
        transcript_path=normalize_path(transcript_path),
    )
