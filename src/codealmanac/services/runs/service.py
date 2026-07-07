import os
from collections.abc import Iterator
from datetime import UTC, datetime

from codealmanac.core.errors import NotFoundError
from codealmanac.services.repositories.models import Repository
from codealmanac.services.repositories.requests import SelectRepositoryRequest
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.runs.locks import RunWorkerLease
from codealmanac.services.runs.models import (
    QueuedRun,
    RunAttachSnapshot,
    RunAttachUpdate,
    RunCancelResult,
    RunLogEvent,
    RunRecord,
    RunSpec,
)
from codealmanac.services.runs.requests import (
    AcquireRunWorkerLockRequest,
    AttachRunRequest,
    CancelRunRequest,
    FinishRunRequest,
    ListRunsRequest,
    MarkRunRunningRequest,
    QueueRunRequest,
    ReadRunLogRequest,
    ReadRunSpecRequest,
    RecordRunEventRequest,
    RecordRunHarnessTranscriptRequest,
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
        repository = self.selected_repository(request.repository_name)
        repository_id = None if repository is None else repository.repository_id
        return self.store.list(request.limit, repository_id=repository_id)

    def show(self, request: ShowRunRequest) -> RunRecord:
        record = self.store.read(request.run_id)
        self.require_selected_run(record, request.repository_name)
        return record

    def read_spec(self, request: ReadRunSpecRequest) -> RunSpec | None:
        record = self.store.read(request.run_id)
        self.require_selected_run(record, request.repository_name)
        return self.store.read_spec(request.run_id)

    def next_queued(self) -> QueuedRun | None:
        return self.store.next_queued()

    def queued_before(self, record: RunRecord) -> int:
        return self.store.queued_before(record)

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

    def log(self, request: ReadRunLogRequest) -> tuple[RunLogEvent, ...]:
        record = self.store.read(request.run_id)
        self.require_selected_run(record, request.repository_name)
        return self.store.log(request.run_id)

    def attach(self, request: AttachRunRequest) -> RunAttachSnapshot:
        snapshot = self.store.attach(request.run_id)
        self.require_selected_run(snapshot.record, request.repository_name)
        return snapshot

    def stream_attach(
        self,
        request: StreamRunAttachRequest,
    ) -> Iterator[RunAttachUpdate]:
        record = self.store.read(request.run_id)
        self.require_selected_run(record, request.repository_name)
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
        return self.store.mark_running(request.run_id)

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

    def cancel(self, request: CancelRunRequest) -> RunCancelResult:
        record = self.store.read(request.run_id)
        self.require_selected_run(record, request.repository_name)
        return self.store.cancel(request.run_id)

    def selected_repository(self, repository_name: str | None) -> Repository | None:
        if repository_name is None:
            return None
        return self.repositories.select_by_name(
            SelectRepositoryRequest(name=repository_name)
        )

    def require_selected_run(
        self,
        record: RunRecord,
        repository_name: str | None,
    ) -> None:
        repository = self.selected_repository(repository_name)
        if repository is None:
            return
        if record.repository_id != repository.repository_id:
            raise NotFoundError("run", record.run_id)
