from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Dict

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.api.v1.whatsapp import whatsapp_live_websocket
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """
    FastAPI Lifespan manager:
    Initializes non-blocking ARQ Redis pool if Redis is reachable so API endpoints
    can enqueue background jobs (`send_meta_capi_event_task`, `execute_workflow_rule_task`,
    `process_large_csv_import_task`) without blocking HTTP cycles.
    """
    app.state.arq_pool = None
    try:
        app.state.arq_pool = await create_pool(
            RedisSettings.from_dsn(settings.REDIS_URL)
        )
    except Exception:
        app.state.arq_pool = None

    yield

    if app.state.arq_pool is not None:
        await app.state.arq_pool.close()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "منصة Crm-One-step السحابية — واجهة برمجية مبنية بـ FastAPI + SQLAlchemy 2.0 Async + "
        "PostgreSQL Row-Level Security (RLS) + WhatsApp Cloud API & WebSockets + Meta CAPI + "
        "Blueprint & Workflow Engine + ZATCA Phase 1 TLV QR + ARQ Redis Worker."
    ),
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.websocket("/ws/whatsapp/{org_id}")
async def root_whatsapp_websocket(websocket: WebSocket, org_id: str) -> None:
    """
    Root WebSocket mount (`/ws/whatsapp/{org_id}`) for real-time WhatsApp message streaming
    to `WhatsappInboxPage.tsx`.
    """
    await whatsapp_live_websocket(websocket=websocket, org_id=org_id)


@app.get("/health", tags=["System Health"])
async def health_check() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "rls_enforced": True,
        "whatsapp_websocket": "/ws/whatsapp/{org_id}",
        "meta_capi_worker": "arq_redis",
        "zatca_phase": "Phase_1_TLV_Base64_15_Percent_VAT",
        "arq_redis_connected": app.state.arq_pool is not None,
    }
