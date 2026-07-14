from datetime import UTC, datetime
from pathlib import Path

from codealmanac.core.paths import normalize_path
from codealmanac.database import query_readonly_or_empty
from codealmanac.services.sources.models import TranscriptApp, TranscriptCandidate
from codealmanac.services.sources.requests import DiscoverTranscriptsRequest

OPENCODE_DB_RELATIVE_PATH = Path(".local") / "share" / "opencode" / "opencode.db"
# Distinguishes an OpenCode session identity from a real filesystem path in
# TranscriptCandidate.transcript_path / SourceRef.transcript. OpenCode has no
# per-session file to point at — its transcript data lives as rows in one
# shared SQLite database, not one file per session — so this scheme prefix
# is how OpencodeTranscriptRuntimeAdapter recognizes "resolve this by
# querying the database," rather than by opening it as a file.
OPENCODE_TRANSCRIPT_SCHEME = "opencode-session:"

_ROOT_SESSIONS_QUERY = """
SELECT id, directory, time_updated
FROM session
WHERE parent_id IS NULL
ORDER BY time_updated DESC
"""


class OpencodeTranscriptDiscoveryAdapter:
    app = TranscriptApp.OPENCODE

    def __init__(self, db_path: Path | None = None):
        self.db_path = db_path

    def discover(
        self,
        request: DiscoverTranscriptsRequest,
    ) -> tuple[TranscriptCandidate, ...]:
        db_path = self.db_path or request.home / OPENCODE_DB_RELATIVE_PATH
        rows = query_readonly_or_empty(db_path, _ROOT_SESSIONS_QUERY)
        candidates: list[TranscriptCandidate] = []
        for row in rows:
            directory = row["directory"]
            session_id = row["id"]
            time_updated = row["time_updated"]
            if not directory or not session_id or time_updated is None:
                continue
            candidates.append(
                TranscriptCandidate(
                    app=self.app,
                    session_id=session_id,
                    transcript_path=opencode_transcript_identity(session_id),
                    cwd=normalize_path(Path(directory)),
                    modified_at=datetime.fromtimestamp(time_updated / 1000, UTC),
                    # OpenCode sessions aren't files; there's no on-disk size
                    # to report, and nothing downstream currently displays
                    # this field for any app.
                    size_bytes=0,
                )
            )
        return tuple(candidates)


def opencode_transcript_identity(session_id: str) -> Path:
    return Path(f"{OPENCODE_TRANSCRIPT_SCHEME}{session_id}")


def opencode_session_id(transcript: str) -> str | None:
    if not transcript.startswith(OPENCODE_TRANSCRIPT_SCHEME):
        return None
    session_id = transcript.removeprefix(OPENCODE_TRANSCRIPT_SCHEME)
    return session_id or None
