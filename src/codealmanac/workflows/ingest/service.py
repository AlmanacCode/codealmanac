from codealmanac.engine.page_run import (
    PageJobRecordEventRequest,
    PageRunBeginRequest,
    PageRunExecuteRequest,
    PageRunWorkflow,
)
from codealmanac.engine.sources.models import SourceBrief, SourceRuntime
from codealmanac.engine.sources.requests import (
    InspectSourceRuntimeRequest,
    ResolveSourcesRequest,
    SourceRuntimeContext,
)
from codealmanac.engine.sources.service import SourcesService
from codealmanac.jobs.ledger.models import (
    JobEventKind,
    JobOperation,
    JobRecord,
)
from codealmanac.jobs.ledger.requests import StartJobRequest
from codealmanac.jobs.ledger.service import JobLedgerService
from codealmanac.prompts import PromptName, PromptRenderer, RenderPromptRequest
from codealmanac.wiki.workspaces.models import Workspace
from codealmanac.workflows.ingest.models import IngestPromptPayload, IngestResult
from codealmanac.workflows.ingest.requests import (
    RunIngestRequest,
    RunIngestWithJobRequest,
)

INGEST_PROMPT_SECTIONS = (
    PromptName.BASE_PURPOSE,
    PromptName.BASE_NOTABILITY,
    PromptName.BASE_SYNTAX,
    PromptName.OPERATION_INGEST,
)


class IngestWorkflow:
    def __init__(
        self,
        sources: SourcesService,
        jobs: JobLedgerService,
        page_runs: PageRunWorkflow,
        prompts: PromptRenderer,
    ):
        self.sources = sources
        self.jobs = jobs
        self.page_runs = page_runs
        self.prompts = prompts

    def run(self, request: RunIngestRequest) -> IngestResult:
        started = self.start(request)
        return self.run_with_job(
            RunIngestWithJobRequest(
                cwd=request.cwd,
                inputs=request.inputs,
                harness=request.harness,
                wiki=request.wiki,
                title=request.title,
                guidance=request.guidance,
                job_id=started.job_id,
            )
        )

    def start(self, request: RunIngestRequest) -> JobRecord:
        return self.jobs.start(
            StartJobRequest(
                cwd=request.cwd,
                wiki=request.wiki,
                operation=JobOperation.INGEST,
                title=request.title or default_title(request.inputs),
            )
        )

    def run_with_job(self, request: RunIngestWithJobRequest) -> IngestResult:
        job_id = request.job_id
        context = self.page_runs.begin(
            PageRunBeginRequest(
                cwd=request.cwd,
                wiki=request.wiki,
                job_id=job_id,
            )
        )
        try:
            context = self.page_runs.preflight(context)
            sources = self.sources.resolve(
                ResolveSourcesRequest(cwd=request.cwd, inputs=request.inputs)
            )
            self.page_runs.record(
                PageJobRecordEventRequest(
                    context=context,
                    kind=JobEventKind.MESSAGE,
                    message=f"resolved {len(sources)} {source_word(len(sources))}",
                )
            )
            source_runtime = self.inspect_source_runtime(context.workspace, sources)
            self.page_runs.record(
                PageJobRecordEventRequest(
                    context=context,
                    kind=JobEventKind.MESSAGE,
                    message=(
                        f"loaded {len(source_runtime)} source runtime snapshot"
                        f"{'' if len(source_runtime) == 1 else 's'}"
                    ),
                )
            )
            page_run = self.page_runs.execute(
                PageRunExecuteRequest(
                    context=context,
                    harness=request.harness,
                    prompt=render_ingest_prompt(
                        self.prompts,
                        context.workspace,
                        sources,
                        source_runtime,
                        request.guidance,
                    ),
                    title=request.title,
                    success_summary="ingest completed",
                )
            )
            return IngestResult(
                job=page_run.job,
                sources=sources,
                source_runtime=source_runtime,
                harness=page_run.harness,
                safety=page_run.safety,
                index=page_run.index,
            )
        except Exception as error:
            self.page_runs.fail(context, error)
            raise

    def inspect_source_runtime(
        self,
        workspace: Workspace,
        sources: tuple[SourceBrief, ...],
    ) -> tuple[SourceRuntime, ...]:
        return tuple(
            self.sources.inspect_runtime(
                InspectSourceRuntimeRequest(
                    cwd=workspace.root_path,
                    ref=source.ref,
                    context=SourceRuntimeContext(
                        ignored_directories=(workspace.almanac_root,)
                    ),
                )
            )
            for source in sources
        )


def render_ingest_prompt(
    prompts: PromptRenderer,
    workspace: Workspace,
    sources: tuple[SourceBrief, ...],
    source_runtime: tuple[SourceRuntime, ...],
    guidance: str | None,
) -> str:
    payload = IngestPromptPayload(
        workspace_name=workspace.name,
        workspace_root=workspace.root_path,
        almanac_root=workspace.almanac_path,
        sources=sources,
        source_runtime=source_runtime,
        guidance=guidance,
    )
    return prompts.render(
        RenderPromptRequest(
            sections=INGEST_PROMPT_SECTIONS,
            context=(f"Runtime context:\n{payload.model_dump_json(indent=2)}\n",),
        )
    )


def default_title(inputs: tuple[str, ...]) -> str:
    if len(inputs) == 1:
        return f"Ingest {inputs[0]}"
    return f"Ingest {len(inputs)} sources"


def source_word(count: int) -> str:
    return "source" if count == 1 else "sources"
