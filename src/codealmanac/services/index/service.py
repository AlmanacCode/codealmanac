from codealmanac.services.index.models import (
    HealthReport,
    IndexRefreshResult,
    IndexSummary,
    PageView,
    SearchPageResult,
    TopicDetail,
    TopicSummary,
)
from codealmanac.services.index.requests import ReindexRequest, SearchIndexRequest
from codealmanac.services.index.store import IndexStore
from codealmanac.services.workspaces.requests import SelectWorkspaceRequest
from codealmanac.services.workspaces.service import WorkspacesService


class IndexService:
    def __init__(self, workspaces: WorkspacesService, store: IndexStore):
        self.workspaces = workspaces
        self.store = store

    def ensure_fresh(self, workspace_id: str) -> IndexRefreshResult:
        workspace = self.workspaces.get(workspace_id)
        return self.store.rebuild(workspace.almanac_path)

    def reindex(self, request: ReindexRequest) -> IndexRefreshResult:
        if request.wiki is None:
            workspace = self.workspaces.resolve(request.cwd)
        else:
            workspace = self.workspaces.select(
                SelectWorkspaceRequest(selector=request.wiki, base_path=request.cwd)
            )
        return self.ensure_fresh(workspace.workspace_id)

    def summary(self, workspace_id: str) -> IndexSummary:
        workspace = self.workspaces.get(workspace_id)
        refresh = self.store.rebuild(workspace.almanac_path)
        counts = self.store.counts(workspace.almanac_path)
        return IndexSummary(
            pages=counts.pages,
            topics=counts.topics,
            files_seen=refresh.files_seen,
            files_skipped=refresh.files_skipped,
        )

    def search(
        self,
        workspace_id: str,
        request: SearchIndexRequest,
    ) -> tuple[SearchPageResult, ...]:
        self.ensure_fresh(workspace_id)
        workspace = self.workspaces.get(workspace_id)
        return self.store.search(workspace.almanac_path, request)

    def get_page(self, workspace_id: str, slug: str) -> PageView | None:
        self.ensure_fresh(workspace_id)
        workspace = self.workspaces.get(workspace_id)
        return self.store.get_page(workspace.almanac_path, slug)

    def list_topics(self, workspace_id: str) -> tuple[TopicSummary, ...]:
        self.ensure_fresh(workspace_id)
        workspace = self.workspaces.get(workspace_id)
        return self.store.list_topics(workspace.almanac_path)

    def get_topic(
        self,
        workspace_id: str,
        slug: str,
        include_descendants: bool,
    ) -> TopicDetail | None:
        self.ensure_fresh(workspace_id)
        workspace = self.workspaces.get(workspace_id)
        return self.store.get_topic(
            workspace.almanac_path,
            slug,
            include_descendants,
        )

    def health_report(self, workspace_id: str) -> HealthReport:
        self.ensure_fresh(workspace_id)
        workspace = self.workspaces.get(workspace_id)
        registered_wikis = {workspace.name for workspace in self.workspaces.list()}
        return self.store.health_report(workspace.almanac_path, registered_wikis)
