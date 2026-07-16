from codealmanac.core.errors import AlreadyExists
from codealmanac.services.harnesses.models import HarnessAgentKind
from codealmanac.services.repositories.models import Repository
from codealmanac.services.repositories.requests import RegisterRepositoryRequest
from codealmanac.services.repositories.roots import RepositoryTarget
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.runs.models import RunEventKind, RunFailureCategory
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


class BuildWorkflow:
    def __init__(
        self,
        repositories: RepositoriesService,
        wiki: WikiService,
        operations: OperationRunner,
    ):
        self.repositories = repositories
        self.wiki = wiki
        self.operations = operations

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
        with self.operations.failure_phase(
            context,
            RunFailureCategory.INTERNAL_ERROR,
        ):
            self.operations.record(
                RecordOperationEventRequest(
                    context=context,
                    kind=RunEventKind.MESSAGE,
                    message="prepared minimal wiki",
                )
            )
            operation_request = ExecuteOperationRequest(
                context=context,
                harness=request.harness,
                model=request.model,
                agent=HarnessAgentKind.BUILD,
                prompt=render_build_prompt(
                    context.repository,
                    request.guidance,
                    request.auto_commit,
                ),
                title=request.title,
                success_summary="build completed",
            )
        operation = self.operations.execute(operation_request)
        return BuildResult(
            repository=context.repository,
            run=operation.run,
            harness=operation.harness,
            index=operation.index,
        )

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
        manual_root=repository.almanac_path / "manual",
        source_control=operation_commit_policy(auto_commit),
        guidance=guidance,
    )
    return "Runtime context:\n" f"{payload.model_dump_json(indent=2)}"
