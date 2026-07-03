import os
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

from codealmanac.jobs.ledger.models import (
    JobAttachSnapshot,
    JobAttachUpdate,
    JobCancelResult,
    JobLogEvent,
    JobRecord,
    JobSpec,
    QueuedJob,
)
from codealmanac.jobs.ledger.requests import (
    AcquireJobWorkerLockRequest,
    AttachJobRequest,
    CancelJobRequest,
    FinishJobRequest,
    ListJobsRequest,
    MarkJobRunningRequest,
    NextQueuedJobRequest,
    QueueJobRequest,
    ReadJobLogRequest,
    ReadJobSpecRequest,
    RecordJobEventRequest,
    RecordJobHarnessTranscriptRequest,
    ShowJobRequest,
    StartJobRequest,
    StreamJobAttachRequest,
)
from codealmanac.jobs.ledger.store import JobStore, JobWorkerLease
from codealmanac.jobs.ledger.streaming import JobAttachStreamer
from codealmanac.wiki.workspaces.models import Workspace
from codealmanac.wiki.workspaces.requests import SelectWorkspaceRequest
from codealmanac.wiki.workspaces.service import WorkspacesService


class JobLedgerService:
    def __init__(
        self,
        workspaces: WorkspacesService,
        store: JobStore,
        jobs_path: Path | None = None,
        streamer: JobAttachStreamer | None = None,
    ):
        self.workspaces = workspaces
        self.store = store
        self.jobs_path = jobs_path
        self.streamer = streamer or JobAttachStreamer(store)

    def start(self, request: StartJobRequest) -> JobRecord:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        return self.store.create(
            self.primary_job_dir(workspace),
            self.primary_log_reference_dir(workspace),
            workspace.workspace_id,
            request.operation,
            request.title,
        )

    def queue(self, request: QueueJobRequest) -> JobRecord:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        spec = request.spec.model_copy(
            update={"cwd": request.cwd, "wiki": request.wiki}
        )
        return self.store.queue(
            self.primary_job_dir(workspace),
            self.primary_log_reference_dir(workspace),
            workspace.workspace_id,
            spec,
            request.title,
        )

    def list(self, request: ListJobsRequest) -> tuple[JobRecord, ...]:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        return self.list_workspace_jobs(workspace, request.limit)

    def show(self, request: ShowJobRequest) -> JobRecord:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        job_dir = self.existing_job_dir(workspace, request.job_id)
        return self.store.read(job_dir, request.job_id)

    def read_spec(self, request: ReadJobSpecRequest) -> JobSpec | None:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        job_dir = self.existing_job_dir(workspace, request.job_id)
        return self.store.read_spec(job_dir, request.job_id)

    def next_queued(self, request: NextQueuedJobRequest) -> QueuedJob | None:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        queued = self.store.next_queued(self.primary_job_dir(workspace))
        if queued is not None:
            return queued
        legacy = self.legacy_job_dir(workspace)
        if legacy == self.primary_job_dir(workspace):
            return None
        return self.store.next_queued(legacy)

    def acquire_worker_lock(
        self,
        request: AcquireJobWorkerLockRequest,
    ) -> JobWorkerLease | None:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        return self.store.acquire_worker_lock(
            self.primary_job_dir(workspace),
            request.owner,
            request.pid or os.getpid(),
            request.now or datetime.now(UTC),
            request.stale_after,
        )

    def log(self, request: ReadJobLogRequest) -> tuple[JobLogEvent, ...]:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        job_dir = self.existing_job_dir(workspace, request.job_id)
        return self.store.log(job_dir, request.job_id)

    def attach(self, request: AttachJobRequest) -> JobAttachSnapshot:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        job_dir = self.existing_job_dir(workspace, request.job_id)
        return self.store.attach(job_dir, request.job_id)

    def stream_attach(
        self,
        request: StreamJobAttachRequest,
    ) -> Iterator[JobAttachUpdate]:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        job_dir = self.existing_job_dir(workspace, request.job_id)
        return self.streamer.stream(
            job_dir,
            request.job_id,
            request.poll_interval_seconds,
        )

    def record_event(self, request: RecordJobEventRequest) -> JobLogEvent:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        job_dir = self.existing_job_dir(workspace, request.job_id)
        return self.store.append(
            job_dir,
            request.job_id,
            request.kind,
            request.message,
            request.harness_event,
        )

    def mark_running(self, request: MarkJobRunningRequest) -> JobRecord:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        job_dir = self.existing_job_dir(workspace, request.job_id)
        return self.store.mark_running(job_dir, request.job_id)

    def record_harness_transcript(
        self,
        request: RecordJobHarnessTranscriptRequest,
    ) -> JobRecord:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        job_dir = self.existing_job_dir(workspace, request.job_id)
        return self.store.record_harness_transcript(
            job_dir,
            request.job_id,
            request.transcript,
        )

    def finish(self, request: FinishJobRequest) -> JobRecord:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        job_dir = self.existing_job_dir(workspace, request.job_id)
        return self.store.finish(
            job_dir,
            request.job_id,
            request.status,
            request.summary,
            request.error,
        )

    def cancel(self, request: CancelJobRequest) -> JobCancelResult:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        job_dir = self.existing_job_dir(workspace, request.job_id)
        return self.store.cancel(job_dir, request.job_id)

    def resolve_workspace(self, cwd: Path, wiki: str | None) -> Workspace:
        if wiki is None:
            return self.workspaces.resolve(cwd)
        return self.workspaces.select(
            SelectWorkspaceRequest(selector=wiki, base_path=cwd)
        )

    def primary_job_dir(self, workspace: Workspace) -> Path:
        if self.jobs_path is None:
            return self.legacy_job_dir(workspace)
        return self.jobs_path / workspace.workspace_id

    def primary_log_reference_dir(self, workspace: Workspace) -> Path:
        if self.jobs_path is None:
            return workspace.almanac_root / "jobs"
        return self.primary_job_dir(workspace)

    def legacy_job_dir(self, workspace: Workspace) -> Path:
        return workspace.almanac_path / "jobs"

    def job_dirs_for_read(self, workspace: Workspace) -> tuple[Path, ...]:
        primary = self.primary_job_dir(workspace)
        legacy = self.legacy_job_dir(workspace)
        if primary == legacy:
            return (primary,)
        return (primary, legacy)

    def existing_job_dir(self, workspace: Workspace, job_id: str) -> Path:
        for job_dir in self.job_dirs_for_read(workspace):
            if self.store.exists(job_dir, job_id):
                return job_dir
        return self.primary_job_dir(workspace)

    def list_workspace_jobs(
        self,
        workspace: Workspace,
        limit: int | None,
    ) -> tuple[JobRecord, ...]:
        records_by_id: dict[str, JobRecord] = {}
        for job_dir in reversed(self.job_dirs_for_read(workspace)):
            for record in self.store.list(job_dir, None):
                records_by_id[record.job_id] = record
        records = sorted(
            records_by_id.values(),
            key=lambda record: (record.created_at, record.job_id),
            reverse=True,
        )
        if limit is not None:
            return tuple(records[:limit])
        return tuple(records)
