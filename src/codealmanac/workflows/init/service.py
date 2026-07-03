from pathlib import Path

from codealmanac.core.errors import ValidationFailed
from codealmanac.engine.page_run import (
    PageRunBeginRequest,
    PageRunExecuteRequest,
    PageRunWorkflow,
)
from codealmanac.jobs.ledger.models import JobOperation
from codealmanac.jobs.ledger.requests import StartJobRequest
from codealmanac.jobs.ledger.service import JobLedgerService
from codealmanac.prompts import PromptName, PromptRenderer, RenderPromptRequest
from codealmanac.wiki.service import WikiService
from codealmanac.wiki.workspaces.models import Workspace
from codealmanac.wiki.workspaces.requests import (
    InitializeWorkspaceRequest,
    RegisterWorkspaceRequest,
)
from codealmanac.wiki.workspaces.roots import AlmanacRootMatch
from codealmanac.wiki.workspaces.service import WorkspacesService
from codealmanac.workflows.init.models import (
    InitPreparation,
    InitPromptPayload,
    InitResult,
)
from codealmanac.workflows.init.requests import RunInitRequest, RunInitWithJobRequest

INIT_PROMPT_SECTIONS = (
    PromptName.BASE_KERNEL,
    PromptName.OPERATION_INIT,
)


class InitWorkflow:
    def __init__(
        self,
        workspaces: WorkspacesService,
        wiki: WikiService,
        jobs: JobLedgerService,
        page_runs: PageRunWorkflow,
        prompts: PromptRenderer,
    ):
        self.workspaces = workspaces
        self.wiki = wiki
        self.jobs = jobs
        self.page_runs = page_runs
        self.prompts = prompts

    def initialize_workspace(self, request: InitializeWorkspaceRequest) -> Workspace:
        return self._initialize_workspace(request)

    def prepare(
        self, request: RunInitRequest, *, enforce_force: bool
    ) -> InitPreparation:
        target = self.workspaces.initialization_target(
            request.path,
            request.almanac_root,
        )
        existing_page_count = count_pages(target.almanac_path / "pages")
        if enforce_force and existing_page_count > 0 and not request.force:
            raise ValidationFailed(
                "wiki already initialized with "
                f"{existing_page_count} {page_word(existing_page_count)}; "
                "pass --force to rebuild"
            )
        workspace = self._initialize_target(target, request)
        return InitPreparation(
            workspace=workspace,
            existing_page_count=existing_page_count,
        )

    def run(self, request: RunInitRequest) -> InitResult:
        preparation = self.prepare(request, enforce_force=True)
        started = self.jobs.start(
            StartJobRequest(
                cwd=preparation.workspace.root_path,
                operation=JobOperation.INIT,
                title=request.title or "Initialize wiki",
            )
        )
        return self.run_with_job(
            RunInitWithJobRequest(
                path=preparation.workspace.root_path,
                harness=request.harness,
                almanac_root=preparation.workspace.almanac_root,
                name=preparation.workspace.name,
                description=preparation.workspace.description,
                title=request.title,
                guidance=request.guidance,
                force=request.force,
                job_id=started.job_id,
            ),
            prepared=preparation,
        )

    def run_with_job(
        self,
        request: RunInitWithJobRequest,
        prepared: InitPreparation | None = None,
    ) -> InitResult:
        preparation = prepared or self.prepare(request, enforce_force=False)
        context = self.page_runs.begin(
            PageRunBeginRequest(
                cwd=preparation.workspace.root_path,
                job_id=request.job_id,
            )
        )
        try:
            context = self.page_runs.preflight(context)
            page_run = self.page_runs.execute(
                PageRunExecuteRequest(
                    context=context,
                    harness=request.harness,
                    prompt=render_init_prompt(
                        self.prompts,
                        preparation.workspace,
                        preparation.existing_page_count,
                        request.force,
                        request.guidance,
                    ),
                    title=request.title,
                    success_summary="init completed",
                )
            )
            return InitResult(
                workspace=preparation.workspace,
                existing_page_count=preparation.existing_page_count,
                job=page_run.job,
                harness=page_run.harness,
                safety=page_run.safety,
                index=page_run.index,
            )
        except Exception as error:
            self.page_runs.fail(context, error)
            raise

    def _initialize_workspace(self, request: InitializeWorkspaceRequest) -> Workspace:
        target = self.workspaces.initialization_target(
            request.path,
            request.almanac_root,
        )
        return self._initialize_target(target, request)

    def _initialize_target(
        self,
        target: AlmanacRootMatch,
        request: InitializeWorkspaceRequest | RunInitRequest,
    ) -> Workspace:
        workspace = self.workspaces.register(
            RegisterWorkspaceRequest(
                root_path=target.repo_root,
                almanac_root=target.almanac_root,
                name=request.name,
                description=request.description,
            )
        )
        self.wiki.initialize(workspace.workspace_id)
        return workspace


def render_init_prompt(
    prompts: PromptRenderer,
    workspace: Workspace,
    existing_page_count: int,
    force: bool,
    guidance: str | None,
) -> str:
    payload = InitPromptPayload(
        workspace_name=workspace.name,
        workspace_root=workspace.root_path,
        almanac_root=workspace.almanac_path,
        pages_root=workspace.almanac_path / "pages",
        topics_file=workspace.almanac_path / "topics.yaml",
        existing_page_count=existing_page_count,
        force=force,
        guidance=guidance,
    )
    return prompts.render(
        RenderPromptRequest(
            sections=INIT_PROMPT_SECTIONS,
            context=(f"Runtime context:\n{payload.model_dump_json(indent=2)}\n",),
        )
    )


def count_pages(pages_path: Path) -> int:
    if not pages_path.is_dir():
        return 0
    return sum(1 for path in pages_path.rglob("*.md") if path.is_file())


def page_word(count: int) -> str:
    return "page" if count == 1 else "pages"
