from datetime import UTC, datetime
from pathlib import Path

from codealmanac.core.paths import normalize_path
from codealmanac.integrations.opencode_paths import OPENCODE_DB_RELATIVE_PATH
from codealmanac.integrations.sources.transcripts.errors import unavailable_runtime
from codealmanac.integrations.sources.transcripts.opencode_db import (
    list_opencode_sessions,
    read_opencode_session_entries,
)
from codealmanac.integrations.sources.transcripts.opencode_ref import (
    format_opencode_transcript_ref,
    parse_opencode_transcript_ref,
)
from codealmanac.integrations.sources.transcripts.rendering import (
    render_transcript_runtime,
)
from codealmanac.services.sources.models import (
    SourceKind,
    SourceRef,
    SourceRuntime,
    SourceRuntimeStatus,
    TranscriptApp,
    TranscriptCandidate,
)
from codealmanac.services.sources.requests import (
    DiscoverTranscriptsRequest,
    InspectSourceRuntimeRequest,
)

DEFAULT_MAX_CHARS = 60_000


class OpencodeTranscriptDiscoveryAdapter:
    app = TranscriptApp.OPENCODE

    def __init__(self, db_path: Path | None = None):
        self.db_path = db_path

    def discover(
        self,
        request: DiscoverTranscriptsRequest,
    ) -> tuple[TranscriptCandidate, ...]:
        path = self.db_path or request.home / OPENCODE_DB_RELATIVE_PATH
        if not path.is_file():
            return ()
        size_bytes = path.stat().st_size
        resolved_path = normalize_path(path)
        candidates = []
        for session_id, directory, time_updated_ms in list_opencode_sessions(path):
            candidates.append(
                TranscriptCandidate(
                    app=TranscriptApp.OPENCODE,
                    session_id=session_id,
                    transcript_path=resolved_path,
                    cwd=normalize_path(Path(directory)),
                    modified_at=datetime.fromtimestamp(time_updated_ms / 1000, UTC),
                    size_bytes=size_bytes,
                    address_override=format_opencode_transcript_ref(
                        resolved_path, session_id
                    ),
                )
            )
        return tuple(candidates)


class OpencodeTranscriptSourceRuntimeAdapter:
    def __init__(self, max_chars: int = DEFAULT_MAX_CHARS):
        self.max_chars = max_chars

    def supports(self, ref: SourceRef) -> bool:
        if ref.kind != SourceKind.TRANSCRIPT or ref.transcript is None:
            return False
        return parse_opencode_transcript_ref(ref.transcript) is not None

    def inspect(self, request: InspectSourceRuntimeRequest) -> SourceRuntime:
        parsed = (
            parse_opencode_transcript_ref(request.ref.transcript)
            if request.ref.transcript is not None
            else None
        )
        if parsed is None:
            return unavailable_runtime(
                request.ref,
                "Transcript unavailable",
                "opencode transcript source requires a db path and session id",
            )
        db_path, session_id = parsed
        if not db_path.is_file():
            return unavailable_runtime(
                request.ref,
                "Transcript unavailable",
                f"opencode database not found: {db_path}",
            )
        entries = read_opencode_session_entries(db_path, session_id)
        if len(entries) == 0:
            return unavailable_runtime(
                request.ref,
                f"Transcript {db_path} ({session_id})",
                "no readable session content found",
            )
        content, truncated = render_transcript_runtime(
            db_path, entries, self.max_chars
        )
        return SourceRuntime(
            ref=request.ref,
            status=SourceRuntimeStatus.AVAILABLE,
            title=f"Transcript {db_path} ({session_id})",
            content=content,
            truncated=truncated,
        )


__all__ = [
    "OpencodeTranscriptDiscoveryAdapter",
    "OpencodeTranscriptSourceRuntimeAdapter",
]
