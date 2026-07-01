import base64
import binascii

from codealmanac.integrations.harnesses.codex.agent_events import lifecycle_events
from codealmanac.integrations.harnesses.codex.display import (
    codex_item_display,
    item_type_tool_name,
    tool_use_event,
)
from codealmanac.integrations.harnesses.codex.fields import (
    JsonObject,
    as_record,
    boolean_field,
    first_present,
    string_field,
)
from codealmanac.integrations.harnesses.codex.state import CodexRunState
from codealmanac.services.harnesses.models import (
    HarnessActorRole,
    HarnessAgentTrace,
    HarnessEvent,
    HarnessEventKind,
    HarnessRunActor,
    HarnessToolStatus,
)


def map_started_item(
    params: JsonObject,
    state: CodexRunState,
    actor: HarnessRunActor,
    thread_id: str | None,
    turn_id: str | None,
) -> tuple[HarnessEvent, ...]:
    item = as_record(params.get("item"))
    events = [
        tool_use_event(
            item,
            HarnessToolStatus.STARTED,
            actor,
            thread_id,
            turn_id,
        )
    ]
    events.extend(lifecycle_events(state, item, actor, "started"))
    return tuple(event for event in events if event is not None)


def map_completed_item(
    params: JsonObject,
    state: CodexRunState,
    actor: HarnessRunActor,
    thread_id: str | None,
    turn_id: str | None,
    notification: JsonObject,
) -> tuple[HarnessEvent, ...]:
    item = as_record(params.get("item"))
    if string_field(item, "type") == "agentMessage":
        return map_agent_message(item, state, actor, thread_id, turn_id, notification)

    display = codex_item_display(
        item,
        HarnessToolStatus.COMPLETED,
        thread_id,
        turn_id,
    )
    if display is None:
        return ()
    result_content = first_present(
        item.get("aggregatedOutput"),
        item.get("result"),
        item.get("error"),
    )
    is_error = display.status == HarnessToolStatus.FAILED or boolean_field(
        item, "success"
    ) is False
    events = [
        HarnessEvent(
            kind=HarnessEventKind.TOOL_RESULT,
            message=display.title or "Tool completed",
            actor=actor,
            tool_id=string_field(item, "id"),
            tool_name=item_type_tool_name(item),
            tool_display=display,
            tool_result=result_content,
            tool_is_error=is_error,
            raw=notification,
        )
    ]
    events.extend(lifecycle_events(state, item, actor, "completed"))
    return tuple(events)


def map_agent_message(
    item: JsonObject,
    state: CodexRunState,
    actor: HarnessRunActor,
    thread_id: str | None,
    turn_id: str | None,
    notification: JsonObject,
) -> tuple[HarnessEvent, ...]:
    text = string_field(item, "text")
    if text is None:
        return ()
    if actor.role == HarnessActorRole.ROOT:
        state.result = text
        state.result_source_thread_id = thread_id
        state.result_source_turn_id = turn_id
        state.result_source_role = actor.role
    events = [
        HarnessEvent(
            kind=HarnessEventKind.TEXT,
            message=text,
            actor=actor,
            raw=notification,
        )
    ]
    if actor.role == HarnessActorRole.HELPER and thread_id is not None:
        state.completed_agents.add(thread_id)
        events.append(
            HarnessEvent(
                kind=HarnessEventKind.AGENT_COMPLETED,
                message=text,
                actor=actor,
                agent_trace=HarnessAgentTrace(
                    parent_thread_id=state.agent_parents.get(thread_id),
                    child_thread_id=thread_id,
                    result=text,
                ),
                raw=notification,
            )
        )
    return tuple(events)


def output_delta(params: JsonObject) -> str | None:
    delta = string_field(params, "delta")
    if delta is not None:
        return delta
    encoded = string_field(params, "deltaBase64")
    if encoded is None:
        return None
    try:
        return base64.b64decode(encoded).decode("utf-8", errors="replace")
    except (binascii.Error, ValueError):
        return encoded
