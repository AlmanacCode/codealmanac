from collections.abc import Mapping

from claude_agent_sdk import (
    AssistantMessage,
    ServerToolResultBlock,
    ServerToolUseBlock,
    ToolResultBlock,
    ToolUseBlock,
    UserMessage,
)

from codealmanac.integrations.command import first_line
from codealmanac.integrations.harnesses.claude.actors import (
    actor_for_helper,
    helper_label,
)
from codealmanac.integrations.harnesses.claude.display import (
    claude_tool_display,
    string_field,
    stringify_tool_input,
)
from codealmanac.integrations.harnesses.claude.raw import (
    json_value,
    raw_block,
)
from codealmanac.integrations.harnesses.claude.state import ClaudeRunState
from codealmanac.services.harnesses.models import (
    HarnessAgentTrace,
    HarnessEvent,
    HarnessEventKind,
    HarnessRunActor,
    HarnessToolStatus,
)


def tool_use_events(
    block: ToolUseBlock,
    message: AssistantMessage,
    state: ClaudeRunState,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
    display = claude_tool_display(
        block.name,
        block.input,
        HarnessToolStatus.STARTED,
    )
    events = [
        HarnessEvent(
            kind=HarnessEventKind.TOOL_USE,
            message=display.title or block.name,
            actor=actor,
            tool_id=block.id,
            tool_name=block.name,
            tool_input=stringify_tool_input(block.input),
            tool_display=display,
            provider_event_id=message.uuid,
            provider_parent_tool_use_id=message.parent_tool_use_id,
            raw=raw_block(block),
        )
    ]
    if block.name == "Agent":
        parent_session = state.provider_session_id
        state.agent_parents[block.id] = parent_session
        state.agent_labels[block.id] = helper_label(state, block.id)
        events.append(
            HarnessEvent(
                kind=HarnessEventKind.AGENT_SPAWNED,
                message=f"spawned {state.agent_labels[block.id]}",
                actor=actor,
                agent_trace=HarnessAgentTrace(
                    parent_thread_id=parent_session,
                    child_thread_id=block.id,
                    prompt=agent_prompt(block.input),
                ),
                raw=raw_block(block),
            )
        )
    return tuple(events)


def server_tool_use_event(
    block: ServerToolUseBlock,
    message: AssistantMessage,
    actor: HarnessRunActor,
) -> HarnessEvent:
    display = claude_tool_display(
        block.name,
        block.input,
        HarnessToolStatus.STARTED,
    )
    return HarnessEvent(
        kind=HarnessEventKind.TOOL_USE,
        message=display.title or block.name,
        actor=actor,
        tool_id=block.id,
        tool_name=block.name,
        tool_input=stringify_tool_input(block.input),
        tool_display=display,
        provider_event_id=message.uuid,
        provider_parent_tool_use_id=message.parent_tool_use_id,
        raw=raw_block(block),
    )


def tool_result_events(
    block: ToolResultBlock,
    message: UserMessage,
    state: ClaudeRunState,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
    events = [
        HarnessEvent(
            kind=HarnessEventKind.TOOL_RESULT,
            message=tool_result_message(block.content),
            actor=actor,
            tool_id=block.tool_use_id,
            tool_result=json_value(block.content),
            tool_is_error=block.is_error,
            provider_event_id=message.uuid,
            provider_parent_tool_use_id=message.parent_tool_use_id,
            raw=raw_block(block),
        )
    ]
    if (
        block.tool_use_id in state.agent_parents
        and block.tool_use_id not in state.completed_agents
    ):
        state.completed_agents.add(block.tool_use_id)
        helper_actor = actor_for_helper(state, block.tool_use_id)
        events.append(
            HarnessEvent(
                kind=HarnessEventKind.AGENT_COMPLETED,
                message=f"{helper_actor.label} completed",
                actor=helper_actor,
                agent_trace=HarnessAgentTrace(
                    parent_thread_id=helper_actor.parent_thread_id,
                    child_thread_id=block.tool_use_id,
                    result=tool_result_message(block.content),
                ),
                raw=raw_block(block),
            )
        )
    return tuple(events)


def server_tool_result_event(
    block: ServerToolResultBlock,
    message: UserMessage,
    actor: HarnessRunActor,
) -> HarnessEvent:
    return HarnessEvent(
        kind=HarnessEventKind.TOOL_RESULT,
        message="server tool completed",
        actor=actor,
        tool_id=block.tool_use_id,
        tool_result=json_value(block.content),
        provider_event_id=message.uuid,
        provider_parent_tool_use_id=message.parent_tool_use_id,
        raw=raw_block(block),
    )


def agent_prompt(tool_input: Mapping[str, object]) -> str | None:
    return string_field(tool_input, "prompt") or string_field(tool_input, "description")


def tool_result_message(content: object) -> str:
    if isinstance(content, str) and content != "":
        return first_line(content)
    return "Tool completed"
