from importlib import resources
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, Response
from pydantic import ValidationError

from codealmanac.app import CodeAlmanac
from codealmanac.core.errors import CodeAlmanacError, ConflictError, NotFoundError
from codealmanac.services.viewer.models import (
    ViewerFile,
    ViewerOverview,
    ViewerPage,
    ViewerSearch,
    ViewerTopic,
)
from codealmanac.services.viewer.requests import (
    ViewerFileRequest,
    ViewerOverviewRequest,
    ViewerPageRequest,
    ViewerSearchRequest,
    ViewerTopicRequest,
)


def create_server_app(
    codealmanac: CodeAlmanac,
    cwd: Path,
    wiki: str | None = None,
) -> FastAPI:
    server = FastAPI(title="CodeAlmanac Local Viewer")

    @server.get("/api/overview", response_model=ViewerOverview)
    def overview() -> ViewerOverview:
        try:
            return codealmanac.viewer.overview(
                ViewerOverviewRequest(cwd=cwd, wiki=wiki)
            )
        except ValidationError as error:
            raise validation_error(error) from error
        except CodeAlmanacError as error:
            raise http_error(error) from error

    @server.get("/api/page/{slug}", response_model=ViewerPage)
    def page(slug: str) -> ViewerPage:
        try:
            return codealmanac.viewer.page(
                ViewerPageRequest(cwd=cwd, wiki=wiki, slug=slug)
            )
        except ValidationError as error:
            raise validation_error(error) from error
        except CodeAlmanacError as error:
            raise http_error(error) from error

    @server.get("/api/search", response_model=ViewerSearch)
    def search(q: str | None = None, limit: int = 50) -> ViewerSearch:
        try:
            return codealmanac.viewer.search(
                ViewerSearchRequest(cwd=cwd, wiki=wiki, query=q, limit=limit)
            )
        except ValidationError as error:
            raise validation_error(error) from error
        except CodeAlmanacError as error:
            raise http_error(error) from error

    @server.get("/api/file", response_model=ViewerFile)
    def file(path: str, limit: int = 50) -> ViewerFile:
        try:
            return codealmanac.viewer.file(
                ViewerFileRequest(cwd=cwd, wiki=wiki, path=path, limit=limit)
            )
        except ValidationError as error:
            raise validation_error(error) from error
        except CodeAlmanacError as error:
            raise http_error(error) from error

    @server.get("/api/topic/{slug}", response_model=ViewerTopic)
    def topic(slug: str, descendants: bool = False) -> ViewerTopic:
        try:
            return codealmanac.viewer.topic(
                ViewerTopicRequest(
                    cwd=cwd,
                    wiki=wiki,
                    slug=slug,
                    include_descendants=descendants,
                )
            )
        except ValidationError as error:
            raise validation_error(error) from error
        except CodeAlmanacError as error:
            raise http_error(error) from error

    @server.get("/", include_in_schema=False)
    def index() -> HTMLResponse:
        return HTMLResponse(read_asset("index.html"))

    @server.get("/app.js", include_in_schema=False)
    def app_js() -> Response:
        return Response(read_asset("app.js"), media_type="text/javascript")

    @server.get("/app.css", include_in_schema=False)
    def app_css() -> Response:
        return Response(read_asset("app.css"), media_type="text/css")

    @server.get("/{path:path}", include_in_schema=False)
    def fallback(path: str) -> HTMLResponse:
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="not found")
        return HTMLResponse(read_asset("index.html"))

    return server


def read_asset(name: str) -> str:
    asset = resources.files("codealmanac.server.assets").joinpath(name)
    return asset.read_text(encoding="utf-8")


def http_error(error: CodeAlmanacError) -> HTTPException:
    status_code = 400
    if isinstance(error, NotFoundError):
        status_code = 404
    elif isinstance(error, ConflictError):
        status_code = 409
    return HTTPException(
        status_code=status_code,
        detail={"code": error.code, "message": str(error)},
    )


def validation_error(error: ValidationError) -> HTTPException:
    return HTTPException(
        status_code=422,
        detail={"code": "validation_failed", "message": str(error)},
    )
