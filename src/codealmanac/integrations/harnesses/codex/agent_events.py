from codealmanac.integrations.harnesses.codex.actors import helper_label
from codealmanac.integrations.harnesses.codex.state import CodexRunState
from codealmanac.integrations.harnesses.fields import (
    JsonObject,
    string_array_field,
    string_field,
)
from codealmanac.services.harnesses.models import (
    HarnessAgentTrace,
    HarnessEvent,
    HarnessEventKind,
    HarnessRunActor,
)


def helper_agent_events(
    state: CodexRunState,
    item: JsonObject,
    actor: HarnessRunActor,
    phase: str,
) -> tuple[HarnessEvent, ...]:
    if string_field(item, "type") != "collabAgentToolCall":
        return ()
    tool = string_field(item, "tool")
    sender_thread_id = string_field(item, "senderThreadId") or actor.thread_id
    receiver_thread_ids = string_array_field(item, "receiverThreadIds")
    if tool == "spawnAgent" and phase == "completed":
        events: list[HarnessEvent] = []
        for child_thread_id in receiver_thread_ids:
            state.agent_parents[child_thread_id] = sender_thread_id
            state.agent_labels[child_thread_id] = helper_label(state, child_thread_id)
            prompt = string_field(item, "prompt") or ""
            events.append(
                HarnessEvent(
                    kind=HarnessEventKind.AGENT_SPAWNED,
                    message=f"spawned {state.agent_labels[child_thread_id]}",
                    actor=actor,
                    agent_trace=HarnessAgentTrace(
                        parent_thread_id=sender_thread_id,
                        child_thread_id=child_thread_id,
                        prompt=prompt,
                        model=string_field(item, "model"),
                        reasoning_effort=string_field(item, "reasoningEffort"),
                    ),
                )
            )
        return tuple(events)
    if tool == "wait" and phase == "started":
        return (
            HarnessEvent(
                kind=HarnessEventKind.AGENT_WAIT_STARTED,
                message="waiting for helper agents",
                actor=actor,
                agent_trace=HarnessAgentTrace(
                    parent_thread_id=sender_thread_id,
                    child_thread_ids=receiver_thread_ids,
                ),
            ),
        )
    return ()
