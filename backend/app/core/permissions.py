from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Dict, List, Optional, Sequence, Set, TypeVar

from fastapi import Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenPayload, get_current_token_payload
from app.db.models import Profile, Role, User
from app.db.session import get_db

T = TypeVar("T")

# Maps frontend FLS field keys to backend SQLAlchemy/Pydantic attribute names
FRONTEND_TO_BACKEND_FIELD_ALIASES: Dict[str, List[str]] = {
    "amount": ["amount", "estimated_value", "total_amount", "subtotal_amount"],
    "estimatedValue": ["estimated_value"],
    "annualRevenue": ["annual_revenue"],
    "phone": ["phone", "phone_number"],
    "email": ["email"],
    "probability": ["probability"],
    "closeDate": ["expected_close_date"],
    "expected_close_date": ["expected_close_date"],
    "ownerName": ["owner_id"],
    "assignedToName": ["owner_id"],
    "source": ["source", "utm_source"],
    "notes": ["lost_reason", "description", "notes"],
    "vatNumber": ["vat_number", "customer_vat_number"],
    "crNumber": ["cr_number"],
}


@dataclass
class PermissionContext:
    """
    Server-Side Permission Context combining:
      1. Profile Module Permissions (`read`, `create`, `update`, `delete`)
      2. Profile Field-Level Security (FLS: `read_write`, `read_only`, `hidden`)
      3. Role Hierarchy & Data Sharing Scope (`organization`, `team_and_subordinates`, `team`, `private`)
    """

    user_id: str
    user_name: Optional[str]
    org_id: uuid.UUID
    is_super_admin: bool = False
    profile_code: str = "system_admin"
    role_code: str = "ceo"
    data_sharing_scope: str = "organization"  # organization | team_and_subordinates | team | private
    hide_subordinates_data: bool = False
    allowed_owner_identifiers: Set[str] = field(default_factory=set)
    module_permissions: Dict[str, Dict[str, bool]] = field(default_factory=dict)
    field_permissions: Dict[str, Dict[str, str]] = field(default_factory=dict)


def _collect_subordinate_role_ids(
    root_role_id: uuid.UUID,
    all_roles: Sequence[Role],
) -> Set[uuid.UUID]:
    """Traverses the organization's role hierarchy tree to find all subordinate role IDs."""
    children_by_parent: Dict[uuid.UUID, List[uuid.UUID]] = {}
    for role in all_roles:
        if role.parent_role_id is not None:
            children_by_parent.setdefault(role.parent_role_id, []).append(role.id)

    subordinate_ids: Set[uuid.UUID] = set()
    stack: List[uuid.UUID] = list(children_by_parent.get(root_role_id, []))
    while stack:
        current = stack.pop()
        if current not in subordinate_ids:
            subordinate_ids.add(current)
            stack.extend(children_by_parent.get(current, []))
    return subordinate_ids


async def get_permission_context(
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    x_user_name: Optional[str] = Header(default=None, alias="X-User-Name"),
    x_data_sharing_scope: Optional[str] = Header(default=None, alias="X-Data-Sharing-Scope"),
    x_hide_subordinates: Optional[str] = Header(default=None, alias="X-Hide-Subordinates"),
    x_profile_permissions: Optional[str] = Header(default=None, alias="X-Profile-Permissions"),
) -> PermissionContext:
    """
    Loads the active user's Profile (FLS + Module CRUD permissions) and Role (Data Sharing scope)
    from PostgreSQL under RLS, and merges any explicit runtime header overrides from the dual-mode adapter.
    """
    effective_user_id = str(x_user_id or token_payload.sub)
    effective_user_name = x_user_name
    is_super_admin = False
    profile_code = "system_admin"
    role_code = "ceo"
    data_sharing_scope = "organization"
    hide_subordinates = False
    module_perms: Dict[str, Dict[str, bool]] = {}
    field_perms: Dict[str, Dict[str, str]] = {}
    allowed_owners: Set[str] = {effective_user_id}
    if effective_user_name:
        allowed_owners.add(effective_user_name)

    # 1. Load User, Profile, and Role Hierarchy from PostgreSQL if user UUID exists
    user_row: Optional[User] = None
    try:
        user_uuid = uuid.UUID(str(token_payload.sub))
        user_row = await db.scalar(select(User).where(User.id == user_uuid))
    except ValueError:
        user_row = None

    if user_row is not None:
        effective_user_id = str(user_row.id)
        effective_user_name = effective_user_name or user_row.full_name
        is_super_admin = bool(user_row.is_superadmin or user_row.is_super_admin)
        allowed_owners.update({str(user_row.id), user_row.email, user_row.full_name})

        # Load Profile FLS & Module Permissions
        if user_row.profile_id:
            profile_row = await db.scalar(
                select(Profile).where(Profile.id == user_row.profile_id)
            )
            if profile_row:
                profile_code = profile_row.code
                raw_perms = profile_row.permissions or {}
                if isinstance(raw_perms.get("modulePermissions"), dict):
                    module_perms = dict(raw_perms["modulePermissions"])
                elif isinstance(raw_perms.get("modules"), dict):
                    module_perms = dict(raw_perms["modules"])
                if isinstance(raw_perms.get("fieldPermissions"), dict):
                    field_perms = dict(raw_perms["fieldPermissions"])
                elif isinstance(raw_perms.get("fls"), dict):
                    field_perms = dict(raw_perms["fls"])

        # Load Role & Hierarchy Subordinates for Data Sharing
        if user_row.role_id:
            all_roles = (await db.scalars(select(Role))).all()
            current_role = next((r for r in all_roles if r.id == user_row.role_id), None)
            if current_role:
                role_code = current_role.code
                data_sharing_scope = current_role.data_sharing_scope or "organization"
                if data_sharing_scope in ("team", "team_and_subordinates"):
                    sub_role_ids = _collect_subordinate_role_ids(current_role.id, all_roles)
                    eligible_role_ids = {current_role.id} | sub_role_ids
                    team_users = (
                        await db.scalars(
                            select(User).where(User.role_id.in_(list(eligible_role_ids)))
                        )
                    ).all()
                    for tu in team_users:
                        allowed_owners.update({str(tu.id), tu.email, tu.full_name})

    # 2. Apply explicit header overrides if provided by the React client / test suite
    if x_data_sharing_scope:
        data_sharing_scope = x_data_sharing_scope.strip().lower()
    if x_hide_subordinates and x_hide_subordinates.lower() in ("true", "1", "yes"):
        hide_subordinates = True
    if x_profile_permissions:
        try:
            parsed = json.loads(x_profile_permissions)
            if isinstance(parsed.get("modulePermissions"), dict):
                module_perms.update(parsed["modulePermissions"])
            if isinstance(parsed.get("fieldPermissions"), dict):
                field_perms.update(parsed["fieldPermissions"])
        except Exception:
            pass

    return PermissionContext(
        user_id=effective_user_id,
        user_name=effective_user_name,
        org_id=token_payload.org_id,
        is_super_admin=is_super_admin,
        profile_code=profile_code,
        role_code=role_code,
        data_sharing_scope=data_sharing_scope,
        hide_subordinates_data=hide_subordinates,
        allowed_owner_identifiers=allowed_owners,
        module_permissions=module_perms,
        field_permissions=field_perms,
    )


def enforce_module_permission(
    ctx: PermissionContext,
    module: str,
    action: str,  # "read" | "create" | "update" | "delete"
) -> None:
    """
    Verifies that the active Profile permits `action` on `module`.
    Raises HTTP 403 Forbidden if explicitly disabled (`False`) in Profile permissions.
    """
    if ctx.is_super_admin:
        return
    mod_rules = ctx.module_permissions.get(module) or {}
    if action in mod_rules and mod_rules[action] is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"ملف الصلاحيات النشط ({ctx.profile_code}) لا يسمح بإجراء ({action}) على وحدة ({module}).",
        )


def can_access_record(
    ctx: PermissionContext,
    record_owner_id: Optional[str],
) -> bool:
    """
    Evaluates Data Sharing rules (`organization`, `team_and_subordinates`, `team`, `private`)
    to determine whether the current user is authorized to view or modify a record.
    """
    if ctx.is_super_admin:
        return True

    scope = (ctx.data_sharing_scope or "organization").lower()
    if scope in ("organization", "all", "public"):
        return True

    # Unassigned records remain accessible within the tenant unless scope is strictly private with an owner mismatch
    if not record_owner_id:
        return True

    owner_norm = str(record_owner_id).strip()
    if scope in ("private", "own_only") or ctx.hide_subordinates_data:
        own_ids = {ctx.user_id}
        if ctx.user_name:
            own_ids.add(ctx.user_name.strip())
        return owner_norm in own_ids

    if scope in ("team", "team_and_subordinates"):
        return owner_norm in ctx.allowed_owner_identifiers

    return True


def enforce_record_access(
    ctx: PermissionContext,
    record_owner_id: Optional[str],
    action: str = "read",
) -> None:
    """
    Raises HTTP 403 Forbidden if Data Sharing rules prevent the current user from
    reading or modifying a record owned by `record_owner_id`.
    """
    if not can_access_record(ctx, record_owner_id):
        action_ar = "عرض" if action == "read" else "تعديل أو حذف"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"قواعد مشاركة البيانات (Data Sharing: {ctx.data_sharing_scope}) "
                f"تمنعك من {action_ar} هذا السجل لأنه مسند إلى موظف خارج نطاق صلاحياتك."
            ),
        )


def filter_records_by_data_sharing(
    ctx: PermissionContext,
    records: Sequence[T],
    owner_attr: str = "owner_id",
) -> List[T]:
    """
    Filters a list of ORM rows or Pydantic models according to the user's Data Sharing scope.
    """
    if ctx.is_super_admin or (ctx.data_sharing_scope or "organization").lower() in (
        "organization",
        "all",
        "public",
    ):
        return list(records)

    filtered: List[T] = []
    for rec in records:
        owner_val = getattr(rec, owner_attr, None)
        if can_access_record(ctx, owner_val):
            filtered.append(rec)
    return filtered


def _resolve_restricted_fields(
    ctx: PermissionContext,
    module: str,
    target_levels: Set[str],
) -> Set[str]:
    """
    Returns all backend attribute names and custom_data keys that match `target_levels`
    (e.g. `{"hidden"}` or `{"hidden", "read_only"}`) for `module`.
    """
    if ctx.is_super_admin:
        return set()

    mod_fls = ctx.field_permissions.get(module) or {}
    restricted: Set[str] = set()
    for field_key, access_level in mod_fls.items():
        norm_level = str(access_level).strip().lower()
        if norm_level in target_levels:
            restricted.add(field_key)
            for alias in FRONTEND_TO_BACKEND_FIELD_ALIASES.get(field_key, []):
                restricted.add(alias)
    return restricted


def enforce_fls_on_write(
    ctx: PermissionContext,
    module: str,
    update_data: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Verifies Field-Level Security (FLS) before writing/updating a record.
    Raises HTTP 403 Forbidden if the request attempts to modify a field marked
    `hidden` or `read_only` in the user's Profile.
    """
    non_writable = _resolve_restricted_fields(ctx, module, {"hidden", "read_only"})
    if not non_writable:
        return update_data

    violated_fields: List[str] = []
    for key in list(update_data.keys()):
        if key in non_writable:
            violated_fields.append(key)

    custom_patch = update_data.get("custom_data")
    if isinstance(custom_patch, dict):
        for c_key in list(custom_patch.keys()):
            if c_key in non_writable:
                violated_fields.append(c_key)

    if violated_fields:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"صلاحيات الحقول (Profile FLS) تمنعك من تعديل الحقول المحظورة أو المخصصة للقراءة فقط: "
                f"{', '.join(violated_fields)}"
            ),
        )
    return update_data


def _mask_single_model_fls(
    model_item: Any,
    hidden_fields: Set[str],
) -> Any:
    """
    Masks/hides restricted FLS fields on a Pydantic response model or dict before returning to the client.
    Numeric fields (such as `amount`, `estimated_value`, `annual_revenue`) are zeroed (`0.00`),
    optional strings are set to `None`, and hidden keys inside `custom_data` are stripped.
    """
    if not hidden_fields:
        return model_item

    if isinstance(model_item, BaseModel):
        for attr in hidden_fields:
            if hasattr(model_item, attr):
                current_val = getattr(model_item, attr)
                if isinstance(current_val, Decimal):
                    setattr(model_item, attr, Decimal("0.00"))
                elif isinstance(current_val, (int, float)) and not isinstance(current_val, bool):
                    setattr(model_item, attr, 0)
                elif current_val is None or isinstance(current_val, str):
                    try:
                        setattr(model_item, attr, None)
                    except Exception:
                        setattr(model_item, attr, "[محجوب FLS]")

        if hasattr(model_item, "custom_data") and isinstance(model_item.custom_data, dict):
            cleaned_custom = {
                k: v for k, v in model_item.custom_data.items() if k not in hidden_fields
            }
            setattr(model_item, "custom_data", cleaned_custom)
        return model_item

    if isinstance(model_item, dict):
        masked = dict(model_item)
        for k in list(masked.keys()):
            if k in hidden_fields:
                masked[k] = None
        if isinstance(masked.get("custom_data"), dict):
            masked["custom_data"] = {
                k: v for k, v in masked["custom_data"].items() if k not in hidden_fields
            }
        return masked

    return model_item


def apply_fls_to_response(
    ctx: PermissionContext,
    module: str,
    data: T,
) -> T:
    """
    Automatically hides restricted fields (`hidden` in Profile FLS) from a single
    Pydantic model, dict, or list of models before returning any FastAPI response.
    """
    hidden_fields = _resolve_restricted_fields(ctx, module, {"hidden"})
    if not hidden_fields:
        return data

    if isinstance(data, list):
        return [_mask_single_model_fls(item, hidden_fields) for item in data]  # type: ignore[return-value]

    return _mask_single_model_fls(data, hidden_fields)
