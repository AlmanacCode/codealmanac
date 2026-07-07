from codealmanac.manual import ManualLibrary
from codealmanac.prompts import PromptName, PromptRenderer, RenderPromptRequest
from codealmanac.services.health.requests import HealthCheckRequest
from codealmanac.services.health.service import HealthService
from codealmanac.services.index.models import HealthReport, IndexSummary
from codealmanac.services.index.service import IndexService
from codealmanac.services.repositories.models import Repository
from codealmanac.services.runs.models import RunEventKind, RunKind, RunRecord
from codealmanac.services.runs.requests import StartRunRequest
from codealmanac.services.runs.service import RunsService
from codealmanac.workflows.garden.models import GardenPromptPayload, GardenResult
from codealmanac.workflows.garden.requests import (
    GardenRequest,
    StartedGardenRequest,
)
from codealmanac.workflows.operations import (
    BeginOperationRequest,
    ExecuteOperationRequest,
    OperationRunner,
    RecordOperationEventRequest,
)
from codealmanac.workflows.operations.commit import operation_commit_policy

GARDEN_PROMPT_SECTIONS = (
    PromptName.BASE_KERNEL,
    PromptName.OPERATION_GARDEN,
)


class GardenWorkflow:
    def __init__(
        self,
        runs: RunsService,
        index: IndexService,
        health: HealthService,
        operations: OperationRunner,
        prompts: PromptRenderer,
        manual: ManualLibrary,
    ):
        self.runs = runs
        self.index = index
        self.health = health
        self.operations = operations
        self.prompts = prompts
        self.manual = manual

    def run(self, request: GardenRequest) -> GardenResult:
        started = self.start(request)
        return self.run_started(
            StartedGardenRequest(
                cwd=request.cwd,
                harness=request.harness,
                model=request.model,
                repository_name=request.repository_name,
                title=request.title,
                guidance=request.guidance,
                auto_commit=request.auto_commit,
                run_id=started.run_id,
            )
        )

    def start(self, request: GardenRequest) -> RunRecord:
        repository = self.operations.resolve_repository(
            request.cwd,
            request.repository_name,
        )
        return self.runs.start(
            StartRunRequest(
                repository_id=repository.repository_id,
                kind=RunKind.GARDEN,
                title=request.title or "Garden wiki",
            )
        )

    def run_started(self, request: StartedGardenRequest) -> GardenResult:
        context = self.operations.begin(
            BeginOperationRequest(
                run_id=request.run_id,
            )
        )
        try:
            index_before = self.index.summary(context.repository.repository_id)
            health_before = self.health.check(
                HealthCheckRequest(
                    cwd=request.cwd,
                    repository_name=request.repository_name,
                )
            )
            self.operations.record(
                RecordOperationEventRequest(
                    context=context,
                    kind=RunEventKind.MESSAGE,
                    message="prepared garden context",
                )
            )
            context = self.operations.preflight(context)
            operation = self.operations.execute(
                ExecuteOperationRequest(
                    context=context,
                    harness=request.harness,
                    model=request.model,
                    prompt=render_garden_prompt(
                        self.prompts,
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
            )
            return GardenResult(
                run=operation.run,
                harness=operation.harness,
                safety=operation.safety,
                index=operation.index,
                health_before=health_before,
            )
        except Exception as error:
            self.operations.fail(context, error)
            raise


def render_garden_prompt(
    prompts: PromptRenderer,
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
    return prompts.render(
        RenderPromptRequest(
            sections=GARDEN_PROMPT_SECTIONS,
            context=(
                "Runtime context:\n"
                f"{payload.model_dump_json(indent=2)}\n",
            ),
        )
    )
