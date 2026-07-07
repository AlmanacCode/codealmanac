from pathlib import Path

from fastapi import FastAPI

from codealmanac.app import CodeAlmanac
from codealmanac.server.api_routes import ServerApiContext, register_api_routes
from codealmanac.server.errors import register_error_handlers
from codealmanac.server.static_routes import register_static_routes


def create_server_app(
    codealmanac: CodeAlmanac,
    cwd: Path,
    wiki: str | None = None,
) -> FastAPI:
    server = FastAPI(title="CodeAlmanac Local Viewer")
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
