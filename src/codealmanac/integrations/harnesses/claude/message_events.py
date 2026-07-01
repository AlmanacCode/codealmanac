from claude_agent_sdk import (
    AssistantMessage,
    ResultMessage,
    ServerToolResultBlock,
    ServerToolUseBlock,
    TextBlock,
    ToolResultBlock,
    ToolUseBlock,
    UserMessage,
)

from codealmanac.integrations.harnesses.claude.raw import (
    raw_block,
    raw_message,
)
from codealmanac.integrations.harnesses.claude.result import usage_event
from codealmanac.integrations.harnesses.claude.state import ClaudeRunState
from codealmanac.integrations.harnesses.claude.tool_events import (
    server_tool_result_event,
    server_tool_use_event,
    tool_result_events,
    tool_use_events,
)
from codealmanac.integrations.harnesses.claude.usage import parse_claude_usage
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessEventKind,
    HarnessRunActor,
)


def assistant_events(
    message: AssistantMessage,
    state: ClaudeRunState,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
    events: list[HarnessEvent] = []
    usage = parse_claude_usage(message.usage)
    if usage is not None:
        state.usage = usage
        events.append(usage_event(usage, actor, raw_message(message)))
    for block in message.content:
        if isinstance(block, TextBlock):
            events.append(
                HarnessEvent(
                    kind=HarnessEventKind.TEXT,
                    message=block.text,
                    actor=actor,
                    provider_event_id=message.uuid,
                    provider_parent_tool_use_id=message.parent_tool_use_id,
                    raw=raw_block(block),
                )
            )
        if isinstance(block, ToolUseBlock):
            events.extend(tool_use_events(block, message, state, actor))
        if isinstance(block, ServerToolUseBlock):
            events.append(server_tool_use_event(block, message, actor))
    return tuple(events)


def user_events(
    message: UserMessage,
    state: ClaudeRunState,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
    if isinstance(message.content, str):
        return ()
    events: list[HarnessEvent] = []
    for block in message.content:
        if isinstance(block, ToolResultBlock):
            events.extend(tool_result_events(block, message, state, actor))
        if isinstance(block, ServerToolResultBlock):
            events.append(server_tool_result_event(block, message, actor))
    return tuple(events)


def result_events(
    message: ResultMessage,
    state: ClaudeRunState,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
    events: list[HarnessEvent] = []
    if state.usage is not None:
        events.append(usage_event(state.usage, actor, raw_message(message)))
    if not state.success:
        errors = message.errors or ()
        if len(errors) == 0:
            errors = (state.error_text(),)
        for error in errors:
            events.append(
                HarnessEvent(
                    kind=HarnessEventKind.ERROR,
                    message=error,
                    actor=actor,
                    failure=state.failure,
                    raw=raw_message(message),
                )
            )
    return tuple(events)
