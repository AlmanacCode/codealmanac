from codealmanac.integrations.harnesses.codex.actors import actor_for_codex_thread
from codealmanac.integrations.harnesses.codex.fields import (
    JsonObject,
    as_record,
    string_field,
)
from codealmanac.integrations.harnesses.codex.item_events import (
    map_completed_item,
    map_started_item,
)
from codealmanac.integrations.harnesses.codex.notification_events import (
    error_event,
    output_delta_event,
    plan_delta_event,
    plan_updated_event,
    text_delta_event,
    warning_event,
)
from codealmanac.integrations.harnesses.codex.result import (
    done_event,
    map_turn_completed,
    map_usage_updated,
    provider_session_event,
)
from codealmanac.integrations.harnesses.codex.state import CodexRunState
from codealmanac.services.harnesses.models import (
    HarnessEvent,
)

__all__ = (
    "CodexRunState",
    "done_event",
    "map_codex_notification",
    "provider_session_event",
)

OUTPUT_DELTA_METHODS = {
    "item/commandExecution/outputDelta",
    "command/exec/outputDelta",
    "item/fileChange/outputDelta",
}


def map_codex_notification(
    notification: JsonObject,
    state: CodexRunState,
    is_root_completion: bool | None = None,
) -> tuple[HarnessEvent, ...]:
    method = string_field(notification, "method")
    params = as_record(notification.get("params"))
    thread_id = string_field(params, "threadId")
    turn_id = string_field(params, "turnId")
    actor = actor_for_codex_thread(state, thread_id)
    if state.provider_session_id is None and thread_id is not None:
        state.provider_session_id = thread_id

    if method == "item/agentMessage/delta":
        return text_delta_event(notification, params, actor)

    if method == "item/plan/delta":
        return plan_delta_event(notification, params, actor)

    if method == "turn/plan/updated":
        return plan_updated_event(notification, params, actor)

    if method == "thread/tokenUsage/updated":
        return map_usage_updated(params, state, actor, notification)

    if method == "item/started":
        return map_started_item(params, state, actor, thread_id, turn_id)

    if method == "item/completed":
        return map_completed_item(
            params,
            state,
            actor,
            thread_id,
            turn_id,
            notification,
        )

    if method in OUTPUT_DELTA_METHODS:
        return output_delta_event(notification, params, actor)

    if method == "turn/completed":
        return map_turn_completed(
            params,
            state,
            actor,
            is_root_completion,
            notification,
        )

    if method == "warning":
        return warning_event(notification, params, actor)

    if method == "error":
        return error_event(notification, params, state, actor)

    return ()
