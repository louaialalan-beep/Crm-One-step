from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    auth,
    automation,
    billing,
    email,
    entities,
    financials,
    import_export,
    leads,
    super_admin,
    whatsapp,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(leads.router)
api_router.include_router(entities.router)
api_router.include_router(financials.router)
api_router.include_router(whatsapp.router)
api_router.include_router(email.router)
api_router.include_router(automation.router)
api_router.include_router(import_export.router)
api_router.include_router(billing.router)
api_router.include_router(super_admin.router)

