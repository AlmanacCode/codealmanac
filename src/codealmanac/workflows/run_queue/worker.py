from codealmanac.services.runs.models import (
    QueuedRun,
    RunKind,
    RunQueueDrainResult,
    RunRecord,
    RunStatus,
)
from codealmanac.services.runs.requests import (
    AcquireRunWorkerLockRequest,
    FinishRunRequest,
)
from codealmanac.services.runs.service import RunsService
from codealmanac.workflows.build.requests import StartedBuildRequest
from codealmanac.workflows.build.service import BuildWorkflow
from codealmanac.workflows.garden.requests import StartedGardenRequest
from codealmanac.workflows.garden.service import GardenWorkflow
from codealmanac.workflows.ingest.requests import StartedIngestRequest
from codealmanac.workflows.ingest.service import IngestWorkflow
from codealmanac.workflows.run_queue.requests import DrainRunQueueRequest


class RunQueueWorker:
    def __init__(
        self,
        runs: RunsService,
        build: BuildWorkflow,
        ingest: IngestWorkflow,
        garden: GardenWorkflow,
    ):
        self.runs = runs
        self.build = build
        self.ingest = ingest
        self.garden = garden

    def drain(self, request: DrainRunQueueRequest) -> RunQueueDrainResult:
        lease = self.runs.acquire_worker_lock(
            AcquireRunWorkerLockRequest(
                owner=request.owner,
                pid=request.pid,
                now=request.now,
                stale_after=request.stale_after,
            )
        )
        if lease is None:
            return RunQueueDrainResult(lock_acquired=False)
        processed: list[RunRecord] = []
        try:
            while request.max_runs is None or len(processed) < request.max_runs:
                queued = self.runs.next_queued()
                if queued is None:
                    break
                processed.append(self.run_queued(queued))
            return RunQueueDrainResult(
                lock_acquired=True,
                processed=tuple(processed),
            )
        finally:
            lease.release()

    def run_queued(self, queued: QueuedRun) -> RunRecord:
        spec = queued.spec
        if spec is None:
            return self.fail_queued_run(
                queued.record,
                "queued run is missing its durable spec",
            )
        repository = self.runs.repository_for(queued.record)
        if spec.kind == RunKind.BUILD:
            result = self.build.run_started(
                StartedBuildRequest(
                    run_id=queued.record.run_id,
                    harness=spec.harness,
                    model=spec.model,
                    title=spec.title,
                    guidance=spec.guidance,
                    auto_commit=spec.auto_commit,
                )
            )
            return result.run
        if spec.kind == RunKind.INGEST:
            result = self.ingest.run_started(
                StartedIngestRequest(
                    cwd=repository.root_path,
                    repository_name=repository.name,
                    inputs=spec.inputs,
                    harness=spec.harness,
                    model=spec.model,
                    title=spec.title,
                    guidance=spec.guidance,
                    auto_commit=spec.auto_commit,
                    run_id=queued.record.run_id,
                )
            )
            return result.run
        if spec.kind == RunKind.GARDEN:
            result = self.garden.run_started(
                StartedGardenRequest(
                    cwd=repository.root_path,
                    repository_name=repository.name,
                    harness=spec.harness,
                    model=spec.model,
                    title=spec.title,
                    guidance=spec.guidance,
                    auto_commit=spec.auto_commit,
                    run_id=queued.record.run_id,
                )
            )
            return result.run
        return self.unsupported_run(queued.record, spec.kind)

    def unsupported_run(self, record: RunRecord, kind: RunKind) -> RunRecord:
        return self.fail_queued_run(
            record,
            f"unsupported queued run kind: {kind.value}",
        )

    def fail_queued_run(self, record: RunRecord, error: str) -> RunRecord:
        return self.runs.finish(
            FinishRunRequest(
                run_id=record.run_id,
                status=RunStatus.FAILED,
                error=error,
            )
        )
