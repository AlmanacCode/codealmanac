from codealmanac.integrations.harnesses.opencode.failures import (
    classify_opencode_failure,
)
from codealmanac.integrations.harnesses.opencode.state import OpencodeRunState
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessEventKind,
    HarnessKind,
    HarnessRunResult,
    HarnessRunStatus,
)


def result_from_state(
    state: OpencodeRunState,
    events: list[HarnessEvent],
) -> HarnessRunResult:
    succeeded = state.success and state.failure is None
    output_text = state.result or state.error or "opencode completed"
    return HarnessRunResult(
        kind=HarnessKind.OPENCODE,
        status=HarnessRunStatus.SUCCEEDED if succeeded else HarnessRunStatus.FAILED,
        output_text=output_text,
        summary=output_text.splitlines()[0],
        events=tuple(events),
    )


def failed_result(message: str) -> HarnessRunResult:
    failure = classify_opencode_failure(message)
    event = HarnessEvent(
        kind=HarnessEventKind.ERROR,
        message=failure.message,
        failure=failure,
    )
    return HarnessRunResult(
        kind=HarnessKind.OPENCODE,
        status=HarnessRunStatus.FAILED,
        output_text=failure.message,
        summary=failure.message,
        events=(event,),
    )


def done_event(state: OpencodeRunState) -> HarnessEvent:
    status = "succeeded" if state.failure is None else "failed"
    result = state.result or state.error or "opencode completed"
    return HarnessEvent(
        kind=HarnessEventKind.DONE,
        message=f"opencode {status}: {result.splitlines()[0]}",
        provider_session_id=state.provider_session_id,
        usage=state.usage,
        failure=state.failure,
        source_thread_id=state.result_source_thread_id,
        source_role=state.result_source_role,
    )


def provider_session_event(session_id: str) -> HarnessEvent:
    return HarnessEvent(
        kind=HarnessEventKind.PROVIDER_SESSION,
        message=f"opencode provider session {session_id}",
        provider_session_id=session_id,
    )
