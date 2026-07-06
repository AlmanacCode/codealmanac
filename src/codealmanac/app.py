from collections.abc import Sequence
from dataclasses import dataclass

from codealmanac import __version__
from codealmanac.core.models import AppConfig
from codealmanac.integrations.automation import LaunchdSchedulerAdapter
from codealmanac.integrations.harnesses import default_harness_adapters
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
from codealmanac.integrations.workspaces.git import GitWorkspaceChangeProbe
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
from codealmanac.services.workspaces.runtime import WorkspaceRuntimePaths
from codealmanac.services.workspaces.service import WorkspacesService
from codealmanac.services.workspaces.store import WorkspaceRegistryStore
from codealmanac.workflows.build.service import BuildWorkflow
from codealmanac.workflows.garden.service import GardenWorkflow
from codealmanac.workflows.ingest.service import IngestWorkflow
from codealmanac.workflows.lifecycle import LifecycleMutationPolicy
from codealmanac.workflows.page_run import PageRunWorkflow
from codealmanac.workflows.run_queue import RunQueueWorkflow
from codealmanac.workflows.sync.service import SyncWorkflow
from codealmanac.workflows.sync.store import SyncLedgerStore


@dataclass(frozen=True)
class CodeAlmanacWorkflows:
    build: BuildWorkflow
    ingest: IngestWorkflow
    garden: GardenWorkflow
    queue: RunQueueWorkflow
    sync: SyncWorkflow


@dataclass(frozen=True)
class CodeAlmanac:
    automation: AutomationService
    config: ConfigService
    workspaces: WorkspacesService
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
class _Services:
    automation: AutomationService
    config: ConfigService
    workspaces: WorkspacesService
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
    runtime_paths = WorkspaceRuntimePaths(app_config.registry_path.parent)
    services = _create_services(
        app_config,
        runtime_paths,
        harness_adapters=harness_adapters,
        transcript_discovery_adapters=transcript_discovery_adapters,
        source_runtime_adapters=source_runtime_adapters,
        scheduler=scheduler,
        update_metadata=update_metadata,
        update_runner=update_runner,
        instruction_installer=instruction_installer,
        global_state_remover=global_state_remover,
        package_uninstaller=package_uninstaller,
    )
    workflows = _create_workflows(
        services,
        runtime_paths,
        worker_spawner=worker_spawner,
    )
    return _create_app(services, workflows)


def _create_services(
    app_config: AppConfig,
    runtime_paths: WorkspaceRuntimePaths,
    *,
    harness_adapters: Sequence[HarnessAdapter] | None,
    transcript_discovery_adapters: Sequence[TranscriptDiscoveryAdapter] | None,
    source_runtime_adapters: Sequence[SourceRuntimeAdapter] | None,
    scheduler: SchedulerAdapter | None,
    update_metadata: PackageInstallMetadataProvider | None,
    update_runner: PackageCommandRunner | None,
    instruction_installer: InstructionInstaller | None,
    global_state_remover: GlobalStateRemover | None,
    package_uninstaller: PackageUninstaller | None,
) -> _Services:
    workspaces = WorkspacesService(WorkspaceRegistryStore(app_config.registry_path))
    config_service = ConfigService(workspaces, ConfigStore(), app_config.config_path)
    automation = AutomationService(workspaces, scheduler or LaunchdSchedulerAdapter())
    manual = ManualLibrary()
    wiki = WikiService(workspaces, manual)
    index = IndexService(workspaces, IndexStore(), runtime_paths)
    search = SearchService(workspaces, index)
    pages = PagesService(workspaces, index)
    topics = TopicsService(workspaces, index)
    health = HealthService(workspaces, index)
    diagnostics = DiagnosticsService(workspaces, index, manual, __version__)
    tagging = TaggingService(pages)
    package_metadata = update_metadata or InstalledPackageMetadataProvider()
    package_runner = update_runner or SubprocessPackageCommandRunner()
    updates = UpdatesService(
        package_metadata,
        package_runner,
        app_config.registry_path.parent,
    )
    setup = SetupService(
        instruction_installer or FileInstructionInstaller(),
        automation,
        global_state_remover
        or FilesystemGlobalStateRemover(app_config.registry_path.parent),
        package_uninstaller
        or PackageToolUninstaller(package_metadata, package_runner),
        config_service,
    )
    runs = RunsService(workspaces, RunStore(), runtime_paths)
    viewer = ViewerService(workspaces, index, runs, MarkdownRenderer())
    sources = SourcesService(
        default_transcript_discovery_adapters()
        if transcript_discovery_adapters is None
        else transcript_discovery_adapters,
        default_source_runtime_adapters()
        if source_runtime_adapters is None
        else source_runtime_adapters,
    )
    prompts = PromptRenderer()
    harnesses = HarnessesService(
        default_harness_adapters() if harness_adapters is None else harness_adapters
    )
    return _Services(
        automation=automation,
        config=config_service,
        workspaces=workspaces,
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


def _create_page_run(services: _Services, operation: str) -> PageRunWorkflow:
    return PageRunWorkflow(
        services.workspaces,
        services.harnesses,
        services.runs,
        services.index,
        services.health,
        LifecycleMutationPolicy(GitWorkspaceChangeProbe(), operation=operation),
    )


def _create_workflows(
    services: _Services,
    runtime_paths: WorkspaceRuntimePaths,
    *,
    worker_spawner: RunWorkerSpawner | None,
) -> CodeAlmanacWorkflows:
    build_page_runs = _create_page_run(services, "build")
    ingest_page_runs = _create_page_run(services, "ingest")
    garden_page_runs = _create_page_run(services, "garden")
    ingest = IngestWorkflow(
        services.sources,
        services.runs,
        ingest_page_runs,
        services.prompts,
        services.manual,
    )
    garden = GardenWorkflow(
        services.runs,
        services.index,
        services.health,
        garden_page_runs,
        services.prompts,
        services.manual,
    )
    build = BuildWorkflow(
        services.workspaces,
        services.wiki,
        services.index,
        services.runs,
        build_page_runs,
        services.prompts,
        services.manual,
    )
    queue = RunQueueWorkflow(
        services.runs,
        ingest,
        garden,
        worker_spawner or SubprocessRunWorkerSpawner(),
    )
    sync = SyncWorkflow(
        services.workspaces,
        services.sources,
        services.runs,
        ingest,
        queue,
        SyncLedgerStore(),
        runtime_paths,
    )
    return CodeAlmanacWorkflows(
        build=build,
        ingest=ingest,
        garden=garden,
        queue=queue,
        sync=sync,
    )


def _create_app(services: _Services, workflows: CodeAlmanacWorkflows) -> CodeAlmanac:
    return CodeAlmanac(
        automation=services.automation,
        config=services.config,
        workspaces=services.workspaces,
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
