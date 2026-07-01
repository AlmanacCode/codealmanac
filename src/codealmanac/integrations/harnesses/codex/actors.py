from codealmanac.integrations.harnesses.codex.state import CodexRunState
from codealmanac.services.harnesses.models import (
    HarnessActorConfidence,
    HarnessActorRole,
    HarnessRunActor,
)


def actor_for_codex_thread(
    state: CodexRunState,
    thread_id: str | None,
) -> HarnessRunActor:
    if thread_id is None:
        return HarnessRunActor(
            thread_id=None,
            role=HarnessActorRole.UNKNOWN,
            confidence=HarnessActorConfidence.UNKNOWN,
            label="Unknown actor",
        )
    if state.root_thread_id is None:
        state.root_thread_id = thread_id
    if thread_id == state.root_thread_id:
        return HarnessRunActor(
            thread_id=thread_id,
            role=HarnessActorRole.ROOT,
            confidence=HarnessActorConfidence.PROVIDER,
            label="Main",
        )
    return HarnessRunActor(
        thread_id=thread_id,
        role=HarnessActorRole.HELPER,
        parent_thread_id=state.agent_parents.get(thread_id) or state.root_thread_id,
        confidence=HarnessActorConfidence.PROVIDER,
        label=helper_label(state, thread_id),
    )


def helper_label(state: CodexRunState, thread_id: str) -> str:
    existing = state.agent_labels.get(thread_id)
    if existing is not None:
        return existing
    label = f"Helper {len(state.agent_labels) + 1}"
    state.agent_labels[thread_id] = label
    return label
