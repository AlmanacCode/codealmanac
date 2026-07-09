import json
from pathlib import Path

from codealmanac.database import query_readonly_or_empty
from codealmanac.integrations.harnesses.fields import as_record, string_field
from codealmanac.integrations.sources.transcripts.models import (
    TranscriptRuntimeEntry,
    TranscriptRuntimeLineKind,
)

_SESSIONS_QUERY = "SELECT id, directory, time_updated FROM session"
# part.data and message.data both alias to the bare column name "data" if
# not given explicit AS aliases — harmless here today since
# read_opencode_session_entries reads rows positionally (row[0]/row[1]),
# but a future edit to key-based access (row["data"]) would silently
# collide (sqlite3.Row's dict-style lookup returns the first match). Named
# explicitly so that footgun can't reappear — the harness-side poller in
# integrations/harnesses/opencode/progress.py hit exactly this bug.
_ENTRIES_QUERY = """
SELECT part.data AS part_data, message.data AS message_data
FROM part
JOIN message ON message.id = part.message_id
WHERE part.session_id = ?
ORDER BY part.time_created
"""


def list_opencode_sessions(path: Path) -> tuple[tuple[str, str, int], ...]:
    """Return (session_id, directory, time_updated_ms) for every session.

    Soft-fails to () on any sqlite error (missing table/column etc.) rather
    than raising — this schema isn't a documented public contract (see
    docs/plans/2026-07-07-opencode-harness.md "Spike findings"), so a future
    opencode-ai upgrade changing it should make sync find nothing this run,
    not crash it. query_readonly_or_empty (codealmanac.database) owns that
    soft-fail behavior and the read-only connection.
    """
    rows = query_readonly_or_empty(path, _SESSIONS_QUERY)
    return tuple(
        (row["id"], row["directory"], row["time_updated"])
        for row in rows
        if isinstance(row["id"], str)
        and isinstance(row["directory"], str)
        and isinstance(row["time_updated"], int)
    )


def read_opencode_session_entries(
    path: Path,
    session_id: str,
) -> tuple[TranscriptRuntimeEntry, ...]:
    rows = query_readonly_or_empty(path, _ENTRIES_QUERY, (session_id,))
    entries: list[TranscriptRuntimeEntry] = []
    for row in rows:
        entry = _entry_from_part_row(len(entries) + 1, row[0], row[1])
        if entry is not None:
            entries.append(entry)
    return tuple(entries)


def _entry_from_part_row(
    line_number: int,
    part_data: object,
    message_data: object,
) -> TranscriptRuntimeEntry | None:
    part = _parse_json_object(part_data)
    if part is None:
        return None
    message = _parse_json_object(message_data) or {}
    role = string_field(message, "role") or "unknown"
    part_type = string_field(part, "type")

    if part_type == "text":
        text = string_field(part, "text")
        if text is None:
            return None
        return TranscriptRuntimeEntry(
            line_number=line_number,
            kind=TranscriptRuntimeLineKind.MESSAGE,
            label=role,
            text=text,
        )
    if part_type == "reasoning":
        text = string_field(part, "text")
        if text is None:
            return None
        return TranscriptRuntimeEntry(
            line_number=line_number,
            kind=TranscriptRuntimeLineKind.MESSAGE,
            label=f"{role} reasoning",
            text=text,
        )
    if part_type == "tool":
        return _tool_entry(line_number, part)
    if part_type == "patch":
        files = part.get("files")
        if not isinstance(files, list) or len(files) == 0:
            return None
        return TranscriptRuntimeEntry(
            line_number=line_number,
            kind=TranscriptRuntimeLineKind.META,
            label="files changed",
            text=", ".join(str(item) for item in files),
        )
    # step-start / step-finish / anything else: bookkeeping, not
    # ingest-relevant content — skip rather than render as noise.
    return None


def _tool_entry(line_number: int, part: dict) -> TranscriptRuntimeEntry | None:
    tool_name = string_field(part, "tool") or "tool"
    state = as_record(part.get("state"))
    input_value = state.get("input")
    output_value = state.get("output")
    if not isinstance(output_value, str):
        output_value = json.dumps(output_value)
    text = (
        f"input: {json.dumps(input_value, sort_keys=True)}\noutput: {output_value}"
    )
    return TranscriptRuntimeEntry(
        line_number=line_number,
        kind=TranscriptRuntimeLineKind.TOOL_CALL,
        label=f"tool:{tool_name}",
        text=text,
    )


def _parse_json_object(value: object) -> dict | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = json.loads(value)
    except ValueError:
        return None
    return parsed if isinstance(parsed, dict) else None
