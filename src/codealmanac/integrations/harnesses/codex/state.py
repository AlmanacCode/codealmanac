from dataclasses import dataclass, field

from codealmanac.services.harnesses.models import (
    HarnessActorRole,
    HarnessFailure,
    HarnessUsage,
)


@dataclass
class CodexRunState:
    success: bool = False
    result: str = ""
    provider_session_id: str | None = None
    turns: int | None = None
    usage: HarnessUsage | None = None
    error: str | None = None
    failure: HarnessFailure | None = None
    root_thread_id: str | None = None
    root_turn_id: str | None = None
    result_source_thread_id: str | None = None
    result_source_turn_id: str | None = None
    result_source_role: HarnessActorRole | None = None
    agent_parents: dict[str, str | None] = field(default_factory=dict)
    agent_labels: dict[str, str] = field(default_factory=dict)
    completed_agents: set[str] = field(default_factory=set)
