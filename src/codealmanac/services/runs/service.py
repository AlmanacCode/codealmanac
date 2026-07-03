import os
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

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
    NextQueuedRunRequest,
    QueueRunRequest,
    ReadRunLogRequest,
    ReadRunSpecRequest,
    RecordRunEventRequest,
    RecordRunHarnessTranscriptRequest,
    ShowRunRequest,
    StartRunRequest,
    StreamRunAttachRequest,
)
from codealmanac.services.runs.store import RunStore, RunWorkerLease
from codealmanac.services.runs.streaming import RunAttachStreamer
from codealmanac.wiki.workspaces.models import Workspace
from codealmanac.wiki.workspaces.requests import SelectWorkspaceRequest
from codealmanac.wiki.workspaces.service import WorkspacesService


class RunsService:
    def __init__(
        self,
        workspaces: WorkspacesService,
        store: RunStore,
        jobs_path: Path | None = None,
        streamer: RunAttachStreamer | None = None,
    ):
        self.workspaces = workspaces
        self.store = store
        self.jobs_path = jobs_path
        self.streamer = streamer or RunAttachStreamer(store)

    def start(self, request: StartRunRequest) -> RunRecord:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        return self.store.create(
            self.primary_run_dir(workspace),
            self.primary_log_reference_dir(workspace),
            workspace.workspace_id,
            request.operation,
            request.title,
        )

    def queue(self, request: QueueRunRequest) -> RunRecord:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        spec = request.spec.model_copy(
            update={"cwd": request.cwd, "wiki": request.wiki}
        )
        return self.store.queue(
            self.primary_run_dir(workspace),
            self.primary_log_reference_dir(workspace),
            workspace.workspace_id,
            spec,
            request.title,
        )

    def list(self, request: ListRunsRequest) -> tuple[RunRecord, ...]:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        return self.list_workspace_runs(workspace, request.limit)

    def show(self, request: ShowRunRequest) -> RunRecord:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        run_dir = self.existing_run_dir(workspace, request.run_id)
        return self.store.read(run_dir, request.run_id)

    def read_spec(self, request: ReadRunSpecRequest) -> RunSpec | None:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        run_dir = self.existing_run_dir(workspace, request.run_id)
        return self.store.read_spec(run_dir, request.run_id)

    def next_queued(self, request: NextQueuedRunRequest) -> QueuedRun | None:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        queued = self.store.next_queued(self.primary_run_dir(workspace))
        if queued is not None:
            return queued
        legacy = self.legacy_run_dir(workspace)
        if legacy == self.primary_run_dir(workspace):
            return None
        return self.store.next_queued(legacy)

    def acquire_worker_lock(
        self,
        request: AcquireRunWorkerLockRequest,
    ) -> RunWorkerLease | None:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        return self.store.acquire_worker_lock(
            self.primary_run_dir(workspace),
            request.owner,
            request.pid or os.getpid(),
            request.now or datetime.now(UTC),
            request.stale_after,
        )

    def log(self, request: ReadRunLogRequest) -> tuple[RunLogEvent, ...]:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        run_dir = self.existing_run_dir(workspace, request.run_id)
        return self.store.log(run_dir, request.run_id)

    def attach(self, request: AttachRunRequest) -> RunAttachSnapshot:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        run_dir = self.existing_run_dir(workspace, request.run_id)
        return self.store.attach(run_dir, request.run_id)

    def stream_attach(
        self,
        request: StreamRunAttachRequest,
    ) -> Iterator[RunAttachUpdate]:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        run_dir = self.existing_run_dir(workspace, request.run_id)
        return self.streamer.stream(
            run_dir,
            request.run_id,
            request.poll_interval_seconds,
        )

    def record_event(self, request: RecordRunEventRequest) -> RunLogEvent:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        run_dir = self.existing_run_dir(workspace, request.run_id)
        return self.store.append(
            run_dir,
            request.run_id,
            request.kind,
            request.message,
            request.harness_event,
        )

    def mark_running(self, request: MarkRunRunningRequest) -> RunRecord:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        run_dir = self.existing_run_dir(workspace, request.run_id)
        return self.store.mark_running(run_dir, request.run_id)

    def record_harness_transcript(
        self,
        request: RecordRunHarnessTranscriptRequest,
    ) -> RunRecord:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        run_dir = self.existing_run_dir(workspace, request.run_id)
        return self.store.record_harness_transcript(
            run_dir,
            request.run_id,
            request.transcript,
        )

    def finish(self, request: FinishRunRequest) -> RunRecord:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        run_dir = self.existing_run_dir(workspace, request.run_id)
        return self.store.finish(
            run_dir,
            request.run_id,
            request.status,
            request.summary,
            request.error,
        )

    def cancel(self, request: CancelRunRequest) -> RunCancelResult:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        run_dir = self.existing_run_dir(workspace, request.run_id)
        return self.store.cancel(run_dir, request.run_id)

    def resolve_workspace(self, cwd: Path, wiki: str | None) -> Workspace:
        if wiki is None:
            return self.workspaces.resolve(cwd)
        return self.workspaces.select(
            SelectWorkspaceRequest(selector=wiki, base_path=cwd)
        )

    def primary_run_dir(self, workspace: Workspace) -> Path:
        if self.jobs_path is None:
            return self.legacy_run_dir(workspace)
        return self.jobs_path / workspace.workspace_id

    def primary_log_reference_dir(self, workspace: Workspace) -> Path:
        if self.jobs_path is None:
            return workspace.almanac_root / "jobs"
        return self.primary_run_dir(workspace)

    def legacy_run_dir(self, workspace: Workspace) -> Path:
        return workspace.almanac_path / "jobs"

    def run_dirs_for_read(self, workspace: Workspace) -> tuple[Path, ...]:
        primary = self.primary_run_dir(workspace)
        legacy = self.legacy_run_dir(workspace)
        if primary == legacy:
            return (primary,)
        return (primary, legacy)

    def existing_run_dir(self, workspace: Workspace, run_id: str) -> Path:
        for run_dir in self.run_dirs_for_read(workspace):
            if self.store.exists(run_dir, run_id):
                return run_dir
        return self.primary_run_dir(workspace)

    def list_workspace_runs(
        self,
        workspace: Workspace,
        limit: int | None,
    ) -> tuple[RunRecord, ...]:
        records_by_id: dict[str, RunRecord] = {}
        for run_dir in reversed(self.run_dirs_for_read(workspace)):
            for record in self.store.list(run_dir, None):
                records_by_id[record.run_id] = record
        records = sorted(
            records_by_id.values(),
            key=lambda record: (record.created_at, record.run_id),
            reverse=True,
        )
        if limit is not None:
            return tuple(records[:limit])
        return tuple(records)
