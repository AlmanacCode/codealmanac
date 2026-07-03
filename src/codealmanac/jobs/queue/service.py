from pathlib import Path

from codealmanac.jobs.ledger.models import (
    JobOperation,
    JobQueueDrainResult,
    JobRecord,
    JobSpec,
    JobStatus,
    QueuedJob,
)
from codealmanac.jobs.ledger.ports import JobWorkerSpawner
from codealmanac.jobs.ledger.requests import (
    AcquireJobWorkerLockRequest,
    FinishJobRequest,
    NextQueuedJobRequest,
    QueueJobRequest,
    SpawnJobWorkerRequest,
)
from codealmanac.jobs.ledger.service import JobLedgerService
from codealmanac.jobs.queue.models import JobQueueStartResult
from codealmanac.jobs.queue.requests import DrainJobQueueRequest
from codealmanac.workflows.garden.requests import (
    RunGardenRequest,
    RunGardenWithJobRequest,
)
from codealmanac.workflows.garden.service import GardenWorkflow
from codealmanac.workflows.ingest.requests import (
    RunIngestRequest,
    RunIngestWithJobRequest,
)
from codealmanac.workflows.ingest.service import IngestWorkflow
from codealmanac.workflows.init.requests import (
    RunInitRequest,
    RunInitWithJobRequest,
)
from codealmanac.workflows.init.service import InitWorkflow


class JobQueueWorkflow:
    def __init__(
        self,
        jobs: JobLedgerService,
        init: InitWorkflow,
        ingest: IngestWorkflow,
        garden: GardenWorkflow,
        spawner: JobWorkerSpawner,
    ):
        self.jobs = jobs
        self.init = init
        self.ingest = ingest
        self.garden = garden
        self.spawner = spawner

    def queue_init(self, request: RunInitRequest) -> JobRecord:
        prepared = self.init.prepare(request, enforce_force=True)
        return self.jobs.queue(
            QueueJobRequest(
                cwd=prepared.workspace.root_path,
                title=request.title or "Initialize wiki",
                spec=JobSpec(
                    operation=JobOperation.INIT,
                    cwd=prepared.workspace.root_path,
                    harness=request.harness,
                    almanac_root=prepared.workspace.almanac_root,
                    workspace_name=prepared.workspace.name,
                    description=prepared.workspace.description,
                    title=request.title,
                    guidance=request.guidance,
                    force=request.force,
                ),
            )
        )

    def start_init_background(self, request: RunInitRequest) -> JobQueueStartResult:
        job = self.queue_init(request)
        worker = self.spawn_worker(request.path, None)
        return JobQueueStartResult(job=job, worker=worker)

    def queue_ingest(self, request: RunIngestRequest) -> JobRecord:
        return self.jobs.queue(
            QueueJobRequest(
                cwd=request.cwd,
                wiki=request.wiki,
                title=request.title or default_ingest_title(request.inputs),
                spec=JobSpec(
                    operation=JobOperation.INGEST,
                    cwd=request.cwd,
                    wiki=request.wiki,
                    harness=request.harness,
                    inputs=request.inputs,
                    title=request.title,
                    guidance=request.guidance,
                ),
            )
        )

    def start_ingest_background(self, request: RunIngestRequest) -> JobQueueStartResult:
        job = self.queue_ingest(request)
        worker = self.spawn_worker(request.cwd, request.wiki)
        return JobQueueStartResult(job=job, worker=worker)

    def queue_garden(self, request: RunGardenRequest) -> JobRecord:
        return self.jobs.queue(
            QueueJobRequest(
                cwd=request.cwd,
                wiki=request.wiki,
                title=request.title or "Garden wiki",
                spec=JobSpec(
                    operation=JobOperation.GARDEN,
                    cwd=request.cwd,
                    wiki=request.wiki,
                    harness=request.harness,
                    title=request.title,
                    guidance=request.guidance,
                ),
            )
        )

    def start_garden_background(self, request: RunGardenRequest) -> JobQueueStartResult:
        job = self.queue_garden(request)
        worker = self.spawn_worker(request.cwd, request.wiki)
        return JobQueueStartResult(job=job, worker=worker)

    def spawn_worker(self, cwd: Path, wiki: str | None):
        return self.spawner.spawn(SpawnJobWorkerRequest(cwd=cwd, wiki=wiki))

    def drain(self, request: DrainJobQueueRequest) -> JobQueueDrainResult:
        lease = self.jobs.acquire_worker_lock(
            AcquireJobWorkerLockRequest(
                cwd=request.cwd,
                wiki=request.wiki,
                owner=request.owner,
                pid=request.pid,
                now=request.now,
                stale_after=request.stale_after,
            )
        )
        if lease is None:
            return JobQueueDrainResult(lock_acquired=False)
        processed: list[JobRecord] = []
        try:
            while request.max_jobs is None or len(processed) < request.max_jobs:
                queued = self.jobs.next_queued(
                    NextQueuedJobRequest(cwd=request.cwd, wiki=request.wiki)
                )
                if queued is None:
                    break
                processed.append(self.run_one(queued, request))
            return JobQueueDrainResult(
                lock_acquired=True,
                processed=tuple(processed),
            )
        finally:
            lease.release()

    def run_one(
        self,
        queued: QueuedJob,
        request: DrainJobQueueRequest,
    ) -> JobRecord:
        spec = queued.spec
        if spec is None:
            return self.jobs.finish(
                FinishJobRequest(
                    cwd=request.cwd,
                    wiki=request.wiki,
                    job_id=queued.record.job_id,
                    status=JobStatus.FAILED,
                    error="queued job is missing its durable spec",
                )
            )
        if spec.operation == JobOperation.INIT:
            result = self.init.run_with_job(
                RunInitWithJobRequest(
                    path=spec.cwd,
                    harness=spec.harness,
                    almanac_root=spec.almanac_root,
                    name=spec.workspace_name,
                    description=spec.description,
                    title=spec.title,
                    guidance=spec.guidance,
                    force=spec.force,
                    job_id=queued.record.job_id,
                )
            )
            return result.job
        if spec.operation == JobOperation.INGEST:
            result = self.ingest.run_with_job(
                RunIngestWithJobRequest(
                    cwd=spec.cwd,
                    wiki=spec.wiki,
                    inputs=spec.inputs,
                    harness=spec.harness,
                    title=spec.title,
                    guidance=spec.guidance,
                    job_id=queued.record.job_id,
                )
            )
            return result.job
        if spec.operation == JobOperation.GARDEN:
            result = self.garden.run_with_job(
                RunGardenWithJobRequest(
                    cwd=spec.cwd,
                    wiki=spec.wiki,
                    harness=spec.harness,
                    title=spec.title,
                    guidance=spec.guidance,
                    job_id=queued.record.job_id,
                )
            )
            return result.job
        return self.jobs.finish(
            FinishJobRequest(
                cwd=request.cwd,
                wiki=request.wiki,
                job_id=queued.record.job_id,
                status=JobStatus.FAILED,
                error=f"unsupported queued job operation: {spec.operation.value}",
            )
        )


def default_ingest_title(inputs: tuple[str, ...]) -> str:
    if len(inputs) == 1:
        return f"Ingest {inputs[0]}"
    return f"Ingest {len(inputs)} sources"
