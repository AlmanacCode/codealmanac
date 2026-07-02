from codealmanac.services.control.models import RecordTriggerEventResult
from codealmanac.services.control.ports import LocalGitStateProbe
from codealmanac.services.control.requests import (
    RecordCurrentGitTriggerRequest,
    RecordLocalTriggerRequest,
)
from codealmanac.services.control.store import ControlStore


def record_current_git_trigger(
    store: ControlStore,
    local_git_state: LocalGitStateProbe,
    request: RecordCurrentGitTriggerRequest,
) -> RecordTriggerEventResult:
    state = local_git_state.read(request.cwd)
    if (
        not state.available
        or state.repository_root is None
        or state.branch_name is None
        or state.head_sha is None
    ):
        return RecordTriggerEventResult(
            recorded=False,
            reason="git_state_unavailable",
        )
    return store.record_local_trigger(
        RecordLocalTriggerRequest(
            repository_root=state.repository_root,
            branch_name=state.branch_name,
            kind=request.kind,
            head_sha=state.head_sha,
            previous_head_sha=request.previous_head_sha,
            payload_ref=request.payload_ref,
        )
    )
