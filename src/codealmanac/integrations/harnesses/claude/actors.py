from claude_agent_sdk import (
    AssistantMessage,
    RateLimitEvent,
    ResultMessage,
    StreamEvent,
    TaskNotificationMessage,
    TaskProgressMessage,
    TaskStartedMessage,
    TaskUpdatedMessage,
    UserMessage,
)

from codealmanac.integrations.harnesses.claude.sdk_messages import (
    ClaudeMessage,
    session_id_for_message,
)
from codealmanac.integrations.harnesses.claude.state import ClaudeRunState
from codealmanac.services.harnesses.models import (
    HarnessActorConfidence,
    HarnessActorRole,
    HarnessRunActor,
)


def actor_for_message(
    message: ClaudeMessage,
    state: ClaudeRunState,
) -> HarnessRunActor:
    if isinstance(message, AssistantMessage):
        return actor_for_parent(state, message.session_id, message.parent_tool_use_id)
    if isinstance(message, UserMessage):
        return actor_for_parent(state, None, message.parent_tool_use_id)
    if isinstance(message, StreamEvent):
        return actor_for_parent(
            state,
            message.session_id,
            message.parent_tool_use_id,
        )
    if isinstance(
        message,
        TaskStartedMessage
        | TaskProgressMessage
        | TaskNotificationMessage,
    ):
        return actor_for_parent(state, message.session_id, message.tool_use_id)
    if isinstance(message, TaskUpdatedMessage):
        return root_claude_actor(state.provider_session_id)
    if isinstance(message, ResultMessage | RateLimitEvent):
        return root_claude_actor(
            session_id_for_message(message) or state.provider_session_id
        )
    return root_claude_actor(state.provider_session_id)


def actor_for_parent(
    state: ClaudeRunState,
    session_id: str | None,
    parent_tool_use_id: str | None,
) -> HarnessRunActor:
    state.note_session_id(session_id)
    if parent_tool_use_id is None or parent_tool_use_id == "":
        return root_claude_actor(state.provider_session_id)
    state.agent_parents[parent_tool_use_id] = (
        state.agent_parents.get(parent_tool_use_id) or state.provider_session_id
    )
    state.agent_labels[parent_tool_use_id] = helper_label(state, parent_tool_use_id)
    return actor_for_helper(state, parent_tool_use_id)


def root_claude_actor(session_id: str | None) -> HarnessRunActor:
    return HarnessRunActor(
        thread_id=session_id,
        role=HarnessActorRole.ROOT
        if session_id is not None
        else HarnessActorRole.UNKNOWN,
        confidence=HarnessActorConfidence.PROVIDER
        if session_id is not None
        else HarnessActorConfidence.UNKNOWN,
        label="Main" if session_id is not None else "Unknown actor",
    )


def actor_for_helper(
    state: ClaudeRunState,
    tool_use_id: str,
) -> HarnessRunActor:
    return HarnessRunActor(
        thread_id=tool_use_id,
        role=HarnessActorRole.HELPER,
        parent_thread_id=state.agent_parents.get(tool_use_id)
        or state.provider_session_id,
        confidence=HarnessActorConfidence.DERIVED,
        label=state.agent_labels.get(tool_use_id) or helper_label(state, tool_use_id),
    )


def helper_label(state: ClaudeRunState, tool_use_id: str) -> str:
    existing = state.agent_labels.get(tool_use_id)
    if existing is not None:
        return existing
    label = f"Helper {len(state.agent_labels) + 1}"
    state.agent_labels[tool_use_id] = label
    return label
