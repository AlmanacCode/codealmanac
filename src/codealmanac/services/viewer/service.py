from codealmanac.core.errors import NotFoundError
from codealmanac.core.slug import to_kebab_case
from codealmanac.services.index.models import PageView
from codealmanac.services.index.requests import SearchIndexRequest
from codealmanac.services.index.service import IndexService
from codealmanac.services.repositories.models import Repository
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.runs.requests import AttachRunRequest, ListRunsRequest
from codealmanac.services.runs.service import RunsService
from codealmanac.services.runs.transcript import project_run_steps
from codealmanac.services.viewer.jobs import viewer_job_run, viewer_job_step
from codealmanac.services.viewer.models import (
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
from codealmanac.services.viewer.projections import (
    page_summary_from_search,
    page_summary_from_view,
    viewer_page_sources,
    viewer_repository,
    viewer_topic_summary,
)
from codealmanac.services.viewer.renderer import MarkdownRenderer
from codealmanac.services.viewer.repository_scope import ViewerRepositoryScope
from codealmanac.services.viewer.requests import (
    ViewerFileRequest,
    ViewerJobRequest,
    ViewerJobsRequest,
    ViewerOverviewRequest,
    ViewerPageRequest,
    ViewerSearchRequest,
    ViewerTopicRequest,
)
from codealmanac.services.wiki.paths import looks_like_dir


class ViewerService:
    def __init__(
        self,
        repositories: RepositoriesService,
        index: IndexService,
        runs: RunsService,
        renderer: MarkdownRenderer,
    ):
        self.index = index
        self.runs = runs
        self.renderer = renderer
        self.repository_scope = ViewerRepositoryScope(repositories)

    def overview(self, request: ViewerOverviewRequest) -> ViewerOverview:
        repository = self.repository_scope.select(request.cwd, request.repository_name)
        summary = self.index.summary(repository.repository_id)
        pages = self.index.search(
            repository.repository_id,
            SearchIndexRequest(limit=request.page_limit),
        )
        navigation_pages = self.index.search(
            repository.repository_id,
            SearchIndexRequest(),
        )
        topics = self.index.list_topics(repository.repository_id)
        return ViewerOverview(
            repository=viewer_repository(repository),
            repositories=self.repository_scope.navigation(
                selected=repository,
                include_all=request.include_repositories,
            ),
            page_count=summary.pages,
            topic_count=summary.topics,
            pages=tuple(page_summary_from_search(repository, page) for page in pages),
            navigation_pages=tuple(
                page_summary_from_search(repository, page)
                for page in navigation_pages
            ),
            topics=tuple(viewer_topic_summary(topic) for topic in topics),
            featured_page=self.get_featured_page(repository),
        )

    def page(self, request: ViewerPageRequest) -> ViewerPage:
        repository = self.repository_scope.select(request.cwd, request.repository_name)
        page = self.get_page_or_raise(repository, request.slug)
        related_pages = self.related_pages(repository, page)
        rendered = self.renderer.render(
            page.body,
            page_id=page.slug,
            title=page.title,
            source_is_folder_landing=page.file_path.name == "README.md",
        )
        return ViewerPage(
            repository=viewer_repository(repository),
            slug=page.slug,
            title=page.title,
            summary=page.summary,
            topics=page.topics,
            body=page.body,
            html=rendered.html,
            backlinks=page.page_links_in,
            outgoing_links=page.page_links_out,
            file_refs=tuple(
                ViewerFileReference(path=ref.path, is_dir=ref.is_dir)
                for ref in page.file_refs
            ),
            sources=viewer_page_sources(page.sources, rendered.citation_order),
            related_pages=related_pages,
        )

    def search(self, request: ViewerSearchRequest) -> ViewerSearch:
        repository = self.repository_scope.select(request.cwd, request.repository_name)
        pages = self.index.search(
            repository.repository_id,
            SearchIndexRequest(query=request.query, limit=request.limit),
        )
        return ViewerSearch(
            repository=viewer_repository(repository),
            query=request.query,
            pages=tuple(page_summary_from_search(repository, page) for page in pages),
        )

    def file(self, request: ViewerFileRequest) -> ViewerFile:
        repository = self.repository_scope.select(request.cwd, request.repository_name)
        pages = self.index.search(
            repository.repository_id,
            SearchIndexRequest(mentions=request.path, limit=request.limit),
        )
        kind = (
            ViewerFileKind.DIRECTORY
            if looks_like_dir(request.path)
            else ViewerFileKind.FILE
        )
        return ViewerFile(
            repository=viewer_repository(repository),
            path=request.path,
            kind=kind,
            pages=tuple(page_summary_from_search(repository, page) for page in pages),
        )

    def topic(self, request: ViewerTopicRequest) -> ViewerTopic:
        repository = self.repository_scope.select(request.cwd, request.repository_name)
        slug = to_kebab_case(request.slug)
        topic = self.index.get_topic(
            repository.repository_id,
            slug,
            request.include_descendants,
        )
        if topic is None:
            raise NotFoundError("topic", request.slug)
        pages = tuple(
            page_summary
            for page_slug in topic.pages
            if (page_summary := self.page_summary(repository, page_slug)) is not None
        )
        return ViewerTopic(
            repository=viewer_repository(repository),
            slug=topic.slug,
            title=topic.title,
            description=topic.description,
            parents=topic.parents,
            children=topic.children,
            pages=pages,
        )

    def jobs(self, request: ViewerJobsRequest) -> ViewerJobs:
        repository = self.repository_scope.select(request.cwd, request.repository_name)
        runs = self.runs.list(
            ListRunsRequest(
                repository_name=repository.name,
                limit=request.limit,
            )
        )
        return ViewerJobs(
            repository=viewer_repository(repository),
            runs=tuple(viewer_job_run(record) for record in runs),
        )

    def job(self, request: ViewerJobRequest) -> ViewerJob:
        repository = self.repository_scope.select(request.cwd, request.repository_name)
        snapshot = self.runs.attach(
            AttachRunRequest(
                repository_name=repository.name,
                run_id=request.run_id,
            )
        )
        return ViewerJob(
            repository=viewer_repository(repository),
            run=viewer_job_run(snapshot.record),
            steps=tuple(map(viewer_job_step, project_run_steps(snapshot.events))),
        )

    def get_page_or_raise(self, repository: Repository, slug: str) -> PageView:
        page = self.index.get_page(repository.repository_id, slug)
        if page is None:
            raise NotFoundError("page", slug)
        return page

    def page_summary(
        self,
        repository: Repository,
        slug: str,
    ) -> ViewerPageSummary | None:
        page = self.index.get_page(repository.repository_id, slug)
        if page is None:
            return None
        return page_summary_from_view(repository, page)

    def get_featured_page(self, repository: Repository) -> ViewerPageSummary | None:
        return self.page_summary(repository, "README")

    def related_pages(
        self,
        repository: Repository,
        page: PageView,
    ) -> tuple[ViewerPageSummary, ...]:
        seen: set[str] = set()
        related: list[ViewerPageSummary] = []
        for slug in (*page.page_links_in, *page.page_links_out):
            if slug in seen or slug == page.slug:
                continue
            seen.add(slug)
            summary = self.page_summary(repository, slug)
            if summary is not None:
                related.append(summary)
        return tuple(related)
