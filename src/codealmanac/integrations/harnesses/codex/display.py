from codealmanac.integrations.harnesses.fields import (
    JsonObject,
    as_record,
    number_field,
    string_field,
    stringify_json_value,
)
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessEventKind,
    HarnessRunActor,
    HarnessToolDisplay,
    HarnessToolDisplayKind,
    HarnessToolStatus,
)


def tool_use_event(
    item: JsonObject,
    status: HarnessToolStatus,
    actor: HarnessRunActor,
    thread_id: str | None,
    turn_id: str | None,
) -> HarnessEvent | None:
    display = codex_item_display(item, status, thread_id, turn_id)
    if display is None:
        return None
    return HarnessEvent(
        kind=HarnessEventKind.TOOL_USE,
        message=display.title or item_type_tool_name(item),
        actor=actor,
        tool_id=string_field(item, "id"),
        tool_name=item_type_tool_name(item),
        tool_input=stringify_json_value(item),
        tool_display=display,
    )


def codex_item_display(
    item: JsonObject,
    fallback_status: HarnessToolStatus,
    thread_id: str | None,
    turn_id: str | None,
) -> HarnessToolDisplay | None:
    item_type = string_field(item, "type")
    if item_type == "commandExecution":
        return command_execution_display(item, fallback_status, thread_id, turn_id)
    if item_type == "fileChange":
        return HarnessToolDisplay(
            kind=HarnessToolDisplayKind.EDIT,
            title="Editing file",
            status=item_status(item, fallback_status),
            duration_ms=number_field(item, "durationMs"),
            provider_thread_id=thread_id,
            provider_turn_id=turn_id,
        )
    if item_type == "mcpToolCall":
        return HarnessToolDisplay(
            kind=HarnessToolDisplayKind.MCP,
            title=f"MCP {string_field(item, 'tool') or 'tool'}",
            status=item_status(item, fallback_status),
            provider_thread_id=thread_id,
            provider_turn_id=turn_id,
        )
    if item_type == "dynamicToolCall":
        tool = string_field(item, "tool") or "Tool"
        return HarnessToolDisplay(
            kind=infer_tool_kind(tool),
            title=tool_title(tool),
            status=item_status(item, fallback_status),
            provider_thread_id=thread_id,
            provider_turn_id=turn_id,
        )
    if item_type == "webSearch":
        return HarnessToolDisplay(
            kind=HarnessToolDisplayKind.WEB,
            title="Web search",
            summary=string_field(item, "query"),
            status=item_status(item, fallback_status),
            provider_thread_id=thread_id,
            provider_turn_id=turn_id,
        )
    if item_type == "imageView":
        return HarnessToolDisplay(
            kind=HarnessToolDisplayKind.IMAGE,
            title="Viewing image",
            path=string_field(item, "path"),
            status=item_status(item, fallback_status),
            provider_thread_id=thread_id,
            provider_turn_id=turn_id,
        )
    if item_type == "collabAgentToolCall":
        return HarnessToolDisplay(
            kind=HarnessToolDisplayKind.AGENT,
            title=f"Agent {string_field(item, 'tool') or 'tool'}",
            status=item_status(item, fallback_status),
            provider_thread_id=thread_id,
            provider_turn_id=turn_id,
        )
    return None


def command_execution_display(
    item: JsonObject,
    fallback_status: HarnessToolStatus,
    thread_id: str | None,
    turn_id: str | None,
) -> HarnessToolDisplay:
    action = first_command_action(item)
    action_type = string_field(action, "type")
    if action_type == "read":
        kind = HarnessToolDisplayKind.READ
        title = "Reading file"
    elif action_type in {"listFiles", "search"}:
        kind = HarnessToolDisplayKind.SEARCH
        title = "Searching"
    else:
        kind = HarnessToolDisplayKind.SHELL
        title = "Running command"
    return HarnessToolDisplay(
        kind=kind,
        title=title,
        path=string_field(action, "path"),
        command=string_field(item, "command"),
        cwd=string_field(item, "cwd"),
        status=item_status(item, fallback_status),
        exit_code=number_field(item, "exitCode"),
        duration_ms=number_field(item, "durationMs"),
        provider_thread_id=thread_id,
        provider_turn_id=turn_id,
    )


def first_command_action(item: JsonObject) -> JsonObject:
    actions = item.get("commandActions")
    if isinstance(actions, list) and actions:
        return as_record(actions[0])
    return {}


def item_status(item: JsonObject, fallback: HarnessToolStatus) -> HarnessToolStatus:
    status = string_field(item, "status")
    if status == "completed":
        return HarnessToolStatus.COMPLETED
    if status == "failed":
        return HarnessToolStatus.FAILED
    if status == "declined":
        return HarnessToolStatus.DECLINED
    return fallback


def infer_tool_kind(tool: str) -> HarnessToolDisplayKind:
    normalized = tool.lower()
    if "read" in normalized:
        return HarnessToolDisplayKind.READ
    if "write" in normalized:
        return HarnessToolDisplayKind.WRITE
    if "edit" in normalized or "patch" in normalized:
        return HarnessToolDisplayKind.EDIT
    if "search" in normalized or "find" in normalized:
        return HarnessToolDisplayKind.SEARCH
    if "bash" in normalized or "shell" in normalized:
        return HarnessToolDisplayKind.SHELL
    if "agent" in normalized:
        return HarnessToolDisplayKind.AGENT
    return HarnessToolDisplayKind.UNKNOWN


def tool_title(tool: str) -> str:
    kind = infer_tool_kind(tool)
    if kind == HarnessToolDisplayKind.READ:
        return "Reading file"
    if kind == HarnessToolDisplayKind.WRITE:
        return "Writing file"
    if kind == HarnessToolDisplayKind.EDIT:
        return "Editing file"
    if kind == HarnessToolDisplayKind.SEARCH:
        return "Searching"
    if kind == HarnessToolDisplayKind.SHELL:
        return "Running command"
    if kind == HarnessToolDisplayKind.AGENT:
        return "Agent tool"
    return tool


def item_type_tool_name(item: JsonObject) -> str:
    return string_field(item, "type") or "tool"
