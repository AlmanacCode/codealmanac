from dataclasses import dataclass, field

from codealmanac.services.harnesses.models import (
    HarnessActorRole,
    HarnessFailure,
    HarnessUsage,
)


@dataclass
class OpencodeRunState:
    success: bool = False
    result: str = ""
    provider_session_id: str | None = None
    usage: HarnessUsage | None = None
    error: str | None = None
    failure: HarnessFailure | None = None
    result_source_thread_id: str | None = None
    result_source_role: HarnessActorRole | None = None
    # Populated by OpencodeProgressWatchdog (progress.py) as it discovers
    # sub-agent sessions via "task" tool calls — see
    # docs/plans/2026-07-09-opencode-harness-live-progress-and-hang-detection.md.
    agent_parents: dict[str, str | None] = field(default_factory=dict)
    agent_labels: dict[str, str] = field(default_factory=dict)
