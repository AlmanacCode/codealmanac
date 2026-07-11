from codealmanac.manual import ManualLibrary
from codealmanac.services.harnesses.models import HarnessAgentKind
from codealmanac.services.repositories.models import Repository
from codealmanac.services.runs.models import RunEventKind
from codealmanac.services.sources.models import SourceBrief, SourceRuntime
from codealmanac.services.sources.requests import (
    InspectSourceRuntimeRequest,
    ResolveSourcesRequest,
    SourceRuntimeContext,
)
from codealmanac.services.sources.service import SourcesService
from codealmanac.workflows.ingest.models import IngestPromptPayload, IngestResult
from codealmanac.workflows.ingest.requests import StartedIngestRequest
from codealmanac.workflows.operations import (
    BeginOperationRequest,
    ExecuteOperationRequest,
    OperationRunner,
    RecordOperationEventRequest,
)
from codealmanac.workflows.operations.commit import operation_commit_policy


class IngestWorkflow:
    def __init__(
        self,
        sources: SourcesService,
        operations: OperationRunner,
        manual: ManualLibrary,
    ):
        self.sources = sources
        self.operations = operations
        self.manual = manual

    def execute_started(self, request: StartedIngestRequest) -> IngestResult:
        run_id = request.run_id
        context = self.operations.begin(
            BeginOperationRequest(
                run_id=run_id,
            )
        )
        try:
            sources = self.sources.resolve(
                ResolveSourcesRequest(cwd=request.cwd, inputs=request.inputs)
            )
            self.operations.record(
                RecordOperationEventRequest(
                    context=context,
                    kind=RunEventKind.MESSAGE,
                    message=f"resolved {len(sources)} {source_word(len(sources))}",
                )
            )
            source_runtime = self.inspect_source_runtime(context.repository, sources)
            self.operations.record(
                RecordOperationEventRequest(
                    context=context,
                    kind=RunEventKind.MESSAGE,
                    message=(
                        f"loaded {len(source_runtime)} source runtime snapshot"
                        f"{'' if len(source_runtime) == 1 else 's'}"
                    ),
                )
            )
            operation = self.operations.execute(
                ExecuteOperationRequest(
                    context=context,
                    harness=request.harness,
                    model=request.model,
                    agent=HarnessAgentKind.INGEST,
                    prompt=render_ingest_prompt(
                        context.repository,
                        sources,
                        source_runtime,
                        request.guidance,
                        request.auto_commit,
                        self.manual,
                    ),
                    title=request.title,
                    success_summary="ingest completed",
                )
            )
            return IngestResult(
                run=operation.run,
                sources=sources,
                source_runtime=source_runtime,
                harness=operation.harness,
                index=operation.index,
            )
        except Exception as error:
            self.operations.fail(context, error)
            raise

    def inspect_source_runtime(
        self,
        repository: Repository,
        sources: tuple[SourceBrief, ...],
    ) -> tuple[SourceRuntime, ...]:
        return tuple(
            self.sources.inspect_runtime(
                InspectSourceRuntimeRequest(
                    cwd=repository.root_path,
                    ref=source.ref,
                    context=SourceRuntimeContext(
                        ignored_directories=(repository.almanac_root,)
                    ),
                )
            )
            for source in sources
        )


def render_ingest_prompt(
    repository: Repository,
    sources: tuple[SourceBrief, ...],
    source_runtime: tuple[SourceRuntime, ...],
    guidance: str | None,
    auto_commit: bool,
    manual: ManualLibrary,
) -> str:
    payload = IngestPromptPayload(
        repository_name=repository.name,
        repository_root=repository.root_path,
        almanac_root=repository.almanac_path,
        sources=sources,
        source_runtime=source_runtime,
        manual_documents=manual.inventory().documents,
        source_control=operation_commit_policy(auto_commit),
        guidance=guidance,
    )
    return "Runtime context:\n" f"{payload.model_dump_json(indent=2)}"


def default_title(inputs: tuple[str, ...]) -> str:
    if len(inputs) == 1:
        return f"Ingest {inputs[0]}"
    return f"Ingest {len(inputs)} sources"


def source_word(count: int) -> str:
    return "source" if count == 1 else "sources"
