from claude_agent_sdk import (
    AssistantMessage,
    RateLimitEvent,
    ResultMessage,
    StreamEvent,
    SystemMessage,
    TaskNotificationMessage,
    TaskProgressMessage,
    TaskStartedMessage,
    TaskUpdatedMessage,
    UserMessage,
)

from codealmanac.integrations.harnesses.claude.actors import actor_for_message
from codealmanac.integrations.harnesses.claude.message_events import (
    assistant_events,
    result_events,
    user_events,
)
from codealmanac.integrations.harnesses.claude.raw import raw_message
from codealmanac.integrations.harnesses.claude.result import (
    done_event,
    provider_session_event,
    record_result,
    result_from_state,
)
from codealmanac.integrations.harnesses.claude.sdk_messages import (
    ClaudeMessage,
    session_id_for_message,
)
from codealmanac.integrations.harnesses.claude.state import ClaudeRunState
from codealmanac.integrations.harnesses.claude.stream import stream_event
from codealmanac.integrations.harnesses.claude.task_events import (
    task_notification_events,
    task_progress_events,
    task_started_events,
    task_updated_events,
)
from codealmanac.services.harnesses.models import HarnessEvent, HarnessEventKind

__all__ = (
    "ClaudeMessage",
    "ClaudeRunState",
    "done_event",
    "map_claude_message",
    "provider_session_event",
    "result_from_state",
    "session_id_for_message",
)


def map_claude_message(
    message: ClaudeMessage,
    state: ClaudeRunState,
) -> tuple[HarnessEvent, ...]:
    state.note_session_id(session_id_for_message(message))
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
