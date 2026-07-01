from codealmanac.integrations.harnesses.codex.actors import actor_for_codex_thread
from codealmanac.integrations.harnesses.codex.failures import (
    failure_from_error_record,
)
from codealmanac.integrations.harnesses.codex.fields import (
    JsonObject,
    as_record,
    string_field,
)
from codealmanac.integrations.harnesses.codex.item_events import (
    map_completed_item,
    map_started_item,
    output_delta,
)
from codealmanac.integrations.harnesses.codex.result import (
    done_event,
    map_turn_completed,
    map_usage_updated,
    provider_session_event,
    record_failure,
)
from codealmanac.integrations.harnesses.codex.state import CodexRunState
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessEventKind,
    HarnessRunActor,
)

__all__ = (
    "CodexRunState",
    "done_event",
    "map_codex_notification",
    "provider_session_event",
)


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
        summary = plan_summary(params)
        if summary is None:
            return ()
        return (
            HarnessEvent(
                kind=HarnessEventKind.TOOL_SUMMARY,
                message=summary,
                actor=actor,
                raw=notification,
            ),
        )

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

    if method in {
        "item/commandExecution/outputDelta",
        "command/exec/outputDelta",
        "item/fileChange/outputDelta",
    }:
        delta = output_delta(params)
        if delta is None or delta.strip() == "":
            return ()
        return (
            HarnessEvent(
                kind=HarnessEventKind.TOOL_SUMMARY,
                message=delta.strip(),
                actor=actor,
                raw=notification,
            ),
        )

    if method == "turn/completed":
        return map_turn_completed(
            params,
            state,
            actor,
            is_root_completion,
            notification,
        )

    if method == "warning":
        message = string_field(params, "message") or "Codex warning"
        return (
            HarnessEvent(
                kind=HarnessEventKind.TOOL_SUMMARY,
                message=f"Warning: {message}",
                actor=actor,
                raw=notification,
            ),
        )

    if method == "error":
        error = as_record(params.get("error"))
        failure = failure_from_error_record(error or params)
        record_failure(state, failure)
        return (
            HarnessEvent(
                kind=HarnessEventKind.ERROR,
                message=failure.message,
                actor=actor,
                failure=failure,
                raw=notification,
            ),
        )

    return ()


def text_delta_event(
    notification: JsonObject,
    params: JsonObject,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
    delta = string_field(params, "delta")
    if delta is None:
        return ()
    return (
        HarnessEvent(
            kind=HarnessEventKind.TEXT_DELTA,
            message=delta,
            actor=actor,
            raw=notification,
        ),
    )


def plan_delta_event(
    notification: JsonObject,
    params: JsonObject,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
    delta = string_field(params, "delta")
    if delta is None:
        return ()
    return (
        HarnessEvent(
            kind=HarnessEventKind.TOOL_SUMMARY,
            message=delta,
            actor=actor,
            raw=notification,
        ),
    )


def plan_summary(params: JsonObject) -> str | None:
    parts: list[str] = []
    explanation = string_field(params, "explanation")
    if explanation is not None:
        parts.append(explanation)
    plan = params.get("plan")
    if isinstance(plan, list):
        for item in plan:
            step = string_field(as_record(item), "step")
            if step is not None:
                parts.append(step)
    if len(parts) == 0:
        return None
    return " | ".join(parts)
