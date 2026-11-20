from __future__ import annotations

import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest

# Ensure `backend/` is on sys.path so `import app...` resolves cleanly
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.permissions import PermissionContext
from app.core.security import TokenPayload


class InMemoryRlsSession:
    """
    In-memory AsyncSession test double that enforces PostgreSQL Row-Level Security (RLS)
    semantics (`app.current_org_id`) across all tenant-scoped SQLAlchemy models.
    """

    def __init__(self, active_org_id: uuid.UUID) -> None:
        self.active_org_id = active_org_id
        self.rls_guc_org_id: str = str(active_org_id)
        self.storage: List[Any] = []
        self.executed_sql: List[str] = []
        self.flushed_count: int = 0

    def set_tenant_context(self, org_id: uuid.UUID) -> None:
        self.active_org_id = org_id
        self.rls_guc_org_id = str(org_id)
        self.executed_sql.append(f"SET LOCAL app.current_org_id = '{org_id}'")

    def add(self, instance: Any) -> None:
        if getattr(instance, "id", None) is None:
            setattr(instance, "id", uuid.uuid4())
        now = datetime.now(timezone.utc)
        if hasattr(instance, "created_at") and getattr(instance, "created_at", None) is None:
            setattr(instance, "created_at", now)
        if hasattr(instance, "updated_at") and getattr(instance, "updated_at", None) is None:
            setattr(instance, "updated_at", now)
        if hasattr(instance, "org_id"):
            row_org = getattr(instance, "org_id", None)
            if row_org is None:
                setattr(instance, "org_id", self.active_org_id)
            elif str(row_org) != self.rls_guc_org_id:
                raise PermissionError(
                    f"PostgreSQL RLS WITH CHECK violation: cannot insert org_id={row_org} "
                    f"when app.current_org_id={self.rls_guc_org_id}"
                )
        self.storage.append(instance)

    async def flush(self) -> None:
        self.flushed_count += 1

    def query_visible(self, model_cls: type) -> List[Any]:
        """Returns only rows matching `model_cls` and `org_id == app.current_org_id` (RLS policy)."""
        return [
            row
            for row in self.storage
            if isinstance(row, model_cls)
            and str(getattr(row, "org_id", "")) == self.rls_guc_org_id
            and getattr(row, "deleted_at", None) is None
        ]


@pytest.fixture
def tenant_a_org_id() -> uuid.UUID:
    return uuid.UUID("11111111-1111-4111-8111-111111111111")


@pytest.fixture
def tenant_b_org_id() -> uuid.UUID:
    return uuid.UUID("22222222-2222-4222-8222-222222222222")


@pytest.fixture
def tenant_a_token(tenant_a_org_id: uuid.UUID) -> TokenPayload:
    return TokenPayload(
        sub="user_salman_a",
        org_id=tenant_a_org_id,
        role="system_admin",
        exp=9999999999,
    )


@pytest.fixture
def tenant_b_token(tenant_b_org_id: uuid.UUID) -> TokenPayload:
    return TokenPayload(
        sub="user_khalid_b",
        org_id=tenant_b_org_id,
        role="sales_rep",
        exp=9999999999,
    )


@pytest.fixture
def sales_rep_perm_context(tenant_a_org_id: uuid.UUID) -> PermissionContext:
    return PermissionContext(
        user_id="rep_01",
        user_name="فهد الدوسري",
        org_id=tenant_a_org_id,
        is_super_admin=False,
        profile_code="sales_rep",
        role_code="sales_rep",
        data_sharing_scope="private",
        hide_subordinates_data=True,
        allowed_owner_identifiers={"rep_01", "فهد الدوسري"},
        module_permissions={
            "leads": {"read": True, "create": True, "update": True, "delete": False},
            "deals": {"read": True, "create": True, "update": True, "delete": False},
        },
        field_permissions={
            "leads": {
                "estimatedValue": "read_only",
                "phone": "hidden",
                "internalCost": "hidden",
            },
            "deals": {
                "amount": "read_only",
                "secretMargin": "hidden",
            },
        },
    )
