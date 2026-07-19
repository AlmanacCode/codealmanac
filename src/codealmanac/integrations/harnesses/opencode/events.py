from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any

from pydantic import JsonValue

from codealmanac.services.harnesses.models import (
    HarnessActorConfidence,
    HarnessActorRole,
    HarnessEvent,
    HarnessEventKind,
    HarnessRunActor,
    HarnessRunStatus,
    HarnessToolDisplay,
    HarnessToolDisplayKind,
    HarnessToolStatus,
    HarnessUsage,
)


def project_json_line(
    line: str,
    *,
    session_id: str | None = None,
) -> tuple[HarnessEvent, ...]:
    payload = parse_json_object(line)
    if payload is None:
        return ()
    return project_payload(payload, session_id=session_id)


def project_payload(
    payload: Mapping[str, Any],
    *,
    session_id: str | None = None,
) -> tuple[HarnessEvent, ...]:
    event_type = text(payload.get("type"))
    if event_type is None:
        return ()
    resolved_session = text(payload.get("sessionID")) or session_id
    actor = root_actor(resolved_session)
    if event_type == "text":
        part = mapping(payload.get("part")) or {}
        message = text(part.get("text")) or "text"
        return (
            HarnessEvent(
                kind=HarnessEventKind.TEXT,
                message=message,
                actor=actor,
                provider_session_id=resolved_session,
                raw=as_json(payload),
            ),
        )
    if event_type == "tool_use":
        part = mapping(payload.get("part")) or {}
        state = mapping(part.get("state")) or {}
        tool_name = text(part.get("tool")) or "tool"
        tool_id = text(part.get("id"))
        status = tool_status(text(state.get("status")))
        error = text(state.get("error"))
        message = f"{tool_name} {status.value}" if status is not None else tool_name
        if error:
            message = f"{tool_name} failed: {error}"
        return (
            HarnessEvent(
                kind=HarnessEventKind.TOOL_USE,
                message=message,
                actor=actor,
                tool_id=tool_id,
                tool_name=tool_name,
                tool_input=json_text(state.get("input")),
                tool_result=as_json(state.get("output") or state.get("error")),
                tool_is_error=status is HarnessToolStatus.FAILED or bool(error),
                tool_display=HarnessToolDisplay(
                    kind=tool_display_kind(tool_name),
                    title=tool_name,
                    path=text(state.get("path")),
                    command=text(state.get("command") or state.get("title")),
                    status=status,
                    summary=text(state.get("title")),
                ),
                provider_session_id=resolved_session,
                provider_event_id=tool_id,
                raw=as_json(payload),
            ),
        )
    if event_type == "error":
        error = payload.get("error")
        message = error_message(error)
        return (
            HarnessEvent(
                kind=HarnessEventKind.ERROR,
                message=message,
                actor=actor,
                provider_session_id=resolved_session,
                raw=as_json(payload),
            ),
        )
    if event_type in {"step_start", "step_finish", "reasoning"}:
        return (
            HarnessEvent(
                kind=HarnessEventKind.STREAM_EVENT,
                message=event_type,
                actor=actor,
                provider_session_id=resolved_session,
                raw=as_json(payload),
            ),
        )
    return (
        HarnessEvent(
            kind=HarnessEventKind.UNKNOWN,
            message=event_type,
            actor=actor,
            provider_session_id=resolved_session,
            raw=as_json(payload),
        ),
    )


def usage_from_part(part: Mapping[str, Any]) -> HarnessUsage | None:
    tokens = mapping(part.get("tokens")) or mapping(part.get("usage"))
    if tokens is None:
        return None
    return HarnessUsage(
        input_tokens=int_or_none(tokens.get("input")),
        output_tokens=int_or_none(tokens.get("output")),
        reasoning_output_tokens=int_or_none(tokens.get("reasoning")),
        total_tokens=int_or_none(tokens.get("total")),
        cached_input_tokens=int_or_none(
            mapping(tokens.get("cache") or {}).get("read")
            if isinstance(tokens.get("cache"), dict)
            else tokens.get("cache")
        ),
    )


def root_actor(session_id: str | None) -> HarnessRunActor:
    if session_id is None:
        return HarnessRunActor(
            role=HarnessActorRole.UNKNOWN,
            label="Unknown actor",
            confidence=HarnessActorConfidence.UNKNOWN,
        )
    return HarnessRunActor(
        thread_id=session_id,
        role=HarnessActorRole.ROOT,
        label="Main",
        confidence=HarnessActorConfidence.PROVIDER,
    )


def tool_status(value: str | None) -> HarnessToolStatus | None:
    if value is None:
        return None
    if value in {"completed", "complete", "success"}:
        return HarnessToolStatus.COMPLETED
    if value in {"error", "failed"}:
        return HarnessToolStatus.FAILED
    if value in {"running", "pending", "started"}:
        return HarnessToolStatus.STARTED
    if value in {"denied", "declined"}:
        return HarnessToolStatus.DECLINED
    return None


def tool_display_kind(name: str) -> HarnessToolDisplayKind:
    lowered = name.casefold()
    if lowered in {"read", "view", "cat"}:
        return HarnessToolDisplayKind.READ
    if lowered in {"write", "create"}:
        return HarnessToolDisplayKind.WRITE
    if lowered in {"edit", "apply_patch", "multiedit", "patch"}:
        return HarnessToolDisplayKind.EDIT
    if lowered in {"grep", "glob", "search", "list"}:
        return HarnessToolDisplayKind.SEARCH
    if lowered in {"bash", "shell", "run"}:
        return HarnessToolDisplayKind.SHELL
    if lowered in {"webfetch", "websearch", "web"}:
        return HarnessToolDisplayKind.WEB
    if lowered in {"task", "agent"}:
        return HarnessToolDisplayKind.AGENT
    if lowered.startswith("mcp"):
        return HarnessToolDisplayKind.MCP
    return HarnessToolDisplayKind.UNKNOWN


def parse_json_object(line: str) -> dict[str, Any] | None:
    stripped = line.strip()
    if stripped == "":
        return None
    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, dict):
        return None
    return parsed


def mapping(value: object) -> dict[str, Any] | None:
    if isinstance(value, dict):
        return value
    return None


def text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def int_or_none(value: object) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value


def json_text(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return text(value)
    try:
        return json.dumps(value, ensure_ascii=True, separators=(",", ":"))
    except (TypeError, ValueError):
        return str(value)


def as_json(value: object) -> JsonValue | None:
    if value is None:
        return None
    try:
        return json.loads(json.dumps(value))
    except (TypeError, ValueError):
        return str(value)


def error_message(error: object) -> str:
    if isinstance(error, str) and error.strip():
        return error.strip()
    mapped = mapping(error)
    if mapped is None:
        return "opencode error"
    data = mapping(mapped.get("data"))
    if data is not None:
        message = text(data.get("message"))
        if message is not None:
            return message
    name = text(mapped.get("name"))
    message = text(mapped.get("message"))
    if name and message:
        return f"{name}: {message}"
    return message or name or "opencode error"


def collect_output_text(events: tuple[HarnessEvent, ...]) -> str:
    texts = [
        event.message
        for event in events
        if event.kind is HarnessEventKind.TEXT and event.message.strip()
    ]
    if texts:
        return "\n".join(texts).strip()
    errors = [
        event.message
        for event in events
        if event.kind is HarnessEventKind.ERROR and event.message.strip()
    ]
    if errors:
        return errors[-1]
    return "opencode completed"


def status_from_events(
    events: tuple[HarnessEvent, ...],
    returncode: int,
) -> HarnessRunStatus:
    if returncode != 0:
        return HarnessRunStatus.FAILED
    if any(event.kind is HarnessEventKind.ERROR for event in events):
        return HarnessRunStatus.FAILED
    return HarnessRunStatus.SUCCEEDED
