from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.admin.router import router as admin_router
from app.appeals.router import router as appeals_router
from app.auth.router import router as auth_router
from app.chat.router import router as chat_router
from app.config import settings
from app.discovery.router import router as discovery_router
from app.errors import ApiError
from app.media.router import router as media_router
from app.notifications.router import router as push_router
from app.profiles.router import router as profiles_router
from app.reports.router import router as reports_router
from app.safety.router import router as safety_router
from app.users.router import router as users_router


def validate_production_settings() -> None:
    problems = []
    if settings.email_backend != "smtp":
        problems.append("EMAIL_BACKEND must be smtp")
    if not settings.cookie_secure:
        problems.append("COOKIE_SECURE must be true")
    for name in ("jwt_secret", "otp_pepper", "email_hash_pepper"):
        if len(getattr(settings, name)) < 32:
            problems.append(f"{name.upper()} must be at least 32 characters")
    if problems:
        raise RuntimeError("Unsafe production configuration: " + "; ".join(problems))


if settings.is_production:
    validate_production_settings()

app = FastAPI(
    title="New Catch API",
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
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    response.headers.setdefault("Cache-Control", "no-store")
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


@app.get("/health")
def health():
    return {"status": "ok"}


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