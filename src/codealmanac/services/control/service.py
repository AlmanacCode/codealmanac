from codealmanac.services.control.current_git import record_current_git_trigger
from codealmanac.services.control.models import (
    BranchRecord,
    ClaimNextTriggerResult,
    ControlRunEventRecord,
    ControlRunRecord,
    ControlSchemaStatus,
    RecordTriggerEventResult,
    RepositoryRecord,
    SessionRecord,
    TriggerEventRecord,
    TurnRecord,
)
from codealmanac.services.control.ports import LocalGitStateProbe
from codealmanac.services.control.requests import (
    AppendControlRunEventRequest,
    ClaimNextTriggerRequest,
    CreateControlRunRequest,
    GetBranchRequest,
    GetControlRunRequest,
    GetRepositoryRequest,
    LinkTurnBranchRequest,
    ListBranchSessionsRequest,
    ListControlRunEventsRequest,
    ListTriggerEventsRequest,
    ReadControlSchemaStatusRequest,
    RecordCurrentGitTriggerRequest,
    RecordTriggerEventRequest,
    SetBranchPolicyRequest,
    UpdateControlRunRequest,
    UpsertRepositoryRequest,
    UpsertSessionRequest,
    UpsertTurnRequest,
)
from codealmanac.services.control.store import ControlStore


class ControlService:
    def __init__(self, store: ControlStore, local_git_state: LocalGitStateProbe):
        self.store = store
        self.local_git_state = local_git_state

    def ensure_ready(self) -> ControlSchemaStatus:
        return self.store.ensure_ready()

    def status(
        self,
        request: ReadControlSchemaStatusRequest | None = None,
    ) -> ControlSchemaStatus:
        resolved = request or ReadControlSchemaStatusRequest()
        return self.store.status(resolved.ensure)

    def get_repository(self, request: GetRepositoryRequest) -> RepositoryRecord:
        return self.store.get_repository(request)

    def get_branch(self, request: GetBranchRequest) -> BranchRecord:
        return self.store.get_branch(request)

    def get_run(self, request: GetControlRunRequest) -> ControlRunRecord:
        return self.store.get_run(request)

    def list_sessions_for_branch(
        self,
        request: ListBranchSessionsRequest,
    ) -> tuple[SessionRecord, ...]:
        return self.store.list_sessions_for_branch(request)

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
        return record_current_git_trigger(
            self.store,
            self.local_git_state,
            request,
        )

    def list_trigger_events(
        self,
        request: ListTriggerEventsRequest | None = None,
    ) -> tuple[TriggerEventRecord, ...]:
        resolved = request or ListTriggerEventsRequest()
        return self.store.list_trigger_events(resolved)

    def create_run(self, request: CreateControlRunRequest) -> ControlRunRecord:
        return self.store.create_run(request)

    def update_run(self, request: UpdateControlRunRequest) -> ControlRunRecord:
        return self.store.update_run(request)

    def append_run_event(
        self,
        request: AppendControlRunEventRequest,
    ) -> ControlRunEventRecord:
        return self.store.append_run_event(request)

    def upsert_session(self, request: UpsertSessionRequest) -> SessionRecord:
        return self.store.upsert_session(request)

    def upsert_turn(self, request: UpsertTurnRequest) -> TurnRecord:
        return self.store.upsert_turn(request)

    def link_turn_branch(self, request: LinkTurnBranchRequest) -> None:
        self.store.link_turn_branch(request)

    def list_run_events(
        self,
        request: ListControlRunEventsRequest,
    ) -> tuple[ControlRunEventRecord, ...]:
        return self.store.list_run_events(request)

    def claim_next_trigger(
        self,
        request: ClaimNextTriggerRequest | None = None,
    ) -> ClaimNextTriggerResult:
        resolved = request or ClaimNextTriggerRequest()
        return self.store.claim_next_trigger(resolved)
