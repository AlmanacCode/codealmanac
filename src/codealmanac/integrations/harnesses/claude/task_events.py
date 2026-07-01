from claude_agent_sdk import (
    TaskNotificationMessage,
    TaskProgressMessage,
    TaskStartedMessage,
    TaskUpdatedMessage,
)

from codealmanac.integrations.harnesses.claude.actors import (
    actor_for_helper,
    helper_label,
)
from codealmanac.integrations.harnesses.claude.failures import (
    classify_claude_failure,
)
from codealmanac.integrations.harnesses.claude.raw import raw_message
from codealmanac.integrations.harnesses.claude.state import ClaudeRunState
from codealmanac.services.harnesses.models import (
    HarnessAgentTrace,
    HarnessEvent,
    HarnessEventKind,
    HarnessRunActor,
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
