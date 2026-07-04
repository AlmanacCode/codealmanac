from pathlib import Path

from codealmanac.engine.harnesses.models import (
    HarnessActorRole,
    HarnessEventKind,
    HarnessKind,
    HarnessRunStatus,
    HarnessToolDisplayKind,
)
from codealmanac.engine.harnesses.requests import RunHarnessRequest
from codealmanac.integrations.harnesses.codex.app_server import (
    CodexAppServerClient,
    noninteractive_response,
)
from codealmanac.integrations.harnesses.codex.usage import (
    parse_codex_app_server_usage,
)

FAKE_CODEX_BODY = r"""
import base64
import json
import os
import sys
import time

EXPECTED_ARGS = ["app-server", "--config", "mcp_servers={}", "--listen", "stdio://"]


def fail(message):
    print(message, file=sys.stderr, flush=True)
    sys.exit(2)


if sys.argv[1:] != EXPECTED_ARGS:
    fail(f"unexpected argv: {sys.argv[1:]}")

if os.environ.get("CODEALMANAC_INTERNAL_SESSION") != "1":
    fail("missing internal session env")


def send(message):
    print(json.dumps(message), flush=True)


def read():
    line = sys.stdin.readline()
    if line == "":
        sys.exit(0)
    return json.loads(line)


def expect_request(method):
    message = read()
    if message.get("method") != method:
        fail(f"expected {method}, got {message}")
    return message


def respond(request, result):
    send({"id": request["id"], "result": result})


def server_request(request_id, method):
    send({"id": request_id, "method": method, "params": {}})
    return read()


def assert_result(response, expected):
    if response.get("result") != expected:
        fail(f"unexpected response: {response}")


def assert_error(response, code):
    if response.get("error", {}).get("code") != code:
        fail(f"unexpected error response: {response}")


def handshake():
    initialize = expect_request("initialize")
    params = initialize.get("params", {})
    if params.get("clientInfo", {}).get("name") != "codealmanac":
        fail(f"bad initialize params: {params}")
    if params.get("capabilities", {}).get("experimentalApi") is not True:
        fail(f"bad capabilities: {params}")
    respond(initialize, {"serverInfo": {"name": "fake-codex"}})

    thread = expect_request("thread/start")
    thread_params = thread.get("params", {})
    if thread_params.get("ephemeral") is not True:
        fail(f"thread is not ephemeral: {thread_params}")
    if thread_params.get("approvalPolicy") != "never":
        fail(f"approval policy is not never: {thread_params}")
    if thread_params.get("sandbox") != "workspace-write":
        fail(f"bad thread sandbox: {thread_params}")
    respond(thread, {"thread": {"id": "thread-root"}})

    turn = expect_request("turn/start")
    turn_params = turn.get("params", {})
    sandbox = turn_params.get("sandboxPolicy", {})
    if sandbox.get("type") != "workspaceWrite":
        fail(f"bad turn sandbox type: {turn_params}")
    if sandbox.get("networkAccess") is not False:
        fail(f"turn has network access: {turn_params}")
    inputs = turn_params.get("input", [])
    if inputs[0].get("text") != "Update the wiki.":
        fail(f"bad prompt input: {turn_params}")
    respond(turn, {"turn": {"id": "turn-root"}})


def run_success():
    handshake()

    assert_result(
        server_request("approval-1", "item/commandExecution/requestApproval"),
        {"decision": "decline"},
    )
    assert_result(
        server_request("permission-1", "item/permissions/requestApproval"),
        {"permissions": {}, "scope": "turn", "strictAutoReview": True},
    )
    assert_error(server_request("auth-1", "account/chatgptAuthTokens/refresh"), -32001)

    send(
        {
            "method": "item/started",
            "params": {
                "threadId": "thread-root",
                "turnId": "turn-root",
                "item": {
                    "id": "tool-1",
                    "type": "commandExecution",
                    "status": "started",
                    "command": "sed -n '1,20p' note.txt",
                    "cwd": "/tmp/project",
                    "commandActions": [{"type": "read", "path": "note.txt"}],
                },
            },
        }
    )
    encoded = base64.b64encode(b"command output\n").decode("ascii")
    send(
        {
            "method": "item/commandExecution/outputDelta",
            "params": {
                "threadId": "thread-root",
                "turnId": "turn-root",
                "deltaBase64": encoded,
            },
        }
    )
    send(
        {
            "method": "warning",
            "params": {"threadId": "thread-root", "message": "model warning"},
        }
    )
    send(
        {
            "method": "item/completed",
            "params": {
                "threadId": "thread-root",
                "turnId": "turn-root",
                "item": {
                    "id": "tool-1",
                    "type": "commandExecution",
                    "status": "completed",
                    "exitCode": 0,
                    "durationMs": 3,
                    "aggregatedOutput": "command output\n",
                    "commandActions": [{"type": "read", "path": "note.txt"}],
                },
            },
        }
    )
    send(
        {
            "method": "item/agentMessage/delta",
            "params": {
                "threadId": "thread-root",
                "turnId": "turn-root",
                "delta": "\n",
            },
        }
    )
    send(
        {
            "method": "item/agentMessage/delta",
            "params": {
                "threadId": "thread-root",
                "turnId": "turn-root",
                "delta": "final ",
            },
        }
    )
    send(
        {
            "method": "item/completed",
            "params": {
                "threadId": "thread-root",
                "turnId": "turn-root",
                "item": {"type": "agentMessage", "text": "final text"},
            },
        }
    )
    send(
        {
            "method": "thread/tokenUsage/updated",
            "params": {
                "threadId": "thread-root",
                "tokenUsage": {
                    "last": {"inputTokens": 0, "outputTokens": 4, "totalTokens": 4},
                    "total": {"totalTokens": 10},
                    "modelContextWindow": 128,
                },
            },
        }
    )
    send(
        {
            "method": "turn/completed",
            "params": {
                "threadId": "thread-root",
                "turnId": "turn-root",
                "turn": {"id": "turn-root"},
            },
        }
    )


def run_helper_error_then_root_success():
    handshake()
    send(
        {
            "method": "turn/completed",
            "params": {
                "threadId": "thread-helper",
                "turnId": "turn-helper",
                "turn": {
                    "id": "turn-helper",
                    "error": {"message": "helper failed", "code": 400},
                },
            },
        }
    )
    send(
        {
            "method": "item/completed",
            "params": {
                "threadId": "thread-root",
                "turnId": "turn-root",
                "item": {"type": "agentMessage", "text": "root recovered"},
            },
        }
    )
    send(
        {
            "method": "turn/completed",
            "params": {
                "threadId": "thread-root",
                "turnId": "turn-root",
                "turn": {"id": "turn-root"},
            },
        }
    )


if SCENARIO == "initialize_timeout":
    time.sleep(5)
elif SCENARIO == "turn_timeout":
    handshake()
    time.sleep(5)
elif SCENARIO == "helper_error":
    run_helper_error_then_root_success()
else:
    run_success()
"""


def test_codex_app_server_run_maps_notifications(tmp_path: Path):
    client = CodexAppServerClient(
        command=fake_codex_path(tmp_path, "success"),
        rpc_timeout_seconds=1,
        turn_timeout_seconds=1,
    )

    result = client.run(run_request(tmp_path))

    assert result.status == HarnessRunStatus.SUCCEEDED
    assert result.output_text == "final text"
    assert result.summary == "final text"
    assert event_kinds(result) == (
        HarnessEventKind.PROVIDER_SESSION,
        HarnessEventKind.TOOL_USE,
        HarnessEventKind.TOOL_SUMMARY,
        HarnessEventKind.TOOL_SUMMARY,
        HarnessEventKind.TOOL_RESULT,
        HarnessEventKind.TEXT_DELTA,
        HarnessEventKind.TEXT,
        HarnessEventKind.CONTEXT_USAGE,
        HarnessEventKind.DONE,
    )
    tool_use = result.events[1]
    assert tool_use.tool_display is not None
    assert tool_use.tool_display.kind == HarnessToolDisplayKind.READ
    assert tool_use.tool_display.path == "note.txt"
    assert result.events[2].message == "command output"
    usage_event = result.events[7]
    assert usage_event.usage is not None
    assert usage_event.usage.input_tokens == 0
    assert usage_event.usage.output_tokens == 4
    assert usage_event.usage.total_tokens == 4
    assert usage_event.usage.total_processed_tokens == 10
    assert usage_event.usage.max_tokens == 128
    done = result.events[-1]
    assert done.provider_session_id == "thread-root"
    assert done.source_thread_id == "thread-root"
    assert done.source_turn_id == "turn-root"
    assert done.source_role == HarnessActorRole.ROOT


def test_codex_app_server_streams_notifications_to_event_sink(tmp_path: Path):
    client = CodexAppServerClient(
        command=fake_codex_path(tmp_path, "success"),
        rpc_timeout_seconds=1,
        turn_timeout_seconds=1,
    )
    streamed = []

    result = client.run(run_request(tmp_path, event_sink=streamed.append))

    assert result.status == HarnessRunStatus.SUCCEEDED
    assert streamed == list(result.events)


def test_codex_app_server_helper_turn_error_does_not_fail_root_turn(
    tmp_path: Path,
):
    client = CodexAppServerClient(
        command=fake_codex_path(tmp_path, "helper_error"),
        rpc_timeout_seconds=1,
        turn_timeout_seconds=1,
    )

    result = client.run(run_request(tmp_path))

    assert result.status == HarnessRunStatus.SUCCEEDED
    assert result.output_text == "root recovered"
    error = next(
        event for event in result.events if event.kind == HarnessEventKind.ERROR
    )
    assert error.actor is not None
    assert error.actor.role == HarnessActorRole.HELPER
    assert error.message == "helper failed"


def test_codex_app_server_reports_startup_timeout(tmp_path: Path):
    client = CodexAppServerClient(
        command=fake_codex_path(tmp_path, "initialize_timeout"),
        rpc_timeout_seconds=0.05,
        turn_timeout_seconds=1,
    )

    result = client.run(run_request(tmp_path))

    assert result.status == HarnessRunStatus.FAILED
    assert "initialize timed out" in result.output_text
    assert result.events[0].kind == HarnessEventKind.ERROR


def test_codex_app_server_reports_turn_timeout(tmp_path: Path):
    client = CodexAppServerClient(
        command=fake_codex_path(tmp_path, "turn_timeout"),
        rpc_timeout_seconds=1,
        turn_timeout_seconds=0.05,
    )

    result = client.run(run_request(tmp_path))

    assert result.status == HarnessRunStatus.FAILED
    assert "turn timed out" in result.output_text
    assert result.events[0].kind == HarnessEventKind.ERROR


def test_codex_app_server_usage_preserves_zero_counts():
    usage = parse_codex_app_server_usage(
        {
            "last": {"inputTokens": 0, "outputTokens": 0, "totalTokens": 0},
            "total": {"totalTokens": 0},
            "modelContextWindow": 128,
        }
    )

    assert usage is not None
    assert usage.input_tokens == 0
    assert usage.output_tokens == 0
    assert usage.total_tokens == 0
    assert usage.total_processed_tokens == 0
    assert usage.max_tokens == 128


def test_codex_app_server_noninteractive_responses_are_deterministic():
    assert noninteractive_response("item/commandExecution/requestApproval").result == {
        "decision": "decline"
    }
    assert noninteractive_response("item/permissions/requestApproval").result == {
        "permissions": {},
        "scope": "turn",
        "strictAutoReview": True,
    }
    assert noninteractive_response("account/chatgptAuthTokens/refresh").error == {
        "code": -32001,
        "message": (
            "CodeAlmanac does not manage ChatGPT auth tokens for Codex app-server."
        ),
    }


def fake_codex_path(tmp_path: Path, scenario: str) -> str:
    path = tmp_path / "codex"
    path.write_text(
        f"#!/usr/bin/env python3\nSCENARIO = {scenario!r}\n{FAKE_CODEX_BODY}\n",
        encoding="utf-8",
    )
    path.chmod(0o755)
    return str(path)


def run_request(tmp_path: Path, event_sink=None) -> RunHarnessRequest:
    return RunHarnessRequest(
        kind=HarnessKind.CODEX,
        cwd=tmp_path,
        prompt="Update the wiki.",
        event_sink=event_sink,
    )


def event_kinds(result) -> tuple[HarnessEventKind, ...]:
    return tuple(event.kind for event in result.events)
