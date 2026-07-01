from claude_agent_sdk import ResultMessage
from pydantic import JsonValue

from codealmanac.integrations.command import first_line
from codealmanac.integrations.harnesses.claude.actors import root_claude_actor
from codealmanac.integrations.harnesses.claude.failures import (
    classify_claude_failure,
)
from codealmanac.integrations.harnesses.claude.state import ClaudeRunState
from codealmanac.integrations.harnesses.claude.usage import parse_claude_usage
from codealmanac.services.harnesses.models import (
    HarnessActorRole,
    HarnessEvent,
    HarnessEventKind,
    HarnessKind,
    HarnessRunActor,
    HarnessRunResult,
    HarnessRunStatus,
    HarnessTranscriptRef,
    HarnessUsage,
)


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
