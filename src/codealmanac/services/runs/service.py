import os
from collections.abc import Iterator
from datetime import UTC, datetime

from codealmanac.core.errors import NotFoundError
from codealmanac.services.repositories.models import Repository, RepositoryName
from codealmanac.services.repositories.requests import SelectRepositoryRequest
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.runs.locks import RunWorkerLease
from codealmanac.services.runs.models import (
    QueuedRun,
    RunAttachSnapshot,
    RunAttachUpdate,
    RunCancellationPlan,
    RunCancelResult,
    RunKind,
    RunLogEvent,
    RunRecord,
    RunSpec,
    RunWorkerIdleHandoffOutcome,
)
from codealmanac.services.runs.requests import (
    AcquireRunWorkerLockRequest,
    AttachRunRequest,
    CancelRunRequest,
    FinishRunCancellationRequest,
    FinishRunRequest,
    ListRunsRequest,
    MarkRunRunningRequest,
    QueueRunRequest,
    ReadRunLogRequest,
    ReadRunSpecRequest,
    RecordRunEventRequest,
    RecordRunHarnessTranscriptRequest,
    ReleaseRunWorkerIfIdleRequest,
    ShowRunRequest,
    StartRunRequest,
    StreamRunAttachRequest,
)
from codealmanac.services.runs.store import RunStore
from codealmanac.services.runs.streaming import RunAttachStreamer


class RunsService:
    def __init__(
        self,
        repositories: RepositoriesService,
        store: RunStore,
        streamer: RunAttachStreamer | None = None,
    ):
        self.repositories = repositories
        self.store = store
        self.streamer = streamer or RunAttachStreamer(store)

    def start(self, request: StartRunRequest) -> RunRecord:
        return self.store.create(
            request.repository_id,
            request.kind,
            request.title,
        )

    def queue(self, request: QueueRunRequest) -> RunRecord:
        return self.store.queue(
            request.repository_id,
            request.spec,
            request.title,
        )

    def list(self, request: ListRunsRequest) -> tuple[RunRecord, ...]:
        repository = self.repository_filter(request.repository_name)
        repository_id = None if repository is None else repository.repository_id
        return self.store.list(request.limit, repository_id=repository_id)

    def show(self, request: ShowRunRequest) -> RunRecord:
        record = self.store.read(request.run_id)
        self.require_run_matches_repository(record, request.repository_name)
        return record

    def read_spec(self, request: ReadRunSpecRequest) -> RunSpec | None:
        record = self.store.read(request.run_id)
        self.require_run_matches_repository(record, request.repository_name)
        return self.store.read_spec(request.run_id)

    def next_queued(self) -> QueuedRun | None:
        return self.store.next_queued()

    def queued_before(self, record: RunRecord) -> int:
        return self.store.queued_before(record)

    def has_active_run(self, repository_id: str, kind: RunKind) -> bool:
        return self.store.has_active_run(repository_id, kind)

    def repository_for(self, record: RunRecord) -> Repository:
        return self.repositories.get(record.repository_id)

    def acquire_worker_lock(
        self,
        request: AcquireRunWorkerLockRequest,
    ) -> RunWorkerLease | None:
        return self.store.acquire_worker_lock(
            request.owner,
            request.pid or os.getpid(),
            request.now or datetime.now(UTC),
            request.stale_after,
        )

    def release_worker_if_idle(
        self,
        request: ReleaseRunWorkerIfIdleRequest,
    ) -> RunWorkerIdleHandoffOutcome:
        return self.store.release_worker_if_idle(request.owner)

    def log(self, request: ReadRunLogRequest) -> tuple[RunLogEvent, ...]:
        record = self.store.read(request.run_id)
        self.require_run_matches_repository(record, request.repository_name)
        return self.store.log(request.run_id)

    def attach(self, request: AttachRunRequest) -> RunAttachSnapshot:
        snapshot = self.store.attach(request.run_id)
        self.require_run_matches_repository(snapshot.record, request.repository_name)
        return snapshot

    def stream_attach(
        self,
        request: StreamRunAttachRequest,
    ) -> Iterator[RunAttachUpdate]:
        record = self.store.read(request.run_id)
        self.require_run_matches_repository(record, request.repository_name)
        return self.streamer.stream(
            request.run_id,
            request.poll_interval_seconds,
        )

    def record_event(self, request: RecordRunEventRequest) -> RunLogEvent:
        return self.store.record_event(
            request.run_id,
            request.kind,
            request.message,
            request.harness_event,
        )

    def mark_running(self, request: MarkRunRunningRequest) -> RunRecord:
        return self.store.mark_running(request.run_id, request.execution)

    def record_harness_transcript(
        self,
        request: RecordRunHarnessTranscriptRequest,
    ) -> RunRecord:
        return self.store.record_harness_transcript(
            request.run_id,
            request.transcript,
        )

    def finish(self, request: FinishRunRequest) -> RunRecord:
        return self.store.finish(
            request.run_id,
            request.status,
            request.summary,
            request.error,
        )

    def prepare_cancellation(
        self,
        request: CancelRunRequest,
    ) -> RunCancellationPlan:
        record = self.store.read(request.run_id)
        self.require_run_matches_repository(record, request.repository_name)
        return self.store.prepare_cancellation(request.run_id)

    def finish_cancellation(
        self,
        request: FinishRunCancellationRequest,
    ) -> RunCancelResult:
        return self.store.finish_cancellation(
            request.run_id,
            request.execution_id,
        )

    def repository_filter(
        self,
        repository_name: RepositoryName | None,
    ) -> Repository | None:
        if repository_name is None:
            return None
        return self.repositories.select_by_name(
            SelectRepositoryRequest(name=repository_name)
        )

    def require_run_matches_repository(
        self,
        record: RunRecord,
        repository_name: RepositoryName | None,
    ) -> None:
        repository = self.repository_filter(repository_name)
        if repository is None:
            return
        if record.repository_id != repository.repository_id:
            raise NotFoundError("run", record.run_id)
