import json
import sqlite3
from pathlib import Path

from codealmanac.integrations.sources import default_source_runtime_adapters
from codealmanac.integrations.sources.transcripts.opencode import (
    opencode_transcript_identity,
)
from codealmanac.integrations.sources.transcripts.opencode_runtime import (
    OpencodeTranscriptRuntimeAdapter,
)
from codealmanac.integrations.sources.transcripts.runtime import (
    TranscriptSourceRuntimeAdapter,
)
from codealmanac.services.sources.models import (
    SourceKind,
    SourceRef,
    SourceRuntimeStatus,
)
from codealmanac.services.sources.requests import InspectSourceRuntimeRequest


def _make_db(path: Path) -> None:
    connection = sqlite3.connect(path)
    connection.execute(
        "CREATE TABLE message (id text PRIMARY KEY, session_id text, "
        "data text, time_created integer)"
    )
    connection.execute(
        "CREATE TABLE part (id text PRIMARY KEY, session_id text, "
        "message_id text, data text, time_created integer)"
    )
    connection.commit()
    connection.close()


def _insert_part(
    path: Path,
    *,
    part_id: str,
    session_id: str,
    message_id: str,
    role: str,
    part: dict,
    seq: int,
) -> None:
    connection = sqlite3.connect(path)
    connection.execute(
        "INSERT OR IGNORE INTO message (id, session_id, data, time_created) "
        "VALUES (?, ?, ?, ?)",
        (message_id, session_id, json.dumps({"role": role}), seq),
    )
    connection.execute(
        "INSERT INTO part (id, session_id, message_id, data, time_created) "
        "VALUES (?, ?, ?, ?, ?)",
        (part_id, session_id, message_id, json.dumps(part), seq),
    )
    connection.commit()
    connection.close()


def _ref_for(session_id: str) -> SourceRef:
    transcript = str(opencode_transcript_identity(session_id))
    return SourceRef(
        raw=f"transcript:{transcript}",
        kind=SourceKind.TRANSCRIPT,
        identity=f"transcript:{transcript}",
        transcript=transcript,
    )


def test_runtime_reads_assistant_text_parts(tmp_path: Path) -> None:
    db_path = tmp_path / "opencode.db"
    _make_db(db_path)
    _insert_part(
        db_path,
        part_id="p1",
        session_id="ses_1",
        message_id="m1",
        role="assistant",
        part={"type": "text", "text": "Lazy expiration decision recorded."},
        seq=1,
    )

    adapter = OpencodeTranscriptRuntimeAdapter(db_path=db_path)
    ref = _ref_for("ses_1")
    result = adapter.inspect(InspectSourceRuntimeRequest(cwd=tmp_path, ref=ref))

    assert result.status == SourceRuntimeStatus.AVAILABLE
    assert "Lazy expiration decision recorded." in (result.content or "")


def test_runtime_includes_user_prompt_text(tmp_path: Path) -> None:
    # A past transcript read for ingest needs the question a session was
    # answering, not just its answer — unlike the live-progress watchdog,
    # which deliberately skips the user's own echoed prompt during a run.
    db_path = tmp_path / "opencode.db"
    _make_db(db_path)
    _insert_part(
        db_path,
        part_id="p1",
        session_id="ses_1",
        message_id="m1",
        role="user",
        part={"type": "text", "text": "Investigate the RESP decoder."},
        seq=1,
    )

    adapter = OpencodeTranscriptRuntimeAdapter(db_path=db_path)
    result = adapter.inspect(
        InspectSourceRuntimeRequest(cwd=tmp_path, ref=_ref_for("ses_1"))
    )

    assert result.status == SourceRuntimeStatus.AVAILABLE
    assert "Investigate the RESP decoder." in (result.content or "")


def test_runtime_skips_non_text_parts_from_non_assistant_roles(tmp_path: Path) -> None:
    db_path = tmp_path / "opencode.db"
    _make_db(db_path)
    _insert_part(
        db_path,
        part_id="p1",
        session_id="ses_1",
        message_id="m1",
        role="user",
        part={"type": "reasoning", "text": "should not appear"},
        seq=1,
    )

    adapter = OpencodeTranscriptRuntimeAdapter(db_path=db_path)
    result = adapter.inspect(
        InspectSourceRuntimeRequest(cwd=tmp_path, ref=_ref_for("ses_1"))
    )

    assert result.status == SourceRuntimeStatus.UNAVAILABLE


def test_runtime_unavailable_for_unknown_session(tmp_path: Path) -> None:
    db_path = tmp_path / "opencode.db"
    _make_db(db_path)

    adapter = OpencodeTranscriptRuntimeAdapter(db_path=db_path)
    result = adapter.inspect(
        InspectSourceRuntimeRequest(cwd=tmp_path, ref=_ref_for("ses_missing"))
    )

    assert result.status == SourceRuntimeStatus.UNAVAILABLE


def test_supports_only_matches_opencode_session_refs(tmp_path: Path) -> None:
    adapter = OpencodeTranscriptRuntimeAdapter(db_path=tmp_path / "opencode.db")

    assert adapter.supports(_ref_for("ses_1")) is True
    real_file_ref = SourceRef(
        raw="transcript:/some/real/path.jsonl",
        kind=SourceKind.TRANSCRIPT,
        identity="transcript:/some/real/path.jsonl",
        transcript="/some/real/path.jsonl",
    )
    assert adapter.supports(real_file_ref) is False


def test_default_source_runtime_adapters_dispatch_opencode_refs_correctly() -> None:
    # Regression: SourcesService.inspect_runtime() dispatches to the FIRST
    # adapter whose supports() matches. TranscriptSourceRuntimeAdapter claims
    # every SourceKind.TRANSCRIPT ref unconditionally, so if it were
    # registered before OpencodeTranscriptRuntimeAdapter, every opencode
    # session ref would be silently misrouted to the file-based adapter and
    # fail as "file not found" — confirmed live against a real CodeAlmanac
    # sync/ingest run before this ordering was fixed.
    adapters = default_source_runtime_adapters()
    ref = _ref_for("ses_1")
    matching = next(adapter for adapter in adapters if adapter.supports(ref))

    assert type(matching).__name__ == "OpencodeTranscriptRuntimeAdapter"


def test_generic_transcript_runtime_adapter_rejects_opencode_refs_on_its_own() -> None:
    # Defense in depth: correctness shouldn't rely solely on registration
    # order. TranscriptSourceRuntimeAdapter must refuse an opencode-shaped
    # ref even if it were (incorrectly, in the future) registered first.
    adapter = TranscriptSourceRuntimeAdapter()

    assert adapter.supports(_ref_for("ses_1")) is False


def test_generic_transcript_runtime_adapter_still_accepts_real_file_refs() -> None:
    adapter = TranscriptSourceRuntimeAdapter()
    real_file_ref = SourceRef(
        raw="transcript:/some/real/path.jsonl",
        kind=SourceKind.TRANSCRIPT,
        identity="transcript:/some/real/path.jsonl",
        transcript="/some/real/path.jsonl",
    )

    assert adapter.supports(real_file_ref) is True
