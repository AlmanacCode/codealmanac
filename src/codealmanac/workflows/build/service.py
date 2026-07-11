from codealmanac.core.errors import AlreadyExists
from codealmanac.manual import ManualLibrary
from codealmanac.prompts import PromptName, PromptRenderer, RenderPromptRequest
from codealmanac.services.harnesses.models import HarnessAgentKind
from codealmanac.services.repositories.models import Repository
from codealmanac.services.repositories.requests import RegisterRepositoryRequest
from codealmanac.services.repositories.roots import RepositoryTarget
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.runs.models import RunEventKind
from codealmanac.services.wiki.service import WikiService
from codealmanac.workflows.build.models import (
    BuildPromptPayload,
    BuildResult,
)
from codealmanac.workflows.build.requests import BuildRequest, StartedBuildRequest
from codealmanac.workflows.operations import (
    BeginOperationRequest,
    ExecuteOperationRequest,
    OperationRunner,
    RecordOperationEventRequest,
)
from codealmanac.workflows.operations.commit import operation_commit_policy

BUILD_PROMPT_SECTIONS = (
    PromptName.BASE_KERNEL,
    PromptName.OPERATION_BUILD,
)


class BuildWorkflow:
    def __init__(
        self,
        repositories: RepositoriesService,
        wiki: WikiService,
        operations: OperationRunner,
        prompts: PromptRenderer,
        manual: ManualLibrary,
    ):
        self.repositories = repositories
        self.wiki = wiki
        self.operations = operations
        self.prompts = prompts
        self.manual = manual

    def prepare(self, request: BuildRequest) -> Repository:
        """Validate, register, and scaffold the wiki before the run is queued."""
        target = self.repositories.prepare_repository_target(request.path)
        reject_existing_almanac(target)
        repository = self.register_target(target, request)
        self.wiki.initialize(repository.repository_id)
        return repository

    def execute_started(self, request: StartedBuildRequest) -> BuildResult:
        context = self.operations.begin(
            BeginOperationRequest(
                run_id=request.run_id,
            )
        )
        try:
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
                    model=request.model,
                    agent=HarnessAgentKind.BUILD,
                    prompt=render_build_prompt(
                        self.prompts,
                        self.manual,
                        context.repository,
                        request.guidance,
                        request.auto_commit,
                    ),
                    title=request.title,
                    success_summary="build completed",
                )
            )
            return BuildResult(
                repository=context.repository,
                run=operation.run,
                harness=operation.harness,
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
        source_control=operation_commit_policy(auto_commit),
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
