from dataclasses import dataclass

from codealmanac.core.models import AppConfig
from codealmanac.services.health.service import HealthService
from codealmanac.services.index.service import IndexService
from codealmanac.services.index.store import IndexStore
from codealmanac.services.pages.service import PagesService
from codealmanac.services.search.service import SearchService
from codealmanac.services.topics.service import TopicsService
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
    build = BuildWorkflow(workspaces, wiki)
    return CodeAlmanac(
        workspaces=workspaces,
        wiki=wiki,
        index=index,
        search=search,
        pages=pages,
        topics=topics,
        health=health,
        build=build,
    )
