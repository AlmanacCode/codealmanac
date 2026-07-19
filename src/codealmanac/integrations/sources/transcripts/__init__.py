from codealmanac.integrations.sources.transcripts.claude import (
    ClaudeTranscriptDiscoveryAdapter,
)
from codealmanac.integrations.sources.transcripts.codex import (
    CodexTranscriptDiscoveryAdapter,
)
from codealmanac.integrations.sources.transcripts.opencode import (
    OpencodeTranscriptDiscoveryAdapter,
)
from codealmanac.integrations.sources.transcripts.opencode_runtime import (
    OpencodeTranscriptRuntimeAdapter,
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
    # Order matters: SourcesService.inspect_runtime() dispatches to the
    # first adapter whose supports() matches, and TranscriptSourceRuntimeAdapter
    # claims every SourceKind.TRANSCRIPT ref (it has no way to know about
    # OpenCode's non-file-backed identity scheme). OpencodeTranscriptRuntimeAdapter
    # must be checked first so it can claim its own opencode-session: refs
    # before the generic file-based adapter does and fails trying to open
    # a synthetic path as a real file.
    return (
        OpencodeTranscriptRuntimeAdapter(),
        TranscriptSourceRuntimeAdapter(),
    )


__all__ = [
    "ClaudeTranscriptDiscoveryAdapter",
    "CodexTranscriptDiscoveryAdapter",
    "OpencodeTranscriptDiscoveryAdapter",
    "OpencodeTranscriptRuntimeAdapter",
    "TranscriptSourceRuntimeAdapter",
    "default_transcript_discovery_adapters",
    "default_transcript_runtime_adapters",
]
