import json
from collections.abc import Mapping

from codealmanac.services.harnesses.models import (
    HarnessToolDisplay,
    HarnessToolDisplayKind,
    HarnessToolStatus,
)

JsonObject = Mapping[str, object]


def claude_tool_display(
    tool_name: str,
    tool_input: JsonObject,
    status: HarnessToolStatus,
) -> HarnessToolDisplay:
    kind = claude_tool_kind(tool_name)
    return HarnessToolDisplay(
        kind=kind,
        title=tool_title(tool_name, tool_input),
        path=tool_path(tool_name, tool_input),
        command=tool_command(tool_name, tool_input),
        status=status,
        summary=tool_summary(tool_name, tool_input),
    )


def claude_tool_kind(tool_name: str) -> HarnessToolDisplayKind:
    if tool_name in {"Read", "LS"}:
        return HarnessToolDisplayKind.READ
    if tool_name == "Write":
        return HarnessToolDisplayKind.WRITE
    if tool_name in {"Edit", "MultiEdit"}:
        return HarnessToolDisplayKind.EDIT
    if tool_name in {"Glob", "Grep"}:
        return HarnessToolDisplayKind.SEARCH
    if tool_name == "Bash":
        return HarnessToolDisplayKind.SHELL
    if tool_name in {"WebFetch", "WebSearch", "web_fetch", "web_search"}:
        return HarnessToolDisplayKind.WEB
    if tool_name == "Agent":
        return HarnessToolDisplayKind.AGENT
    return HarnessToolDisplayKind.UNKNOWN


def tool_title(tool_name: str, tool_input: JsonObject) -> str:
    path = tool_path(tool_name, tool_input)
    if path is not None:
        return f"{tool_name} {path}"
    command = tool_command(tool_name, tool_input)
    if command is not None:
        return command
    summary = tool_summary(tool_name, tool_input)
    if summary is not None:
        return summary
    return tool_name


def tool_path(tool_name: str, tool_input: JsonObject) -> str | None:
    if tool_name in {"Read", "Write", "Edit", "MultiEdit"}:
        return string_field(tool_input, "file_path")
    if tool_name == "LS":
        return string_field(tool_input, "path")
    return None


def tool_command(tool_name: str, tool_input: JsonObject) -> str | None:
    if tool_name == "Bash":
        return string_field(tool_input, "command")
    return None


def tool_summary(tool_name: str, tool_input: JsonObject) -> str | None:
    if tool_name == "Glob":
        return string_field(tool_input, "pattern")
    if tool_name == "Grep":
        return string_field(tool_input, "pattern") or string_field(tool_input, "query")
    if tool_name in {"WebFetch", "web_fetch"}:
        return string_field(tool_input, "url")
    if tool_name in {"WebSearch", "web_search"}:
        return string_field(tool_input, "query")
    if tool_name == "Agent":
        return string_field(tool_input, "description") or string_field(
            tool_input, "prompt"
        )
    return None


def stringify_tool_input(tool_input: JsonObject) -> str:
    return json.dumps(dict(tool_input), sort_keys=True, separators=(",", ":"))


def string_field(record: JsonObject, field: str) -> str | None:
    value = record.get(field)
    return value if isinstance(value, str) and value != "" else None
