from enum import StrEnum


class HarnessKind(StrEnum):
    CODEX = "codex"
    CLAUDE = "claude"


class HarnessAgentKind(StrEnum):
    BUILD = "build"
    INGEST = "ingest"
    GARDEN = "garden"


class HarnessRunStatus(StrEnum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"
