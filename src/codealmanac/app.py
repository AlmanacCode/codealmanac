from collections.abc import Sequence
from dataclasses import dataclass

from codealmanac import __version__
from codealmanac.integrations.automation import LaunchdSchedulerAdapter
from codealmanac.integrations.harnesses import default_harness_adapters
from codealmanac.integrations.repositories.git import GitRepositoryChangeProbe
from codealmanac.integrations.runs import SubprocessRunWorkerSpawner
from codealmanac.integrations.setup import (
    FileInstructionInstaller,
    FilesystemGlobalStateRemover,
    PackageToolUninstaller,
)
from codealmanac.integrations.sources import (
    default_source_runtime_adapters,
    default_transcript_discovery_adapters,
)
from codealmanac.integrations.updates import (
    InstalledPackageMetadataProvider,
    SubprocessPackageCommandRunner,
)
from codealmanac.manual import ManualLibrary
from codealmanac.prompts import PromptRenderer
from codealmanac.services.automation.ports import SchedulerAdapter
from codealmanac.services.automation.service import AutomationService
from codealmanac.services.config.service import ConfigService
from codealmanac.services.config.store import ConfigStore
from codealmanac.services.diagnostics.service import DiagnosticsService
from codealmanac.services.harnesses.ports import HarnessAdapter
from codealmanac.services.harnesses.service import HarnessesService
from codealmanac.services.health.service import HealthService
from codealmanac.services.index.service import IndexService
from codealmanac.services.index.store import IndexStore
from codealmanac.services.pages.service import PagesService
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.repositories.store import RepositoryStore
from codealmanac.services.runs.models import RunKind
from codealmanac.services.runs.ports import RunWorkerSpawner
from codealmanac.services.runs.service import RunsService
from codealmanac.services.runs.store import RunStore
from codealmanac.services.search.service import SearchService
from codealmanac.services.setup.ports import (
    GlobalStateRemover,
    InstructionInstaller,
    PackageUninstaller,
)
from codealmanac.services.setup.service import SetupService
from codealmanac.services.sources.ports import (
    SourceRuntimeAdapter,
    TranscriptDiscoveryAdapter,
)
from codealmanac.services.sources.service import SourcesService
from codealmanac.services.tagging.service import TaggingService
from codealmanac.services.topics.service import TopicsService
from codealmanac.services.updates.ports import (
    PackageCommandRunner,
    PackageInstallMetadataProvider,
)
from codealmanac.services.updates.service import UpdatesService
from codealmanac.services.viewer.renderer import MarkdownRenderer
from codealmanac.services.viewer.service import ViewerService
from codealmanac.services.wiki.service import WikiService
from codealmanac.settings import AppConfig, LocalStatePaths
from codealmanac.workflows.build.service import BuildWorkflow
from codealmanac.workflows.garden.service import GardenWorkflow
from codealmanac.workflows.ingest.service import IngestWorkflow
from codealmanac.workflows.operations import OperationRunner
from codealmanac.workflows.operations.mutation import OperationMutationPolicy
from codealmanac.workflows.run_queue import RunQueue
from codealmanac.workflows.sync.service import SyncWorkflow
from codealmanac.workflows.sync.store import SyncStateStore


@dataclass(frozen=True)
class CodeAlmanacWorkflows:
    build: BuildWorkflow
    ingest: IngestWorkflow
    garden: GardenWorkflow
    queue: RunQueue
    sync: SyncWorkflow


@dataclass(frozen=True)
class CodeAlmanac:
    local_state: LocalStatePaths
    automation: AutomationService
    config: ConfigService
    repositories: RepositoriesService
    wiki: WikiService
    index: IndexService
    search: SearchService
    pages: PagesService
    topics: TopicsService
    health: HealthService
    diagnostics: DiagnosticsService
    tagging: TaggingService
    updates: UpdatesService
    setup: SetupService
    viewer: ViewerService
    runs: RunsService
    sources: SourcesService
    harnesses: HarnessesService
    prompts: PromptRenderer
    manual: ManualLibrary
    workflows: CodeAlmanacWorkflows


@dataclass(frozen=True)
class AppAdapters:
    harness_adapters: Sequence[HarnessAdapter] | None = None
    transcript_discovery_adapters: Sequence[TranscriptDiscoveryAdapter] | None = None
    source_runtime_adapters: Sequence[SourceRuntimeAdapter] | None = None
    scheduler: SchedulerAdapter | None = None
    worker_spawner: RunWorkerSpawner | None = None
    update_metadata: PackageInstallMetadataProvider | None = None
    update_runner: PackageCommandRunner | None = None
    instruction_installer: InstructionInstaller | None = None
    global_state_remover: GlobalStateRemover | None = None
    package_uninstaller: PackageUninstaller | None = None


@dataclass(frozen=True)
class Services:
    local_state: LocalStatePaths
    automation: AutomationService
    config: ConfigService
    repositories: RepositoriesService
    wiki: WikiService
    index: IndexService
    search: SearchService
    pages: PagesService
    topics: TopicsService
    health: HealthService
    diagnostics: DiagnosticsService
    tagging: TaggingService
    updates: UpdatesService
    setup: SetupService
    viewer: ViewerService
    runs: RunsService
    sources: SourcesService
    harnesses: HarnessesService
    prompts: PromptRenderer
    manual: ManualLibrary


def create_app(
    config: AppConfig | None = None,
    harness_adapters: Sequence[HarnessAdapter] | None = None,
    transcript_discovery_adapters: Sequence[TranscriptDiscoveryAdapter] | None = None,
    source_runtime_adapters: Sequence[SourceRuntimeAdapter] | None = None,
    scheduler: SchedulerAdapter | None = None,
    worker_spawner: RunWorkerSpawner | None = None,
    update_metadata: PackageInstallMetadataProvider | None = None,
    update_runner: PackageCommandRunner | None = None,
    instruction_installer: InstructionInstaller | None = None,
    global_state_remover: GlobalStateRemover | None = None,
    package_uninstaller: PackageUninstaller | None = None,
) -> CodeAlmanac:
    app_config = config or AppConfig()
    local_state = LocalStatePaths.from_config(app_config)
    adapters = AppAdapters(
        harness_adapters=harness_adapters,
        transcript_discovery_adapters=transcript_discovery_adapters,
        source_runtime_adapters=source_runtime_adapters,
        scheduler=scheduler,
        worker_spawner=worker_spawner,
        update_metadata=update_metadata,
        update_runner=update_runner,
        instruction_installer=instruction_installer,
        global_state_remover=global_state_remover,
        package_uninstaller=package_uninstaller,
    )
    services = create_services(
        local_state,
        adapters,
    )
    workflows = create_workflows(
        services,
        adapters,
    )
    return assemble_app(services, workflows)


def create_services(
    local_state: LocalStatePaths,
    adapters: AppAdapters,
) -> Services:
    repositories = RepositoriesService(RepositoryStore(local_state.database_path))
    config_service = ConfigService(repositories, ConfigStore(), local_state.config_path)
    automation = AutomationService(adapters.scheduler or LaunchdSchedulerAdapter())
    manual = ManualLibrary()
    wiki = WikiService(repositories, manual)
    index = IndexService(repositories, IndexStore(), local_state)
    search = SearchService(repositories, index)
    pages = PagesService(repositories, index)
    topics = TopicsService(repositories, index)
    health = HealthService(repositories, index)
    diagnostics = DiagnosticsService(
        repositories,
        index,
        manual,
        local_state,
        __version__,
    )
    tagging = TaggingService(pages)
    package_metadata = adapters.update_metadata or InstalledPackageMetadataProvider()
    package_runner = adapters.update_runner or SubprocessPackageCommandRunner()
    updates = UpdatesService(
        package_metadata,
        package_runner,
        local_state.update_lock_path,
        local_state.database_path,
    )
    setup = SetupService(
        adapters.instruction_installer or FileInstructionInstaller(),
        automation,
        adapters.global_state_remover
        or FilesystemGlobalStateRemover(local_state.state_dir),
        adapters.package_uninstaller
        or PackageToolUninstaller(package_metadata, package_runner),
        config_service,
    )
    runs = RunsService(repositories, RunStore(local_state.database_path))
    viewer = ViewerService(repositories, index, runs, MarkdownRenderer())
    sources = SourcesService(
        default_transcript_discovery_adapters()
        if adapters.transcript_discovery_adapters is None
        else adapters.transcript_discovery_adapters,
        default_source_runtime_adapters()
        if adapters.source_runtime_adapters is None
        else adapters.source_runtime_adapters,
    )
    prompts = PromptRenderer()
    harnesses = HarnessesService(
        default_harness_adapters()
        if adapters.harness_adapters is None
        else adapters.harness_adapters
    )
    return Services(
        local_state=local_state,
        automation=automation,
        config=config_service,
        repositories=repositories,
        wiki=wiki,
        index=index,
        search=search,
        pages=pages,
        topics=topics,
        health=health,
        diagnostics=diagnostics,
        tagging=tagging,
        updates=updates,
        setup=setup,
        viewer=viewer,
        runs=runs,
        sources=sources,
        harnesses=harnesses,
        prompts=prompts,
        manual=manual,
    )


def create_operation(services: Services, kind: RunKind) -> OperationRunner:
    return OperationRunner(
        services.repositories,
        services.harnesses,
        services.runs,
        services.index,
        services.health,
        OperationMutationPolicy(GitRepositoryChangeProbe(), kind=kind),
    )


def create_workflows(
    services: Services,
    adapters: AppAdapters,
) -> CodeAlmanacWorkflows:
    build_operations = create_operation(services, RunKind.BUILD)
    ingest_operations = create_operation(services, RunKind.INGEST)
    garden_operations = create_operation(services, RunKind.GARDEN)
    ingest = IngestWorkflow(
        services.sources,
        services.runs,
        ingest_operations,
        services.prompts,
        services.manual,
    )
    garden = GardenWorkflow(
        services.runs,
        services.index,
        services.health,
        garden_operations,
        services.prompts,
        services.manual,
    )
    build = BuildWorkflow(
        services.repositories,
        services.wiki,
        services.runs,
        build_operations,
        services.prompts,
        services.manual,
    )
    queue = RunQueue(
        services.repositories,
        services.runs,
        ingest,
        garden,
        adapters.worker_spawner or SubprocessRunWorkerSpawner(),
    )
    sync = SyncWorkflow(
        services.repositories,
        services.sources,
        queue,
        SyncStateStore(services.local_state.database_path),
    )
    return CodeAlmanacWorkflows(
        build=build,
        ingest=ingest,
        garden=garden,
        queue=queue,
        sync=sync,
    )


def assemble_app(services: Services, workflows: CodeAlmanacWorkflows) -> CodeAlmanac:
    return CodeAlmanac(
        local_state=services.local_state,
        automation=services.automation,
        config=services.config,
        repositories=services.repositories,
        wiki=services.wiki,
        index=services.index,
        search=services.search,
        pages=services.pages,
        topics=services.topics,
        health=services.health,
        diagnostics=services.diagnostics,
        tagging=services.tagging,
        updates=services.updates,
        setup=services.setup,
        viewer=services.viewer,
        runs=services.runs,
        sources=services.sources,
        harnesses=services.harnesses,
        prompts=services.prompts,
        manual=services.manual,
        workflows=workflows,
    )
