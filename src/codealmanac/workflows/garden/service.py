from codealmanac.manual import ManualLibrary
from codealmanac.services.harnesses.models import HarnessAgentKind
from codealmanac.services.health.requests import HealthCheckRequest
from codealmanac.services.health.service import HealthService
from codealmanac.services.index.models import HealthReport, IndexSummary
from codealmanac.services.index.service import IndexService
from codealmanac.services.repositories.models import Repository
from codealmanac.services.runs.models import RunEventKind, RunFailureCategory
from codealmanac.workflows.garden.models import GardenPromptPayload, GardenResult
from codealmanac.workflows.garden.requests import StartedGardenRequest
from codealmanac.workflows.operations import (
    BeginOperationRequest,
    ExecuteOperationRequest,
    OperationRunner,
    RecordOperationEventRequest,
)
from codealmanac.workflows.operations.commit import operation_commit_policy


class GardenWorkflow:
    def __init__(
        self,
        index: IndexService,
        health: HealthService,
        operations: OperationRunner,
        manual: ManualLibrary,
    ):
        self.index = index
        self.health = health
        self.operations = operations
        self.manual = manual

    def execute_started(self, request: StartedGardenRequest) -> GardenResult:
        context = self.operations.begin(
            BeginOperationRequest(
                run_id=request.run_id,
            )
        )
        with self.operations.failure_phase(
            context,
            RunFailureCategory.INDEXING,
        ):
            index_before = self.index.summary(context.repository.repository_id)

        with self.operations.failure_phase(
            context,
            RunFailureCategory.WIKI_VALIDATION,
        ):
            health_before = self.health.check(
                HealthCheckRequest(
                    cwd=request.cwd,
                    repository_name=request.repository_name,
                )
            )

        with self.operations.failure_phase(
            context,
            RunFailureCategory.INTERNAL_ERROR,
        ):
            self.operations.record(
                RecordOperationEventRequest(
                    context=context,
                    kind=RunEventKind.MESSAGE,
                    message="prepared garden context",
                )
            )
            operation_request = ExecuteOperationRequest(
                context=context,
                harness=request.harness,
                model=request.model,
                agent=HarnessAgentKind.GARDEN,
                prompt=render_garden_prompt(
                    context.repository,
                    index_before,
                    health_before,
                    request.guidance,
                    request.auto_commit,
                    self.manual,
                ),
                title=request.title,
                success_summary="garden completed",
            )
        operation = self.operations.execute(operation_request)
        return GardenResult(
            run=operation.run,
            harness=operation.harness,
            index=operation.index,
            health_before=health_before,
        )


def render_garden_prompt(
    repository: Repository,
    index: IndexSummary,
    health: HealthReport,
    guidance: str | None,
    auto_commit: bool,
    manual: ManualLibrary,
) -> str:
    payload = GardenPromptPayload(
        repository_name=repository.name,
        repository_root=repository.root_path,
        almanac_root=repository.almanac_path,
        wiki_source_root=repository.almanac_path,
        topics_file=repository.almanac_path / "topics.yaml",
        index=index,
        health=health,
        manual_documents=manual.inventory().documents,
        source_control=operation_commit_policy(auto_commit),
        guidance=guidance,
    )
    return "Runtime context:\n" f"{payload.model_dump_json(indent=2)}"
