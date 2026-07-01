from collections.abc import Sequence
from dataclasses import dataclass

from codealmanac import __version__
from codealmanac.core.models import AppConfig
from codealmanac.integrations.automation import LaunchdSchedulerAdapter
from codealmanac.integrations.harnesses import default_harness_adapters
from codealmanac.integrations.runs import SubprocessRunWorkerSpawner
from codealmanac.integrations.setup import FileInstructionInstaller
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
from codealmanac.services.setup.ports import InstructionInstaller
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
) -> CodeAlmanac:
    app_config = config or AppConfig()
    workspaces = WorkspacesService(WorkspaceRegistryStore(app_config.registry_path))
    config_service = ConfigService(workspaces, ConfigStore(), app_config.config_path)
    automation = AutomationService(workspaces, scheduler or LaunchdSchedulerAdapter())
    manual = ManualLibrary()
    wiki = WikiService(workspaces, manual)
    index = IndexService(workspaces, IndexStore())
    search = SearchService(workspaces, index)
    pages = PagesService(workspaces, index)
    topics = TopicsService(workspaces, index)
    health = HealthService(workspaces, index)
    diagnostics = DiagnosticsService(workspaces, index, manual, __version__)
    tagging = TaggingService(pages)
    updates = UpdatesService(
        update_metadata or InstalledPackageMetadataProvider(),
        update_runner or SubprocessPackageCommandRunner(),
    )
    setup = SetupService(
        instruction_installer or FileInstructionInstaller(),
        automation,
    )
    runs = RunsService(workspaces, RunStore())
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
    build = BuildWorkflow(workspaces, wiki, index)
    ingest_page_runs = PageRunWorkflow(
        workspaces,
        harnesses,
        runs,
        index,
        LifecycleMutationPolicy(GitWorkspaceChangeProbe(), operation="ingest"),
    )
    garden_page_runs = PageRunWorkflow(
        workspaces,
        harnesses,
        runs,
        index,
        LifecycleMutationPolicy(GitWorkspaceChangeProbe(), operation="garden"),
    )
    ingest = IngestWorkflow(
        sources,
        runs,
        ingest_page_runs,
        prompts,
    )
    garden = GardenWorkflow(
        runs,
        index,
        health,
        garden_page_runs,
        prompts,
    )
    queue = RunQueueWorkflow(
        runs,
        ingest,
        garden,
        worker_spawner or SubprocessRunWorkerSpawner(),
    )
    sync = SyncWorkflow(workspaces, sources, runs, ingest, queue, SyncLedgerStore())
    workflows = CodeAlmanacWorkflows(
        build=build,
        ingest=ingest,
        garden=garden,
        queue=queue,
        sync=sync,
    )
    return CodeAlmanac(
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
        workflows=workflows,
    )
