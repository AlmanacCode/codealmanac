from codealmanac.integrations.harnesses.codex.failures import classify_codex_failure
from codealmanac.integrations.harnesses.codex.fields import (
    JsonObject,
    as_record,
    compact_json,
    first_present,
    number_field,
    string_field,
)
from codealmanac.integrations.harnesses.codex.state import CodexRunState
from codealmanac.integrations.harnesses.codex.usage import (
    parse_codex_app_server_usage,
)
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessEventKind,
    HarnessFailure,
    HarnessRunActor,
    HarnessUsage,
)


def map_turn_completed(
    params: JsonObject,
    state: CodexRunState,
    actor: HarnessRunActor,
    is_root_completion: bool | None,
    notification: JsonObject,
) -> tuple[HarnessEvent, ...]:
    turn = as_record(params.get("turn"))
    error = as_record(turn.get("error"))
    error_message = string_field(error, "message")
    if error_message is not None:
        failure = classify_codex_failure(
            error_message,
            first_present(
                number_field(error, "statusCode"),
                number_field(error, "code"),
            ),
            error,
        )
        if is_root_completion is not False:
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
    if is_root_completion is not False:
        state.success = True
        state.turns = 1
    return ()


def record_failure(state: CodexRunState, failure: HarnessFailure) -> None:
    state.success = False
    state.error = failure.message
    state.failure = failure


def done_event(state: CodexRunState) -> HarnessEvent:
    status = "succeeded" if state.failure is None else "failed"
    result = state.result or state.error or "codex completed"
    return HarnessEvent(
        kind=HarnessEventKind.DONE,
        message=f"codex {status}: {result.splitlines()[0]}",
        provider_session_id=state.provider_session_id,
        usage=state.usage,
        failure=state.failure,
        source_thread_id=state.result_source_thread_id,
        source_turn_id=state.result_source_turn_id,
        source_role=state.result_source_role,
    )


def provider_session_event(thread_id: str) -> HarnessEvent:
    return HarnessEvent(
        kind=HarnessEventKind.PROVIDER_SESSION,
        message=f"codex provider session {thread_id}",
        provider_session_id=thread_id,
    )


def map_usage_updated(
    params: JsonObject,
    state: CodexRunState,
    actor: HarnessRunActor,
    notification: JsonObject,
) -> tuple[HarnessEvent, ...]:
    usage = parse_codex_app_server_usage(params.get("tokenUsage"))
    if usage is None:
        return ()
    state.usage = usage
    return (
        HarnessEvent(
            kind=HarnessEventKind.CONTEXT_USAGE,
            message=usage_message(usage),
            actor=actor,
            usage=usage,
            raw=notification,
        ),
    )


def usage_message(usage: HarnessUsage) -> str:
    if usage.total_tokens is not None:
        return f"usage: {usage.total_tokens} tokens"
    return f"usage: {compact_json(usage.model_dump(mode='json', exclude_none=True))}"
