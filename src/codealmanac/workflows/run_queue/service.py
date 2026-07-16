from pathlib import Path

from codealmanac.core.errors import error_summary
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.runs.models import (
    RunCancelResult,
    RunKind,
    RunQueueDrainResult,
    RunRecord,
    RunWorkerSpawnResult,
)
from codealmanac.services.runs.ports import RunWorkerSpawner
from codealmanac.services.runs.requests import (
    CancelRunRequest,
    QueueRunRequest,
    SpawnRunWorkerRequest,
)
from codealmanac.services.runs.service import RunsService
from codealmanac.services.telemetry.service import TelemetryService
from codealmanac.workflows.build.requests import BuildRequest
from codealmanac.workflows.build.service import BuildWorkflow
from codealmanac.workflows.garden.requests import (
    GardenRequest,
)
from codealmanac.workflows.garden.service import GardenWorkflow
from codealmanac.workflows.ingest.requests import (
    IngestRequest,
)
from codealmanac.workflows.ingest.service import IngestWorkflow
from codealmanac.workflows.run_queue.control import RunCancellation
from codealmanac.workflows.run_queue.executor import RunExecutor
from codealmanac.workflows.run_queue.models import (
    RunQueueStartResult,
    ScheduledGardenResult,
)
from codealmanac.workflows.run_queue.ports import (
    RunExecutorSpawner,
)
from codealmanac.workflows.run_queue.requests import (
    DrainRunQueueRequest,
    ExecuteRunRequest,
    ScheduledGardenRequest,
)
from codealmanac.workflows.run_queue.specs import (
    build_run_spec,
    build_run_title,
    garden_run_spec,
    garden_run_title,
    ingest_run_spec,
    ingest_run_title,
)
from codealmanac.workflows.run_queue.worker import RunQueueWorker


class RunQueue:
    def __init__(
        self,
        repositories: RepositoriesService,
        runs: RunsService,
        build: BuildWorkflow,
        ingest: IngestWorkflow,
        garden: GardenWorkflow,
        spawner: RunWorkerSpawner,
        executor: RunExecutor,
        executor_spawner: RunExecutorSpawner,
        cancellation: RunCancellation,
        telemetry: TelemetryService,
    ):
        self.repositories = repositories
        self.runs = runs
        self.build = build
        self.ingest = ingest
        self.garden = garden
        self.spawner = spawner
        self.executor = executor
        self.cancellation = cancellation
        self.worker = RunQueueWorker(runs, executor_spawner, telemetry)

    def queue_build(self, request: BuildRequest) -> RunRecord:
        repository = self.build.prepare(request)
        return self.runs.queue(
            QueueRunRequest(
                repository_id=repository.repository_id,
                title=build_run_title(request),
                spec=build_run_spec(request),
            )
        )

    def start_build(self, request: BuildRequest) -> RunQueueStartResult:
        run = self.queue_build(request)
        worker = self.spawn_worker(request.path)
        return self.start_result(run, worker)

    def queue_ingest(self, request: IngestRequest) -> RunRecord:
        repository = self.repositories.select_for_operation(
            request.cwd,
            request.repository_name,
        )
        return self.runs.queue(
            QueueRunRequest(
                repository_id=repository.repository_id,
                title=ingest_run_title(request),
                spec=ingest_run_spec(request),
            )
        )

    def start_ingest(self, request: IngestRequest) -> RunQueueStartResult:
        run = self.queue_ingest(request)
        worker = self.spawn_worker(request.cwd)
        return self.start_result(run, worker)

    def queue_garden(self, request: GardenRequest) -> RunRecord:
        repository = self.repositories.select_for_operation(
            request.cwd,
            request.repository_name,
        )
        return self.runs.queue(
            QueueRunRequest(
                repository_id=repository.repository_id,
                title=garden_run_title(request),
                spec=garden_run_spec(request),
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
        skipped = []
        worker_cwd = None
        for repository in self.repositories.list():
            if self.runs.has_active_run(repository.repository_id, RunKind.GARDEN):
                skipped.append(repository)
                continue
            run = self.queue_garden(
                GardenRequest(
                    cwd=repository.root_path,
                    repository_name=repository.name,
                    harness=request.harness,
                    model=request.model,
                    auto_commit=request.auto_commit,
                )
            )
            runs.append(run)
            worker_cwd = worker_cwd or repository.root_path
        if worker_cwd is None:
            return ScheduledGardenResult(runs=tuple(runs), skipped=tuple(skipped))
        try:
            worker = self.spawn_worker(worker_cwd)
        except Exception as error:
            return ScheduledGardenResult(
                runs=tuple(runs),
                skipped=tuple(skipped),
                worker_error=error_summary(error),
            )
        return ScheduledGardenResult(
            runs=tuple(runs),
            skipped=tuple(skipped),
            worker=worker,
        )

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
        return self.worker.drain(request)

    def execute(self, request: ExecuteRunRequest) -> RunRecord:
        return self.executor.execute(request)

    def cancel(self, request: CancelRunRequest) -> RunCancelResult:
        return self.cancellation.cancel(request)
