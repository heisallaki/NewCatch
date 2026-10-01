import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
ENV_FILE = Path(os.environ.get("NEWCATCH_ENV_FILE") or DEFAULT_ENV_FILE)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    database_url: str
    database_url_direct: str = ""
    jwt_secret: str
    otp_pepper: str
    email_hash_pepper: str
    proxy_shared_secret: str = ""
    trusted_proxy_count: int = 0
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    otp_ttl_minutes: int = 10
    otp_max_attempts: int = 5
    otp_max_per_hour: int = 5
    otp_resend_seconds: int = 60
    appeal_cooldown_days: int = 7
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    refresh_cookie_path: str = "/auth"
    cors_origins: str = "http://localhost:8081"
    email_backend: str = "console"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    support_email: str = "kal.projects.dev@gmail.com"
    policy_version: str = "2026-09-29"
    storage_backend: str = "local"
    upload_dir: str = "uploads"
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_bucket: str = "newcatch-media"
    supabase_keepalive: bool = True
    max_photos: int = 6
    max_upload_bytes: int = 9_000_000
    media_token_minutes: int = 60
    push_enabled: bool = True
    expo_push_url: str = "https://exp.host/--/api/v2/push/send"
    expo_access_token: str = ""

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def max_body_bytes(self) -> int:
        return self.max_upload_bytes * 4 // 3 + 65536

    @property
    def migration_database_url(self) -> str:
        return self.database_url_direct or self.database_url


settings = Settings()