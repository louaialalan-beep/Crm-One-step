from __future__ import annotations

import json
import logging
import secrets
from typing import List, Optional

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("crm_one_step.config")


class Settings(BaseSettings):
    # 1. Application & Routing Defaults (Non-sensitive)
    VITE_API_URL: str = ""
    APP_NAME: str = "Crm-One-step"
    APP_VERSION: str = "4.0.0"
    APP_ENV: str = "development"
    API_V1_STR: str = "/api/v1"

    # 2. PostgreSQL & Redis Defaults
    POSTGRES_USER: str = "crm_user"
    POSTGRES_PASSWORD: str = "changeme_local_dev_pass"
    POSTGRES_DB: str = "crm_one_step"
    DATABASE_URL: str = (
        "postgresql+asyncpg://crm_user:changeme_local_dev_pass@db:5432/crm_one_step"
    )
    REDIS_URL: str = "redis://redis:6379/0"

    # 3. JWT & Security (Auto-generates temporary random secret if not provided)
    JWT_SECRET: Optional[str] = None
    JWT_SECRET_KEY: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    META_ENCRYPTION_KEY: Optional[str] = None

    CORS_ORIGINS: List[str] = [
        "http://localhost",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ]

    # 4. ZATCA Phase 1 Defaults (المرحلة الأولى - الفوترة الإلكترونية السعودية)
    ZATCA_DEFAULT_SELLER_NAME: str = "Crm-One-step Demo"
    ZATCA_DEFAULT_VAT_NUMBER: str = "300000000000003"
    ZATCA_VAT_RATE: float = 0.15

    # 5. Meta Conversions API (CAPI) & WhatsApp Cloud API (Optional External Keys)
    META_GRAPH_API_VERSION: str = "v21.0"
    META_PIXEL_ID: Optional[str] = None
    META_CAPI_ACCESS_TOKEN: Optional[str] = None
    META_WEBHOOK_VERIFY_TOKEN: Optional[str] = None
    META_APP_SECRET: Optional[str] = None
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    WHATSAPP_ACCESS_TOKEN: Optional[str] = None

    # 6. Transactional Email (SMTP - Optional External Keys)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_FROM_NAME: Optional[str] = None
    SMTP_USE_TLS: bool = True

    # 7. Unified Payment Gateway (Moyasar / Tap / Stripe - Optional External Keys)
    PAYMENT_PROVIDER: str = "moyasar"
    PAYMENT_MOYASAR_SECRET_KEY: Optional[str] = None
    PAYMENT_TAP_SECRET_KEY: Optional[str] = None
    PAYMENT_STRIPE_SECRET_KEY: Optional[str] = None
    PAYMENT_WEBHOOK_SECRET: Optional[str] = None
    PAYMENT_SUCCESS_URL: str = "http://localhost/settings/subscription?status=success"
    PAYMENT_CANCEL_URL: str = "http://localhost/settings/subscription?status=cancel"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @model_validator(mode="after")
    def ensure_jwt_secrets(self) -> "Settings":
        provided_secret = (self.JWT_SECRET or self.JWT_SECRET_KEY or "").strip()
        if not provided_secret:
            generated = secrets.token_urlsafe(32)
            self.JWT_SECRET = generated
            self.JWT_SECRET_KEY = generated
            if self.APP_ENV.lower() == "production":
                logger.warning(
                    "WARNING [PRODUCTION]: JWT_SECRET / JWT_SECRET_KEY was not provided in environment variables. "
                    "Generated a temporary random secret for this process. Set JWT_SECRET in .env for persistent sessions."
                )
        else:
            self.JWT_SECRET = provided_secret
            self.JWT_SECRET_KEY = provided_secret

        if not self.META_ENCRYPTION_KEY:
            self.META_ENCRYPTION_KEY = secrets.token_urlsafe(32)
        return self

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str):
            v_strip = v.strip()
            if v_strip.startswith("["):
                return json.loads(v_strip)
            return [item.strip() for item in v_strip.split(",") if item.strip()]
        return v


settings = Settings()
