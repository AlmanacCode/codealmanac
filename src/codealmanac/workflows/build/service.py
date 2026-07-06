from codealmanac.core.errors import AlreadyExists
from codealmanac.manual import ManualLibrary
from codealmanac.prompts import PromptName, PromptRenderer, RenderPromptRequest
from codealmanac.services.repositories.models import Repository
from codealmanac.services.repositories.requests import RegisterRepositoryRequest
from codealmanac.services.repositories.roots import RepositoryTarget
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.runs.models import RunEventKind, RunKind
from codealmanac.services.runs.requests import StartRunRequest
from codealmanac.services.runs.service import RunsService
from codealmanac.services.wiki.service import WikiService
from codealmanac.workflows.build.models import (
    BuildPromptPayload,
    BuildResult,
    StartedBuild,
)
from codealmanac.workflows.build.requests import BuildRequest
from codealmanac.workflows.lifecycle_commit import lifecycle_commit_policy
from codealmanac.workflows.operations import (
    BeginOperationRequest,
    ExecuteOperationRequest,
    OperationRunner,
    RecordOperationEventRequest,
)

BUILD_PROMPT_SECTIONS = (
    PromptName.BASE_KERNEL,
    PromptName.OPERATION_BUILD,
)


class BuildWorkflow:
    def __init__(
        self,
        repositories: RepositoriesService,
        wiki: WikiService,
        runs: RunsService,
        operations: OperationRunner,
        prompts: PromptRenderer,
        manual: ManualLibrary,
    ):
        self.repositories = repositories
        self.wiki = wiki
        self.runs = runs
        self.operations = operations
        self.prompts = prompts
        self.manual = manual

    def run(self, request: BuildRequest) -> BuildResult:
        return self.run_started(request, self.start(request))

    def start(self, request: BuildRequest) -> StartedBuild:
        target = self.repositories.prepare_repository_target(request.path)
        reject_existing_almanac(target)
        self.operations.mutation_policy.ensure_tracking_available(target.root_path)
        repository = self.register_target(target, request)
        self.wiki.initialize(repository.repository_id)
        run = self.runs.start(
            StartRunRequest(
                repository_id=repository.repository_id,
                kind=RunKind.BUILD,
                title=request.title or "Build wiki",
            )
        )
        return StartedBuild(repository=repository, run=run)

    def run_started(
        self,
        request: BuildRequest,
        start: StartedBuild,
    ) -> BuildResult:
        repository = start.repository
        context = self.operations.begin(
            BeginOperationRequest(
                run_id=start.run.run_id,
            )
        )
        try:
            context = self.operations.preflight(context)
            self.operations.record(
                RecordOperationEventRequest(
                    context=context,
                    kind=RunEventKind.MESSAGE,
                    message="prepared minimal wiki",
                )
            )
            operation = self.operations.execute(
                ExecuteOperationRequest(
                    context=context,
                    harness=request.harness,
                    prompt=render_build_prompt(
                        self.prompts,
                        self.manual,
                        repository,
                        request.guidance,
                        request.auto_commit,
                    ),
                    title=request.title,
                    success_summary="build completed",
                )
            )
            return BuildResult(
                repository=repository,
                run=operation.run,
                harness=operation.harness,
                safety=operation.safety,
                index=operation.index,
            )
        except Exception as error:
            self.operations.fail(context, error)
            raise

    def register_target(
        self,
        target: RepositoryTarget,
        request: BuildRequest,
    ) -> Repository:
        return self.repositories.register(
            RegisterRepositoryRequest(
                root_path=target.root_path,
                name=request.name,
                description=request.description,
            )
        )


def reject_existing_almanac(target: RepositoryTarget) -> None:
    if target.almanac_path.exists():
        raise AlreadyExists(
            "almanac",
            target.almanac_path.as_posix(),
            "almanac/ already exists here.\n"
            "Use the existing repository wiki or choose a different directory.",
        )


def render_build_prompt(
    prompts: PromptRenderer,
    manual: ManualLibrary,
    repository: Repository,
    guidance: str | None,
    auto_commit: bool,
) -> str:
    payload = BuildPromptPayload(
        repository_name=repository.name,
        repository_root=repository.root_path,
        almanac_root=repository.almanac_path,
        wiki_source_root=repository.almanac_path,
        topics_file=repository.almanac_path / "topics.yaml",
        manual_documents=manual.inventory().documents,
        source_control=lifecycle_commit_policy(auto_commit),
        guidance=guidance,
    )
    return prompts.render(
        RenderPromptRequest(
            sections=BUILD_PROMPT_SECTIONS,
            context=(
                "Runtime context:\n"
                f"{payload.model_dump_json(indent=2)}\n",
            ),
        )
    )
