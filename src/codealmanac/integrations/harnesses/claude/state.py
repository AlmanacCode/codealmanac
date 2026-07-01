from dataclasses import dataclass, field

from codealmanac.services.harnesses.models import (
    HarnessActorRole,
    HarnessFailure,
    HarnessUsage,
)


@dataclass
class ClaudeRunState:
    success: bool = False
    seen_result: bool = False
    result: str = ""
    provider_session_id: str | None = None
    turns: int | None = None
    usage: HarnessUsage | None = None
    error: str | None = None
    failure: HarnessFailure | None = None
    result_source_role: HarnessActorRole | None = None
    agent_parents: dict[str, str | None] = field(default_factory=dict)
    agent_labels: dict[str, str] = field(default_factory=dict)
    completed_agents: set[str] = field(default_factory=set)

    def note_session_id(self, session_id: str | None) -> None:
        if self.provider_session_id is None and session_id is not None:
            self.provider_session_id = session_id

    def error_text(self) -> str:
        return self.error or "claude run failed"
