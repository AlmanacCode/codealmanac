from pathlib import Path

from codealmanac.core.errors import error_summary
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.runs.models import (
    QueuedRun,
    RunKind,
    RunQueueDrainResult,
    RunRecord,
    RunSpec,
    RunStatus,
    RunWorkerSpawnResult,
)
from codealmanac.services.runs.ports import RunWorkerSpawner
from codealmanac.services.runs.requests import (
    AcquireRunWorkerLockRequest,
    FinishRunRequest,
    QueueRunRequest,
    SpawnRunWorkerRequest,
)
from codealmanac.services.runs.service import RunsService
from codealmanac.workflows.garden.requests import (
    GardenRequest,
    StartedGardenRequest,
)
from codealmanac.workflows.garden.service import GardenWorkflow
from codealmanac.workflows.ingest.requests import (
    IngestRequest,
    StartedIngestRequest,
)
from codealmanac.workflows.ingest.service import IngestWorkflow
from codealmanac.workflows.run_queue.models import (
    RunQueueStartResult,
    ScheduledGardenResult,
)
from codealmanac.workflows.run_queue.requests import (
    DrainRunQueueRequest,
    ScheduledGardenRequest,
)


class RunQueue:
    def __init__(
        self,
        repositories: RepositoriesService,
        runs: RunsService,
        ingest: IngestWorkflow,
        garden: GardenWorkflow,
        spawner: RunWorkerSpawner,
    ):
        self.repositories = repositories
        self.runs = runs
        self.ingest = ingest
        self.garden = garden
        self.spawner = spawner

    def queue_ingest(self, request: IngestRequest) -> RunRecord:
        repository = self.repositories.select_operation_repository(
            request.cwd,
            request.repository_name,
        )
        return self.runs.queue(
            QueueRunRequest(
                repository_id=repository.repository_id,
                title=request.title or default_ingest_title(request.inputs),
                spec=RunSpec(
                    kind=RunKind.INGEST,
                    harness=request.harness,
                    inputs=request.inputs,
                    title=request.title,
                    guidance=request.guidance,
                    auto_commit=request.auto_commit,
                ),
            )
        )

    def start_ingest(self, request: IngestRequest) -> RunQueueStartResult:
        run = self.queue_ingest(request)
        worker = self.spawn_worker(request.cwd)
        return self.start_result(run, worker)

    def queue_garden(self, request: GardenRequest) -> RunRecord:
        repository = self.repositories.select_operation_repository(
            request.cwd,
            request.repository_name,
        )
        return self.runs.queue(
            QueueRunRequest(
                repository_id=repository.repository_id,
                title=request.title or "Garden wiki",
                spec=RunSpec(
                    kind=RunKind.GARDEN,
                    harness=request.harness,
                    title=request.title,
                    guidance=request.guidance,
                    auto_commit=request.auto_commit,
                ),
            )
        )

    def start_garden(self, request: GardenRequest) -> RunQueueStartResult:
        run = self.queue_garden(request)
        worker = self.spawn_worker(request.cwd)
        return self.start_result(run, worker)

    def start_scheduled_garden(
        self,
        request: ScheduledGardenRequest,
    ) -> ScheduledGardenResult:
        runs: list[RunRecord] = []
        worker_cwd = None
        for repository in self.repositories.list():
            run = self.queue_garden(
                GardenRequest(
                    cwd=repository.root_path,
                    repository_name=repository.name,
                    harness=request.harness,
                    auto_commit=request.auto_commit,
                )
            )
            runs.append(run)
            worker_cwd = worker_cwd or repository.root_path
        if worker_cwd is None:
            return ScheduledGardenResult(runs=tuple(runs))
        try:
            worker = self.spawn_worker(worker_cwd)
        except Exception as error:
            return ScheduledGardenResult(
                runs=tuple(runs),
                worker_error=error_summary(error),
            )
        return ScheduledGardenResult(runs=tuple(runs), worker=worker)

    def spawn_worker(self, cwd: Path) -> RunWorkerSpawnResult:
        return self.spawner.spawn(SpawnRunWorkerRequest(cwd=cwd))

    def start_result(
        self,
        run: RunRecord,
        worker: RunWorkerSpawnResult,
    ) -> RunQueueStartResult:
        return RunQueueStartResult(
            run=run,
            repository=self.runs.repository_for(run),
            runs_ahead=self.runs.queued_before(run),
            worker=worker,
        )

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
                processed.append(self.run_one(queued))
            return RunQueueDrainResult(
                lock_acquired=True,
                processed=tuple(processed),
            )
        finally:
            lease.release()

    def run_one(self, queued: QueuedRun) -> RunRecord:
        spec = queued.spec
        if spec is None:
            return self.runs.finish(
                FinishRunRequest(
                    run_id=queued.record.run_id,
                    status=RunStatus.FAILED,
                    error="queued run is missing its durable spec",
                )
            )
        repository = self.runs.repository_for(queued.record)
        if spec.kind == RunKind.INGEST:
            result = self.ingest.run_started(
                StartedIngestRequest(
                    cwd=repository.root_path,
                    repository_name=repository.name,
                    inputs=spec.inputs,
                    harness=spec.harness,
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
                    title=spec.title,
                    guidance=spec.guidance,
                    auto_commit=spec.auto_commit,
                    run_id=queued.record.run_id,
                )
            )
            return result.run
        return self.runs.finish(
            FinishRunRequest(
                run_id=queued.record.run_id,
                status=RunStatus.FAILED,
                error=f"unsupported queued run kind: {spec.kind.value}",
            )
        )


def default_ingest_title(inputs: tuple[str, ...]) -> str:
    if len(inputs) == 1:
        return f"Ingest {inputs[0]}"
    return f"Ingest {len(inputs)} sources"
