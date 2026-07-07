from pathlib import Path

from codealmanac.core.errors import error_summary
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.runs.models import (
    RunQueueDrainResult,
    RunRecord,
    RunWorkerSpawnResult,
)
from codealmanac.services.runs.ports import RunWorkerSpawner
from codealmanac.services.runs.requests import (
    QueueRunRequest,
    SpawnRunWorkerRequest,
)
from codealmanac.services.runs.service import RunsService
from codealmanac.workflows.garden.requests import (
    GardenRequest,
)
from codealmanac.workflows.garden.service import GardenWorkflow
from codealmanac.workflows.ingest.requests import (
    IngestRequest,
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
from codealmanac.workflows.run_queue.specs import (
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
        ingest: IngestWorkflow,
        garden: GardenWorkflow,
        spawner: RunWorkerSpawner,
    ):
        self.repositories = repositories
        self.runs = runs
        self.ingest = ingest
        self.garden = garden
        self.spawner = spawner
        self.worker = RunQueueWorker(runs, ingest, garden)

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
        return self.worker.drain(request)
