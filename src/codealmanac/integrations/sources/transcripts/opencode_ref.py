from pathlib import Path

# Separator between the shared opencode.db path and a session id in a
# transcript address string, e.g. "/home/.../opencode.db::ses_abc123". Unlike
# Claude/Codex, every OpenCode session lives in the same database file, so
# the file path alone can't identify one session. This stays entirely
# inside the opencode integration package — services/sources/transcripts.py
# only sees the result via TranscriptCandidate.address_override, and never
# needs to know this encoding (or OpenCode) exists. See
# docs/plans/2026-07-08-opencode-harness-slice-3.md for the full reasoning.
#
# Two characters, not one: a Windows path can contain a single drive-letter
# colon (e.g. "C:\Users\me\...\opencode.db"), and rpartition() on "::" still
# finds the real separator correctly since it searches for the whole
# 2-character substring — verified by test, see
# test_opencode_transcripts.py.
OPENCODE_TRANSCRIPT_SEPARATOR = "::"


def format_opencode_transcript_ref(db_path: Path, session_id: str) -> str:
    return f"{db_path}{OPENCODE_TRANSCRIPT_SEPARATOR}{session_id}"


def parse_opencode_transcript_ref(value: str) -> tuple[Path, str] | None:
    db_path_str, separator, session_id = value.rpartition(
        OPENCODE_TRANSCRIPT_SEPARATOR
    )
    if separator == "" or db_path_str == "" or session_id == "":
        return None
    return Path(db_path_str), session_id
