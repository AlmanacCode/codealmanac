from codealmanac.engine.page_run import (
    PageJobRecordEventRequest,
    PageRunBeginRequest,
    PageRunExecuteRequest,
    PageRunWorkflow,
)
from codealmanac.jobs.ledger.models import JobEventKind, JobOperation
from codealmanac.jobs.ledger.requests import StartJobRequest
from codealmanac.jobs.ledger.service import JobLedgerService
from codealmanac.prompts import PromptName, PromptRenderer, RenderPromptRequest
from codealmanac.wiki.health.requests import HealthCheckRequest
from codealmanac.wiki.health.service import HealthService
from codealmanac.wiki.index.models import HealthReport, IndexSummary
from codealmanac.wiki.index.service import IndexService
from codealmanac.wiki.workspaces.models import Workspace
from codealmanac.workflows.garden.models import GardenPromptPayload, GardenResult
from codealmanac.workflows.garden.requests import (
    RunGardenRequest,
    RunGardenWithJobRequest,
)

GARDEN_PROMPT_SECTIONS = (
    PromptName.BASE_PURPOSE,
    PromptName.BASE_NOTABILITY,
    PromptName.BASE_SYNTAX,
    PromptName.OPERATION_GARDEN,
)


class GardenWorkflow:
    def __init__(
        self,
        jobs: JobLedgerService,
        index: IndexService,
        health: HealthService,
        page_runs: PageRunWorkflow,
        prompts: PromptRenderer,
    ):
        self.jobs = jobs
        self.index = index
        self.health = health
        self.page_runs = page_runs
        self.prompts = prompts

    def run(self, request: RunGardenRequest) -> GardenResult:
        started = self.jobs.start(
            StartJobRequest(
                cwd=request.cwd,
                wiki=request.wiki,
                operation=JobOperation.GARDEN,
                title=request.title or "Garden wiki",
            )
        )
        return self.run_with_job(
            RunGardenWithJobRequest(
                cwd=request.cwd,
                harness=request.harness,
                wiki=request.wiki,
                title=request.title,
                guidance=request.guidance,
                job_id=started.job_id,
            )
        )

    def run_with_job(self, request: RunGardenWithJobRequest) -> GardenResult:
        context = self.page_runs.begin(
            PageRunBeginRequest(
                cwd=request.cwd,
                wiki=request.wiki,
                job_id=request.job_id,
            )
        )
        try:
            index_before = self.index.summary(context.workspace.workspace_id)
            health_before = self.health.check(
                HealthCheckRequest(cwd=request.cwd, wiki=request.wiki)
            )
            self.page_runs.record(
                PageJobRecordEventRequest(
                    context=context,
                    kind=JobEventKind.MESSAGE,
                    message="prepared garden context",
                )
            )
            context = self.page_runs.preflight(context)
            page_run = self.page_runs.execute(
                PageRunExecuteRequest(
                    context=context,
                    harness=request.harness,
                    prompt=render_garden_prompt(
                        self.prompts,
                        context.workspace,
                        index_before,
                        health_before,
                        request.guidance,
                    ),
                    title=request.title,
                    success_summary="garden completed",
                )
            )
            return GardenResult(
                job=page_run.job,
                harness=page_run.harness,
                safety=page_run.safety,
                index=page_run.index,
                health_before=health_before,
            )
        except Exception as error:
            self.page_runs.fail(context, error)
            raise


def render_garden_prompt(
    prompts: PromptRenderer,
    workspace: Workspace,
    index: IndexSummary,
    health: HealthReport,
    guidance: str | None,
) -> str:
    payload = GardenPromptPayload(
        workspace_name=workspace.name,
        workspace_root=workspace.root_path,
        almanac_root=workspace.almanac_path,
        pages_root=workspace.almanac_path / "pages",
        topics_file=workspace.almanac_path / "topics.yaml",
        index=index,
        health=health,
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
