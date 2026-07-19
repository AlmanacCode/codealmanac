from __future__ import annotations

import os
import shutil
import subprocess
import threading
import time
from collections.abc import Callable, Mapping
from pathlib import Path

from codealmanac.agents.catalog import load_agent
from codealmanac.integrations.harnesses.opencode.events import (
    collect_output_text,
    project_json_line,
    status_from_events,
)
from codealmanac.services.harnesses.models import (
    HarnessAgentKind,
    HarnessEvent,
    HarnessEventKind,
    HarnessFailure,
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
    HarnessTranscriptRef,
    terminal_harness_event,
)
from codealmanac.services.harnesses.ports import HarnessEventSink
from codealmanac.services.harnesses.requests import RunHarnessRequest

OPENCODE_BINARY = "opencode"
# 0 = no cap. Builds can legitimately run for hours; the old 90-minute hard
# cap killed long opencode runs mid-write. Override with the env var below.
OPENCODE_RUN_TIMEOUT_SECONDS = 0
OPENCODE_RUN_TIMEOUT_ENV = "CODEALMANAC_OPENCODE_RUN_TIMEOUT"
OPENCODE_AGENT_PREFIX = "codealmanac"
LineSink = Callable[[str], None]
CommandRunner = Callable[
    [tuple[str, ...], Path, int, str | None, Mapping[str, str] | None, LineSink | None],
    "OpenCodeProcessResult",
]


class OpenCodeProcessResult:
    def __init__(
        self,
        returncode: int,
        lines: tuple[str, ...],
        stderr: str = "",
    ):
        self.returncode = returncode
        self.lines = lines
        self.stderr = stderr


class OpenCodeHarnessAdapter:
    """Run CodeAlmanac lifecycle jobs through the OpenCode CLI."""

    kind = HarnessKind.OPENCODE

    def __init__(
        self,
        runtime_root: Path,
        *,
        binary: str = OPENCODE_BINARY,
        runner: CommandRunner | None = None,
        which: Callable[[str], str | None] | None = None,
        timeout_seconds: int | None = None,
    ):
        self.runtime_root = runtime_root
        self.binary = binary
        self.runner = runner or run_opencode_json
        self.which = which or shutil.which
        self.timeout_seconds = resolve_timeout(timeout_seconds)

    def check(self) -> HarnessReadiness:
        path = self.which(self.binary)
        if path is None:
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message="opencode not found on PATH",
                repair=(
                    "install OpenCode (https://opencode.ai) and ensure "
                    "`opencode` is on PATH"
                ),
            )
        try:
            completed = subprocess.run(
                (path, "--version"),
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message=str(error),
                repair=(
                    "repair the OpenCode installation, then rerun "
                    "codealmanac doctor"
                ),
            )
        if completed.returncode != 0:
            details = (
                first_line(completed.stderr, completed.stdout)
                or "opencode --version failed"
            )
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message=details,
                repair=(
                    "repair the OpenCode installation, then rerun "
                    "codealmanac doctor"
                ),
            )
        version = (
            first_line(completed.stdout, completed.stderr) or "opencode available"
        )
        return HarnessReadiness(
            kind=self.kind,
            available=True,
            message=version,
        )

    def run(
        self,
        request: RunHarnessRequest,
        on_event: HarnessEventSink | None = None,
    ) -> HarnessRunResult:
        # Stage lifecycle agents under product-owned local state, never the
        # target repo. OpenCode loads OPENCODE_CONFIG_DIR as an *additive*
        # agents/commands directory (after global + project config), so
        # providers/auth stay on the user's real OpenCode config while our
        # agents remain outside git status.
        stage_root = self.runtime_root / "opencode"
        agent_name = stage_lifecycle_agent(stage_root, request.agent)
        args = (
            "run",
            "--format",
            "json",
            "--auto",
            "--dir",
            str(request.cwd),
            "--model",
            request.model,
            "--agent",
            agent_name,
            "--title",
            f"codealmanac-{request.agent.value}",
        )
        events: list[HarnessEvent] = []
        session_id: str | None = None

        def on_line(line: str) -> None:
            nonlocal session_id
            for event in project_json_line(line, session_id=session_id):
                if event.provider_session_id:
                    session_id = event.provider_session_id
                events.append(event)
                if on_event is not None and event.kind is not HarnessEventKind.DONE:
                    on_event(event)

        try:
            process = self.runner(
                (self.binary, *args),
                request.cwd,
                self.timeout_seconds,
                request.prompt.strip(),
                {"OPENCODE_CONFIG_DIR": str(stage_root)},
                on_line,
            )
        except FileNotFoundError:
            return failed_result(
                "opencode not found on PATH",
                on_event=on_event,
                repair="install OpenCode and ensure `opencode` is on PATH",
            )
        except subprocess.TimeoutExpired:
            return failed_result(
                f"opencode timed out after {self.timeout_seconds}s",
                on_event=on_event,
            )
        except OSError as error:
            return failed_result(str(error), on_event=on_event)

        if process.returncode != 0 and not any(
            event.kind is HarnessEventKind.ERROR for event in events
        ):
            message = (
                first_line(process.stderr)
                or f"opencode exited {process.returncode}"
            )
            error_event = HarnessEvent(
                kind=HarnessEventKind.ERROR,
                message=message,
                provider_session_id=session_id,
            )
            events.append(error_event)
            if on_event is not None:
                on_event(error_event)

        status = status_from_events(tuple(events), process.returncode)
        output = collect_output_text(tuple(events))
        if status is HarnessRunStatus.FAILED and process.stderr.strip():
            stderr_line = first_line(process.stderr)
            if stderr_line and stderr_line not in output:
                if output == "opencode completed":
                    output = stderr_line
                else:
                    output = f"{output}\n{stderr_line}"
        failure = (
            HarnessFailure(provider=self.kind, message=output.splitlines()[0])
            if status is HarnessRunStatus.FAILED
            else None
        )
        done = terminal_harness_event(self.kind, status, output)
        if failure is not None:
            done = done.model_copy(update={"failure": failure})
        events.append(done)
        if on_event is not None:
            on_event(done)
        return HarnessRunResult(
            kind=self.kind,
            status=status,
            output_text=output,
            transcript=(
                HarnessTranscriptRef(kind=self.kind, session_id=session_id)
                if session_id is not None
                else None
            ),
            events=tuple(events),
        )


def stage_lifecycle_agent(stage_root: Path, agent: HarnessAgentKind) -> str:
    """Write packaged agent markdown under stage_root/agents/ (not the repo)."""
    name = f"{OPENCODE_AGENT_PREFIX}-{agent.value}"
    agents_dir = stage_root / "agents"
    agents_dir.mkdir(parents=True, exist_ok=True)
    instructions = load_agent(agent).instructions or ""
    path = agents_dir / f"{name}.md"
    path.write_text(
        (
            "---\n"
            f"description: CodeAlmanac {agent.value} lifecycle agent\n"
            "mode: primary\n"
            "permission:\n"
            "  edit: allow\n"
            "  bash: allow\n"
            "  external_directory: allow\n"
            "---\n\n"
            f"{instructions.strip()}\n"
        ),
        encoding="utf-8",
    )
    return name


def run_opencode_json(
    command: tuple[str, ...],
    cwd: Path,
    timeout_seconds: int,
    stdin: str | None,
    env: Mapping[str, str] | None = None,
    on_line: LineSink | None = None,
) -> OpenCodeProcessResult:
    process_env = os.environ.copy()
    # Drop a parent OPENCODE_CONFIG_DIR first, then apply caller env. Lifecycle
    # runs pass our product-owned stage dir; an interactive session's value
    # must not leak into the worker and displace staged agents.
    process_env.pop("OPENCODE_CONFIG_DIR", None)
    if env:
        process_env.update(env)
    process = subprocess.Popen(
        command,
        cwd=cwd,
        stdin=subprocess.PIPE if stdin is not None else subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=process_env,
        bufsize=1,
    )
    lines: list[str] = []
    stderr_chunks: list[str] = []

    def read_stdout() -> None:
        assert process.stdout is not None
        for line in process.stdout:
            stripped = line.rstrip("\n")
            if stripped.strip() == "":
                continue
            lines.append(stripped)
            if on_line is not None:
                on_line(stripped)

    def read_stderr() -> None:
        assert process.stderr is not None
        for chunk in process.stderr:
            stderr_chunks.append(chunk)

    stdout_thread = threading.Thread(target=read_stdout, daemon=True)
    stderr_thread = threading.Thread(target=read_stderr, daemon=True)
    stdout_thread.start()
    stderr_thread.start()
    if stdin is not None and process.stdin is not None:
        process.stdin.write(stdin)
        process.stdin.close()
    deadline = (
        time.monotonic() + timeout_seconds if timeout_seconds and timeout_seconds > 0
        else None
    )
    while process.poll() is None:
        if deadline is not None and time.monotonic() >= deadline:
            process.kill()
            stdout_thread.join(timeout=5)
            stderr_thread.join(timeout=5)
            raise subprocess.TimeoutExpired(command, timeout_seconds)
        time.sleep(0.1)
    stdout_thread.join(timeout=5)
    stderr_thread.join(timeout=5)
    return OpenCodeProcessResult(
        returncode=process.returncode or 0,
        lines=tuple(lines),
        stderr="".join(stderr_chunks),
    )


def failed_result(
    message: str,
    *,
    on_event: HarnessEventSink | None = None,
    repair: str | None = None,
) -> HarnessRunResult:
    failure = HarnessFailure(
        provider=HarnessKind.OPENCODE,
        message=message,
        fix=repair,
    )
    error = HarnessEvent(
        kind=HarnessEventKind.ERROR,
        message=message,
        failure=failure,
    )
    done = terminal_harness_event(
        HarnessKind.OPENCODE,
        HarnessRunStatus.FAILED,
        message,
    ).model_copy(update={"failure": failure})
    if on_event is not None:
        on_event(error)
        on_event(done)
    return HarnessRunResult(
        kind=HarnessKind.OPENCODE,
        status=HarnessRunStatus.FAILED,
        output_text=message,
        events=(error, done),
    )


def resolve_timeout(explicit: int | None) -> int:
    """Resolve the OpenCode run timeout: explicit > env > default (no cap)."""
    if explicit is not None:
        return max(0, explicit)
    env_value = os.environ.get(OPENCODE_RUN_TIMEOUT_ENV)
    if env_value and env_value.strip():
        try:
            return max(0, int(env_value.strip()))
        except ValueError:
            return OPENCODE_RUN_TIMEOUT_SECONDS
    return OPENCODE_RUN_TIMEOUT_SECONDS


def first_line(*values: str) -> str:
    for value in values:
        for line in value.splitlines():
            stripped = line.strip()
            if stripped:
                return stripped
    return ""
