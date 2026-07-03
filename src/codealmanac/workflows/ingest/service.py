from codealmanac.prompts import PromptName, PromptRenderer, RenderPromptRequest
from codealmanac.services.runs.models import (
    RunEventKind,
    RunOperation,
    RunRecord,
)
from codealmanac.services.runs.requests import StartRunRequest
from codealmanac.services.runs.service import RunsService
from codealmanac.services.sources.models import SourceBrief, SourceRuntime
from codealmanac.services.sources.requests import (
    InspectSourceRuntimeRequest,
    ResolveSourcesRequest,
    SourceRuntimeContext,
)
from codealmanac.services.sources.service import SourcesService
from codealmanac.wiki.workspaces.models import Workspace
from codealmanac.workflows.ingest.models import IngestPromptPayload, IngestResult
from codealmanac.workflows.ingest.requests import (
    RunIngestRequest,
    RunIngestWithRunRequest,
)
from codealmanac.workflows.page_run import (
    PageRunBeginRequest,
    PageRunExecuteRequest,
    PageRunRecordEventRequest,
    PageRunWorkflow,
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
        runs: RunsService,
        page_runs: PageRunWorkflow,
        prompts: PromptRenderer,
    ):
        self.sources = sources
        self.runs = runs
        self.page_runs = page_runs
        self.prompts = prompts

    def run(self, request: RunIngestRequest) -> IngestResult:
        started = self.start(request)
        return self.run_with_run(
            RunIngestWithRunRequest(
                cwd=request.cwd,
                inputs=request.inputs,
                harness=request.harness,
                wiki=request.wiki,
                title=request.title,
                guidance=request.guidance,
                run_id=started.run_id,
            )
        )

    def start(self, request: RunIngestRequest) -> RunRecord:
        return self.runs.start(
            StartRunRequest(
                cwd=request.cwd,
                wiki=request.wiki,
                operation=RunOperation.INGEST,
                title=request.title or default_title(request.inputs),
            )
        )

    def run_with_run(self, request: RunIngestWithRunRequest) -> IngestResult:
        run_id = request.run_id
        context = self.page_runs.begin(
            PageRunBeginRequest(
                cwd=request.cwd,
                wiki=request.wiki,
                run_id=run_id,
            )
        )
        try:
            context = self.page_runs.preflight(context)
            sources = self.sources.resolve(
                ResolveSourcesRequest(cwd=request.cwd, inputs=request.inputs)
            )
            self.page_runs.record(
                PageRunRecordEventRequest(
                    context=context,
                    kind=RunEventKind.MESSAGE,
                    message=f"resolved {len(sources)} {source_word(len(sources))}",
                )
            )
            source_runtime = self.inspect_source_runtime(context.workspace, sources)
            self.page_runs.record(
                PageRunRecordEventRequest(
                    context=context,
                    kind=RunEventKind.MESSAGE,
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
                run=page_run.run,
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
            context=(
                "Runtime context:\n"
                f"{payload.model_dump_json(indent=2)}\n",
            ),
        )
    )


def default_title(inputs: tuple[str, ...]) -> str:
    if len(inputs) == 1:
        return f"Ingest {inputs[0]}"
    return f"Ingest {len(inputs)} sources"


def source_word(count: int) -> str:
    return "source" if count == 1 else "sources"
