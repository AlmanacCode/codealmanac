from codealmanac.core.errors import NotFoundError
from codealmanac.core.slug import to_kebab_case
from codealmanac.services.runs.requests import AttachRunRequest, ListRunsRequest
from codealmanac.services.runs.service import RunsService
from codealmanac.wiki.index.models import PageView
from codealmanac.wiki.index.requests import SearchIndexRequest
from codealmanac.wiki.index.service import IndexService
from codealmanac.wiki.paths import looks_like_dir
from codealmanac.wiki.viewer.jobs import viewer_job_event, viewer_job_run
from codealmanac.wiki.viewer.models import (
    ViewerFile,
    ViewerFileKind,
    ViewerFileReference,
    ViewerJob,
    ViewerJobs,
    ViewerOverview,
    ViewerPage,
    ViewerPageSummary,
    ViewerSearch,
    ViewerTopic,
)
from codealmanac.wiki.viewer.projections import (
    page_summary_from_search,
    page_summary_from_view,
    viewer_page_sources,
    viewer_topic_summary,
    viewer_workspace,
)
from codealmanac.wiki.viewer.renderer import MarkdownRenderer
from codealmanac.wiki.viewer.requests import (
    ViewerFileRequest,
    ViewerJobRequest,
    ViewerJobsRequest,
    ViewerOverviewRequest,
    ViewerPageRequest,
    ViewerSearchRequest,
    ViewerTopicRequest,
)
from codealmanac.wiki.viewer.workspace_scope import ViewerWorkspaceScope
from codealmanac.wiki.workspaces.models import Workspace
from codealmanac.wiki.workspaces.service import WorkspacesService


class ViewerService:
    def __init__(
        self,
        workspaces: WorkspacesService,
        index: IndexService,
        runs: RunsService,
        renderer: MarkdownRenderer,
    ):
        self.index = index
        self.runs = runs
        self.renderer = renderer
        self.workspace_scope = ViewerWorkspaceScope(workspaces)

    def overview(self, request: ViewerOverviewRequest) -> ViewerOverview:
        workspace = self.workspace_scope.select(request.cwd, request.wiki)
        summary = self.index.summary(workspace.workspace_id)
        pages = self.index.search(
            workspace.workspace_id,
            SearchIndexRequest(limit=request.page_limit),
        )
        topics = self.index.list_topics(workspace.workspace_id)
        return ViewerOverview(
            workspace=viewer_workspace(workspace),
            workspaces=self.workspace_scope.navigation(
                selected=workspace,
                include_all=request.include_workspaces,
            ),
            page_count=summary.pages,
            topic_count=summary.topics,
            pages=tuple(page_summary_from_search(page) for page in pages),
            topics=tuple(viewer_topic_summary(topic) for topic in topics),
            featured_page=self.get_featured_page(workspace),
        )

    def page(self, request: ViewerPageRequest) -> ViewerPage:
        workspace = self.workspace_scope.select(request.cwd, request.wiki)
        page = self.get_page_or_raise(workspace, request.slug)
        related_pages = self.related_pages(workspace, page)
        return ViewerPage(
            workspace=viewer_workspace(workspace),
            slug=page.slug,
            title=page.title,
            summary=page.summary,
            topics=page.topics,
            body=page.body,
            html=self.renderer.render(page.body),
            backlinks=page.wikilinks_in,
            outgoing_links=page.wikilinks_out,
            file_refs=tuple(
                ViewerFileReference(path=ref.path, is_dir=ref.is_dir)
                for ref in page.file_refs
            ),
            sources=viewer_page_sources(page.sources),
            related_pages=related_pages,
        )

    def search(self, request: ViewerSearchRequest) -> ViewerSearch:
        workspace = self.workspace_scope.select(request.cwd, request.wiki)
        pages = self.index.search(
            workspace.workspace_id,
            SearchIndexRequest(query=request.query, limit=request.limit),
        )
        return ViewerSearch(
            workspace=viewer_workspace(workspace),
            query=request.query,
            pages=tuple(page_summary_from_search(page) for page in pages),
        )

    def file(self, request: ViewerFileRequest) -> ViewerFile:
        workspace = self.workspace_scope.select(request.cwd, request.wiki)
        pages = self.index.search(
            workspace.workspace_id,
            SearchIndexRequest(mentions=request.path, limit=request.limit),
        )
        kind = (
            ViewerFileKind.DIRECTORY
            if looks_like_dir(request.path)
            else ViewerFileKind.FILE
        )
        return ViewerFile(
            workspace=viewer_workspace(workspace),
            path=request.path,
            kind=kind,
            pages=tuple(page_summary_from_search(page) for page in pages),
        )

    def topic(self, request: ViewerTopicRequest) -> ViewerTopic:
        workspace = self.workspace_scope.select(request.cwd, request.wiki)
        slug = to_kebab_case(request.slug)
        topic = self.index.get_topic(
            workspace.workspace_id,
            slug,
            request.include_descendants,
        )
        if topic is None:
            raise NotFoundError("topic", request.slug)
        pages = tuple(
            page_summary
            for page_slug in topic.pages
            if (page_summary := self.page_summary(workspace, page_slug)) is not None
        )
        return ViewerTopic(
            workspace=viewer_workspace(workspace),
            slug=topic.slug,
            title=topic.title,
            description=topic.description,
            parents=topic.parents,
            children=topic.children,
            pages=pages,
        )

    def jobs(self, request: ViewerJobsRequest) -> ViewerJobs:
        workspace = self.workspace_scope.select(request.cwd, request.wiki)
        runs = self.runs.list(
            ListRunsRequest(
                cwd=request.cwd,
                wiki=workspace.workspace_id,
                limit=request.limit,
            )
        )
        return ViewerJobs(
            workspace=viewer_workspace(workspace),
            runs=tuple(viewer_job_run(record) for record in runs),
        )

    def job(self, request: ViewerJobRequest) -> ViewerJob:
        workspace = self.workspace_scope.select(request.cwd, request.wiki)
        snapshot = self.runs.attach(
            AttachRunRequest(
                cwd=request.cwd,
                wiki=workspace.workspace_id,
                run_id=request.run_id,
            )
        )
        return ViewerJob(
            workspace=viewer_workspace(workspace),
            run=viewer_job_run(snapshot.record),
            events=tuple(viewer_job_event(event) for event in snapshot.events),
        )

    def get_page_or_raise(self, workspace: Workspace, slug: str) -> PageView:
        normalized = to_kebab_case(slug)
        page = self.index.get_page(workspace.workspace_id, normalized)
        if page is None:
            raise NotFoundError("page", slug)
        return page

    def page_summary(
        self,
        workspace: Workspace,
        slug: str,
    ) -> ViewerPageSummary | None:
        page = self.index.get_page(workspace.workspace_id, slug)
        if page is None:
            return None
        return page_summary_from_view(page)

    def get_featured_page(self, workspace: Workspace) -> ViewerPageSummary | None:
        return self.page_summary(workspace, "getting-started")

    def related_pages(
        self,
        workspace: Workspace,
        page: PageView,
    ) -> tuple[ViewerPageSummary, ...]:
        seen: set[str] = set()
        related: list[ViewerPageSummary] = []
        for slug in (*page.wikilinks_in, *page.wikilinks_out):
            if slug in seen or slug == page.slug:
                continue
            seen.add(slug)
            summary = self.page_summary(workspace, slug)
            if summary is not None:
                related.append(summary)
        return tuple(related)
