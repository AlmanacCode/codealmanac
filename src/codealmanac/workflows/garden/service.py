from contextlib import suppress
from pathlib import Path

from codealmanac.prompts import PromptName, PromptRenderer, RenderPromptRequest
from codealmanac.services.harnesses.models import HarnessRunResult
from codealmanac.services.harnesses.requests import RunHarnessRequest
from codealmanac.services.harnesses.service import HarnessesService
from codealmanac.services.health.requests import HealthCheckRequest
from codealmanac.services.health.service import HealthService
from codealmanac.services.index.models import HealthReport, IndexSummary
from codealmanac.services.index.service import IndexService
from codealmanac.services.runs.models import RunEventKind, RunOperation, RunStatus
from codealmanac.services.runs.requests import (
    FinishRunRequest,
    MarkRunRunningRequest,
    RecordRunEventRequest,
    RecordRunHarnessTranscriptRequest,
    StartRunRequest,
)
from codealmanac.services.runs.service import RunsService
from codealmanac.services.workspaces.models import Workspace
from codealmanac.services.workspaces.requests import SelectWorkspaceRequest
from codealmanac.services.workspaces.service import WorkspacesService
from codealmanac.workflows.garden.models import GardenPromptPayload, GardenResult
from codealmanac.workflows.garden.requests import RunGardenRequest
from codealmanac.workflows.lifecycle import (
    LifecycleMutationPolicy,
    first_line,
    harness_events,
    harness_run_event_kind,
    validate_harness_result,
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
        workspaces: WorkspacesService,
        harnesses: HarnessesService,
        runs: RunsService,
        index: IndexService,
        health: HealthService,
        mutation_policy: LifecycleMutationPolicy,
        prompts: PromptRenderer,
    ):
        self.workspaces = workspaces
        self.harnesses = harnesses
        self.runs = runs
        self.index = index
        self.health = health
        self.mutation_policy = mutation_policy
        self.prompts = prompts

    def run(self, request: RunGardenRequest) -> GardenResult:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        started = self.runs.start(
            StartRunRequest(
                cwd=request.cwd,
                wiki=request.wiki,
                operation=RunOperation.GARDEN,
                title=request.title or "Garden wiki",
            )
        )
        self.runs.mark_running(
            MarkRunRunningRequest(
                cwd=request.cwd,
                wiki=request.wiki,
                run_id=started.run_id,
            )
        )
        try:
            index_before = self.index.summary(workspace.workspace_id)
            health_before = self.health.check(
                HealthCheckRequest(cwd=request.cwd, wiki=request.wiki)
            )
            self.record(
                request,
                started.run_id,
                RunEventKind.MESSAGE,
                "prepared garden context",
            )
            preflight = self.mutation_policy.preflight(workspace)
            self.record(
                request,
                started.run_id,
                RunEventKind.MESSAGE,
                f"verified clean {workspace.almanac_root.as_posix()} preflight",
            )
            harness = self.harnesses.run(
                RunHarnessRequest(
                    kind=request.harness,
                    cwd=workspace.root_path,
                    prompt=render_garden_prompt(
                        self.prompts,
                        workspace,
                        index_before,
                        health_before,
                        request.guidance,
                    ),
                    title=request.title,
                )
            )
            self.record_harness_transcript(request, started.run_id, harness)
            self.record_harness(request, started.run_id, harness)
            safety = self.mutation_policy.validate(
                preflight,
                workspace,
                harness.changed_files,
            )
            validate_harness_result(harness)
            index_after = self.index.ensure_fresh(workspace.workspace_id)
            finished = self.runs.finish(
                FinishRunRequest(
                    cwd=request.cwd,
                    wiki=request.wiki,
                    run_id=started.run_id,
                    status=RunStatus.DONE,
                    summary=harness.summary or "garden completed",
                )
            )
            return GardenResult(
                run=finished,
                harness=harness,
                safety=safety,
                index=index_after,
                health_before=health_before,
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
        request: RunGardenRequest,
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
        request: RunGardenRequest,
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

    def record_harness(
        self,
        request: RunGardenRequest,
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

    def fail_run(
        self,
        request: RunGardenRequest,
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
