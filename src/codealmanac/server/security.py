from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.responses import Response
from starlette.middleware.trustedhost import TrustedHostMiddleware

LOOPBACK_HOSTS = ("localhost", "127.0.0.1", "::1")
DEFAULT_BIND_HOST = "127.0.0.1"

CONTENT_SECURITY_POLICY = "; ".join(
    (
        "default-src 'self'",
        "img-src 'self' data: https:",
        "style-src 'self'",
        "script-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
    )
)

SECURITY_HEADERS = {
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
}


def register_security(server: FastAPI, host: str) -> None:
    """Harden the local viewer against browser-driven access from other sites.

    The viewer has no authentication because it only serves the wiki of the
    repo it was started in. That makes the browser the attack surface: a page
    the user visits can point a hostname it controls at 127.0.0.1 and read the
    API through the user's own browser. Restricting the accepted Host header to
    loopback names removes that rebinding path, and the response headers stop
    wiki markdown from pulling in or leaking to third-party origins.
    """
    if is_loopback(host):
        server.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=[*LOOPBACK_HOSTS, "[::1]"],
        )

    @server.middleware("http")
    async def apply_security_headers(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        response = await call_next(request)
        for header, value in SECURITY_HEADERS.items():
            response.headers.setdefault(header, value)
        return response


def is_loopback(host: str) -> bool:
    return host.strip().strip("[]").lower() in LOOPBACK_HOSTS
