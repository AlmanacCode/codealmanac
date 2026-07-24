from pathlib import Path

from fastapi import FastAPI

from codealmanac.app import CodeAlmanac
from codealmanac.server.api_routes import ServerApiContext, register_api_routes
from codealmanac.server.errors import register_error_handlers
from codealmanac.server.security import DEFAULT_BIND_HOST, register_security
from codealmanac.server.static_routes import register_static_routes


def create_server_app(
    codealmanac: CodeAlmanac,
    cwd: Path,
    wiki: str | None = None,
    host: str = DEFAULT_BIND_HOST,
) -> FastAPI:
    # The viewer serves local wiki content without authentication; the
    # generated docs and schema endpoints add reachable surface nobody reads.
    server = FastAPI(
        title="CodeAlmanac Local Viewer",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    register_security(server, host)
    register_error_handlers(server)
    register_api_routes(
        server,
        ServerApiContext(
            codealmanac=codealmanac,
            cwd=cwd,
            scoped_repository_name=wiki,
        ),
    )
    register_static_routes(server)

    return server
