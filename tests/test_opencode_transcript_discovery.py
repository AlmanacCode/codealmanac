import sqlite3
from pathlib import Path

from codealmanac.integrations.sources.transcripts.opencode import (
    OpencodeTranscriptDiscoveryAdapter,
    opencode_session_id,
    opencode_transcript_identity,
)
from codealmanac.services.sources.models import TranscriptApp
from codealmanac.services.sources.requests import DiscoverTranscriptsRequest


def _make_db(path: Path) -> None:
    connection = sqlite3.connect(path)
    connection.execute(
        "CREATE TABLE session (id text PRIMARY KEY, parent_id text, "
        "directory text NOT NULL, time_created integer, time_updated integer)"
    )
    connection.commit()
    connection.close()


def _insert_session(
    path: Path,
    *,
    session_id: str,
    directory: str,
    parent_id: str | None = None,
    time_updated: int = 1_000,
) -> None:
    connection = sqlite3.connect(path)
    connection.execute(
        "INSERT INTO session (id, parent_id, directory, time_created, time_updated) "
        "VALUES (?, ?, ?, ?, ?)",
        (session_id, parent_id, directory, time_updated, time_updated),
    )
    connection.commit()
    connection.close()


def test_opencode_discovery_reads_root_sessions(tmp_path: Path) -> None:
    db_path = tmp_path / "opencode.db"
    _make_db(db_path)
    repo = tmp_path / "repo"
    _insert_session(db_path, session_id="ses_root", directory=str(repo))

    adapter = OpencodeTranscriptDiscoveryAdapter(db_path=db_path)
    candidates = adapter.discover(
        DiscoverTranscriptsRequest(home=tmp_path, apps=(TranscriptApp.OPENCODE,))
    )

    assert len(candidates) == 1
    candidate = candidates[0]
    assert candidate.app == TranscriptApp.OPENCODE
    assert candidate.session_id == "ses_root"
    assert candidate.cwd == repo.resolve()
    assert candidate.transcript_path == opencode_transcript_identity("ses_root")


def test_opencode_discovery_excludes_subagent_sessions(tmp_path: Path) -> None:
    db_path = tmp_path / "opencode.db"
    _make_db(db_path)
    repo = tmp_path / "repo"
    _insert_session(db_path, session_id="ses_root", directory=str(repo))
    _insert_session(
        db_path, session_id="ses_child", directory=str(repo), parent_id="ses_root"
    )

    adapter = OpencodeTranscriptDiscoveryAdapter(db_path=db_path)
    candidates = adapter.discover(
        DiscoverTranscriptsRequest(home=tmp_path, apps=(TranscriptApp.OPENCODE,))
    )

    session_ids = {candidate.session_id for candidate in candidates}
    assert session_ids == {"ses_root"}


def test_opencode_discovery_returns_empty_for_missing_db(tmp_path: Path) -> None:
    adapter = OpencodeTranscriptDiscoveryAdapter(db_path=tmp_path / "missing.db")
    candidates = adapter.discover(
        DiscoverTranscriptsRequest(home=tmp_path, apps=(TranscriptApp.OPENCODE,))
    )

    assert candidates == ()


def test_opencode_discovery_soft_skips_on_schema_drift(tmp_path: Path) -> None:
    # OpenCode's schema is not a documented public contract — a future
    # opencode-ai upgrade renaming or dropping a column should make this
    # discovery pass find nothing that run, not crash sync entirely.
    db_path = tmp_path / "opencode.db"
    connection = sqlite3.connect(db_path)
    connection.execute("CREATE TABLE session (id text PRIMARY KEY)")
    connection.commit()
    connection.close()

    adapter = OpencodeTranscriptDiscoveryAdapter(db_path=db_path)
    candidates = adapter.discover(
        DiscoverTranscriptsRequest(home=tmp_path, apps=(TranscriptApp.OPENCODE,))
    )

    assert candidates == ()


def test_opencode_session_id_roundtrip() -> None:
    identity = opencode_transcript_identity("ses_abc123")
    assert opencode_session_id(str(identity)) == "ses_abc123"
    assert opencode_session_id("/some/real/file/path") is None
