from collections.abc import Sequence
from dataclasses import dataclass

from codealmanac import __version__
from codealmanac.cloud.auth.login_ports import BrowserOpener, CloudLoginInteraction
from codealmanac.cloud.auth.login_workflow import CloudLoginWorkflow
from codealmanac.cloud.auth.ports import CloudAuthClient
from codealmanac.cloud.auth.service import CloudAuthService
from codealmanac.cloud.auth.store import CloudAuthStore
from codealmanac.cloud.capture.event_store import CaptureEventStore
from codealmanac.cloud.capture.ports import (
    CaptureHookManager,
    CaptureRepositoryProbe,
    CaptureTranscriptParser,
    CloudCaptureClient,
)
from codealmanac.cloud.capture.service import CloudCaptureService
from codealmanac.cloud.capture.store import CaptureStateStore
from codealmanac.cloud.open.workflow import CloudOpenWorkflow
from codealmanac.cloud.repositories.ports import CloudRepositoriesClient
from codealmanac.cloud.repositories.service import CloudRepositoriesService
from codealmanac.cloud.repositories.workflow import CloudRepoWorkflow
from codealmanac.cloud.runs.ports import CloudRunsClient
from codealmanac.cloud.runs.service import CloudRunsService
from codealmanac.cloud.runs.workflow import CloudRunsWorkflow
from codealmanac.cloud.status.workflow import CloudStatusWorkflow
from codealmanac.core.models import AppConfig
from codealmanac.engine.harnesses.ports import HarnessAdapter
from codealmanac.engine.harnesses.service import HarnessesService
from codealmanac.engine.lifecycle import LifecycleMutationPolicy
from codealmanac.engine.page_run import PageRunWorkflow
from codealmanac.engine.runs.service import EngineRunsService
from codealmanac.engine.runs.store import EngineRunsStore
from codealmanac.engine.source_bundles.service import SourceBundlesService
from codealmanac.engine.source_bundles.store import SourceBundlesStore
from codealmanac.engine.sources.ports import (
    SourceRuntimeAdapter,
    TranscriptDiscoveryAdapter,
)
from codealmanac.engine.sources.service import SourcesService
from codealmanac.engine.workspaces.ports import GitWorktreeManager
from codealmanac.engine.workspaces.service import EngineWorkspacesService
from codealmanac.engine.workspaces.store import EngineWorkspacesStore
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
    SubprocessJobWorkerSpawner,
    SubprocessLocalWorkerSpawner,
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
from codealmanac.jobs.ledger.ports import JobWorkerSpawner
from codealmanac.jobs.ledger.service import JobLedgerService
from codealmanac.jobs.ledger.store import JobStore
from codealmanac.jobs.queue import JobQueueWorkflow
from codealmanac.local.control.ports import LocalGitStateProbe
from codealmanac.local.control.service import ControlService
from codealmanac.local.control.store import ControlStore
from codealmanac.local.delivery.execution import LocalDeliveryWorkflow
from codealmanac.local.delivery.execution.ports import LocalGitDeliveryManager
from codealmanac.local.delivery.ledger.service import DeliveriesService
from codealmanac.local.delivery.ledger.store import DeliveriesStore
from codealmanac.local.hooks.ports import LocalGitHookManager
from codealmanac.local.hooks.service import LocalHooksService
from codealmanac.local.policies import LocalPolicyWorkflow
from codealmanac.local.runs.execution import LocalEngineWorkflow
from codealmanac.local.runs.preparation import LocalRunPreparationWorkflow
from codealmanac.local.runs.service import LocalRunsWorkflow
from codealmanac.local.runs.worker import LocalWorkerSpawner, LocalWorkerWorkflow
from codealmanac.local.setup import (
    LocalRepositoryProbe,
    LocalSetupWorkflow,
)
from codealmanac.local.status import LocalStatusWorkflow
from codealmanac.manual import ManualLibrary
from codealmanac.prompts import PromptRenderer
from codealmanac.services.config.service import ConfigService
from codealmanac.services.config.store import ConfigStore
from codealmanac.services.diagnostics.service import DiagnosticsService
from codealmanac.services.setup.ports import InstructionInstaller
from codealmanac.services.setup.service import SetupService
from codealmanac.services.tagging.service import TaggingService
from codealmanac.services.updates.ports import (
    PackageCommandRunner,
    PackageInstallMetadataProvider,
)
from codealmanac.services.updates.service import UpdatesService
from codealmanac.wiki.health.service import HealthService
from codealmanac.wiki.index.service import IndexService
from codealmanac.wiki.index.store import IndexStore
from codealmanac.wiki.pages.service import PagesService
from codealmanac.wiki.search.service import SearchService
from codealmanac.wiki.service import WikiService
from codealmanac.wiki.topics.service import TopicsService
from codealmanac.wiki.viewer.renderer import MarkdownRenderer
from codealmanac.wiki.viewer.service import ViewerService
from codealmanac.wiki.workspaces.service import WorkspacesService
from codealmanac.wiki.workspaces.store import WorkspaceRegistryStore
from codealmanac.workflows.garden.service import GardenWorkflow
from codealmanac.workflows.ingest.service import IngestWorkflow
from codealmanac.workflows.init.service import InitWorkflow


@dataclass(frozen=True)
class CodeAlmanacWorkflows:
    cloud_login: CloudLoginWorkflow
    cloud_open: CloudOpenWorkflow
    cloud_repo: CloudRepoWorkflow
    cloud_runs: CloudRunsWorkflow
    cloud_status: CloudStatusWorkflow
    init: InitWorkflow
    ingest: IngestWorkflow
    garden: GardenWorkflow
    queue: JobQueueWorkflow
    local_runs: LocalRunsWorkflow
    local_setup: LocalSetupWorkflow
    local_status: LocalStatusWorkflow
    local_policy: LocalPolicyWorkflow
    local_run_preparation: LocalRunPreparationWorkflow
    local_engine: LocalEngineWorkflow
    local_delivery: LocalDeliveryWorkflow
    local_worker: LocalWorkerWorkflow


@dataclass(frozen=True)
class CodeAlmanacEngine:
    harnesses: HarnessesService
    sources: SourcesService
    source_bundles: SourceBundlesService
    runs: EngineRunsService
    workspaces: EngineWorkspacesService


@dataclass(frozen=True)
class CodeAlmanacLocal:
    control: ControlService
    deliveries: DeliveriesService
    hooks: LocalHooksService
    worker_spawner: LocalWorkerSpawner
    setup: LocalSetupWorkflow
    status: LocalStatusWorkflow
    runs: LocalRunsWorkflow
    policy: LocalPolicyWorkflow
    run_preparation: LocalRunPreparationWorkflow
    engine: LocalEngineWorkflow
    delivery: LocalDeliveryWorkflow
    worker: LocalWorkerWorkflow


@dataclass(frozen=True)
class CodeAlmanac:
    cloud_auth: CloudAuthService
    capture: CloudCaptureService
    cloud_runs: CloudRunsService
    cloud_repositories: CloudRepositoriesService
    config: ConfigService
    control: ControlService
    deliveries: DeliveriesService
    engine: CodeAlmanacEngine
    local_hooks: LocalHooksService
    source_bundles: SourceBundlesService
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
    jobs: JobLedgerService
    sources: SourcesService
    harnesses: HarnessesService
    local: CodeAlmanacLocal
    local_worker_spawner: LocalWorkerSpawner
    prompts: PromptRenderer
    manual: ManualLibrary
    workflows: CodeAlmanacWorkflows


def create_app(
    config: AppConfig | None = None,
    harness_adapters: Sequence[HarnessAdapter] | None = None,
    transcript_discovery_adapters: Sequence[TranscriptDiscoveryAdapter] | None = None,
    source_runtime_adapters: Sequence[SourceRuntimeAdapter] | None = None,
    worker_spawner: JobWorkerSpawner | None = None,
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
    engine_workspaces = EngineWorkspacesService(
        EngineWorkspacesStore(app_config.engine_workspaces_path),
        git_worktree_manager or GitDetachedWorktreeManager(),
    )
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
        cloud_login,
    )
    jobs = JobLedgerService(workspaces, JobStore(), jobs_path=app_config.jobs_path)
    viewer = ViewerService(workspaces, index, jobs, MarkdownRenderer())
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
    engine = CodeAlmanacEngine(
        harnesses=harnesses,
        sources=sources,
        source_bundles=source_bundles,
        runs=engine_runs,
        workspaces=engine_workspaces,
    )
    init_page_runs = PageRunWorkflow(
        workspaces,
        harnesses,
        jobs,
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
        jobs,
        index,
        LifecycleMutationPolicy(GitWorkspaceChangeProbe(), operation="ingest"),
    )
    garden_page_runs = PageRunWorkflow(
        workspaces,
        harnesses,
        jobs,
        index,
        LifecycleMutationPolicy(GitWorkspaceChangeProbe(), operation="garden"),
    )
    init = InitWorkflow(
        workspaces,
        wiki,
        jobs,
        init_page_runs,
        prompts,
    )
    ingest = IngestWorkflow(
        sources,
        jobs,
        ingest_page_runs,
        prompts,
    )
    garden = GardenWorkflow(
        jobs,
        index,
        health,
        garden_page_runs,
        prompts,
    )
    queue = JobQueueWorkflow(
        jobs,
        init,
        ingest,
        garden,
        worker_spawner or SubprocessJobWorkerSpawner(),
    )
    local_runs = LocalRunPreparationWorkflow(
        control,
        engine.workspaces,
        engine.source_bundles,
        engine.runs,
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
        cloud_repositories,
        resolved_browser_opener,
    )
    cloud_runs_workflow = CloudRunsWorkflow(
        cloud_runs,
        cloud_repo,
    )
    cloud_status = CloudStatusWorkflow(
        cloud_auth,
        cloud_repo,
        capture,
    )
    local_status = LocalStatusWorkflow(
        control,
        resolved_local_repository_probe,
    )
    local_policy = LocalPolicyWorkflow(
        control,
        local_status,
    )
    local_engine = LocalEngineWorkflow(
        control,
        engine.runs,
        engine.harnesses,
        prompts,
    )
    local_delivery = LocalDeliveryWorkflow(
        control,
        deliveries,
        engine.runs,
        engine.workspaces,
        git_delivery_manager or GitLocalDeliveryManager(),
    )
    local_worker = LocalWorkerWorkflow(
        local_runs,
        local_engine,
        local_delivery,
    )
    local_runs_workflow = LocalRunsWorkflow(
        control,
        local_status,
        local_worker,
    )
    resolved_local_worker_spawner = (
        local_worker_spawner or SubprocessLocalWorkerSpawner()
    )
    local = CodeAlmanacLocal(
        control=control,
        deliveries=deliveries,
        hooks=local_hooks,
        worker_spawner=resolved_local_worker_spawner,
        setup=local_setup,
        status=local_status,
        runs=local_runs_workflow,
        policy=local_policy,
        run_preparation=local_runs,
        engine=local_engine,
        delivery=local_delivery,
        worker=local_worker,
    )
    workflows = CodeAlmanacWorkflows(
        cloud_login=cloud_login,
        cloud_open=cloud_open,
        cloud_repo=cloud_repo,
        cloud_runs=cloud_runs_workflow,
        cloud_status=cloud_status,
        init=init,
        ingest=ingest,
        garden=garden,
        queue=queue,
        local_runs=local_runs_workflow,
        local_setup=local_setup,
        local_status=local_status,
        local_policy=local_policy,
        local_run_preparation=local_runs,
        local_engine=local_engine,
        local_delivery=local_delivery,
        local_worker=local_worker,
    )
    return CodeAlmanac(
        cloud_auth=cloud_auth,
        capture=capture,
        cloud_runs=cloud_runs,
        cloud_repositories=cloud_repositories,
        config=config_service,
        control=control,
        deliveries=deliveries,
        engine=engine,
        local_hooks=local_hooks,
        source_bundles=source_bundles,
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
        jobs=jobs,
        sources=sources,
        harnesses=harnesses,
        local=local,
        local_worker_spawner=resolved_local_worker_spawner,
        prompts=prompts,
        manual=manual,
        workflows=workflows,
    )
