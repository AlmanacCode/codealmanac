from codealmanac.integrations.sources.transcripts.errors import unavailable_runtime
from codealmanac.integrations.sources.transcripts.opencode_ref import (
    parse_opencode_transcript_ref,
)
from codealmanac.integrations.sources.transcripts.paths import transcript_path
from codealmanac.integrations.sources.transcripts.reader import read_transcript_entries
from codealmanac.integrations.sources.transcripts.rendering import (
    render_transcript_runtime,
)
from codealmanac.services.sources.models import (
    SourceKind,
    SourceRef,
    SourceRuntime,
    SourceRuntimeStatus,
)
from codealmanac.services.sources.requests import InspectSourceRuntimeRequest

DEFAULT_MAX_CHARS = 60_000


class TranscriptSourceRuntimeAdapter:
    def __init__(self, max_chars: int = DEFAULT_MAX_CHARS):
        self.max_chars = max_chars

    def supports(self, ref: SourceRef) -> bool:
        if ref.kind != SourceKind.TRANSCRIPT:
            return False
        # OpenCode refs are "db-path::session-id" strings, handled by
        # OpencodeTranscriptSourceRuntimeAdapter instead (every OpenCode
        # session shares one file, so a bare path can't address one). Ruled
        # out explicitly so this adapter's supports() is correct standing
        # alone, not merely correct because of registration order in
        # default_transcript_runtime_adapters().
        if ref.transcript is None:
            return True
        return parse_opencode_transcript_ref(ref.transcript) is None

    def inspect(self, request: InspectSourceRuntimeRequest) -> SourceRuntime:
        if request.ref.kind != SourceKind.TRANSCRIPT:
            return SourceRuntime(
                ref=request.ref,
                status=SourceRuntimeStatus.SKIPPED,
                title=f"Unsupported transcript source {request.ref.identity}",
            )
        path = transcript_path(request.cwd, request.ref)
        if path is None:
            return unavailable_runtime(
                request.ref,
                "Transcript unavailable",
                "transcript source requires a path",
            )
        if not path.is_file():
            return unavailable_runtime(
                request.ref,
                "Transcript unavailable",
                f"transcript file not found: {path}",
            )
        entries = tuple(read_transcript_entries(path))
        if len(entries) == 0:
            return unavailable_runtime(
                request.ref,
                f"Transcript {path}",
                "no readable JSONL objects found",
            )
        content, truncated = render_transcript_runtime(path, entries, self.max_chars)
        return SourceRuntime(
            ref=request.ref,
            status=SourceRuntimeStatus.AVAILABLE,
            title=f"Transcript {path}",
            content=content,
            truncated=truncated,
        )
