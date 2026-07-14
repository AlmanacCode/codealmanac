from codealmanac.services.runs.models import RunKind, RunRecord
from codealmanac.services.runs.requests import (
    MarkRunRunningRequest,
    ReadRunSpecRequest,
)
from codealmanac.services.runs.service import RunsService
from codealmanac.workflows.build.requests import StartedBuildRequest
from codealmanac.workflows.build.service import BuildWorkflow
from codealmanac.workflows.garden.requests import StartedGardenRequest
from codealmanac.workflows.garden.service import GardenWorkflow
from codealmanac.workflows.ingest.requests import StartedIngestRequest
from codealmanac.workflows.ingest.service import IngestWorkflow
from codealmanac.workflows.run_queue.ports import RunProcessController
from codealmanac.workflows.run_queue.requests import ExecuteRunRequest


class RunExecutor:
    def __init__(
        self,
        runs: RunsService,
        build: BuildWorkflow,
        ingest: IngestWorkflow,
        garden: GardenWorkflow,
        processes: RunProcessController,
    ):
        self.runs = runs
        self.build = build
        self.ingest = ingest
        self.garden = garden
        self.processes = processes

    def execute(self, request: ExecuteRunRequest) -> RunRecord:
        spec = self.runs.read_spec(ReadRunSpecRequest(run_id=request.run_id))
        if spec is None:
            raise ValueError("queued run is missing its durable spec")
        record = self.runs.mark_running(
            MarkRunRunningRequest(
                run_id=request.run_id,
                execution=self.processes.current_execution(),
            )
        )
        repository = self.runs.repository_for(record)
        if spec.kind == RunKind.BUILD:
            return self.build.execute_started(
                StartedBuildRequest(
                    run_id=record.run_id,
                    harness=spec.harness,
                    model=spec.model,
                    title=spec.title,
                    guidance=spec.guidance,
                    auto_commit=spec.auto_commit,
                )
            ).run
        if spec.kind == RunKind.INGEST:
            return self.ingest.execute_started(
                StartedIngestRequest(
                    cwd=repository.root_path,
                    repository_name=repository.name,
                    inputs=spec.inputs,
                    harness=spec.harness,
                    model=spec.model,
                    title=spec.title,
                    guidance=spec.guidance,
                    auto_commit=spec.auto_commit,
                    run_id=record.run_id,
                )
            ).run
        if spec.kind == RunKind.GARDEN:
            return self.garden.execute_started(
                StartedGardenRequest(
                    cwd=repository.root_path,
                    repository_name=repository.name,
                    harness=spec.harness,
                    model=spec.model,
                    title=spec.title,
                    guidance=spec.guidance,
                    auto_commit=spec.auto_commit,
                    run_id=record.run_id,
                )
            ).run
        raise ValueError(f"unsupported queued run kind: {spec.kind.value}")
