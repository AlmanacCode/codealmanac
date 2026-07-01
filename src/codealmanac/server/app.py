from enum import StrEnum
from importlib import resources
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator

from codealmanac.app import CodeAlmanac
from codealmanac.core.errors import CodeAlmanacError, ConflictError, NotFoundError
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


class ServerAssetSuffix(StrEnum):
    HTML = ".html"
    CSS = ".css"
    JAVASCRIPT = ".js"


ASSET_MEDIA_TYPES: dict[ServerAssetSuffix, str] = {
    ServerAssetSuffix.HTML: "text/html",
    ServerAssetSuffix.CSS: "text/css",
    ServerAssetSuffix.JAVASCRIPT: "text/javascript",
}


class ServerAssetRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    path: str

    @field_validator("path")
    @classmethod
    def validate_path(cls, value: str) -> str:
        if value != value.strip():
            raise ValueError("asset path must not contain surrounding whitespace")
        if not value:
            raise ValueError("asset path is required")
        if value.startswith("/") or "\\" in value:
            raise ValueError("asset path must be relative")
        parts = value.split("/")
        if any(part in {"", ".", ".."} for part in parts):
            raise ValueError("asset path contains an invalid segment")
        suffix = Path(value).suffix
        if suffix not in {item.value for item in ServerAssetSuffix}:
            raise ValueError("asset path has an unsupported extension")
        return value

    @property
    def media_type(self) -> str:
        return ASSET_MEDIA_TYPES[ServerAssetSuffix(Path(self.path).suffix)]

    @property
    def parts(self) -> list[str]:
        return self.path.split("/")


def create_server_app(
    codealmanac: CodeAlmanac,
    cwd: Path,
    wiki: str | None = None,
) -> FastAPI:
    server = FastAPI(title="CodeAlmanac Local Viewer")
    scope_wiki = wiki

    @server.get("/api/overview", response_model=ViewerOverview)
    def overview(wiki: str | None = None) -> ViewerOverview:
        try:
            return codealmanac.viewer.overview(
                ViewerOverviewRequest(
                    cwd=cwd,
                    wiki=selected_wiki(scope_wiki, wiki),
                    include_workspaces=scope_wiki is None,
                )
            )
        except ValidationError as error:
            raise validation_error(error) from error
        except CodeAlmanacError as error:
            raise http_error(error) from error

    @server.get("/api/page/{slug}", response_model=ViewerPage)
    def page(slug: str, wiki: str | None = None) -> ViewerPage:
        try:
            return codealmanac.viewer.page(
                ViewerPageRequest(
                    cwd=cwd,
                    wiki=selected_wiki(scope_wiki, wiki),
                    slug=slug,
                )
            )
        except ValidationError as error:
            raise validation_error(error) from error
        except CodeAlmanacError as error:
            raise http_error(error) from error

    @server.get("/api/search", response_model=ViewerSearch)
    def search(
        q: str | None = None,
        limit: int = 50,
        wiki: str | None = None,
    ) -> ViewerSearch:
        try:
            return codealmanac.viewer.search(
                ViewerSearchRequest(
                    cwd=cwd,
                    wiki=selected_wiki(scope_wiki, wiki),
                    query=q,
                    limit=limit,
                )
            )
        except ValidationError as error:
            raise validation_error(error) from error
        except CodeAlmanacError as error:
            raise http_error(error) from error

    @server.get("/api/file", response_model=ViewerFile)
    def file(
        path: str,
        limit: int = 50,
        wiki: str | None = None,
    ) -> ViewerFile:
        try:
            return codealmanac.viewer.file(
                ViewerFileRequest(
                    cwd=cwd,
                    wiki=selected_wiki(scope_wiki, wiki),
                    path=path,
                    limit=limit,
                )
            )
        except ValidationError as error:
            raise validation_error(error) from error
        except CodeAlmanacError as error:
            raise http_error(error) from error

    @server.get("/api/topic/{slug}", response_model=ViewerTopic)
    def topic(
        slug: str,
        descendants: bool = False,
        wiki: str | None = None,
    ) -> ViewerTopic:
        try:
            return codealmanac.viewer.topic(
                ViewerTopicRequest(
                    cwd=cwd,
                    wiki=selected_wiki(scope_wiki, wiki),
                    slug=slug,
                    include_descendants=descendants,
                )
            )
        except ValidationError as error:
            raise validation_error(error) from error
        except CodeAlmanacError as error:
            raise http_error(error) from error

    @server.get("/api/jobs", response_model=ViewerJobs)
    def jobs(limit: int | None = None, wiki: str | None = None) -> ViewerJobs:
        try:
            return codealmanac.viewer.jobs(
                ViewerJobsRequest(
                    cwd=cwd,
                    wiki=selected_wiki(scope_wiki, wiki),
                    limit=limit,
                )
            )
        except ValidationError as error:
            raise validation_error(error) from error
        except CodeAlmanacError as error:
            raise http_error(error) from error

    @server.get("/api/jobs/{run_id}", response_model=ViewerJob)
    def job(run_id: str, wiki: str | None = None) -> ViewerJob:
        try:
            return codealmanac.viewer.job(
                ViewerJobRequest(
                    cwd=cwd,
                    wiki=selected_wiki(scope_wiki, wiki),
                    run_id=run_id,
                )
            )
        except ValidationError as error:
            raise validation_error(error) from error
        except CodeAlmanacError as error:
            raise http_error(error) from error

    @server.get("/", include_in_schema=False)
    def index() -> HTMLResponse:
        return HTMLResponse(read_asset_text(ServerAssetRequest(path="index.html")))

    @server.get("/app.js", include_in_schema=False)
    def app_js() -> Response:
        return asset_response("app.js")

    @server.get("/app.css", include_in_schema=False)
    def app_css() -> Response:
        return asset_response("app.css")

    @server.get("/assets/{asset_path:path}", include_in_schema=False)
    def static_asset(asset_path: str) -> Response:
        return asset_response(asset_path)

    @server.get("/{path:path}", include_in_schema=False)
    def fallback(path: str) -> HTMLResponse:
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="not found")
        return HTMLResponse(read_asset_text(ServerAssetRequest(path="index.html")))

    return server


def selected_wiki(scope_wiki: str | None, request_wiki: str | None) -> str | None:
    return scope_wiki or request_wiki


def asset_response(asset_path: str) -> Response:
    try:
        request = ServerAssetRequest(path=asset_path)
        return Response(
            read_asset_text(request),
            media_type=request.media_type,
        )
    except ValidationError as error:
        raise validation_error(error) from error
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": f"asset not found: {asset_path}"},
        ) from error


def read_asset_text(request: ServerAssetRequest) -> str:
    asset = resources.files("codealmanac.server.assets").joinpath(*request.parts)
    if not asset.is_file():
        raise FileNotFoundError(request.path)
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
