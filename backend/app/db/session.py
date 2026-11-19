from __future__ import annotations

from typing import AsyncGenerator

from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings
from app.core.security import TokenPayload, get_current_token_payload

engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_unscoped_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Unscoped database session used exclusively for public endpoints
    such as `/auth/login`, `/auth/register`, and `/organizations` auto-provisioning.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_db(
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> AsyncGenerator[AsyncSession, None]:
    """
    Tenant-isolated AsyncSession dependency with PostgreSQL Row-Level Security (RLS).
    Automatically executes:
        SET LOCAL app.current_org_id = :org_id
    inside the transaction after verifying the JWT Token so PostgreSQL enforces
    `tenant_isolation` policies on every query, insert, update, and delete.
    """
    async with AsyncSessionLocal() as session:
        try:
            await session.execute(
                text("SET LOCAL app.current_org_id = :org_id"),
                {"org_id": str(token_payload.org_id)},
            )
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
