import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from codealmanac.integrations.sources.transcripts import (
    OpencodeTranscriptDiscoveryAdapter,
    OpencodeTranscriptSourceRuntimeAdapter,
    TranscriptSourceRuntimeAdapter,
    default_transcript_runtime_adapters,
)
from codealmanac.integrations.sources.transcripts.opencode_ref import (
    format_opencode_transcript_ref,
    parse_opencode_transcript_ref,
)
from codealmanac.services.sources.models import (
    SourceKind,
    SourceRef,
    SourceRuntimeStatus,
    TranscriptApp,
)
from codealmanac.services.sources.requests import (
    DiscoverTranscriptsRequest,
    InspectSourceRuntimeRequest,
)
from codealmanac.services.sources.service import SourcesService
from codealmanac.services.sources.transcripts import transcript_address
from codealmanac.workflows.sync.queue import sync_ingest_request
from codealmanac.workflows.sync.requests import SyncRequest

SCHEMA = """
CREATE TABLE project (id TEXT PRIMARY KEY, worktree TEXT NOT NULL);
CREATE TABLE session (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    directory TEXT NOT NULL,
    time_updated INTEGER NOT NULL
);
CREATE TABLE message (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    time_created INTEGER NOT NULL,
    data TEXT NOT NULL
);
CREATE TABLE part (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    time_created INTEGER NOT NULL,
    data TEXT NOT NULL
);
"""


def build_fixture_db(path: Path) -> None:
    conn = sqlite3.connect(path)
    try:
        conn.executescript(SCHEMA)
        conn.execute(
            "INSERT INTO project (id, worktree) VALUES (?, ?)",
            ("proj_1", "/repo"),
        )
        conn.execute(
            "INSERT INTO session (id, project_id, directory, time_updated) "
            "VALUES (?, ?, ?, ?)",
            ("ses_1", "proj_1", "/repo", 1783538522023),
        )
        conn.execute(
            "INSERT INTO message (id, session_id, time_created, data) "
            "VALUES (?, ?, ?, ?)",
            ("msg_user", "ses_1", 1, json.dumps({"role": "user"})),
        )
        conn.execute(
            "INSERT INTO part (id, message_id, session_id, time_created, data) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                "prt_user_1",
                "msg_user",
                "ses_1",
                1,
                json.dumps({"type": "text", "text": "run echo hi"}),
            ),
        )
        conn.execute(
            "INSERT INTO message (id, session_id, time_created, data) "
            "VALUES (?, ?, ?, ?)",
            ("msg_assistant", "ses_1", 2, json.dumps({"role": "assistant"})),
        )
        conn.execute(
            "INSERT INTO part (id, message_id, session_id, time_created, data) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                "prt_asst_1",
                "msg_assistant",
                "ses_1",
                2,
                json.dumps(
                    {
                        "type": "tool",
                        "tool": "bash",
                        "callID": "call_1",
                        "state": {"input": {"command": "echo hi"}, "output": "hi\n"},
                    }
                ),
            ),
        )
        conn.execute(
            "INSERT INTO part (id, message_id, session_id, time_created, data) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                "prt_asst_2",
                "msg_assistant",
                "ses_1",
                3,
                json.dumps({"type": "text", "text": "done"}),
            ),
        )
        conn.commit()
    finally:
        conn.close()


# --- opencode_ref round-trip -------------------------------------------------


def test_transcript_address_uses_address_override_when_set():
    from codealmanac.services.sources.models import TranscriptCandidate

    candidate = TranscriptCandidate(
        app=TranscriptApp.OPENCODE,
        session_id="ses_1",
        transcript_path=Path("/home/.local/share/opencode/opencode.db"),
        cwd=Path("/repo"),
        modified_at=datetime.now(UTC),
        size_bytes=100,
        address_override="/home/.local/share/opencode/opencode.db::ses_1",
    )

    address = transcript_address(candidate)

    # transcript_address itself is app-agnostic — it only ever reads
    # address_override, never candidate.app. The OpenCode-specific encoding
    # lives entirely in integrations/sources/transcripts/opencode_ref.py.
    assert address == "/home/.local/share/opencode/opencode.db::ses_1"
    assert parse_opencode_transcript_ref(address) == (
        Path("/home/.local/share/opencode/opencode.db"),
        "ses_1",
    )


def test_transcript_address_falls_back_to_transcript_path_without_override():
    from codealmanac.services.sources.models import TranscriptCandidate

    candidate = TranscriptCandidate(
        app=TranscriptApp.CLAUDE,
        session_id="ignored",
        transcript_path=Path("/home/.claude/projects/session.jsonl"),
        cwd=Path("/repo"),
        modified_at=datetime.now(UTC),
        size_bytes=100,
    )

    assert transcript_address(candidate) == "/home/.claude/projects/session.jsonl"


def test_parse_opencode_transcript_ref_rejects_plain_path():
    assert parse_opencode_transcript_ref("/home/.claude/session.jsonl") is None


def test_parse_opencode_transcript_ref_handles_windows_drive_letter_colon():
    # A Windows path's own single drive-letter colon must not be mistaken
    # for the "::" separator — rpartition on the full two-character
    # separator finds the real one regardless.
    ref = format_opencode_transcript_ref(
        Path("C:\\Users\\me\\AppData\\opencode.db"), "ses_abc123"
    )

    assert parse_opencode_transcript_ref(ref) == (
        Path("C:\\Users\\me\\AppData\\opencode.db"),
        "ses_abc123",
    )


# --- OpencodeTranscriptDiscoveryAdapter --------------------------------------


def test_discover_finds_sessions_in_fixture_db(tmp_path: Path):
    db_path = tmp_path / "opencode.db"
    build_fixture_db(db_path)
    adapter = OpencodeTranscriptDiscoveryAdapter(db_path=db_path)

    candidates = adapter.discover(
        DiscoverTranscriptsRequest(home=tmp_path, apps=(TranscriptApp.OPENCODE,))
    )

    assert len(candidates) == 1
    candidate = candidates[0]
    assert candidate.app == TranscriptApp.OPENCODE
    assert candidate.session_id == "ses_1"
    assert candidate.transcript_path == db_path.resolve()
    assert str(candidate.cwd).endswith("/repo")
    assert candidate.address_override == f"{db_path.resolve()}::ses_1"
    assert transcript_address(candidate) == candidate.address_override


def test_discover_returns_empty_when_db_is_missing(tmp_path: Path):
    adapter = OpencodeTranscriptDiscoveryAdapter(db_path=tmp_path / "missing.db")

    candidates = adapter.discover(
        DiscoverTranscriptsRequest(home=tmp_path, apps=(TranscriptApp.OPENCODE,))
    )

    assert candidates == ()


def test_discover_soft_skips_on_schema_drift(tmp_path: Path):
    db_path = tmp_path / "opencode.db"
    conn = sqlite3.connect(db_path)
    conn.executescript("CREATE TABLE session (id TEXT PRIMARY KEY);")  # no columns
    conn.close()
    adapter = OpencodeTranscriptDiscoveryAdapter(db_path=db_path)

    candidates = adapter.discover(
        DiscoverTranscriptsRequest(home=tmp_path, apps=(TranscriptApp.OPENCODE,))
    )

    assert candidates == ()


# --- OpencodeTranscriptSourceRuntimeAdapter ----------------------------------


def test_runtime_adapter_renders_session_content(tmp_path: Path):
    db_path = tmp_path / "opencode.db"
    build_fixture_db(db_path)
    adapter = OpencodeTranscriptSourceRuntimeAdapter()
    ref = SourceRef(
        raw=f"transcript:{db_path}::ses_1",
        kind=SourceKind.TRANSCRIPT,
        identity=f"transcript:{db_path}::ses_1",
        transcript=f"{db_path}::ses_1",
    )

    assert adapter.supports(ref) is True

    runtime = adapter.inspect(InspectSourceRuntimeRequest(cwd=tmp_path, ref=ref))

    assert runtime.status == SourceRuntimeStatus.AVAILABLE
    assert runtime.content is not None
    assert "echo hi" in runtime.content
    assert "hi" in runtime.content
    assert "done" in runtime.content


def test_runtime_adapter_does_not_support_plain_path_refs(tmp_path: Path):
    adapter = OpencodeTranscriptSourceRuntimeAdapter()
    ref = SourceRef(
        raw="transcript:/home/.claude/session.jsonl",
        kind=SourceKind.TRANSCRIPT,
        identity="transcript:/home/.claude/session.jsonl",
        transcript="/home/.claude/session.jsonl",
    )

    assert adapter.supports(ref) is False


def test_runtime_adapter_reports_unavailable_for_missing_db(tmp_path: Path):
    adapter = OpencodeTranscriptSourceRuntimeAdapter()
    missing = tmp_path / "gone.db"
    ref = SourceRef(
        raw=f"transcript:{missing}::ses_1",
        kind=SourceKind.TRANSCRIPT,
        identity=f"transcript:{missing}::ses_1",
        transcript=f"{missing}::ses_1",
    )

    runtime = adapter.inspect(InspectSourceRuntimeRequest(cwd=tmp_path, ref=ref))

    assert runtime.status == SourceRuntimeStatus.UNAVAILABLE


# --- registration ordering regression ----------------------------------------


def test_default_runtime_adapters_prefer_opencode_over_generic(tmp_path: Path):
    db_path = tmp_path / "opencode.db"
    build_fixture_db(db_path)
    adapters = default_transcript_runtime_adapters()
    assert isinstance(adapters[0], OpencodeTranscriptSourceRuntimeAdapter)
    assert isinstance(adapters[1], TranscriptSourceRuntimeAdapter)

    service = SourcesService(runtime_adapters=adapters)
    ref = SourceRef(
        raw=f"transcript:{db_path}::ses_1",
        kind=SourceKind.TRANSCRIPT,
        identity=f"transcript:{db_path}::ses_1",
        transcript=f"{db_path}::ses_1",
    )

    runtime = service.inspect_runtime(
        InspectSourceRuntimeRequest(cwd=tmp_path, ref=ref)
    )

    # If the generic JSONL adapter won instead, this would be UNAVAILABLE
    # ("no readable JSONL objects found") rather than real content.
    assert runtime.status == SourceRuntimeStatus.AVAILABLE
    assert runtime.content is not None
    assert "echo hi" in runtime.content


def test_generic_runtime_adapter_rejects_opencode_shaped_refs_on_its_own(
    tmp_path: Path,
):
    # Regression: this must hold even if default_transcript_runtime_adapters()
    # is ever reordered — TranscriptSourceRuntimeAdapter.supports() excludes
    # OpenCode refs explicitly, not merely because it's asked second today.
    adapter = TranscriptSourceRuntimeAdapter()
    db_path = tmp_path / "opencode.db"
    address = format_opencode_transcript_ref(db_path, "ses_1")
    ref = SourceRef(
        raw=f"transcript:{address}",
        kind=SourceKind.TRANSCRIPT,
        identity=f"transcript:{address}",
        transcript=address,
    )

    assert adapter.supports(ref) is False


# --- sync_ingest_request builds the right address per app -------------------


def test_sync_ingest_request_builds_opencode_and_claude_addresses(tmp_path: Path):
    from codealmanac.services.harnesses.models import HarnessKind
    from codealmanac.services.repositories.models import Repository
    from codealmanac.services.sources.models import TranscriptCandidate
    from codealmanac.workflows.sync.models import SyncRepositoryIngest

    repository = Repository(
        repository_id="repo-id",
        name="repo",
        description="",
        root_path=tmp_path,
        almanac_path=tmp_path / "almanac",
        registered_at=datetime.now(UTC),
    )
    opencode_candidate = TranscriptCandidate(
        app=TranscriptApp.OPENCODE,
        session_id="ses_1",
        transcript_path=tmp_path / "opencode.db",
        cwd=tmp_path,
        modified_at=datetime.now(UTC),
        size_bytes=10,
        # Set by OpencodeTranscriptDiscoveryAdapter in real use (see
        # test_discover_finds_sessions_in_fixture_db) — set directly here to
        # test sync_ingest_request's pass-through behavior in isolation.
        address_override=f"{tmp_path / 'opencode.db'}::ses_1",
    )
    claude_candidate = TranscriptCandidate(
        app=TranscriptApp.CLAUDE,
        session_id="claude-session",
        transcript_path=tmp_path / "session.jsonl",
        cwd=tmp_path,
        modified_at=datetime.now(UTC),
        size_bytes=10,
    )
    item = SyncRepositoryIngest(
        repository=repository,
        transcripts=(opencode_candidate, claude_candidate),
    )
    request = SyncRequest(
        repository_name="repo",
        apps=(TranscriptApp.OPENCODE, TranscriptApp.CLAUDE),
        harness=HarnessKind.CODEX,
        model="gpt-5.5",
    )

    ingest_request = sync_ingest_request(request, item)

    assert ingest_request.inputs == (
        f"transcript:{tmp_path / 'opencode.db'}::ses_1",
        f"transcript:{tmp_path / 'session.jsonl'}",
    )
