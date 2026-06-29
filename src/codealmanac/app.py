from dataclasses import dataclass

from codealmanac import __version__
from codealmanac.core.models import AppConfig
from codealmanac.services.diagnostics.service import DiagnosticsService
from codealmanac.services.health.service import HealthService
from codealmanac.services.index.service import IndexService
from codealmanac.services.index.store import IndexStore
from codealmanac.services.pages.service import PagesService
from codealmanac.services.runs.service import RunsService
from codealmanac.services.runs.store import RunStore
from codealmanac.services.search.service import SearchService
from codealmanac.services.tagging.service import TaggingService
from codealmanac.services.topics.service import TopicsService
from codealmanac.services.viewer.renderer import MarkdownRenderer
from codealmanac.services.viewer.service import ViewerService
from codealmanac.services.wiki.service import WikiService
from codealmanac.services.workspaces.service import WorkspacesService
from codealmanac.services.workspaces.store import WorkspaceRegistryStore
from codealmanac.workflows.build.service import BuildWorkflow


@dataclass(frozen=True)
class CodeAlmanac:
    workspaces: WorkspacesService
    wiki: WikiService
    index: IndexService
    search: SearchService
    pages: PagesService
    topics: TopicsService
    health: HealthService
    diagnostics: DiagnosticsService
    tagging: TaggingService
    viewer: ViewerService
    runs: RunsService
    build: BuildWorkflow


def create_app(config: AppConfig | None = None) -> CodeAlmanac:
    app_config = config or AppConfig()
    workspaces = WorkspacesService(WorkspaceRegistryStore(app_config.registry_path))
    wiki = WikiService(workspaces)
    index = IndexService(workspaces, IndexStore())
    search = SearchService(workspaces, index)
    pages = PagesService(workspaces, index)
    topics = TopicsService(workspaces, index)
    health = HealthService(workspaces, index)
    diagnostics = DiagnosticsService(workspaces, index, __version__)
    tagging = TaggingService(pages)
    viewer = ViewerService(workspaces, index, MarkdownRenderer())
    runs = RunsService(workspaces, RunStore())
    build = BuildWorkflow(workspaces, wiki, index)
    return CodeAlmanac(
        workspaces=workspaces,
        wiki=wiki,
        index=index,
        search=search,
        pages=pages,
        topics=topics,
        health=health,
        diagnostics=diagnostics,
        tagging=tagging,
        viewer=viewer,
        runs=runs,
        build=build,
    )
