from codealmanac.engine.sources.ports import SourceRuntimeAdapter
from codealmanac.integrations.sources.filesystem import FilesystemSourceRuntimeAdapter
from codealmanac.integrations.sources.git import GitSourceRuntimeAdapter
from codealmanac.integrations.sources.github import GitHubSourceRuntimeAdapter
from codealmanac.integrations.sources.transcripts import (
    TranscriptSourceRuntimeAdapter,
    default_transcript_discovery_adapters,
)
from codealmanac.integrations.sources.web import WebSourceRuntimeAdapter


def default_source_runtime_adapters() -> tuple[SourceRuntimeAdapter, ...]:
    return (
        FilesystemSourceRuntimeAdapter(),
        GitSourceRuntimeAdapter(),
        GitHubSourceRuntimeAdapter(),
        TranscriptSourceRuntimeAdapter(),
        WebSourceRuntimeAdapter(),
    )


__all__ = [
    "FilesystemSourceRuntimeAdapter",
    "GitSourceRuntimeAdapter",
    "GitHubSourceRuntimeAdapter",
    "TranscriptSourceRuntimeAdapter",
    "WebSourceRuntimeAdapter",
    "default_source_runtime_adapters",
    "default_transcript_discovery_adapters",
]
