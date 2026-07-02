from codealmanac.services.control.models import (
    BranchRecord,
    ControlSchemaStatus,
    RecordTriggerEventResult,
    RepositoryRecord,
    TriggerEventRecord,
)
from codealmanac.services.control.ports import LocalGitStateProbe
from codealmanac.services.control.requests import (
    EnsureControlSchemaRequest,
    ListTriggerEventsRequest,
    ReadControlSchemaStatusRequest,
    RecordCurrentGitTriggerRequest,
    RecordLocalTriggerRequest,
    RecordTriggerEventRequest,
    SetBranchPolicyRequest,
    UpsertRepositoryRequest,
)
from codealmanac.services.control.store import ControlStore


class ControlService:
    def __init__(self, store: ControlStore, local_git_state: LocalGitStateProbe):
        self.store = store
        self.local_git_state = local_git_state

    def ensure_ready(
        self,
        request: EnsureControlSchemaRequest | None = None,
    ) -> ControlSchemaStatus:
        _ = request or EnsureControlSchemaRequest()
        return self.store.ensure_ready()

    def status(
        self,
        request: ReadControlSchemaStatusRequest | None = None,
    ) -> ControlSchemaStatus:
        resolved = request or ReadControlSchemaStatusRequest()
        return self.store.status(resolved.ensure)

    def upsert_repository(
        self,
        request: UpsertRepositoryRequest,
    ) -> RepositoryRecord:
        return self.store.upsert_repository(request)

    def set_branch_policy(
        self,
        request: SetBranchPolicyRequest,
    ) -> BranchRecord:
        return self.store.set_branch_policy(request)

    def record_trigger_event(
        self,
        request: RecordTriggerEventRequest,
    ) -> RecordTriggerEventResult:
        return self.store.record_trigger_event(request)

    def record_current_git_trigger(
        self,
        request: RecordCurrentGitTriggerRequest,
    ) -> RecordTriggerEventResult:
        state = self.local_git_state.read(request.cwd)
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
        return self.store.record_local_trigger(
            RecordLocalTriggerRequest(
                repository_root=state.repository_root,
                branch_name=state.branch_name,
                kind=request.kind,
                head_sha=state.head_sha,
                previous_head_sha=request.previous_head_sha,
                payload_ref=request.payload_ref,
            )
        )

    def list_trigger_events(
        self,
        request: ListTriggerEventsRequest | None = None,
    ) -> tuple[TriggerEventRecord, ...]:
        resolved = request or ListTriggerEventsRequest()
        return self.store.list_trigger_events(resolved)
