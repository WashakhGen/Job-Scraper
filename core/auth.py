import base64
import binascii
import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from core.settings import SETTINGS

_UNAUTHORIZED = Response(
    status_code=401,
    headers={"WWW-Authenticate": 'Basic realm="Job Scraper"'},
)


class BasicAuthMiddleware(BaseHTTPMiddleware):
    """Gates every route — API and the served frontend alike — behind a
    single shared HTTP Basic Auth credential.

    A no-op when APP_PASSWORD is unset, so existing deployments aren't
    suddenly locked out by upgrading. /health stays open for uptime checks —
    it returns no data worth protecting.
    """

    async def dispatch(self, request: Request, call_next):
        if not SETTINGS.APP_PASSWORD or request.url.path == "/health":
            return await call_next(request)

        if _is_authorized(request.headers.get("authorization")):
            return await call_next(request)

        return _UNAUTHORIZED


def _is_authorized(header: str | None) -> bool:
    if not header or not header.startswith("Basic "):
        return False

    try:
        decoded = base64.b64decode(header.removeprefix("Basic ")).decode("utf-8")
    except (binascii.Error, UnicodeDecodeError):
        return False

    username, _, password = decoded.partition(":")

    # compare_digest is timing-safe; a plain == leaks how many leading
    # characters matched via response-time differences
    return secrets.compare_digest(username, SETTINGS.APP_USERNAME) and secrets.compare_digest(
        password, SETTINGS.APP_PASSWORD
    )
