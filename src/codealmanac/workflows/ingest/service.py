from contextlib import suppress
from pathlib import Path

from codealmanac.core.errors import ExecutionFailed
from codealmanac.services.harnesses.models import HarnessRunResult, HarnessRunStatus
from codealmanac.services.harnesses.requests import RunHarnessRequest
from codealmanac.services.harnesses.service import HarnessesService
from codealmanac.services.index.service import IndexService
from codealmanac.services.runs.models import RunEventKind, RunOperation, RunStatus
from codealmanac.services.runs.requests import (
    FinishRunRequest,
    RecordRunEventRequest,
    StartRunRequest,
)
from codealmanac.services.runs.service import RunsService
from codealmanac.services.sources.models import SourceBrief
from codealmanac.services.sources.requests import ResolveSourcesRequest
from codealmanac.services.sources.service import SourcesService
from codealmanac.services.workspaces.models import Workspace
from codealmanac.services.workspaces.requests import SelectWorkspaceRequest
from codealmanac.services.workspaces.service import WorkspacesService
from codealmanac.workflows.ingest.models import IngestPromptPayload, IngestResult
from codealmanac.workflows.ingest.requests import RunIngestRequest
from codealmanac.workflows.ingest.safety import IngestMutationPolicy


class IngestWorkflow:
    def __init__(
        self,
        workspaces: WorkspacesService,
        sources: SourcesService,
        harnesses: HarnessesService,
        runs: RunsService,
        index: IndexService,
        mutation_policy: IngestMutationPolicy,
    ):
        self.workspaces = workspaces
        self.sources = sources
        self.harnesses = harnesses
        self.runs = runs
        self.index = index
        self.mutation_policy = mutation_policy

    def run(self, request: RunIngestRequest) -> IngestResult:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        started = self.runs.start(
            StartRunRequest(
                cwd=request.cwd,
                wiki=request.wiki,
                operation=RunOperation.INGEST,
                title=request.title or default_title(request.inputs),
            )
        )
        try:
            preflight = self.mutation_policy.preflight(workspace)
            self.record(
                request,
                started.run_id,
                RunEventKind.MESSAGE,
                "verified clean .almanac preflight",
            )
            sources = self.sources.resolve(
                ResolveSourcesRequest(cwd=request.cwd, inputs=request.inputs)
            )
            self.record(
                request,
                started.run_id,
                RunEventKind.MESSAGE,
                f"resolved {len(sources)} {source_word(len(sources))}",
            )
            harness = self.harnesses.run(
                RunHarnessRequest(
                    kind=request.harness,
                    cwd=workspace.root_path,
                    prompt=render_ingest_prompt(workspace, sources, request.guidance),
                    title=request.title,
                )
            )
            validate_harness_result(harness)
            safety = self.mutation_policy.validate(
                preflight,
                workspace,
                harness.changed_files,
            )
            self.record(
                request,
                started.run_id,
                RunEventKind.OUTPUT,
                f"{harness.kind.value} {harness.status.value}",
            )
            index = self.index.ensure_fresh(workspace.workspace_id)
            finished = self.runs.finish(
                FinishRunRequest(
                    cwd=request.cwd,
                    wiki=request.wiki,
                    run_id=started.run_id,
                    status=RunStatus.DONE,
                    summary=harness.summary or "ingest completed",
                )
            )
            return IngestResult(
                run=finished,
                sources=sources,
                harness=harness,
                safety=safety,
                index=index,
            )
        except Exception as error:
            self.fail_run(request, started.run_id, error)
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
    workspace: Workspace,
    sources: tuple[SourceBrief, ...],
    guidance: str | None,
) -> str:
    payload = IngestPromptPayload(
        workspace_name=workspace.name,
        workspace_root=workspace.root_path,
        almanac_root=workspace.almanac_path,
        sources=sources,
        guidance=guidance,
    )
    return (
        "You are running CodeAlmanac ingest for a repo-owned .almanac wiki.\n"
        "Use the source briefs below as operation input. Update only files under "
        "the almanac_root path. Do not edit application code. Preserve durable "
        "wiki knowledge: decisions, flows, invariants, incidents, conventions, "
        "and gotchas. The public CLI name is codealmanac, never almanac or alm. "
        "Skip changes when the material does not justify a durable wiki update.\n\n"
        f"{payload.model_dump_json(indent=2)}\n"
    )


def validate_harness_result(result: HarnessRunResult) -> None:
    if result.status != HarnessRunStatus.SUCCEEDED:
        suffix = first_line(result.output_text)
        details = f": {suffix}" if suffix else ""
        raise ExecutionFailed(
            f"harness {result.kind.value} failed with status "
            f"{result.status.value}{details}"
        )


def default_title(inputs: tuple[str, ...]) -> str:
    if len(inputs) == 1:
        return f"Ingest {inputs[0]}"
    return f"Ingest {len(inputs)} sources"


def source_word(count: int) -> str:
    return "source" if count == 1 else "sources"


def first_line(value: str) -> str:
    return value.splitlines()[0] if value.splitlines() else value
