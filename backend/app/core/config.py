from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "OwnerMate API"
    app_version: str = "0.1.0"
    app_env: Literal["local", "development", "staging", "production", "test"] = (
        "development"
    )
    debug: bool = False
    log_level: Literal["critical", "error", "warning", "info", "debug"] = "info"

    api_v1_prefix: str = ""
    docs_url: str | None = "/docs"
    redoc_url: str | None = "/redoc"
    openapi_url: str | None = "/openapi.json"
    uvicorn_host: str = "0.0.0.0"
    uvicorn_port: int = 8000

    database_url: str | None = None
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    sentiment_provider: Literal["mock"] = "mock"
    content_provider: Literal["mock"] = "mock"
    google_review_provider: Literal["mock"] = "mock"
    facebook_review_provider: Literal["mock"] = "mock"
    review_intelligence_provider: Literal["mock"] = "mock"
    supabase_service_role_key: str | None = Field(
        default=None, alias="SUPABASE_SERVICE_ROLE_KEY"
    )

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value: object) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "prod", "production"}:
                return False
        return bool(value)


@lru_cache
def get_settings() -> Settings:
    return Settings()
