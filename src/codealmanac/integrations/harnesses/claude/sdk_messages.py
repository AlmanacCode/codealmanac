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

ClaudeMessage = (
    AssistantMessage
    | UserMessage
    | SystemMessage
    | ResultMessage
    | StreamEvent
    | RateLimitEvent
    | TaskStartedMessage
    | TaskProgressMessage
    | TaskUpdatedMessage
    | TaskNotificationMessage
)


def session_id_for_message(message: ClaudeMessage) -> str | None:
    if isinstance(message, AssistantMessage):
        return message.session_id
    if isinstance(message, ResultMessage):
        return message.session_id
    if isinstance(message, StreamEvent | RateLimitEvent):
        return message.session_id
    if isinstance(
        message,
        TaskStartedMessage | TaskProgressMessage | TaskNotificationMessage,
    ):
        return message.session_id
    if isinstance(message, TaskUpdatedMessage):
        return message.session_id
    if isinstance(message, SystemMessage):
        value = message.data.get("session_id")
        return value if isinstance(value, str) else None
    return None
