from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False,
)


class TokenPayload(BaseModel):
    sub: str
    org_id: uuid.UUID
    role_id: Optional[str] = None
    profile_id: Optional[str] = None
    email: Optional[str] = None
    exp: Optional[int] = None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(
    subject: str | uuid.UUID,
    org_id: str | uuid.UUID,
    extra_claims: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode: Dict[str, Any] = {
        "sub": str(subject),
        "org_id": str(org_id),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    if extra_claims:
        to_encode.update(extra_claims)
    return jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        sub = payload.get("sub")
        org_id_raw = payload.get("org_id")
        if not sub or not org_id_raw:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="بيانات رمز المصادقة JWT غير مكتملة (sub / org_id).",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return TokenPayload(
            sub=str(sub),
            org_id=uuid.UUID(str(org_id_raw)),
            role_id=payload.get("role_id"),
            profile_id=payload.get("profile_id"),
            email=payload.get("email"),
            exp=payload.get("exp"),
        )
    except (JWTError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="رمز المصادقة JWT غير صالح أو منتهي الصلاحية.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def parse_org_uuid_fallback(raw_org_id: Optional[str]) -> uuid.UUID:
    """
    Converts a UUID string or deterministic organization slug (e.g. 'org_rawaq_main')
    into a valid UUID so hybrid Preview/Cloud headers work seamlessly with PostgreSQL RLS.
    """
    if not raw_org_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="لم يتم العثور على رمز المصادقة أو معرّف المؤسسة (org_id).",
        )
    try:
        return uuid.UUID(raw_org_id)
    except ValueError:
        return uuid.uuid5(uuid.NAMESPACE_DNS, f"crm-one-step.{raw_org_id}")


async def get_current_token_payload(
    token: Optional[str] = Depends(oauth2_scheme),
    x_organization_id: Optional[str] = Header(default=None, alias="X-Organization-Id"),
) -> TokenPayload:
    """
    Extracts and verifies the JWT token. Supports deterministic UUID fallback via
    X-Organization-Id header when called from the React dual-mode service adapter.
    """
    if token:
        try:
            return decode_access_token(token)
        except HTTPException:
            if not x_organization_id:
                raise

    if x_organization_id:
        org_uuid = parse_org_uuid_fallback(x_organization_id)
        return TokenPayload(
            sub="adapter_service_user",
            org_id=org_uuid,
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="يرجى تسجيل الدخول وإرفاق رمز JWT صالح.",
        headers={"WWW-Authenticate": "Bearer"},
    )
