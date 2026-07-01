from enum import StrEnum


class HarnessKind(StrEnum):
    CODEX = "codex"
    CLAUDE = "claude"


class HarnessRunStatus(StrEnum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"
