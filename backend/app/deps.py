import hmac

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.auth.service import ACCESS_COOKIE
from app.config import settings
from app.constants import CSRF_HEADER_VALUE, STATUS_ACTIVE, STATUS_BLACKLISTED, STATUS_DEACTIVATED
from app.database import get_db
from app.errors import ApiError
from app.models import User
from app.security import decode_jwt, limiter

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def client_ip(request: Request) -> str:
    secret = settings.proxy_shared_secret
    if secret:
        supplied = request.headers.get("x-proxy-secret", "")
        if hmac.compare_digest(supplied.encode(), secret.encode()):
            forwarded = request.headers.get("x-client-ip", "").strip()
            if forwarded:
                return forwarded
    count = settings.trusted_proxy_count
    if count > 0:
        parts = [part.strip() for part in request.headers.get("x-forwarded-for", "").split(",") if part.strip()]
        if len(parts) >= count:
            return parts[-count]
    return request.client.host if request.client else "unknown"


def enforce_csrf(request: Request) -> None:
    if request.method in SAFE_METHODS:
        return
    if request.headers.get("x-requested-with") != CSRF_HEADER_VALUE:
        raise ApiError(403, "csrf_blocked", "Request blocked.")


def rate_limit(name: str, limit: int, window_seconds: int):
    def dependency(request: Request) -> None:
        if not limiter.check(f"{name}:{client_ip(request)}", limit, window_seconds):
            raise ApiError(429, "rate_limited", "Too many requests. Please wait a moment and try again.")

    return dependency


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = None
    from_cookie = False
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    else:
        token = request.cookies.get(ACCESS_COOKIE)
        from_cookie = token is not None
    if not token:
        raise ApiError(401, "unauthorized", "Please sign in to continue.")
    if from_cookie:
        enforce_csrf(request)
    payload = decode_jwt(token, "access")
    if payload is None:
        raise ApiError(401, "unauthorized", "Your session has expired. Please sign in again.")
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise ApiError(401, "unauthorized", "Please sign in to continue.")
    if user.status == STATUS_BLACKLISTED:
        raise ApiError(
            403,
            "email_blacklisted",
            f"This account has been blacklisted. To appeal, contact {settings.support_email}.",
        )
    return user


def get_active_user(user: User = Depends(get_current_user)) -> User:
    if user.status == STATUS_DEACTIVATED:
        raise ApiError(
            403,
            "account_deactivated",
            "Your account has been deactivated by an administrator. You can submit an appeal.",
        )
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.status != STATUS_ACTIVE or not user.is_admin:
        raise ApiError(404, "not_found", "Not Found")
    return user