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
    ClaudeMessage,
    ClaudeRunState,
    done_event,
    map_claude_message,
    provider_session_event,
    result_from_state,
    session_id_for_message,
)
from codealmanac.integrations.harnesses.claude.failures import (
    classify_claude_failure,
)
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessEventKind,
    HarnessKind,
    HarnessRunResult,
    HarnessRunStatus,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest

CLAUDE_COMMAND = "claude"
CLAUDE_RUN_TIMEOUT_SECONDS = 900
CLAUDE_ALLOWED_TOOLS = (
    "Read",
    "Write",
    "Edit",
    "MultiEdit",
    "Glob",
    "Grep",
    "LS",
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

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        try:
            return asyncio.run(
                asyncio.wait_for(
                    self._run(request),
                    timeout=self.run_timeout_seconds,
                )
            )
        except TimeoutError:
            return failed_result("claude run timed out")
        except CLINotFoundError:
            return failed_result("claude not found on PATH")
        except CLIJSONDecodeError as error:
            return failed_result(f"claude returned invalid JSON: {error}")
        except ProcessError as error:
            return failed_result(str(error))
        except ClaudeSDKError as error:
            return failed_result(str(error))

    async def _run(self, request: RunHarnessRequest) -> HarnessRunResult:
        state = ClaudeRunState()
        events: list[HarnessEvent] = []
        announced_session_id: str | None = None
        stream = self.query(
            prompt=request.prompt,
            options=claude_options(
                cwd=request.cwd,
                command=self.command,
            ),
        )
        async for message in stream:
            state.note_session_id(session_id_for_message(message))
            if (
                state.provider_session_id is not None
                and announced_session_id != state.provider_session_id
            ):
                announced_session_id = state.provider_session_id
                events.append(provider_session_event(state.provider_session_id))
            events.extend(map_claude_message(message, state))
        events.append(done_event(state))
        return result_from_state(state, tuple(events))


def claude_options(cwd: Path, command: str) -> ClaudeAgentOptions:
    return ClaudeAgentOptions(
        cwd=cwd,
        cli_path=command,
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
