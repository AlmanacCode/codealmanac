import asyncio
from pathlib import Path

from claude_agent_sdk import (
    AssistantMessage,
    ResultMessage,
    StreamEvent,
    TextBlock,
    ToolResultBlock,
    ToolUseBlock,
    UserMessage,
)

from codealmanac.app import create_app
from codealmanac.integrations.command import CommandResult
from codealmanac.integrations.harnesses.claude.adapter import (
    ANTHROPIC_API_KEY,
    ClaudeSdkHarnessAdapter,
)
from codealmanac.integrations.harnesses.claude.client import (
    CLAUDE_ALLOWED_TOOLS,
    ClaudeSdkClient,
)
from codealmanac.services.harnesses.models import (
    HarnessActorRole,
    HarnessEventKind,
    HarnessKind,
    HarnessRunResult,
    HarnessRunStatus,
    HarnessToolDisplayKind,
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


class FakeClaudeClient:
    def __init__(self, result: HarnessRunResult):
        self.result = result
        self.requests: list[RunHarnessRequest] = []
        self.on_events = []

    def run(self, request: RunHarnessRequest, on_event=None) -> HarnessRunResult:
        self.requests.append(request)
        self.on_events.append(on_event)
        return self.result


class FakeClaudeQuery:
    def __init__(self, messages):
        self.messages = tuple(messages)
        self.calls = []

    def __call__(self, *, prompt, options):
        self.calls.append((prompt, options))
        return self._messages()

    async def _messages(self):
        for message in self.messages:
            yield message


class SlowClaudeQuery:
    def __call__(self, *, prompt, options):
        return self._messages()

    async def _messages(self):
        await asyncio.sleep(1)
        yield successful_result()


def test_claude_adapter_reports_ready_when_auth_status_is_logged_in(
    monkeypatch,
):
    monkeypatch.delenv(ANTHROPIC_API_KEY, raising=False)
    runner = FakeCommandRunner(
        (
            CommandResult(
                returncode=0,
                stdout=(
                    '{"loggedIn": true, "authMethod": "claude.ai", '
                    '"email": "agent@example.com"}'
                ),
            ),
        )
    )
    adapter = ClaudeSdkHarnessAdapter(runner=runner)

    readiness = adapter.check()

    assert readiness.kind == HarnessKind.CLAUDE
    assert readiness.available is True
    assert readiness.message == "agent@example.com"
    assert runner.calls[0][1] == ("auth", "status")


def test_claude_adapter_reports_not_ready_when_command_is_missing(monkeypatch):
    monkeypatch.delenv(ANTHROPIC_API_KEY, raising=False)
    runner = FakeCommandRunner((FileNotFoundError("missing"),))
    adapter = ClaudeSdkHarnessAdapter(runner=runner)

    readiness = adapter.check()

    assert readiness.available is False
    assert readiness.message == "claude not found on PATH"
    assert readiness.repair is not None
    assert "npm install -g @anthropic-ai/claude-code" in readiness.repair


def test_claude_adapter_repairs_logged_out_cli_with_login_hint(monkeypatch):
    monkeypatch.delenv(ANTHROPIC_API_KEY, raising=False)
    runner = FakeCommandRunner(
        (CommandResult(returncode=0, stdout='{"loggedIn": false}'),)
    )
    adapter = ClaudeSdkHarnessAdapter(runner=runner)

    readiness = adapter.check()

    assert readiness.available is False
    assert readiness.message == "claude is not logged in"
    assert readiness.repair is not None
    assert "claude auth login" in readiness.repair


def test_claude_adapter_reports_api_key_ready_when_cli_is_not_logged_in(
    monkeypatch,
):
    monkeypatch.setenv(ANTHROPIC_API_KEY, "test-key")
    runner = FakeCommandRunner(
        (
            CommandResult(
                returncode=0,
                stdout='{"loggedIn": false}',
            ),
        )
    )
    adapter = ClaudeSdkHarnessAdapter(runner=runner)

    readiness = adapter.check()

    assert readiness.available is True
    assert readiness.message == f"{ANTHROPIC_API_KEY} set"


def test_claude_adapter_runs_sdk_client_without_git_change_probe(tmp_path: Path):
    runner = FakeCommandRunner(())
    client = FakeClaudeClient(
        HarnessRunResult(
            kind=HarnessKind.CLAUDE,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="updated wiki",
            summary="updated wiki",
        )
    )
    adapter = ClaudeSdkHarnessAdapter(runner=runner, client=client)
    request = RunHarnessRequest(
        kind=HarnessKind.CLAUDE,
        model="claude-sonnet-5",
        cwd=tmp_path,
        prompt="Update the wiki.",
        title="Ingest note",
    )

    result = adapter.run(request)

    assert client.requests == [request]
    assert client.on_events == [None]
    assert result.status == HarnessRunStatus.SUCCEEDED
    assert result.output_text == "updated wiki"
    assert result.changed_files == ()
    assert runner.calls == []


def test_claude_sdk_client_maps_typed_message_stream(tmp_path: Path):
    query = FakeClaudeQuery(
        (
            StreamEvent(
                uuid="stream-1",
                session_id="claude-session-1",
                event={
                    "type": "content_block_delta",
                    "delta": {"type": "text_delta", "text": "working "},
                },
            ),
            AssistantMessage(
                content=[
                    TextBlock(text="reading source"),
                    ToolUseBlock(
                        id="tool-1",
                        name="Read",
                        input={"file_path": "almanac/source.md"},
                    ),
                    ToolUseBlock(
                        id="agent-1",
                        name="Agent",
                        input={
                            "description": "Review page",
                            "prompt": "Check the page.",
                        },
                    ),
                ],
                model="claude",
                session_id="claude-session-1",
                uuid="assistant-1",
                usage={"input_tokens": 3, "output_tokens": 4},
            ),
            UserMessage(
                content=[
                    ToolResultBlock(
                        tool_use_id="tool-1",
                        content="file contents",
                        is_error=False,
                    ),
                    ToolResultBlock(
                        tool_use_id="agent-1",
                        content="looks good",
                        is_error=False,
                    ),
                ],
                uuid="user-1",
            ),
            successful_result(),
        )
    )
    client = ClaudeSdkClient(query=query, run_timeout_seconds=1)

    result = client.run(run_request(tmp_path))

    assert result.status == HarnessRunStatus.SUCCEEDED
    assert result.output_text == "updated wiki"
    assert result.transcript is not None
    assert result.transcript.session_id == "claude-session-1"
    assert event_kinds(result) == (
        HarnessEventKind.PROVIDER_SESSION,
        HarnessEventKind.TEXT_DELTA,
        HarnessEventKind.CONTEXT_USAGE,
        HarnessEventKind.TEXT,
        HarnessEventKind.TOOL_USE,
        HarnessEventKind.TOOL_USE,
        HarnessEventKind.AGENT_SPAWNED,
        HarnessEventKind.TOOL_RESULT,
        HarnessEventKind.TOOL_RESULT,
        HarnessEventKind.AGENT_COMPLETED,
        HarnessEventKind.CONTEXT_USAGE,
        HarnessEventKind.DONE,
    )
    tool_use = result.events[4]
    assert tool_use.tool_display is not None
    assert tool_use.tool_display.kind == HarnessToolDisplayKind.READ
    assert tool_use.tool_display.path == "almanac/source.md"
    helper_done = result.events[9]
    assert helper_done.actor is not None
    assert helper_done.actor.role == HarnessActorRole.HELPER
    done = result.events[-1]
    assert done.provider_session_id == "claude-session-1"
    assert done.source_thread_id == "claude-session-1"
    assert done.source_role == HarnessActorRole.ROOT
    assert done.usage is not None
    assert done.usage.input_tokens == 10
    assert done.usage.cached_input_tokens == 2
    assert done.usage.output_tokens == 5
    assert done.usage.total_tokens == 15
    prompt, options = query.calls[0]
    assert prompt == "Update the wiki."
    assert options.permission_mode == "dontAsk"
    assert options.setting_sources == []
    assert options.strict_mcp_config is True
    assert options.mcp_servers == {}
    assert options.tools == list(CLAUDE_ALLOWED_TOOLS)
    assert options.allowed_tools == list(CLAUDE_ALLOWED_TOOLS)
    assert "Agent" in options.allowed_tools


def test_claude_sdk_client_maps_result_failure(tmp_path: Path):
    query = FakeClaudeQuery(
        (
            ResultMessage(
                subtype="error_max_budget_usd",
                duration_ms=1,
                duration_api_ms=1,
                is_error=True,
                num_turns=1,
                session_id="claude-session-1",
                errors=["budget exceeded"],
            ),
        )
    )
    client = ClaudeSdkClient(query=query, run_timeout_seconds=1)

    result = client.run(run_request(tmp_path))

    assert result.status == HarnessRunStatus.FAILED
    assert result.output_text == "budget exceeded"
    assert result.events[-1].failure is not None
    assert result.events[-1].failure.code == "claude.max_budget_exceeded"
    assert result.events[-1].message == "claude failed: budget exceeded"


def test_claude_sdk_client_reports_timeout(tmp_path: Path):
    client = ClaudeSdkClient(query=SlowClaudeQuery(), run_timeout_seconds=0.01)

    result = client.run(run_request(tmp_path))

    assert result.status == HarnessRunStatus.FAILED
    assert result.output_text == "claude run timed out"
    assert result.events[0].kind == HarnessEventKind.ERROR
    assert result.events[-1].kind == HarnessEventKind.DONE


def test_create_app_wires_default_claude_sdk_adapter():
    app = create_app()

    adapter = app.harnesses.adapter_for(HarnessKind.CLAUDE)

    assert isinstance(adapter, ClaudeSdkHarnessAdapter)


def successful_result() -> ResultMessage:
    return ResultMessage(
        subtype="success",
        duration_ms=10,
        duration_api_ms=8,
        is_error=False,
        num_turns=2,
        session_id="claude-session-1",
        usage={
            "input_tokens": 10,
            "cache_read_input_tokens": 2,
            "output_tokens": 5,
        },
        result="updated wiki",
    )


def run_request(tmp_path: Path) -> RunHarnessRequest:
    return RunHarnessRequest(
        kind=HarnessKind.CLAUDE,
        model="claude-sonnet-5",
        cwd=tmp_path,
        prompt="Update the wiki.",
    )


def event_kinds(result: HarnessRunResult) -> tuple[HarnessEventKind, ...]:
    return tuple(event.kind for event in result.events)
