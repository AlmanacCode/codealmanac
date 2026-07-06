from codealmanac.integrations.harnesses.codex.failures import (
    failure_from_error_record,
)
from codealmanac.integrations.harnesses.codex.fields import (
    JsonObject,
    as_record,
    string_field,
)
from codealmanac.integrations.harnesses.codex.item_events import output_delta
from codealmanac.integrations.harnesses.codex.result import record_failure
from codealmanac.integrations.harnesses.codex.state import CodexRunState
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessEventKind,
    HarnessRunActor,
)


def text_delta_event(
    notification: JsonObject,
    params: JsonObject,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
    delta = string_field(params, "delta")
    if delta is None or delta.strip() == "":
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
    if delta is None or delta.strip() == "":
        return ()
    return (
        HarnessEvent(
            kind=HarnessEventKind.TOOL_SUMMARY,
            message=delta,
            actor=actor,
            raw=notification,
        ),
    )


def plan_updated_event(
    notification: JsonObject,
    params: JsonObject,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
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


def output_delta_event(
    notification: JsonObject,
    params: JsonObject,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
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


def warning_event(
    notification: JsonObject,
    params: JsonObject,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
    message = string_field(params, "message") or "Codex warning"
    return (
        HarnessEvent(
            kind=HarnessEventKind.TOOL_SUMMARY,
            message=f"Warning: {message}",
            actor=actor,
            raw=notification,
        ),
    )


def error_event(
    notification: JsonObject,
    params: JsonObject,
    state: CodexRunState,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
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
