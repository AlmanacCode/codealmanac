import asyncio
import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Protocol

from claude_agent_sdk import (
    ClaudeAgentOptions,
    ClaudeSDKError,
    CLIJSONDecodeError,
    CLINotFoundError,
    ProcessError,
)
from claude_agent_sdk import (
    query as claude_query,
)

from codealmanac.integrations.harnesses.claude.events import (
    map_claude_message,
)
from codealmanac.integrations.harnesses.claude.failures import (
    classify_claude_failure,
)
from codealmanac.integrations.harnesses.claude.result import (
    done_event,
    provider_session_event,
    result_from_state,
)
from codealmanac.integrations.harnesses.claude.sdk_messages import (
    ClaudeMessage,
    session_id_for_message,
)
from codealmanac.integrations.harnesses.claude.state import ClaudeRunState
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessEventKind,
    HarnessKind,
    HarnessRunResult,
    HarnessRunStatus,
)
from codealmanac.services.harnesses.ports import HarnessEventSink
from codealmanac.services.harnesses.requests import RunHarnessRequest

CLAUDE_COMMAND = "claude"
CLAUDE_RUN_TIMEOUT_SECONDS = 90 * 60
CLAUDE_ALLOWED_TOOLS = (
    "Read",
    "Write",
    "Edit",
    "MultiEdit",
    "Glob",
    "Grep",
    "LS",
    "Bash",
    "Agent",
)
CLAUDE_MAX_TURNS = 100


class ClaudeQuery(Protocol):
    def __call__(
        self,
        *,
        prompt: str,
        options: ClaudeAgentOptions,
    ) -> AsyncIterator[ClaudeMessage]:
        """Return the Claude SDK message stream."""


class ClaudeSdkClient:
    def __init__(
        self,
        query: ClaudeQuery = claude_query,
        command: str = CLAUDE_COMMAND,
        run_timeout_seconds: float = CLAUDE_RUN_TIMEOUT_SECONDS,
    ):
        self.query = query
        self.command = command
        self.run_timeout_seconds = run_timeout_seconds

    def run(
        self,
        request: RunHarnessRequest,
        on_event: HarnessEventSink | None = None,
    ) -> HarnessRunResult:
        try:
            return asyncio.run(
                asyncio.wait_for(
                    self.run_once(request, on_event),
                    timeout=self.run_timeout_seconds,
                )
            )
        except TimeoutError:
            return emit_result(failed_result("claude run timed out"), on_event)
        except CLINotFoundError:
            return emit_result(failed_result("claude not found on PATH"), on_event)
        except CLIJSONDecodeError as error:
            return emit_result(
                failed_result(f"claude returned invalid JSON: {error}"),
                on_event,
            )
        except ProcessError as error:
            return emit_result(failed_result(str(error)), on_event)
        except ClaudeSDKError as error:
            return emit_result(failed_result(str(error)), on_event)

    async def run_once(
        self,
        request: RunHarnessRequest,
        on_event: HarnessEventSink | None = None,
    ) -> HarnessRunResult:
        state = ClaudeRunState()
        events: list[HarnessEvent] = []
        announced_session_id: str | None = None
        stream = self.query(
            prompt=request.prompt,
            options=claude_options(
                cwd=request.cwd,
                command=self.command,
                model=request.model,
            ),
        )
        async for message in stream:
            state.note_session_id(session_id_for_message(message))
            if (
                state.provider_session_id is not None
                and announced_session_id != state.provider_session_id
            ):
                announced_session_id = state.provider_session_id
                append_event(
                    events,
                    provider_session_event(state.provider_session_id),
                    on_event,
                )
            for event in map_claude_message(message, state):
                append_event(events, event, on_event)
        append_event(events, done_event(state), on_event)
        return result_from_state(state, tuple(events))


def claude_options(cwd: Path, command: str, model: str) -> ClaudeAgentOptions:
    return ClaudeAgentOptions(
        cwd=cwd,
        cli_path=command,
        model=model,
        tools=list(CLAUDE_ALLOWED_TOOLS),
        allowed_tools=list(CLAUDE_ALLOWED_TOOLS),
        mcp_servers={},
        strict_mcp_config=True,
        permission_mode="dontAsk",
        include_partial_messages=True,
        setting_sources=[],
        max_turns=CLAUDE_MAX_TURNS,
        env=dict(os.environ),
        debug_stderr=None,
    )


def failed_result(output_text: str) -> HarnessRunResult:
    failure = classify_claude_failure(output_text)
    return HarnessRunResult(
        kind=HarnessKind.CLAUDE,
        status=HarnessRunStatus.FAILED,
        output_text=output_text,
        events=(
            HarnessEvent(
                kind=HarnessEventKind.ERROR,
                message=output_text,
                failure=failure,
            ),
            HarnessEvent(
                kind=HarnessEventKind.DONE,
                status=HarnessRunStatus.FAILED,
                message=f"claude failed: {output_text}",
                failure=failure,
            ),
        ),
    )


def append_event(
    events: list[HarnessEvent],
    event: HarnessEvent,
    on_event: HarnessEventSink | None,
) -> None:
    events.append(event)
    if on_event is not None:
        on_event(event)


def emit_result(
    result: HarnessRunResult,
    on_event: HarnessEventSink | None,
) -> HarnessRunResult:
    if on_event is not None:
        for event in result.events:
            on_event(event)
    return result
