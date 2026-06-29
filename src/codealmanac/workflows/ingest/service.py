from contextlib import suppress
from pathlib import Path

from codealmanac.prompts import PromptName, PromptRenderer, RenderPromptRequest
from codealmanac.services.harnesses.models import HarnessRunResult
from codealmanac.services.harnesses.requests import RunHarnessRequest
from codealmanac.services.harnesses.service import HarnessesService
from codealmanac.services.index.service import IndexService
from codealmanac.services.runs.models import (
    RunEventKind,
    RunOperation,
    RunRecord,
    RunStatus,
)
from codealmanac.services.runs.requests import (
    FinishRunRequest,
    MarkRunRunningRequest,
    RecordRunEventRequest,
    RecordRunHarnessTranscriptRequest,
    StartRunRequest,
)
from codealmanac.services.runs.service import RunsService
from codealmanac.services.sources.models import SourceBrief, SourceRuntime
from codealmanac.services.sources.requests import (
    InspectSourceRuntimeRequest,
    ResolveSourcesRequest,
    SourceRuntimeContext,
)
from codealmanac.services.sources.service import SourcesService
from codealmanac.services.workspaces.models import Workspace
from codealmanac.services.workspaces.requests import SelectWorkspaceRequest
from codealmanac.services.workspaces.service import WorkspacesService
from codealmanac.workflows.ingest.models import IngestPromptPayload, IngestResult
from codealmanac.workflows.ingest.requests import (
    RunIngestRequest,
    RunIngestWithRunRequest,
)
from codealmanac.workflows.lifecycle import (
    LifecycleMutationPolicy,
    first_line,
    harness_events,
    harness_run_event_kind,
    validate_harness_result,
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
        workspaces: WorkspacesService,
        sources: SourcesService,
        harnesses: HarnessesService,
        runs: RunsService,
        index: IndexService,
        mutation_policy: LifecycleMutationPolicy,
        prompts: PromptRenderer,
    ):
        self.workspaces = workspaces
        self.sources = sources
        self.harnesses = harnesses
        self.runs = runs
        self.index = index
        self.mutation_policy = mutation_policy
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
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        run_id = request.run_id
        try:
            self.runs.mark_running(
                MarkRunRunningRequest(
                    cwd=request.cwd,
                    wiki=request.wiki,
                    run_id=run_id,
                )
            )
            preflight = self.mutation_policy.preflight(workspace)
            self.record(
                request,
                run_id,
                RunEventKind.MESSAGE,
                f"verified clean {workspace.almanac_root.as_posix()} preflight",
            )
            sources = self.sources.resolve(
                ResolveSourcesRequest(cwd=request.cwd, inputs=request.inputs)
            )
            self.record(
                request,
                run_id,
                RunEventKind.MESSAGE,
                f"resolved {len(sources)} {source_word(len(sources))}",
            )
            source_runtime = self.inspect_source_runtime(workspace, sources)
            self.record(
                request,
                run_id,
                RunEventKind.MESSAGE,
                f"loaded {len(source_runtime)} source runtime snapshot"
                f"{'' if len(source_runtime) == 1 else 's'}",
            )
            harness = self.harnesses.run(
                RunHarnessRequest(
                    kind=request.harness,
                    cwd=workspace.root_path,
                    prompt=render_ingest_prompt(
                        self.prompts,
                        workspace,
                        sources,
                        source_runtime,
                        request.guidance,
                    ),
                    title=request.title,
                )
            )
            self.record_harness_transcript(request, run_id, harness)
            self.record_harness_events(request, run_id, harness)
            safety = self.mutation_policy.validate(
                preflight,
                workspace,
                harness.changed_files,
            )
            validate_harness_result(harness)
            index = self.index.ensure_fresh(workspace.workspace_id)
            finished = self.runs.finish(
                FinishRunRequest(
                    cwd=request.cwd,
                    wiki=request.wiki,
                    run_id=run_id,
                    status=RunStatus.DONE,
                    summary=harness.summary or "ingest completed",
                )
            )
            return IngestResult(
                run=finished,
                sources=sources,
                source_runtime=source_runtime,
                harness=harness,
                safety=safety,
                index=index,
            )
        except Exception as error:
            self.fail_run(request, run_id, error)
            raise

    def resolve_workspace(self, cwd: Path, wiki: str | None) -> Workspace:
        if wiki is None:
            return self.workspaces.resolve(cwd)
        return self.workspaces.select(
            SelectWorkspaceRequest(selector=wiki, base_path=cwd)
        )

    def record(
        self,
        request: RunIngestRequest,
        run_id: str,
        kind: RunEventKind,
        message: str,
    ) -> None:
        self.runs.record_event(
            RecordRunEventRequest(
                cwd=request.cwd,
                wiki=request.wiki,
                run_id=run_id,
                kind=kind,
                message=message,
            )
        )

    def record_harness_transcript(
        self,
        request: RunIngestRequest,
        run_id: str,
        harness: HarnessRunResult,
    ) -> None:
        if harness.transcript is None:
            return
        self.runs.record_harness_transcript(
            RecordRunHarnessTranscriptRequest(
                cwd=request.cwd,
                wiki=request.wiki,
                run_id=run_id,
                transcript=harness.transcript,
            )
        )

    def record_harness_events(
        self,
        request: RunIngestRequest,
        run_id: str,
        harness: HarnessRunResult,
    ) -> None:
        for event in harness_events(harness):
            self.record(
                request,
                run_id,
                harness_run_event_kind(event),
                event.message,
            )

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

    def fail_run(
        self,
        request: RunIngestRequest,
        run_id: str,
        error: Exception,
    ) -> None:
        message = first_line(str(error)) or error.__class__.__name__
        with suppress(Exception):
            self.record(request, run_id, RunEventKind.ERROR, message)
            self.runs.finish(
                FinishRunRequest(
                    cwd=request.cwd,
                    wiki=request.wiki,
                    run_id=run_id,
                    status=RunStatus.FAILED,
                    error=message,
                )
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
