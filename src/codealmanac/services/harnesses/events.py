from enum import StrEnum

from pydantic import JsonValue, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.harnesses.actors import HarnessActorRole, HarnessRunActor
from codealmanac.services.harnesses.kinds import HarnessKind, HarnessRunStatus


class HarnessEventKind(StrEnum):
    TEXT_DELTA = "text_delta"
    TEXT = "text"
    TOOL_USE = "tool_use"
    TOOL_RESULT = "tool_result"
    TOOL_SUMMARY = "tool_summary"
    TOOL_REQUEST = "tool_request"
    APPROVAL_REQUEST = "approval_request"
    USER_INPUT_REQUEST = "user_input_request"
    REQUEST_RESOLVED = "request_resolved"
    CONTEXT_USAGE = "context_usage"
    PROVIDER_SESSION = "provider_session"
    WARNING = "warning"
    ERROR = "error"
    DONE = "done"
    HOOK = "hook"
    RATE_LIMIT = "rate_limit"
    GOAL_UPDATED = "goal_updated"
    GOAL_CLEARED = "goal_cleared"
    STREAM_EVENT = "stream_event"
    UNKNOWN = "unknown"
    AGENT_SPAWNED = "agent_spawned"
    AGENT_WAIT_STARTED = "agent_wait_started"
    AGENT_COMPLETED = "agent_completed"


class HarnessToolDisplayKind(StrEnum):
    READ = "read"
    WRITE = "write"
    EDIT = "edit"
    SEARCH = "search"
    SHELL = "shell"
    MCP = "mcp"
    WEB = "web"
    AGENT = "agent"
    IMAGE = "image"
    UNKNOWN = "unknown"


class HarnessToolStatus(StrEnum):
    STARTED = "started"
    COMPLETED = "completed"
    FAILED = "failed"
    DECLINED = "declined"


class HarnessUsage(CodeAlmanacModel):
    input_tokens: int | None = None
    cache_creation_input_tokens: int | None = None
    cached_input_tokens: int | None = None
    output_tokens: int | None = None
    reasoning_output_tokens: int | None = None
    total_tokens: int | None = None
    total_processed_tokens: int | None = None
    max_tokens: int | None = None

    @field_validator(
        "input_tokens",
        "cache_creation_input_tokens",
        "cached_input_tokens",
        "output_tokens",
        "reasoning_output_tokens",
        "total_tokens",
        "total_processed_tokens",
        "max_tokens",
    )
    @classmethod
    def non_negative_count(cls, value: int | None) -> int | None:
        if value is not None and value < 0:
            raise ValueError("harness usage counts must be non-negative")
        return value


class HarnessFailure(CodeAlmanacModel):
    provider: HarnessKind
    message: str
    fix: str | None = None
    code: str | None = None
    raw: str | None = None
    details: dict[str, JsonValue] | None = None

    @field_validator("message")
    @classmethod
    def require_message(cls, value: str) -> str:
        return required_text(value, "harness failure message")

    @field_validator("fix", "code", "raw")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "harness failure text")


class HarnessToolDisplay(CodeAlmanacModel):
    kind: HarnessToolDisplayKind | None = None
    title: str | None = None
    path: str | None = None
    command: str | None = None
    cwd: str | None = None
    status: HarnessToolStatus | None = None
    exit_code: int | None = None
    duration_ms: int | None = None
    summary: str | None = None
    provider_thread_id: str | None = None
    provider_turn_id: str | None = None

    @field_validator(
        "title",
        "path",
        "command",
        "cwd",
        "summary",
        "provider_thread_id",
        "provider_turn_id",
    )
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "harness tool display text")

    @field_validator("duration_ms")
    @classmethod
    def non_negative_duration(cls, value: int | None) -> int | None:
        if value is not None and value < 0:
            raise ValueError("harness tool duration must be non-negative")
        return value


class HarnessAgentTrace(CodeAlmanacModel):
    parent_thread_id: str | None = None
    child_thread_id: str | None = None
    child_thread_ids: tuple[str, ...] = ()
    prompt: str | None = None
    model: str | None = None
    reasoning_effort: str | None = None
    result: str | None = None

    @field_validator(
        "parent_thread_id",
        "child_thread_id",
        "prompt",
        "model",
        "reasoning_effort",
        "result",
    )
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "harness agent trace text")

    @field_validator("child_thread_ids")
    @classmethod
    def require_child_thread_ids(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        for item in value:
            required_text(item, "harness child thread id")
        return value


class HarnessEvent(CodeAlmanacModel):
    kind: HarnessEventKind
    message: str
    status: HarnessRunStatus | None = None
    actor: HarnessRunActor | None = None
    tool_id: str | None = None
    tool_name: str | None = None
    tool_input: str | None = None
    tool_display: HarnessToolDisplay | None = None
    tool_result: JsonValue | None = None
    tool_is_error: bool | None = None
    usage: HarnessUsage | None = None
    provider_session_id: str | None = None
    provider_event_id: str | None = None
    provider_parent_tool_use_id: str | None = None
    source_thread_id: str | None = None
    source_turn_id: str | None = None
    source_role: HarnessActorRole | None = None
    failure: HarnessFailure | None = None
    agent_trace: HarnessAgentTrace | None = None
    raw: JsonValue | None = None

    @field_validator("message")
    @classmethod
    def require_message(cls, value: str) -> str:
        return required_text(value, "harness event message")

    @field_validator(
        "tool_id",
        "tool_name",
        "tool_input",
        "provider_session_id",
        "provider_event_id",
        "provider_parent_tool_use_id",
        "source_thread_id",
        "source_turn_id",
    )
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "harness event text")
