from codealmanac.integrations.sources.transcripts.claude import (
    ClaudeTranscriptDiscoveryAdapter,
)
from codealmanac.integrations.sources.transcripts.codex import (
    CodexTranscriptDiscoveryAdapter,
)
from codealmanac.integrations.sources.transcripts.opencode import (
    OpencodeTranscriptDiscoveryAdapter,
    OpencodeTranscriptSourceRuntimeAdapter,
)
from codealmanac.integrations.sources.transcripts.runtime import (
    TranscriptSourceRuntimeAdapter,
)
from codealmanac.services.sources.ports import (
    SourceRuntimeAdapter,
    TranscriptDiscoveryAdapter,
)


def default_transcript_discovery_adapters() -> tuple[TranscriptDiscoveryAdapter, ...]:
    return (
        ClaudeTranscriptDiscoveryAdapter(),
        CodexTranscriptDiscoveryAdapter(),
        OpencodeTranscriptDiscoveryAdapter(),
    )


def default_transcript_runtime_adapters() -> tuple[SourceRuntimeAdapter, ...]:
    # Order no longer matters: TranscriptSourceRuntimeAdapter.supports()
    # explicitly excludes OpenCode-shaped (db-path::session-id) refs, so the
    # two adapters' supports() are disjoint rather than one being a superset
    # of the other. See runtime.py and test_opencode_transcripts.py's
    # ordering regression test (kept as defense-in-depth).
    return (
        OpencodeTranscriptSourceRuntimeAdapter(),
        TranscriptSourceRuntimeAdapter(),
    )


__all__ = [
    "ClaudeTranscriptDiscoveryAdapter",
    "CodexTranscriptDiscoveryAdapter",
    "OpencodeTranscriptDiscoveryAdapter",
    "OpencodeTranscriptSourceRuntimeAdapter",
    "TranscriptSourceRuntimeAdapter",
    "default_transcript_discovery_adapters",
    "default_transcript_runtime_adapters",
]
