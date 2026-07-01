from dataclasses import dataclass
from pathlib import Path

from fastapi import FastAPI

from codealmanac.app import CodeAlmanac
from codealmanac.services.viewer.models import (
    ViewerFile,
    ViewerJob,
    ViewerJobs,
    ViewerOverview,
    ViewerPage,
    ViewerSearch,
    ViewerTopic,
)
from codealmanac.services.viewer.requests import (
    ViewerFileRequest,
    ViewerJobRequest,
    ViewerJobsRequest,
    ViewerOverviewRequest,
    ViewerPageRequest,
    ViewerSearchRequest,
    ViewerTopicRequest,
)


@dataclass(frozen=True)
class ServerApiContext:
    codealmanac: CodeAlmanac
    cwd: Path
    scope_wiki: str | None = None

    def selected_wiki(self, request_wiki: str | None) -> str | None:
        return self.scope_wiki or request_wiki


def register_api_routes(server: FastAPI, context: ServerApiContext) -> None:
    @server.get("/api/overview", response_model=ViewerOverview)
    def overview(wiki: str | None = None) -> ViewerOverview:
        return context.codealmanac.viewer.overview(
            ViewerOverviewRequest(
                cwd=context.cwd,
                wiki=context.selected_wiki(wiki),
                include_workspaces=context.scope_wiki is None,
            )
        )

    @server.get("/api/page/{slug}", response_model=ViewerPage)
    def page(slug: str, wiki: str | None = None) -> ViewerPage:
        return context.codealmanac.viewer.page(
            ViewerPageRequest(
                cwd=context.cwd,
                wiki=context.selected_wiki(wiki),
                slug=slug,
            )
        )

    @server.get("/api/search", response_model=ViewerSearch)
    def search(
        q: str | None = None,
        limit: int = 50,
        wiki: str | None = None,
    ) -> ViewerSearch:
        return context.codealmanac.viewer.search(
            ViewerSearchRequest(
                cwd=context.cwd,
                wiki=context.selected_wiki(wiki),
                query=q,
                limit=limit,
            )
        )

    @server.get("/api/file", response_model=ViewerFile)
    def file_route(
        path: str,
        limit: int = 50,
        wiki: str | None = None,
    ) -> ViewerFile:
        return context.codealmanac.viewer.file(
            ViewerFileRequest(
                cwd=context.cwd,
                wiki=context.selected_wiki(wiki),
                path=path,
                limit=limit,
            )
        )

    @server.get("/api/topic/{slug}", response_model=ViewerTopic)
    def topic(
        slug: str,
        descendants: bool = False,
        wiki: str | None = None,
    ) -> ViewerTopic:
        return context.codealmanac.viewer.topic(
            ViewerTopicRequest(
                cwd=context.cwd,
                wiki=context.selected_wiki(wiki),
                slug=slug,
                include_descendants=descendants,
            )
        )

    @server.get("/api/jobs", response_model=ViewerJobs)
    def jobs(limit: int | None = None, wiki: str | None = None) -> ViewerJobs:
        return context.codealmanac.viewer.jobs(
            ViewerJobsRequest(
                cwd=context.cwd,
                wiki=context.selected_wiki(wiki),
                limit=limit,
            )
        )

    @server.get("/api/jobs/{run_id}", response_model=ViewerJob)
    def job(run_id: str, wiki: str | None = None) -> ViewerJob:
        return context.codealmanac.viewer.job(
            ViewerJobRequest(
                cwd=context.cwd,
                wiki=context.selected_wiki(wiki),
                run_id=run_id,
            )
        )
