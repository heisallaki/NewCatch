import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app.admin.router import router as admin_router
from app.appeals.router import router as appeals_router
from app.auth.router import router as auth_router
from app.chat.router import router as chat_router
from app.config import settings
from app.deps import client_ip
from app.discovery.router import router as discovery_router
from app.errors import ApiError
from app.media.router import router as media_router
from app.notifications.router import router as push_router
from app.profiles.router import router as profiles_router
from app.reports.router import router as reports_router
from app.safety.router import router as safety_router
from app.storage import storage
from app.users.router import router as users_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("newcatch")

KEEPALIVE_SECONDS = 24 * 3600


def validate_production_settings() -> None:
    problems = []
    if settings.email_backend != "smtp":
        problems.append("EMAIL_BACKEND must be smtp")
    if not (settings.smtp_username and settings.smtp_password):
        problems.append("SMTP_USERNAME and SMTP_PASSWORD are required")
    if not settings.cookie_secure:
        problems.append("COOKIE_SECURE must be true")
    if settings.cookie_samesite.lower() not in ("lax", "strict"):
        problems.append("COOKIE_SAMESITE must be lax or strict")
    for name in ("jwt_secret", "otp_pepper", "email_hash_pepper"):
        if len(getattr(settings, name)) < 32:
            problems.append(f"{name.upper()} must be at least 32 characters")
    if settings.storage_backend != "supabase":
        problems.append("STORAGE_BACKEND must be supabase")
    if "localhost" in settings.database_url or "127.0.0.1" in settings.database_url:
        problems.append("DATABASE_URL must not point at localhost")
    if "sslmode" not in settings.database_url:
        problems.append("DATABASE_URL must include sslmode=require")
    origins = settings.cors_origin_list
    if not origins or any(not origin.startswith("https://") for origin in origins):
        problems.append("CORS_ORIGINS must list only https origins")
    if settings.proxy_shared_secret and len(settings.proxy_shared_secret) < 32:
        problems.append("PROXY_SHARED_SECRET must be at least 32 characters")
    if settings.trusted_proxy_count < 1 and not settings.proxy_shared_secret:
        problems.append("Set TRUSTED_PROXY_COUNT or PROXY_SHARED_SECRET so rate limits see real client IPs")
    if problems:
        raise RuntimeError("Unsafe production configuration: " + "; ".join(problems))


if settings.is_production:
    validate_production_settings()


async def storage_keepalive() -> None:
    while True:
        try:
            await run_in_threadpool(storage.keepalive)
        except Exception:
            logger.warning("Storage keepalive failed")
        await asyncio.sleep(KEEPALIVE_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = None
    if settings.storage_backend == "supabase" and settings.supabase_keepalive:
        task = asyncio.create_task(storage_keepalive())
    yield
    if task is not None:
        task.cancel()


app = FastAPI(
    title="New Catch API",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > settings.max_body_bytes:
        return JSONResponse(
            status_code=413,
            content={"detail": "That upload is too large.", "code": "file_too_large"},
        )
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    response.headers.setdefault("Cache-Control", "no-store")
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-Client-Type"],
)


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail, "code": exc.code})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": "Please check the details you entered.", "code": "validation_error"},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong. Please try again.", "code": "server_error"},
    )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/client-ip")
def whoami(request: Request):
    return {"ip": client_ip(request)}


app.include_router(auth_router)
app.include_router(appeals_router)
app.include_router(users_router)
app.include_router(profiles_router)
app.include_router(media_router)
app.include_router(discovery_router)
app.include_router(safety_router)
app.include_router(reports_router)
app.include_router(chat_router)
app.include_router(push_router)
app.include_router(admin_router)