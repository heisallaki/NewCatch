from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    database_url: str
    jwt_secret: str
    otp_pepper: str
    email_hash_pepper: str
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    otp_ttl_minutes: int = 10
    otp_max_attempts: int = 5
    otp_max_per_hour: int = 5
    otp_resend_seconds: int = 60
    appeal_cooldown_days: int = 7
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    cors_origins: str = "http://localhost:8081"
    email_backend: str = "console"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    support_email: str = "kal.projects.dev@gmail.com"
    policy_version: str = "2026-09-29"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()