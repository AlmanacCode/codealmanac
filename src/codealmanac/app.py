from collections.abc import Sequence
from dataclasses import dataclass

from codealmanac import __version__
from codealmanac.core.models import AppConfig
from codealmanac.integrations.automation import LaunchdSchedulerAdapter
from codealmanac.integrations.browser import WebBrowserOpener
from codealmanac.integrations.capture import (
    CaptureTranscriptNormalizer,
    FileCaptureHookManager,
    GitCaptureRepositoryProbe,
)
from codealmanac.integrations.cloud import HttpCloudAuthClient
from codealmanac.integrations.cloud_login import TerminalCloudLoginInteraction
from codealmanac.integrations.harnesses import default_harness_adapters
from codealmanac.integrations.runs import (
    SubprocessLocalWorkerSpawner,
    SubprocessRunWorkerSpawner,
)
from codealmanac.integrations.setup import FileInstructionInstaller
from codealmanac.integrations.sources import (
    default_source_runtime_adapters,
    default_transcript_discovery_adapters,
)
from codealmanac.integrations.updates import (
    InstalledPackageMetadataProvider,
    SubprocessPackageCommandRunner,
)
from codealmanac.integrations.workspaces.git import (
    FileLocalGitHookManager,
    GitDetachedWorktreeManager,
    GitLocalDeliveryManager,
    GitLocalRepositoryProbe,
    GitLocalStateProbe,
    GitWorkspaceChangeProbe,
)
from codealmanac.manual import ManualLibrary
from codealmanac.prompts import PromptRenderer
from codealmanac.services.automation.ports import SchedulerAdapter
from codealmanac.services.automation.service import AutomationService
from codealmanac.services.cloud_auth.ports import CloudAuthClient
from codealmanac.services.cloud_auth.service import CloudAuthService
from codealmanac.services.cloud_auth.store import CloudAuthStore
from codealmanac.services.cloud_capture.event_store import CaptureEventStore
from codealmanac.services.cloud_capture.ports import (
    CaptureHookManager,
    CaptureRepositoryProbe,
    CaptureTranscriptParser,
    CloudCaptureClient,
)
from codealmanac.services.cloud_capture.service import CloudCaptureService
from codealmanac.services.cloud_capture.store import CaptureStateStore
from codealmanac.services.cloud_repositories.ports import CloudRepositoriesClient
from codealmanac.services.cloud_repositories.service import CloudRepositoriesService
from codealmanac.services.cloud_runs.ports import CloudRunsClient
from codealmanac.services.cloud_runs.service import CloudRunsService
from codealmanac.services.config.service import ConfigService
from codealmanac.services.config.store import ConfigStore
from codealmanac.services.control.ports import LocalGitStateProbe
from codealmanac.services.control.service import ControlService
from codealmanac.services.control.store import ControlStore
from codealmanac.services.deliveries.service import DeliveriesService
from codealmanac.services.deliveries.store import DeliveriesStore
from codealmanac.services.diagnostics.service import DiagnosticsService
from codealmanac.services.engine_runs.service import EngineRunsService
from codealmanac.services.engine_runs.store import EngineRunsStore
from codealmanac.services.harnesses.ports import HarnessAdapter
from codealmanac.services.harnesses.service import HarnessesService
from codealmanac.services.health.service import HealthService
from codealmanac.services.index.service import IndexService
from codealmanac.services.index.store import IndexStore
from codealmanac.services.local_hooks.ports import LocalGitHookManager
from codealmanac.services.local_hooks.service import LocalHooksService
from codealmanac.services.pages.service import PagesService
from codealmanac.services.runs.ports import RunWorkerSpawner
from codealmanac.services.runs.service import RunsService
from codealmanac.services.runs.store import RunStore
from codealmanac.services.search.service import SearchService
from codealmanac.services.setup.ports import InstructionInstaller
from codealmanac.services.setup.service import SetupService
from codealmanac.services.source_bundles.service import SourceBundlesService
from codealmanac.services.source_bundles.store import SourceBundlesStore
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
from codealmanac.services.worker_workspaces.ports import GitWorktreeManager
from codealmanac.services.worker_workspaces.service import WorkerWorkspacesService
from codealmanac.services.worker_workspaces.store import WorkerWorkspacesStore
from codealmanac.services.workspaces.service import WorkspacesService
from codealmanac.services.workspaces.store import WorkspaceRegistryStore
from codealmanac.workflows.cloud_login import CloudLoginWorkflow
from codealmanac.workflows.cloud_login.ports import BrowserOpener, CloudLoginInteraction
from codealmanac.workflows.cloud_open import CloudOpenWorkflow
from codealmanac.workflows.cloud_repo import CloudRepoWorkflow
from codealmanac.workflows.cloud_runs import CloudRunsWorkflow
from codealmanac.workflows.garden.service import GardenWorkflow
from codealmanac.workflows.ingest.service import IngestWorkflow
from codealmanac.workflows.init.service import InitWorkflow
from codealmanac.workflows.lifecycle import LifecycleMutationPolicy
from codealmanac.workflows.local_delivery import LocalDeliveryWorkflow
from codealmanac.workflows.local_delivery.ports import LocalGitDeliveryManager
from codealmanac.workflows.local_engine import LocalEngineWorkflow
from codealmanac.workflows.local_jobs import LocalJobsWorkflow
from codealmanac.workflows.local_policy import LocalPolicyWorkflow
from codealmanac.workflows.local_runs import LocalRunPreparationWorkflow
from codealmanac.workflows.local_setup import (
    LocalRepositoryProbe,
    LocalSetupWorkflow,
)
from codealmanac.workflows.local_status import LocalStatusWorkflow
from codealmanac.workflows.local_update import LocalUpdateWorkflow
from codealmanac.workflows.local_worker import LocalWorkerSpawner, LocalWorkerWorkflow
from codealmanac.workflows.page_run import PageRunWorkflow
from codealmanac.workflows.run_queue import RunQueueWorkflow
from codealmanac.workflows.sync.service import SyncWorkflow
from codealmanac.workflows.sync.store import SyncLedgerStore


@dataclass(frozen=True)
class CodeAlmanacWorkflows:
    cloud_login: CloudLoginWorkflow
    cloud_open: CloudOpenWorkflow
    cloud_repo: CloudRepoWorkflow
    cloud_runs: CloudRunsWorkflow
    init: InitWorkflow
    ingest: IngestWorkflow
    garden: GardenWorkflow
    queue: RunQueueWorkflow
    local_runs: LocalRunPreparationWorkflow
    local_setup: LocalSetupWorkflow
    local_status: LocalStatusWorkflow
    local_jobs: LocalJobsWorkflow
    local_policy: LocalPolicyWorkflow
    local_engine: LocalEngineWorkflow
    local_delivery: LocalDeliveryWorkflow
    local_worker: LocalWorkerWorkflow
    local_update: LocalUpdateWorkflow
    sync: SyncWorkflow


@dataclass(frozen=True)
class CodeAlmanac:
    automation: AutomationService
    cloud_auth: CloudAuthService
    capture: CloudCaptureService
    cloud_runs: CloudRunsService
    cloud_repositories: CloudRepositoriesService
    config: ConfigService
    control: ControlService
    deliveries: DeliveriesService
    engine_runs: EngineRunsService
    local_hooks: LocalHooksService
    source_bundles: SourceBundlesService
    worker_workspaces: WorkerWorkspacesService
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
    local_worker_spawner: LocalWorkerSpawner
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
    local_worker_spawner: LocalWorkerSpawner | None = None,
    update_metadata: PackageInstallMetadataProvider | None = None,
    update_runner: PackageCommandRunner | None = None,
    instruction_installer: InstructionInstaller | None = None,
    cloud_auth_client: CloudAuthClient | None = None,
    cloud_capture_client: CloudCaptureClient | None = None,
    cloud_runs_client: CloudRunsClient | None = None,
    cloud_repositories_client: CloudRepositoriesClient | None = None,
    capture_hook_manager: CaptureHookManager | None = None,
    capture_transcript_parser: CaptureTranscriptParser | None = None,
    capture_repository_probe: CaptureRepositoryProbe | None = None,
    browser_opener: BrowserOpener | None = None,
    cloud_login_interaction: CloudLoginInteraction | None = None,
    local_git_state_probe: LocalGitStateProbe | None = None,
    local_git_hook_manager: LocalGitHookManager | None = None,
    local_repository_probe: LocalRepositoryProbe | None = None,
    git_worktree_manager: GitWorktreeManager | None = None,
    git_delivery_manager: LocalGitDeliveryManager | None = None,
) -> CodeAlmanac:
    app_config = config or AppConfig()
    workspaces = WorkspacesService(WorkspaceRegistryStore(app_config.registry_path))
    config_service = ConfigService(workspaces, ConfigStore(), app_config.config_path)
    cloud_auth = CloudAuthService(
        CloudAuthStore(app_config.auth_path),
        cloud_auth_client or HttpCloudAuthClient(),
    )
    capture = CloudCaptureService(
        auth=cloud_auth,
        store=CaptureStateStore(app_config.capture_path),
        events=CaptureEventStore(app_config.capture_events_path),
        client=cloud_capture_client or HttpCloudAuthClient(),
        hooks=capture_hook_manager or FileCaptureHookManager(),
        parser=capture_transcript_parser or CaptureTranscriptNormalizer(),
        repository_probe=capture_repository_probe or GitCaptureRepositoryProbe(),
    )
    cloud_repositories = CloudRepositoriesService(
        cloud_auth,
        cloud_repositories_client or HttpCloudAuthClient(),
    )
    cloud_runs = CloudRunsService(
        cloud_auth,
        cloud_runs_client or HttpCloudAuthClient(),
    )
    control = ControlService(
        ControlStore(app_config.control_db_path),
        local_git_state_probe or GitLocalStateProbe(),
    )
    deliveries = DeliveriesService(DeliveriesStore(app_config.control_db_path))
    engine_runs = EngineRunsService(EngineRunsStore(app_config.run_artifacts_path))
    source_bundles = SourceBundlesService(SourceBundlesStore())
    local_hooks = LocalHooksService(
        local_git_hook_manager or FileLocalGitHookManager(),
    )
    worker_workspaces = WorkerWorkspacesService(
        WorkerWorkspacesStore(app_config.worker_workspaces_path),
        git_worktree_manager or GitDetachedWorktreeManager(),
    )
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
    resolved_browser_opener = browser_opener or WebBrowserOpener()
    cloud_login = CloudLoginWorkflow(
        cloud_auth,
        resolved_browser_opener,
        cloud_login_interaction or TerminalCloudLoginInteraction(),
    )
    setup = SetupService(
        instruction_installer or FileInstructionInstaller(),
        automation,
        cloud_login,
    )
    runs = RunsService(workspaces, RunStore(), jobs_path=app_config.jobs_path)
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
    init_page_runs = PageRunWorkflow(
        workspaces,
        harnesses,
        runs,
        index,
        LifecycleMutationPolicy(
            GitWorkspaceChangeProbe(),
            operation="init",
            require_clean_almanac=False,
        ),
    )
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
    init = InitWorkflow(
        workspaces,
        wiki,
        runs,
        init_page_runs,
        prompts,
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
        init,
        ingest,
        garden,
        worker_spawner or SubprocessRunWorkerSpawner(),
    )
    local_runs = LocalRunPreparationWorkflow(
        control,
        worker_workspaces,
        source_bundles,
        engine_runs,
    )
    resolved_local_repository_probe = (
        local_repository_probe or GitLocalRepositoryProbe()
    )
    local_setup = LocalSetupWorkflow(
        control,
        local_hooks,
        resolved_local_repository_probe,
    )
    cloud_repo = CloudRepoWorkflow(
        cloud_repositories,
        resolved_local_repository_probe,
    )
    cloud_open = CloudOpenWorkflow(
        resolved_local_repository_probe,
        resolved_browser_opener,
    )
    cloud_runs_workflow = CloudRunsWorkflow(
        cloud_runs,
        cloud_repo,
    )
    local_status = LocalStatusWorkflow(
        control,
        resolved_local_repository_probe,
    )
    local_jobs = LocalJobsWorkflow(control)
    local_policy = LocalPolicyWorkflow(
        control,
        local_status,
    )
    local_engine = LocalEngineWorkflow(
        control,
        engine_runs,
        harnesses,
        prompts,
    )
    local_delivery = LocalDeliveryWorkflow(
        control,
        deliveries,
        engine_runs,
        worker_workspaces,
        git_delivery_manager or GitLocalDeliveryManager(),
    )
    local_worker = LocalWorkerWorkflow(
        local_runs,
        local_engine,
        local_delivery,
    )
    local_update = LocalUpdateWorkflow(
        control,
        local_status,
        local_worker,
    )
    resolved_local_worker_spawner = (
        local_worker_spawner or SubprocessLocalWorkerSpawner()
    )
    sync = SyncWorkflow(
        workspaces,
        sources,
        runs,
        ingest,
        queue,
        SyncLedgerStore(app_config.jobs_path),
    )
    workflows = CodeAlmanacWorkflows(
        cloud_login=cloud_login,
        cloud_open=cloud_open,
        cloud_repo=cloud_repo,
        cloud_runs=cloud_runs_workflow,
        init=init,
        ingest=ingest,
        garden=garden,
        queue=queue,
        local_runs=local_runs,
        local_setup=local_setup,
        local_status=local_status,
        local_jobs=local_jobs,
        local_policy=local_policy,
        local_engine=local_engine,
        local_delivery=local_delivery,
        local_worker=local_worker,
        local_update=local_update,
        sync=sync,
    )
    return CodeAlmanac(
        automation=automation,
        cloud_auth=cloud_auth,
        capture=capture,
        cloud_runs=cloud_runs,
        cloud_repositories=cloud_repositories,
        config=config_service,
        control=control,
        deliveries=deliveries,
        engine_runs=engine_runs,
        local_hooks=local_hooks,
        source_bundles=source_bundles,
        worker_workspaces=worker_workspaces,
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
        local_worker_spawner=resolved_local_worker_spawner,
        prompts=prompts,
        manual=manual,
        workflows=workflows,
    )
