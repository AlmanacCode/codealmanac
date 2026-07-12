import json
from pathlib import Path

from codealmanac.database import query_readonly_or_empty
from codealmanac.integrations.sources.transcripts.jsonl import (
    object_field,
    string_field,
)
from codealmanac.integrations.sources.transcripts.models import (
    TranscriptRuntimeEntry,
    TranscriptRuntimeLineKind,
)
from codealmanac.integrations.sources.transcripts.opencode import (
    OPENCODE_DB_RELATIVE_PATH,
    opencode_session_id,
    opencode_transcript_identity,
)
from codealmanac.integrations.sources.transcripts.rendering import (
    render_json_text,
    render_transcript_runtime,
)
from codealmanac.services.sources.models import (
    SourceKind,
    SourceRef,
    SourceRuntime,
    SourceRuntimeStatus,
)
from codealmanac.services.sources.requests import InspectSourceRuntimeRequest

_SESSION_PARTS_QUERY = """
SELECT part.id AS id, part.data AS part_data, message.data AS message_data
FROM part
JOIN message ON message.id = part.message_id
WHERE part.session_id = ?
ORDER BY part.time_created
"""


class OpencodeTranscriptRuntimeAdapter:
    def __init__(self, db_path: Path | None = None):
        self.db_path = db_path

    def supports(self, ref: SourceRef) -> bool:
        return (
            ref.kind == SourceKind.TRANSCRIPT
            and ref.transcript is not None
            and opencode_session_id(ref.transcript) is not None
        )

    def inspect(self, request: InspectSourceRuntimeRequest) -> SourceRuntime:
        ref = request.ref
        session_id = opencode_session_id(ref.transcript or "")
        if session_id is None:
            return SourceRuntime(
                ref=ref,
                status=SourceRuntimeStatus.SKIPPED,
                title=f"Unsupported transcript source {ref.identity}",
            )
        db_path = self.db_path or _default_db_path()
        rows = query_readonly_or_empty(db_path, _SESSION_PARTS_QUERY, (session_id,))
        display_path = opencode_transcript_identity(session_id)
        if not rows:
            return SourceRuntime(
                ref=ref,
                status=SourceRuntimeStatus.UNAVAILABLE,
                title=f"Transcript {display_path}",
                diagnostics=(f"no readable session parts found for {session_id}",),
            )
        entries = tuple(
            entry
            for entry in (
                _entry_from_row(index, row) for index, row in enumerate(rows, start=1)
            )
            if entry is not None
        )
        if not entries:
            return SourceRuntime(
                ref=ref,
                status=SourceRuntimeStatus.UNAVAILABLE,
                title=f"Transcript {display_path}",
                diagnostics=("no renderable parts in session",),
            )
        content, truncated = render_transcript_runtime(display_path, entries, 60_000)
        return SourceRuntime(
            ref=ref,
            status=SourceRuntimeStatus.AVAILABLE,
            title=f"Transcript {display_path}",
            content=content,
            truncated=truncated,
        )


def _default_db_path() -> Path:
    from codealmanac.core.paths import home_dir

    return home_dir() / OPENCODE_DB_RELATIVE_PATH


def _entry_from_row(line_number: int, row) -> TranscriptRuntimeEntry | None:
    part = _parse_json(row["part_data"])
    if part is None:
        return None
    message = _parse_json(row["message_data"])
    role = (string_field(message, "role") if message is not None else None) or "unknown"
    part_type = string_field(part, "type")
    if part_type == "text":
        text = string_field(part, "text")
        if text is None:
            return None
        # Includes user-authored text too (the original prompt), not just
        # assistant output — unlike the live-progress watchdog this reuses
        # part-shape knowledge from, a past transcript read for ingest needs
        # the question a session was answering, not just its answer.
        return _entry(line_number, TranscriptRuntimeLineKind.MESSAGE, role, text)
    if role != "assistant":
        # Non-text parts (tool calls, reasoning, patches) from a non-
        # assistant role aren't meaningful to render — OpenCode's own user
        # turns are plain text prompts.
        return None
    if part_type == "reasoning":
        text = string_field(part, "text")
        if text is None:
            return None
        return _entry(line_number, TranscriptRuntimeLineKind.EVENT, "reasoning", text)
    if part_type == "tool":
        return _tool_entry(line_number, part)
    if part_type == "patch":
        files = part.get("files")
        if not isinstance(files, list) or not files:
            return None
        names = ", ".join(str(item) for item in files)
        return _entry(
            line_number,
            TranscriptRuntimeLineKind.EVENT,
            "patch",
            f"files changed: {names}",
        )
    return None


def _tool_entry(line_number: int, part: dict) -> TranscriptRuntimeEntry | None:
    tool_name = string_field(part, "tool") or "tool"
    state = object_field(part, "state") or {}
    status = string_field(state, "status")
    if status == "running":
        return None
    kind = (
        TranscriptRuntimeLineKind.TOOL_RESULT
        if status in ("completed", "error")
        else TranscriptRuntimeLineKind.TOOL_CALL
    )
    input_text = render_json_text(state.get("input"))
    output_text = render_json_text(state.get("output"))
    text = "\n".join(piece for piece in (input_text, output_text) if piece) or "(empty)"
    return _entry(line_number, kind, tool_name, text)


def _entry(
    line_number: int,
    kind: TranscriptRuntimeLineKind,
    label: str,
    text: str,
) -> TranscriptRuntimeEntry:
    rendered = text.strip() or "(empty)"
    return TranscriptRuntimeEntry(
        line_number=line_number,
        kind=kind,
        label=label,
        text=rendered,
    )


def _parse_json(value: object) -> dict | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = json.loads(value)
    except ValueError:
        return None
    return parsed if isinstance(parsed, dict) else None
