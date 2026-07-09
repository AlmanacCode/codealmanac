import json
import sqlite3
import subprocess
import threading
import time
from pathlib import Path

import httpx
import pytest

from codealmanac.app import create_app
from codealmanac.integrations.command import CommandResult
from codealmanac.integrations.harnesses.opencode.adapter import OpencodeHarnessAdapter
from codealmanac.integrations.harnesses.opencode.client import OpencodeClient
from codealmanac.integrations.harnesses.opencode.failures import (
    classify_opencode_failure,
)
from codealmanac.integrations.harnesses.opencode.model_ref import split_opencode_model
from codealmanac.integrations.harnesses.opencode.parts import (
    is_task_settled,
    is_task_spawn,
    map_opencode_part,
)
from codealmanac.integrations.harnesses.opencode.progress import (
    OpencodeProgressWatchdog,
)
from codealmanac.integrations.harnesses.opencode.server import (
    OpencodeServerStartupError,
    _wait_for_listening,
    start_opencode_server,
)
from codealmanac.integrations.harnesses.opencode.state import OpencodeRunState
from codealmanac.integrations.harnesses.opencode.usage import parse_opencode_usage
from codealmanac.services.harnesses.actors import (
    HarnessActorConfidence,
    HarnessActorRole,
)
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessEventKind,
    HarnessKind,
    HarnessReadiness,
    HarnessRunActor,
    HarnessRunResult,
    HarnessRunStatus,
    HarnessToolDisplayKind,
    HarnessToolStatus,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest

ROOT_ACTOR = HarnessRunActor(
    thread_id="ses_root",
    role=HarnessActorRole.ROOT,
    confidence=HarnessActorConfidence.PROVIDER,
    label="Main",
)


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


class FakeOpencodeClient:
    def __init__(
        self,
        readiness: HarnessReadiness | None = None,
        result: HarnessRunResult | None = None,
    ):
        self.readiness = readiness
        self.result = result
        self.check_calls: list[Path] = []
        self.requests: list[RunHarnessRequest] = []

    def check_providers(self, cwd: Path) -> HarnessReadiness:
        self.check_calls.append(cwd)
        assert self.readiness is not None
        return self.readiness

    def run(self, request: RunHarnessRequest, on_event=None) -> HarnessRunResult:
        self.requests.append(request)
        assert self.result is not None
        return self.result


# --- adapter.check() -------------------------------------------------------


def test_opencode_adapter_reports_not_ready_when_command_is_missing():
    runner = FakeCommandRunner((FileNotFoundError("missing"),))
    adapter = OpencodeHarnessAdapter(runner=runner)

    readiness = adapter.check()

    assert readiness.kind == HarnessKind.OPENCODE
    assert readiness.available is False
    assert readiness.message == "opencode not found on PATH"
    assert readiness.repair == "install the OpenCode CLI: npm install -g opencode-ai"


def test_opencode_adapter_reports_not_ready_when_version_times_out():
    runner = FakeCommandRunner((subprocess.TimeoutExpired("opencode", 1),))
    adapter = OpencodeHarnessAdapter(runner=runner)

    readiness = adapter.check()

    assert readiness.available is False
    assert readiness.message == "opencode --version timed out"
    assert readiness.repair is not None


def test_opencode_adapter_reports_not_ready_when_version_exits_nonzero():
    runner = FakeCommandRunner(
        (CommandResult(returncode=1, stderr="command not found\n"),)
    )
    adapter = OpencodeHarnessAdapter(runner=runner)

    readiness = adapter.check()

    assert readiness.available is False
    assert readiness.message == "command not found"


def test_opencode_adapter_delegates_to_client_when_installed():
    runner = FakeCommandRunner((CommandResult(returncode=0, stdout="1.17.15\n"),))
    client = FakeOpencodeClient(
        readiness=HarnessReadiness(
            kind=HarnessKind.OPENCODE,
            available=True,
            message="opencode providers configured: OpenCode Zen",
        )
    )
    adapter = OpencodeHarnessAdapter(runner=runner, client=client)

    readiness = adapter.check()

    assert readiness.available is True
    assert readiness.message == "opencode providers configured: OpenCode Zen"
    assert len(client.check_calls) == 1
    assert runner.calls[0][1] == ("--version",)


def test_opencode_adapter_runs_client_without_a_second_version_check(
    tmp_path: Path,
):
    runner = FakeCommandRunner(())
    client = FakeOpencodeClient(
        result=HarnessRunResult(
            kind=HarnessKind.OPENCODE,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="updated wiki",
            summary="updated wiki",
        )
    )
    adapter = OpencodeHarnessAdapter(runner=runner, client=client)
    request = RunHarnessRequest(
        kind=HarnessKind.OPENCODE,
        model="opencode/deepseek-v4-flash-free",
        cwd=tmp_path,
        prompt="Update the wiki.",
        title="Ingest note",
    )

    result = adapter.run(request)

    assert client.requests == [request]
    assert result.status == HarnessRunStatus.SUCCEEDED
    assert result.output_text == "updated wiki"
    assert runner.calls == []


def test_create_app_wires_default_opencode_adapter():
    app = create_app()

    adapter = app.harnesses.adapter_for(HarnessKind.OPENCODE)

    assert isinstance(adapter, OpencodeHarnessAdapter)


# --- OpencodeClient.check_providers() --------------------------------------


def test_opencode_client_check_providers_reports_ready(monkeypatch):
    client = OpencodeClient()
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.start_opencode_server",
        lambda *a, **k: _FakeServer("http://127.0.0.1:1"),
    )
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.get_providers",
        lambda base_url, timeout_seconds: (
            {"id": "opencode", "name": "OpenCode Zen"},
        ),
    )

    readiness = client.check_providers(Path("/tmp"))

    assert readiness.available is True
    assert "OpenCode Zen" in readiness.message


def test_opencode_client_check_providers_reports_not_ready_with_no_providers(
    monkeypatch,
):
    client = OpencodeClient()
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.start_opencode_server",
        lambda *a, **k: _FakeServer("http://127.0.0.1:1"),
    )
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.get_providers",
        lambda base_url, timeout_seconds: (),
    )

    readiness = client.check_providers(Path("/tmp"))

    assert readiness.available is False
    assert readiness.message == "no opencode providers are configured"
    assert readiness.repair is not None


def test_opencode_client_check_providers_reports_not_ready_when_server_fails(
    monkeypatch,
):
    client = OpencodeClient()

    def _raise(*args, **kwargs):
        raise OpencodeServerStartupError("opencode serve exited before it started")

    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.start_opencode_server",
        _raise,
    )

    readiness = client.check_providers(Path("/tmp"))

    assert readiness.available is False
    assert "exited before it started" in readiness.message


def test_opencode_client_check_providers_reports_not_ready_on_http_error(
    monkeypatch,
):
    client = OpencodeClient()
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.start_opencode_server",
        lambda *a, **k: _FakeServer("http://127.0.0.1:1"),
    )

    def _raise(base_url, timeout_seconds):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.get_providers", _raise
    )

    readiness = client.check_providers(Path("/tmp"))

    assert readiness.available is False
    assert "opencode server request failed" in readiness.message


def test_opencode_client_check_providers_reports_not_ready_on_malformed_json(
    monkeypatch,
):
    client = OpencodeClient()
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.start_opencode_server",
        lambda *a, **k: _FakeServer("http://127.0.0.1:1"),
    )

    def _raise(base_url, timeout_seconds):
        # response.json() raises json.JSONDecodeError (a ValueError) on a
        # malformed 200 body — the bug this test guards against was that
        # check_providers only caught httpx.HTTPError, not this.
        raise ValueError("Expecting value: line 1 column 1 (char 0)")

    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.get_providers", _raise
    )

    readiness = client.check_providers(Path("/tmp"))

    assert readiness.available is False
    assert "invalid response" in readiness.message


# --- OpencodeClient.run() ---------------------------------------------------


def test_opencode_client_run_fails_fast_on_bad_model_string(monkeypatch, tmp_path):
    client = OpencodeClient()

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("server should not start for an invalid model string")

    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.start_opencode_server",
        _fail_if_called,
    )

    result = client.run(
        RunHarnessRequest(
            kind=HarnessKind.OPENCODE,
            model="not-a-provider-model-pair",
            cwd=tmp_path,
            prompt="Update the wiki.",
        )
    )

    assert result.status == HarnessRunStatus.FAILED
    assert "provider/model" in result.output_text


def test_opencode_client_run_maps_parts_to_events(monkeypatch, tmp_path):
    db_path = tmp_path / "opencode.db"
    _build_part_db(db_path)
    _seed_parts(db_path, "ses_root", _MESSAGE_RESPONSE["parts"])
    client = OpencodeClient(db_path=db_path, poll_interval_seconds=0.02)
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.start_opencode_server",
        lambda *a, **k: _FakeServer("http://127.0.0.1:1"),
    )
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.create_session",
        lambda *a, **k: {"id": "ses_root", "slug": "brave-planet"},
    )
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.post_message",
        lambda *a, **k: _MESSAGE_RESPONSE,
    )

    events: list = []
    result = client.run(
        RunHarnessRequest(
            kind=HarnessKind.OPENCODE,
            model="opencode/deepseek-v4-flash-free",
            cwd=tmp_path,
            prompt="Run: echo sse-tool-check via the bash tool, then say done.",
        ),
        on_event=events.append,
    )

    assert result.status == HarnessRunStatus.SUCCEEDED
    assert result.output_text == "done"
    assert result.transcript is None  # not populated for opencode in slice 1
    kinds = [event.kind for event in result.events]
    assert kinds == [
        HarnessEventKind.PROVIDER_SESSION,
        HarnessEventKind.TOOL_SUMMARY,  # reasoning
        HarnessEventKind.TOOL_USE,
        HarnessEventKind.TOOL_RESULT,
        HarnessEventKind.CONTEXT_USAGE,  # step-finish (tool-calls)
        HarnessEventKind.TEXT,
        HarnessEventKind.CONTEXT_USAGE,  # step-finish (stop)
        HarnessEventKind.DONE,
    ]
    assert events == list(result.events)
    tool_use = result.events[2]
    assert tool_use.tool_name == "bash"
    assert tool_use.tool_display is not None
    assert tool_use.tool_display.kind == HarnessToolDisplayKind.SHELL
    done = result.events[-1]
    assert done.provider_session_id == "ses_root"
    assert done.usage is not None
    assert done.usage.total_tokens == 8811


def test_opencode_client_run_emits_events_live_before_response_returns(
    monkeypatch, tmp_path
):
    """Events should arrive via on_event while post_message is still
    blocked, not only once it returns — the whole point of the watchdog."""
    db_path = tmp_path / "opencode.db"
    _build_part_db(db_path)
    seen_before_return: list[float] = []
    return_time: dict[str, float] = {}

    def _slow_post_message(*args, **kwargs):
        # Seed one part partway through the "call", from a helper thread,
        # simulating OpenCode writing to its db while the HTTP call is
        # still in flight.
        def _write_soon():
            time.sleep(0.1)
            _seed_parts(db_path, "ses_root", [{"type": "text", "text": "working"}])

        threading.Thread(target=_write_soon, daemon=True).start()
        time.sleep(0.3)
        return_time["at"] = time.monotonic()
        return {
            "info": {"tokens": {"total": 1}},
            "parts": [{"type": "text", "text": "done"}],
        }

    client = OpencodeClient(db_path=db_path, poll_interval_seconds=0.02)
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.start_opencode_server",
        lambda *a, **k: _FakeServer("http://127.0.0.1:1"),
    )
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.create_session",
        lambda *a, **k: {"id": "ses_root", "slug": "brave-planet"},
    )
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.post_message",
        _slow_post_message,
    )

    def _on_event(event):
        seen_before_return.append(time.monotonic())

    result = client.run(
        RunHarnessRequest(
            kind=HarnessKind.OPENCODE,
            model="opencode/deepseek-v4-flash-free",
            cwd=tmp_path,
            prompt="Update the wiki.",
        ),
        on_event=_on_event,
    )

    assert result.status == HarnessRunStatus.SUCCEEDED
    # At least one on_event call happened strictly before post_message
    # returned — proof of live delivery, not a single batch at the end.
    assert any(t < return_time["at"] for t in seen_before_return)


def test_opencode_client_run_emits_agent_spawned_and_completed(monkeypatch, tmp_path):
    db_path = tmp_path / "opencode.db"
    _build_part_db(db_path)
    task_part = {
        "type": "tool",
        "tool": "task",
        "callID": "call_1",
        "state": {
            "title": "Write pages",
            "metadata": {
                "parentSessionId": "ses_root",
                "sessionId": "ses_child",
            },
            "status": "completed",
            "input": {"prompt": "Write three pages"},
            "output": "wrote three pages",
        },
    }
    _seed_parts(db_path, "ses_root", [task_part])

    client = OpencodeClient(db_path=db_path, poll_interval_seconds=0.02)
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.start_opencode_server",
        lambda *a, **k: _FakeServer("http://127.0.0.1:1"),
    )
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.create_session",
        lambda *a, **k: {"id": "ses_root", "slug": "brave-planet"},
    )
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.post_message",
        lambda *a, **k: {"info": {}, "parts": []},
    )

    result = client.run(
        RunHarnessRequest(
            kind=HarnessKind.OPENCODE,
            model="opencode/deepseek-v4-flash-free",
            cwd=tmp_path,
            prompt="Update the wiki.",
        )
    )

    kinds = [event.kind for event in result.events]
    assert HarnessEventKind.AGENT_SPAWNED in kinds
    assert HarnessEventKind.AGENT_COMPLETED in kinds
    spawned = next(e for e in result.events if e.kind == HarnessEventKind.AGENT_SPAWNED)
    assert spawned.agent_trace is not None
    assert spawned.agent_trace.child_thread_id == "ses_child"
    assert spawned.agent_trace.prompt == "Write three pages"
    completed = next(
        e for e in result.events if e.kind == HarnessEventKind.AGENT_COMPLETED
    )
    assert completed.actor is not None
    assert completed.actor.role == HarnessActorRole.HELPER
    assert completed.agent_trace is not None
    assert completed.agent_trace.result == "wrote three pages"


def test_opencode_client_run_detects_stuck_tool_call(monkeypatch, tmp_path):
    db_path = tmp_path / "opencode.db"
    _build_part_db(db_path)
    stuck_start_ms = int(time.time() * 1000) - 10_000  # 10s ago
    _seed_parts(
        db_path,
        "ses_root",
        [
            {
                "type": "tool",
                "tool": "glob",
                "callID": "call_1",
                "state": {
                    "status": "running",
                    "input": {"pattern": "**/*", "path": "/whatever"},
                    "time": {"start": stuck_start_ms},
                },
            }
        ],
    )

    server = _FakeServer("http://127.0.0.1:1")
    client = OpencodeClient(
        db_path=db_path, poll_interval_seconds=0.02, stuck_after_seconds=1
    )
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.start_opencode_server",
        lambda *a, **k: server,
    )
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.create_session",
        lambda *a, **k: {"id": "ses_root", "slug": "brave-planet"},
    )

    def _never_returns(*args, **kwargs):
        threading.Event().wait()

    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.post_message",
        _never_returns,
    )

    result = client.run(
        RunHarnessRequest(
            kind=HarnessKind.OPENCODE,
            model="opencode/deepseek-v4-flash-free",
            cwd=tmp_path,
            prompt="Update the wiki.",
        )
    )

    assert result.status == HarnessRunStatus.FAILED
    assert "glob" in result.output_text
    assert "stuck" in result.output_text
    assert server.terminated is True


def test_opencode_client_run_reports_failure_when_server_cannot_start(
    monkeypatch, tmp_path
):
    client = OpencodeClient()

    def _raise(*args, **kwargs):
        raise OpencodeServerStartupError(
            "opencode serve did not report a listening port in time"
        )

    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.client.start_opencode_server",
        _raise,
    )

    result = client.run(
        RunHarnessRequest(
            kind=HarnessKind.OPENCODE,
            model="opencode/deepseek-v4-flash-free",
            cwd=tmp_path,
            prompt="Update the wiki.",
        )
    )

    assert result.status == HarnessRunStatus.FAILED
    assert "did not report a listening port" in result.output_text
    # Matches the Codex precedent (result.py::failed_result): a hard failure
    # before a session ever starts emits a single ERROR event, not a DONE.
    assert result.events[-1].kind == HarnessEventKind.ERROR


class _FakeServer:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.terminated = False

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        self.terminated = True
        return None


def _build_part_db(path: Path) -> None:
    conn = sqlite3.connect(path)
    conn.executescript(
        "CREATE TABLE message ("
        "id TEXT PRIMARY KEY, session_id TEXT NOT NULL, "
        "time_created INTEGER NOT NULL, data TEXT NOT NULL);"
        "CREATE TABLE part ("
        "id TEXT PRIMARY KEY, message_id TEXT NOT NULL, "
        "session_id TEXT NOT NULL, time_created INTEGER NOT NULL, "
        "data TEXT NOT NULL);"
    )
    conn.commit()
    conn.close()


def _seed_parts(
    path: Path,
    session_id: str,
    parts: list[dict],
    role: str = "assistant",
    message_id: str = "msg_1",
) -> None:
    conn = sqlite3.connect(path)
    base = int(time.time() * 1000)
    conn.execute(
        "INSERT OR REPLACE INTO message (id, session_id, time_created, data) "
        "VALUES (?, ?, ?, ?)",
        (message_id, session_id, base, json.dumps({"role": role})),
    )
    for offset, part in enumerate(parts):
        part_id = part.get("callID") or f"prt_{session_id}_{base}_{offset}"
        conn.execute(
            "INSERT OR REPLACE INTO part "
            "(id, message_id, session_id, time_created, data) "
            "VALUES (?, ?, ?, ?, ?)",
            (part_id, message_id, session_id, base + offset, json.dumps(part)),
        )
    conn.commit()
    conn.close()


_MESSAGE_RESPONSE = {
    "info": {
        "id": "msg_assistant",
        "sessionID": "ses_root",
        "role": "assistant",
        "tokens": {
            "total": 8811,
            "input": 91,
            "output": 16,
            "reasoning": 0,
            "cache": {"read": 8448, "write": 0},
        },
    },
    "parts": [
        {
            "type": "reasoning",
            "text": "The user wants me to run a command then reply.",
        },
        {
            "type": "tool",
            "tool": "bash",
            "callID": "call_1",
            "state": {
                "status": "completed",
                "input": {"command": "echo sse-tool-check"},
                "output": "sse-tool-check\n",
                "metadata": {"exit": 0, "truncated": False},
                "title": "echo sse-tool-check",
            },
        },
        {
            "type": "step-finish",
            "reason": "tool-calls",
            "tokens": {
                "total": 8720,
                "input": 6877,
                "output": 51,
                "reasoning": 0,
                "cache": {"read": 1792, "write": 0},
            },
        },
        {"type": "text", "text": "done"},
        {
            "type": "step-finish",
            "reason": "stop",
            "tokens": {
                "total": 8811,
                "input": 91,
                "output": 16,
                "reasoning": 0,
                "cache": {"read": 8448, "write": 0},
            },
        },
    ],
}


# --- is_task_spawn / is_task_settled ----------------------------------------


def test_is_task_spawn_extracts_child_session_and_prompt():
    part = {
        "type": "tool",
        "tool": "task",
        "state": {
            "metadata": {"sessionId": "ses_child"},
            "input": {"prompt": "Write pages"},
            "status": "running",
        },
    }

    assert is_task_spawn(part) == ("ses_child", "Write pages")


def test_is_task_spawn_returns_none_for_non_task_tool():
    part = {"type": "tool", "tool": "bash", "state": {"status": "running"}}

    assert is_task_spawn(part) is None


def test_is_task_settled_reports_completed_and_error():
    completed = {"type": "tool", "tool": "task", "state": {"status": "completed"}}
    failed = {"type": "tool", "tool": "task", "state": {"status": "error"}}
    running = {"type": "tool", "tool": "task", "state": {"status": "running"}}

    assert is_task_settled(completed) == HarnessToolStatus.COMPLETED
    assert is_task_settled(failed) == HarnessToolStatus.FAILED
    assert is_task_settled(running) is None


# --- OpencodeProgressWatchdog direct unit test ------------------------------


def test_watchdog_ignores_user_authored_parts(tmp_path):
    # Regression test: a live smoke test against a real opencode server
    # found the watchdog emitting a TEXT event for the *user's own prompt*
    # (echoed back as a part on the same session) — the POST response never
    # had this problem since it only returns the new assistant message's
    # parts. The watchdog polls the whole session's parts, so it must
    # filter by message role explicitly.
    db_path = tmp_path / "opencode.db"
    _build_part_db(db_path)
    _seed_parts(
        db_path,
        "ses_root",
        [{"type": "text", "text": "the user's own prompt, echoed back"}],
        role="user",
        message_id="msg_user",
    )
    events: list[HarnessEvent] = []
    watchdog = OpencodeProgressWatchdog(
        db_path=db_path,
        root_session_id="ses_root",
        root_actor=ROOT_ACTOR,
        state=OpencodeRunState(),
        events=events,
        on_event=None,
    )

    watchdog._poll_once()

    assert events == []


def test_watchdog_does_not_flag_a_tool_call_under_the_threshold(tmp_path):
    db_path = tmp_path / "opencode.db"
    _build_part_db(db_path)
    recent_start_ms = int(time.time() * 1000) - 5_000  # 5s ago
    _seed_parts(
        db_path,
        "ses_root",
        [
            {
                "type": "tool",
                "tool": "glob",
                "callID": "call_1",
                "state": {
                    "status": "running",
                    "input": {"pattern": "**/*"},
                    "time": {"start": recent_start_ms},
                },
            }
        ],
    )
    watchdog = OpencodeProgressWatchdog(
        db_path=db_path,
        root_session_id="ses_root",
        root_actor=ROOT_ACTOR,
        state=OpencodeRunState(),
        events=[],
        on_event=None,
        stuck_after_seconds=60.0,  # 5s elapsed is well under this
    )

    watchdog._poll_once()

    assert watchdog.stuck_reason is None


# --- part mapping / parsing helpers -----------------------------------------


def test_map_opencode_part_text():
    events = map_opencode_part({"type": "text", "text": "hello"}, ROOT_ACTOR)

    assert len(events) == 1
    assert events[0].kind == HarnessEventKind.TEXT
    assert events[0].message == "hello"


def test_map_opencode_part_tool_call_and_result():
    part = {
        "type": "tool",
        "tool": "bash",
        "callID": "call_1",
        "state": {
            "status": "completed",
            "input": {"command": "ls"},
            "output": "file.txt\n",
            "metadata": {"exit": 0},
            "title": "ls",
        },
    }

    events = map_opencode_part(part, ROOT_ACTOR)

    assert len(events) == 2
    use, result = events
    assert use.kind == HarnessEventKind.TOOL_USE
    assert use.tool_id == "call_1"
    assert result.kind == HarnessEventKind.TOOL_RESULT
    assert result.tool_result == "file.txt\n"
    assert result.tool_is_error is False
    assert result.tool_display is not None
    assert result.tool_display.status == HarnessToolStatus.COMPLETED
    assert result.tool_display.exit_code == 0


def test_map_opencode_part_failed_tool_call_marks_result_as_error():
    part = {
        "type": "tool",
        "tool": "bash",
        "callID": "call_2",
        "state": {"status": "error", "input": {}, "output": "boom"},
    }

    events = map_opencode_part(part, ROOT_ACTOR)

    assert events[1].tool_is_error is True
    assert events[1].tool_display is not None
    assert events[1].tool_display.status == HarnessToolStatus.FAILED


def test_map_opencode_part_step_start_is_ignored():
    events = map_opencode_part({"type": "step-start"}, ROOT_ACTOR)

    assert events == ()


def test_map_opencode_part_patch_reports_files():
    events = map_opencode_part(
        {"type": "patch", "files": ["almanac/example.md"]}, ROOT_ACTOR
    )

    assert len(events) == 1
    assert events[0].kind == HarnessEventKind.TOOL_SUMMARY
    assert "almanac/example.md" in events[0].message


def test_map_opencode_part_step_finish_reports_usage():
    events = map_opencode_part(
        {"type": "step-finish", "tokens": {"total": 100, "input": 80, "output": 20}},
        ROOT_ACTOR,
    )

    assert len(events) == 1
    assert events[0].kind == HarnessEventKind.CONTEXT_USAGE
    assert events[0].usage is not None
    assert events[0].usage.total_tokens == 100


@pytest.mark.parametrize(
    ("model", "expected"),
    [
        ("opencode/deepseek-v4-flash-free", ("opencode", "deepseek-v4-flash-free")),
        ("anthropic/claude-sonnet-4-6", ("anthropic", "claude-sonnet-4-6")),
    ],
)
def test_split_opencode_model_valid(model, expected):
    assert split_opencode_model(model) == expected


@pytest.mark.parametrize(
    "model", ["no-separator", "/missing-provider", "missing-model/"]
)
def test_split_opencode_model_invalid(model):
    with pytest.raises(ValueError, match="provider/model"):
        split_opencode_model(model)


def test_parse_opencode_usage_reads_nested_cache_field():
    usage = parse_opencode_usage(
        {"total": 100, "input": 80, "output": 20, "reasoning": 5, "cache": {"read": 3}}
    )

    assert usage is not None
    assert usage.total_tokens == 100
    assert usage.cached_input_tokens == 3


def test_parse_opencode_usage_returns_none_for_empty_value():
    assert parse_opencode_usage(None) is None
    assert parse_opencode_usage({}) is None


def test_classify_opencode_failure_not_installed():
    failure = classify_opencode_failure("opencode not found on PATH")

    assert failure.code == "opencode.not_installed"


def test_classify_opencode_failure_generic_fallback():
    failure = classify_opencode_failure("something else broke")

    assert failure.code == "opencode.request_failed"
    assert failure.message == "something else broke"


# --- server startup line parsing --------------------------------------------


class _FakeStdoutProcess:
    def __init__(self, lines: list[str], exits: bool = False):
        self._lines = lines
        self._exits = exits
        self.stdout = self

    def __iter__(self):
        return iter(self._lines)

    def poll(self):
        return 0 if self._exits else None


def test_wait_for_listening_parses_bound_port():
    process = _FakeStdoutProcess(
        ["some startup log\n", "opencode server listening on http://127.0.0.1:54321\n"]
    )

    base_url = _wait_for_listening(process, timeout_seconds=1)

    assert base_url == "http://127.0.0.1:54321"


def test_wait_for_listening_raises_when_process_exits_first():
    process = _FakeStdoutProcess(["boom, crashed\n"], exits=True)

    with pytest.raises(OpencodeServerStartupError, match="exited before"):
        _wait_for_listening(process, timeout_seconds=1)


class _BlockingStdoutProcess:
    """Simulates a process that's still running and simply hasn't printed
    anything yet, as opposed to one whose stdout has hit EOF."""

    def __init__(self):
        self.stdout = self

    def __iter__(self):
        return self

    def __next__(self):
        threading.Event().wait()
        raise StopIteration

    def poll(self):
        return None


def test_wait_for_listening_raises_on_timeout():
    process = _BlockingStdoutProcess()

    with pytest.raises(OpencodeServerStartupError, match="did not report"):
        _wait_for_listening(process, timeout_seconds=0.05)


def test_start_opencode_server_resolves_command_through_path(monkeypatch, tmp_path):
    # Windows regression: npm-installed opencode ships as a .cmd/.ps1 shim,
    # so the bare command name must be resolved via shutil.which() before
    # Popen, the same fix already applied to
    # integrations/command.py's SubprocessCommandRunner.
    captured: dict[str, object] = {}

    def _fake_which(command: str) -> str:
        captured["which_command"] = command
        return f"/resolved/{command}.cmd"

    def _fake_popen(args, **kwargs):
        captured["popen_args"] = args
        return _FakeStdoutProcess(["listening on http://127.0.0.1:12345\n"])

    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.server.shutil.which",
        _fake_which,
    )
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.server.subprocess.Popen",
        _fake_popen,
    )

    server = start_opencode_server("opencode", tmp_path)

    assert captured["which_command"] == "opencode"
    assert captured["popen_args"][0] == "/resolved/opencode.cmd"
    assert server.base_url == "http://127.0.0.1:12345"


def test_start_opencode_server_falls_back_to_bare_command_when_unresolved(
    monkeypatch, tmp_path
):
    captured: dict[str, object] = {}

    def _fake_popen(args, **kwargs):
        captured["popen_args"] = args
        return _FakeStdoutProcess(["listening on http://127.0.0.1:12345\n"])

    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.server.shutil.which",
        lambda command: None,
    )
    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.server.subprocess.Popen",
        _fake_popen,
    )

    start_opencode_server("opencode", tmp_path)

    assert captured["popen_args"][0] == "opencode"
