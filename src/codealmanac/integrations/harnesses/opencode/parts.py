from codealmanac.integrations.harnesses.fields import (
    JsonObject,
    as_record,
    number_field,
    string_field,
    stringify_json_value,
)
from codealmanac.integrations.harnesses.opencode.usage import parse_opencode_usage
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessEventKind,
    HarnessRunActor,
    HarnessToolDisplay,
    HarnessToolDisplayKind,
    HarnessToolStatus,
    HarnessUsage,
)

_TOOL_TITLES = {
    HarnessToolDisplayKind.READ: "Reading file",
    HarnessToolDisplayKind.WRITE: "Writing file",
    HarnessToolDisplayKind.EDIT: "Editing file",
    HarnessToolDisplayKind.SEARCH: "Searching",
    HarnessToolDisplayKind.SHELL: "Running command",
    HarnessToolDisplayKind.WEB: "Web request",
    HarnessToolDisplayKind.AGENT: "Agent tool",
}


def map_opencode_part(
    part: JsonObject,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
    part_type = string_field(part, "type")
    if part_type == "text":
        return text_events(part, actor)
    if part_type == "reasoning":
        return reasoning_events(part, actor)
    if part_type == "tool":
        return tool_events(part, actor)
    if part_type == "patch":
        return patch_events(part, actor)
    if part_type == "step-finish":
        return step_finish_events(part, actor)
    return ()


def text_events(part: JsonObject, actor: HarnessRunActor) -> tuple[HarnessEvent, ...]:
    text = string_field(part, "text")
    if text is None:
        return ()
    return (
        HarnessEvent(kind=HarnessEventKind.TEXT, message=text, actor=actor, raw=part),
    )


def reasoning_events(
    part: JsonObject,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
    text = string_field(part, "text")
    if text is None:
        return ()
    return (
        HarnessEvent(
            kind=HarnessEventKind.TOOL_SUMMARY,
            message=text,
            actor=actor,
            raw=part,
        ),
    )


def tool_events(part: JsonObject, actor: HarnessRunActor) -> tuple[HarnessEvent, ...]:
    tool_name = string_field(part, "tool") or "tool"
    call_id = string_field(part, "callID")
    state = as_record(part.get("state"))
    display = opencode_tool_display(tool_name, state)
    use_event = HarnessEvent(
        kind=HarnessEventKind.TOOL_USE,
        message=display.title or tool_name,
        actor=actor,
        tool_id=call_id,
        tool_name=tool_name,
        tool_input=stringify_json_value(state.get("input")),
        tool_display=display,
        raw=part,
    )
    result_event = HarnessEvent(
        kind=HarnessEventKind.TOOL_RESULT,
        message=display.title or f"{tool_name} completed",
        actor=actor,
        tool_id=call_id,
        tool_name=tool_name,
        tool_display=display,
        tool_result=state.get("output"),
        tool_is_error=display.status == HarnessToolStatus.FAILED,
        raw=part,
    )
    return (use_event, result_event)


def opencode_tool_display(tool_name: str, state: JsonObject) -> HarnessToolDisplay:
    metadata = as_record(state.get("metadata"))
    input_record = as_record(state.get("input"))
    kind = infer_opencode_tool_kind(tool_name)
    return HarnessToolDisplay(
        kind=kind,
        title=string_field(state, "title") or _TOOL_TITLES.get(kind, tool_name),
        path=string_field(input_record, "filePath")
        or string_field(input_record, "path"),
        command=string_field(input_record, "command"),
        status=opencode_tool_status(state),
        exit_code=number_field(metadata, "exit"),
    )


def opencode_tool_status(state: JsonObject) -> HarnessToolStatus:
    status = string_field(state, "status")
    if status == "error":
        return HarnessToolStatus.FAILED
    return HarnessToolStatus.COMPLETED


def infer_opencode_tool_kind(tool: str) -> HarnessToolDisplayKind:
    normalized = tool.lower()
    if "read" in normalized:
        return HarnessToolDisplayKind.READ
    if "write" in normalized:
        return HarnessToolDisplayKind.WRITE
    if "edit" in normalized or "patch" in normalized:
        return HarnessToolDisplayKind.EDIT
    if any(word in normalized for word in ("grep", "glob", "search", "find", "ls")):
        return HarnessToolDisplayKind.SEARCH
    if "bash" in normalized or "shell" in normalized:
        return HarnessToolDisplayKind.SHELL
    if "web" in normalized or "fetch" in normalized:
        return HarnessToolDisplayKind.WEB
    if "task" in normalized or "agent" in normalized:
        return HarnessToolDisplayKind.AGENT
    return HarnessToolDisplayKind.UNKNOWN


def patch_events(part: JsonObject, actor: HarnessRunActor) -> tuple[HarnessEvent, ...]:
    files = part.get("files")
    if not isinstance(files, list) or len(files) == 0:
        return ()
    names = ", ".join(str(item) for item in files)
    return (
        HarnessEvent(
            kind=HarnessEventKind.TOOL_SUMMARY,
            message=f"files changed: {names}",
            actor=actor,
            raw=part,
        ),
    )


def step_finish_events(
    part: JsonObject,
    actor: HarnessRunActor,
) -> tuple[HarnessEvent, ...]:
    usage = parse_opencode_usage(part.get("tokens"))
    if usage is None:
        return ()
    return (
        HarnessEvent(
            kind=HarnessEventKind.CONTEXT_USAGE,
            message=usage_message(usage),
            actor=actor,
            usage=usage,
            raw=part,
        ),
    )


def usage_message(usage: HarnessUsage) -> str:
    if usage.total_tokens is not None:
        return f"usage: {usage.total_tokens} tokens"
    return "usage updated"


def final_text_from_parts(parts: list[JsonObject]) -> str | None:
    for part in reversed(parts):
        if string_field(part, "type") == "text":
            text = string_field(part, "text")
            if text is not None:
                return text
    return None


def is_task_spawn(part: JsonObject) -> tuple[str, str] | None:
    """(child_session_id, prompt) if this part spawns a sub-agent session."""
    if string_field(part, "type") != "tool" or string_field(part, "tool") != "task":
        return None
    state = as_record(part.get("state"))
    metadata = as_record(state.get("metadata"))
    child_session_id = string_field(metadata, "sessionId")
    if child_session_id is None:
        return None
    input_record = as_record(state.get("input"))
    prompt = string_field(input_record, "prompt") or string_field(
        input_record, "description"
    )
    return child_session_id, (prompt or "")


def is_task_settled(part: JsonObject) -> HarnessToolStatus | None:
    """Completed/failed status once a task-tool part resolves, else None."""
    if string_field(part, "type") != "tool" or string_field(part, "tool") != "task":
        return None
    state = as_record(part.get("state"))
    status = string_field(state, "status")
    if status == "completed":
        return HarnessToolStatus.COMPLETED
    if status == "error":
        return HarnessToolStatus.FAILED
    return None


