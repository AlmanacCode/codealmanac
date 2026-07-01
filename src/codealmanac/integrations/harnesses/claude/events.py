from collections.abc import Mapping
from dataclasses import asdict, dataclass, field, is_dataclass

from claude_agent_sdk import (
    AssistantMessage,
    RateLimitEvent,
    ResultMessage,
    ServerToolResultBlock,
    ServerToolUseBlock,
    StreamEvent,
    SystemMessage,
    TaskNotificationMessage,
    TaskProgressMessage,
    TaskStartedMessage,
    TaskUpdatedMessage,
    TextBlock,
    ToolResultBlock,
    ToolUseBlock,
    UserMessage,
)
from pydantic import JsonValue

from codealmanac.integrations.command import first_line
from codealmanac.integrations.harnesses.claude.display import (
    claude_tool_display,
    string_field,
    stringify_tool_input,
)
from codealmanac.integrations.harnesses.claude.failures import (
    classify_claude_failure,
)
from codealmanac.integrations.harnesses.claude.usage import parse_claude_usage
from codealmanac.services.harnesses.models import (
    HarnessActorConfidence,
    HarnessActorRole,
    HarnessAgentTrace,
    HarnessEvent,
    HarnessEventKind,
    HarnessFailure,
    HarnessKind,
    HarnessRunActor,
    HarnessRunResult,
    HarnessRunStatus,
    HarnessToolStatus,
    HarnessTranscriptRef,
    HarnessUsage,
)


@dataclass
class ClaudeRunState:
    success: bool = False
    seen_result: bool = False
    result: str = ""
    provider_session_id: str | None = None
    turns: int | None = None
    usage: HarnessUsage | None = None
    error: str | None = None
    failure: HarnessFailure | None = None
    result_source_role: HarnessActorRole | None = None
    agent_parents: dict[str, str | None] = field(default_factory=dict)
    agent_labels: dict[str, str] = field(default_factory=dict)
    completed_agents: set[str] = field(default_factory=set)

    def note_session_id(self, session_id: str | None) -> None:
        if self.provider_session_id is None and session_id is not None:
            self.provider_session_id = session_id

    def error_text(self) -> str:
        return self.error or "claude run failed"


ClaudeMessage = (
    AssistantMessage
    | UserMessage
    | SystemMessage
    | ResultMessage
    | StreamEvent
    | RateLimitEvent
    | TaskStartedMessage
    | TaskProgressMessage
    | TaskUpdatedMessage
    | TaskNotificationMessage
)


def map_claude_message(
    message: ClaudeMessage,
    state: ClaudeRunState,
) -> tuple[HarnessEvent, ...]:
    session_id = session_id_for_message(message)
    state.note_session_id(session_id)
    actor = actor_for_message(message, state)

    if isinstance(message, StreamEvent):
        return stream_event(message, actor)
    if isinstance(message, AssistantMessage):
        return assistant_events(message, state, actor)
    if isinstance(message, UserMessage):
        return user_events(message, state, actor)
    if isinstance(message, ResultMessage):
        record_result(message, state)
        return result_events(message, state, actor)
    if isinstance(message, RateLimitEvent):
        return (
            HarnessEvent(
                kind=HarnessEventKind.WARNING,
                message="Claude rate limit update",
                actor=actor,
                raw=raw_message(message),
            ),
        )
    if isinstance(message, TaskStartedMessage):
        return task_started_events(message, state, actor)
    if isinstance(message, TaskProgressMessage):
        return task_progress_events(message, actor)
    if isinstance(message, TaskNotificationMessage):
        return task_notification_events(message, state, actor)
    if isinstance(message, TaskUpdatedMessage):
        return task_updated_events(message, actor)
    if isinstance(message, SystemMessage):
        return ()
    return ()


def provider_session_event(session_id: str) -> HarnessEvent:
    return HarnessEvent(
        kind=HarnessEventKind.PROVIDER_SESSION,
        message=f"claude session {session_id}",
        provider_session_id=session_id,
        actor=root_claude_actor(session_id),
    )


def done_event(state: ClaudeRunState) -> HarnessEvent:
    finalize_state(state)
    status = HarnessRunStatus.SUCCEEDED if state.success else HarnessRunStatus.FAILED
    output = state.result if state.success else state.error_text()
    return HarnessEvent(
        kind=HarnessEventKind.DONE,
        status=status,
        message=f"claude {status.value}: {first_line(output)}",
        provider_session_id=state.provider_session_id,
        source_thread_id=state.provider_session_id,
        source_role=state.result_source_role,
        usage=state.usage,
        failure=state.failure,
        actor=root_claude_actor(state.provider_session_id),
    )


def result_from_state(
    state: ClaudeRunState,
    events: tuple[HarnessEvent, ...],
) -> HarnessRunResult:
    finalize_state(state)
    output_text = state.result if state.success else state.error_text()
    return HarnessRunResult(
        kind=HarnessKind.CLAUDE,
        status=HarnessRunStatus.SUCCEEDED
        if state.success
        else HarnessRunStatus.FAILED,
        output_text=output_text or "claude completed without output",
        summary=first_line(output_text) if output_text else None,
        transcript=claude_transcript_ref(state.provider_session_id),
        events=events,
    )


def finalize_state(state: ClaudeRunState) -> None:
    if state.seen_result:
        return
    state.success = False
    state.error = "claude run ended without a result"
    state.failure = classify_claude_failure(state.error)


def claude_transcript_ref(session_id: str | None) -> HarnessTranscriptRef | None:
    if session_id is None:
        return None
    return HarnessTranscriptRef(kind=HarnessKind.CLAUDE, session_id=session_id)


def stream_event(
    message: StreamEvent,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
    text = text_delta_from_stream_event(message.event)
    if text is None:
        return ()
    return (
        HarnessEvent(
            kind=HarnessEventKind.TEXT_DELTA,
            message=text,
            actor=actor,
            provider_event_id=message.uuid,
            provider_parent_tool_use_id=message.parent_tool_use_id,
            raw=raw_message(message),
        ),
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
    content = json_value(block.content)
    events = [
        HarnessEvent(
            kind=HarnessEventKind.TOOL_RESULT,
            message=tool_result_message(block.content),
            actor=actor,
            tool_id=block.tool_use_id,
            tool_result=content,
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


def task_started_events(
    message: TaskStartedMessage,
    state: ClaudeRunState,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
    if message.tool_use_id is None:
        return (
            HarnessEvent(
                kind=HarnessEventKind.TOOL_SUMMARY,
                message=f"Task started: {message.description}",
                actor=actor,
                raw=raw_message(message),
            ),
        )
    state.agent_parents[message.tool_use_id] = state.provider_session_id
    state.agent_labels[message.tool_use_id] = helper_label(state, message.tool_use_id)
    return (
        HarnessEvent(
            kind=HarnessEventKind.AGENT_WAIT_STARTED,
            message=f"{state.agent_labels[message.tool_use_id]} started",
            actor=actor,
            agent_trace=HarnessAgentTrace(
                parent_thread_id=state.provider_session_id,
                child_thread_id=message.tool_use_id,
                prompt=message.description,
            ),
            raw=raw_message(message),
        ),
    )


def task_progress_events(
    message: TaskProgressMessage,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
    return (
        HarnessEvent(
            kind=HarnessEventKind.TOOL_SUMMARY,
            message=f"Task progress: {message.description}",
            actor=actor,
            raw=raw_message(message),
        ),
    )


def task_notification_events(
    message: TaskNotificationMessage,
    state: ClaudeRunState,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
    if message.tool_use_id is None:
        return (
            HarnessEvent(
                kind=HarnessEventKind.TOOL_SUMMARY,
                message=message.summary,
                actor=actor,
                raw=raw_message(message),
            ),
        )
    state.completed_agents.add(message.tool_use_id)
    helper_actor = actor_for_helper(state, message.tool_use_id)
    if message.status == "failed":
        failure = classify_claude_failure(message.summary, "task_failed")
        return (
            HarnessEvent(
                kind=HarnessEventKind.ERROR,
                message=message.summary,
                actor=helper_actor,
                failure=failure,
                raw=raw_message(message),
            ),
        )
    return (
        HarnessEvent(
            kind=HarnessEventKind.AGENT_COMPLETED,
            message=message.summary,
            actor=helper_actor,
            agent_trace=HarnessAgentTrace(
                parent_thread_id=helper_actor.parent_thread_id,
                child_thread_id=message.tool_use_id,
                result=message.summary,
            ),
            raw=raw_message(message),
        ),
    )


def task_updated_events(
    message: TaskUpdatedMessage,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
    if message.status is None:
        return ()
    return (
        HarnessEvent(
            kind=HarnessEventKind.TOOL_SUMMARY,
            message=f"Task {message.status}",
            actor=actor,
            raw=raw_message(message),
        ),
    )


def record_result(message: ResultMessage, state: ClaudeRunState) -> None:
    state.seen_result = True
    state.note_session_id(message.session_id)
    state.turns = message.num_turns
    state.usage = parse_claude_usage(message.usage)
    if message.subtype == "success" and not message.is_error:
        state.success = True
        state.result = message.result or ""
        state.result_source_role = HarnessActorRole.ROOT
        return
    state.success = False
    state.error = result_error(message)
    state.failure = classify_claude_failure(state.error, message.subtype)


def result_error(message: ResultMessage) -> str:
    if message.errors is not None and len(message.errors) > 0:
        return "; ".join(message.errors)
    if message.result is not None and message.result != "":
        return message.result
    return f"agent error: {message.subtype}"


def usage_event(
    usage: HarnessUsage,
    actor: HarnessRunActor,
    raw: JsonValue,
) -> HarnessEvent:
    return HarnessEvent(
        kind=HarnessEventKind.CONTEXT_USAGE,
        message=usage_message(usage),
        actor=actor,
        usage=usage,
        raw=raw,
    )


def usage_message(usage: HarnessUsage) -> str:
    if usage.total_tokens is not None:
        return f"usage: {usage.total_tokens} tokens"
    return "usage updated"


def actor_for_message(
    message: ClaudeMessage,
    state: ClaudeRunState,
) -> HarnessRunActor:
    if isinstance(message, AssistantMessage):
        return actor_for_parent(state, message.session_id, message.parent_tool_use_id)
    if isinstance(message, UserMessage):
        return actor_for_parent(state, None, message.parent_tool_use_id)
    if isinstance(message, StreamEvent):
        return actor_for_parent(
            state,
            message.session_id,
            message.parent_tool_use_id,
        )
    if isinstance(
        message,
        TaskStartedMessage
        | TaskProgressMessage
        | TaskNotificationMessage,
    ):
        return actor_for_parent(state, message.session_id, message.tool_use_id)
    if isinstance(message, TaskUpdatedMessage):
        return root_claude_actor(state.provider_session_id)
    return root_claude_actor(
        session_id_for_message(message) or state.provider_session_id
    )


def actor_for_parent(
    state: ClaudeRunState,
    session_id: str | None,
    parent_tool_use_id: str | None,
) -> HarnessRunActor:
    state.note_session_id(session_id)
    if parent_tool_use_id is None or parent_tool_use_id == "":
        return root_claude_actor(state.provider_session_id)
    state.agent_parents[parent_tool_use_id] = (
        state.agent_parents.get(parent_tool_use_id) or state.provider_session_id
    )
    state.agent_labels[parent_tool_use_id] = helper_label(state, parent_tool_use_id)
    return actor_for_helper(state, parent_tool_use_id)


def root_claude_actor(session_id: str | None) -> HarnessRunActor:
    return HarnessRunActor(
        thread_id=session_id,
        role=HarnessActorRole.ROOT
        if session_id is not None
        else HarnessActorRole.UNKNOWN,
        confidence=HarnessActorConfidence.PROVIDER
        if session_id is not None
        else HarnessActorConfidence.UNKNOWN,
        label="Main" if session_id is not None else "Unknown actor",
    )


def actor_for_helper(
    state: ClaudeRunState,
    tool_use_id: str,
) -> HarnessRunActor:
    return HarnessRunActor(
        thread_id=tool_use_id,
        role=HarnessActorRole.HELPER,
        parent_thread_id=state.agent_parents.get(tool_use_id)
        or state.provider_session_id,
        confidence=HarnessActorConfidence.DERIVED,
        label=state.agent_labels.get(tool_use_id) or helper_label(state, tool_use_id),
    )


def helper_label(state: ClaudeRunState, tool_use_id: str) -> str:
    existing = state.agent_labels.get(tool_use_id)
    if existing is not None:
        return existing
    label = f"Helper {len(state.agent_labels) + 1}"
    state.agent_labels[tool_use_id] = label
    return label


def session_id_for_message(message: ClaudeMessage) -> str | None:
    if isinstance(message, AssistantMessage):
        return message.session_id
    if isinstance(message, ResultMessage):
        return message.session_id
    if isinstance(message, StreamEvent | RateLimitEvent):
        return message.session_id
    if isinstance(
        message,
        TaskStartedMessage
        | TaskProgressMessage
        | TaskNotificationMessage,
    ):
        return message.session_id
    if isinstance(message, TaskUpdatedMessage):
        return message.session_id
    if isinstance(message, SystemMessage):
        value = message.data.get("session_id")
        return value if isinstance(value, str) else None
    return None


def text_delta_from_stream_event(event: Mapping[str, object]) -> str | None:
    if event.get("type") != "content_block_delta":
        return None
    delta = event.get("delta")
    if not isinstance(delta, Mapping):
        return None
    if delta.get("type") != "text_delta":
        return None
    text = delta.get("text")
    return text if isinstance(text, str) else None


def agent_prompt(tool_input: Mapping[str, object]) -> str | None:
    return string_field(tool_input, "prompt") or string_field(tool_input, "description")


def tool_result_message(content: object) -> str:
    if isinstance(content, str) and content != "":
        return first_line(content)
    if content is None:
        return "Tool completed"
    return "Tool completed"


def raw_message(message: object) -> JsonValue:
    return json_value(message)


def raw_block(block: object) -> JsonValue:
    return json_value(block)


# Raw provider payloads are intentionally opaque external passthrough. Convert
# them to JSON-compatible values before attaching them to HarnessEvent.raw.
def json_value(value: object) -> JsonValue:
    if value is None:
        return None
    if isinstance(value, str | int | float | bool):
        return value
    if is_dataclass(value) and not isinstance(value, type):
        return json_value(asdict(value))
    if isinstance(value, Mapping):
        return {str(key): json_value(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [json_value(item) for item in value]
    return str(value)
