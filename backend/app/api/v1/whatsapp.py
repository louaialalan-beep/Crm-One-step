from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

import httpx
from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.responses import PlainTextResponse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.quotas import require_plan_feature
from app.core.security import (
    TokenPayload,
    get_current_token_payload,
    parse_org_uuid_fallback,
)
from app.db.models import (
    Contact,
    Lead,
    Organization,
    Touchpoint,
    WhatsAppMessage,
    generate_unified_customer_uid,
)
from app.db.session import AsyncSessionLocal, get_db, get_unscoped_db
from app.schemas.crm import WhatsAppMessageResponse, WhatsAppSendRequest

router = APIRouter(tags=["WhatsApp Cloud API & Real-Time WebSockets"])


class WhatsAppConnectionManager:
    """
    Manages real-time WebSocket connections grouped by `org_id` room so inbound
    and outbound WhatsApp messages stream instantaneously to `WhatsappInboxPage.tsx`.
    """

    def __init__(self) -> None:
        self._rooms: Dict[str, Set[WebSocket]] = defaultdict(set)

    async def connect(self, org_key: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._rooms[org_key].add(websocket)

    def disconnect(self, org_key: str, websocket: WebSocket) -> None:
        if org_key in self._rooms:
            self._rooms[org_key].discard(websocket)
            if not self._rooms[org_key]:
                self._rooms.pop(org_key, None)

    async def broadcast_to_org(
        self,
        org_id: uuid.UUID | str,
        event_type: str,
        payload: Dict[str, Any],
    ) -> None:
        envelope = {
            "event": event_type,
            "org_id": str(org_id),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": payload,
        }
        target_keys = {str(org_id)}
        for key in list(target_keys):
            sockets = list(self._rooms.get(key, set()))
            for ws in sockets:
                try:
                    await ws.send_json(envelope)
                except Exception:
                    self.disconnect(key, ws)


whatsapp_ws_manager = WhatsAppConnectionManager()


def verify_meta_webhook_signature(
    raw_body: bytes,
    signature_header: Optional[str],
    app_secret: Optional[str],
) -> bool:
    """
    Verifies Meta's `X-Hub-Signature-256: sha256=<hex>` HMAC-SHA256 header.
    If `META_APP_SECRET` is not configured in development, verification passes
    unless an explicit invalid signature is provided.
    """
    if not app_secret:
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected_sig = hmac.new(
        app_secret.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256,
    ).hexdigest()
    provided_sig = signature_header.split("sha256=", 1)[1].strip()
    return hmac.compare_digest(expected_sig, provided_sig)


@router.get("/webhooks/meta", response_class=PlainTextResponse)
async def verify_meta_webhook_challenge(
    hub_mode: Optional[str] = Query(default=None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(default=None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(default=None, alias="hub.challenge"),
) -> PlainTextResponse:
    """
    Meta WhatsApp Cloud API Webhook Verification endpoint (`GET /api/v1/webhooks/meta`).
    """
    expected_token = settings.META_WEBHOOK_VERIFY_TOKEN
    if hub_mode == "subscribe" and (not expected_token or hub_verify_token == expected_token):
        return PlainTextResponse(content=str(hub_challenge or ""), status_code=status.HTTP_200_OK)

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="فشل التحقق من رمز Meta Webhook Verify Token.",
    )


@router.post("/webhooks/meta")
async def receive_meta_whatsapp_webhook(
    request: Request,
    x_hub_signature_256: Optional[str] = Header(default=None, alias="X-Hub-Signature-256"),
    x_organization_id: Optional[str] = Header(default=None, alias="X-Organization-Id"),
    db: AsyncSession = Depends(get_unscoped_db),
) -> Dict[str, Any]:
    """
    Receives inbound WhatsApp Cloud API webhook events (`POST /api/v1/webhooks/meta`):
      1. Validates `X-Hub-Signature-256` HMAC-SHA256 signature.
      2. Resolves target tenant `org_id` and activates PostgreSQL RLS (`SET LOCAL app.current_org_id`).
      3. Matches phone number to existing `Contact` or `Lead` — or auto-creates a new `Lead`
         with a Permanent Unified Customer ID (`RWQ-xxxxx`).
      4. Automatically creates a `Touchpoint` (`channel="واتساب"`, `source="WhatsApp Cloud API"`).
      5. Saves the message in `whatsapp_messages`.
      6. Broadcasts the message in real time via WebSocket `/ws/whatsapp/{org_id}`.
    """
    raw_body = await request.body()
    if not verify_meta_webhook_signature(
        raw_body=raw_body,
        signature_header=x_hub_signature_256,
        app_secret=settings.META_APP_SECRET,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="توقيع X-Hub-Signature-256 غير صالح.",
        )

    try:
        body = json.loads(raw_body.decode("utf-8") or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="حمولة JSON غير صالحة.",
        ) from exc

    # Resolve target organization
    org_uuid: Optional[uuid.UUID] = None
    if x_organization_id:
        org_uuid = parse_org_uuid_fallback(x_organization_id)
    elif body.get("org_id"):
        org_uuid = parse_org_uuid_fallback(str(body["org_id"]))
    else:
        first_org = await db.scalar(
            select(Organization).where(Organization.is_active.is_(True)).order_by(Organization.created_at.asc())
        )
        if first_org:
            org_uuid = first_org.id

    if org_uuid is None:
        org_uuid = parse_org_uuid_fallback("org_rawaq_main")

    # Enforce PostgreSQL Row-Level Security for this tenant
    await db.execute(
        text("SET LOCAL app.current_org_id = :org_id"),
        {"org_id": str(org_uuid)},
    )

    processed_messages: List[Dict[str, Any]] = []
    entries = body.get("entry") or []

    # Support simplified direct webhook testing payload as well as standard Meta Graph entry[] format
    if not entries and body.get("from"):
        entries = [
            {
                "changes": [
                    {
                        "value": {
                            "contacts": [
                                {
                                    "profile": {"name": body.get("contact_name") or "عميل واتساب"},
                                    "wa_id": body.get("from"),
                                }
                            ],
                            "messages": [
                                {
                                    "from": body.get("from"),
                                    "id": body.get("wamid") or f"wamid.in.{uuid.uuid4().hex[:16]}",
                                    "type": body.get("type") or "text",
                                    "text": {"body": body.get("body") or ""},
                                }
                            ],
                        }
                    }
                ]
            }
        ]

    for entry in entries:
        for change in entry.get("changes", []):
            value_obj = change.get("value", {})
            contacts_meta = value_obj.get("contacts") or []
            profile_name_map: Dict[str, str] = {}
            for c_meta in contacts_meta:
                wa_id = str(c_meta.get("wa_id") or "")
                c_name = (c_meta.get("profile") or {}).get("name") or "عميل واتساب"
                if wa_id:
                    profile_name_map[wa_id] = c_name

            for msg in value_obj.get("messages", []):
                sender_phone = str(msg.get("from") or "").strip()
                if not sender_phone:
                    continue
                wamid = str(msg.get("id") or f"wamid.in.{uuid.uuid4().hex[:16]}")
                msg_type = str(msg.get("type") or "text")
                text_body = ""
                media_url: Optional[str] = None

                if msg_type == "text":
                    text_body = str((msg.get("text") or {}).get("body") or "")
                elif msg_type in ("image", "document", "audio", "video"):
                    media_obj = msg.get(msg_type) or {}
                    text_body = str(media_obj.get("caption") or f"[{msg_type.upper()}]")
                    media_url = media_obj.get("url") or media_obj.get("id")
                else:
                    text_body = str(msg.get("body") or f"[{msg_type}]")

                sender_name = profile_name_map.get(sender_phone) or "عميل واتساب جديد"

                # Check if phone belongs to an existing Contact or Lead in this organization
                existing_contact = await db.scalar(
                    select(Contact).where(
                        Contact.phone == sender_phone,
                        Contact.deleted_at.is_(None),
                    )
                )
                existing_lead = await db.scalar(
                    select(Lead).where(
                        Lead.phone == sender_phone,
                        Lead.deleted_at.is_(None),
                    )
                )

                lead_uid: str
                lead_id_val: Optional[uuid.UUID] = None
                contact_id_val: Optional[uuid.UUID] = None
                created_new_lead = False

                if existing_contact:
                    lead_uid = existing_contact.lead_uid
                    contact_id_val = existing_contact.id
                    sender_name = existing_contact.full_name
                elif existing_lead:
                    lead_uid = existing_lead.lead_uid
                    lead_id_val = existing_lead.id
                    sender_name = existing_lead.full_name
                else:
                    # Auto-create a new Lead with Permanent Unified Customer ID (RWQ-xxxxx)
                    lead_uid = generate_unified_customer_uid()
                    new_lead = Lead(
                        org_id=org_uuid,
                        lead_uid=lead_uid,
                        full_name=sender_name,
                        company=f"عميل واتساب ({sender_phone})",
                        phone=sender_phone,
                        source="واتساب السحابي",
                        status="جديد",
                        score=75,
                    )
                    db.add(new_lead)
                    await db.flush()
                    lead_id_val = new_lead.id
                    created_new_lead = True

                # Auto-create Touchpoint for attribution & visit frequency tracking
                touchpoint = Touchpoint(
                    org_id=org_uuid,
                    lead_uid=lead_uid,
                    lead_id=lead_id_val,
                    contact_id=contact_id_val,
                    channel="واتساب",
                    source="WhatsApp Cloud API",
                    campaign_name=msg.get("referral", {}).get("headline"),
                    ad_id=msg.get("referral", {}).get("source_id"),
                    metadata_={
                        "wamid": wamid,
                        "phone": sender_phone,
                        "snippet": text_body[:120],
                        "auto_created_lead": created_new_lead,
                    },
                )
                db.add(touchpoint)

                # Save WhatsAppMessage record
                wa_message = WhatsAppMessage(
                    org_id=org_uuid,
                    lead_uid=lead_uid,
                    lead_id=lead_id_val,
                    contact_id=contact_id_val,
                    phone_number=sender_phone,
                    contact_name=sender_name,
                    direction="inbound",
                    message_type=msg_type,
                    body=text_body,
                    media_url=media_url,
                    wamid=wamid,
                    status="received",
                    metadata_={"raw_webhook_msg": msg},
                )
                db.add(wa_message)
                await db.flush()

                serialized = WhatsAppMessageResponse.model_validate(wa_message).model_dump(mode="json")
                processed_messages.append(serialized)

                # Broadcast immediately to connected WebSocket clients for this organization
                await whatsapp_ws_manager.broadcast_to_org(
                    org_id=org_uuid,
                    event_type="whatsapp:message_received",
                    payload=serialized,
                )

    return {
        "status": "processed",
        "org_id": str(org_uuid),
        "messages_count": len(processed_messages),
        "messages": processed_messages,
    }


@router.get("/whatsapp/messages", response_model=List[WhatsAppMessageResponse])
async def list_whatsapp_messages(
    lead_uid: Optional[str] = None,
    phone_number: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> List[WhatsAppMessageResponse]:
    stmt = select(WhatsAppMessage).order_by(WhatsAppMessage.created_at.asc())
    if lead_uid:
        stmt = stmt.where(WhatsAppMessage.lead_uid == lead_uid)
    if phone_number:
        stmt = stmt.where(WhatsAppMessage.phone_number == phone_number)
    rows = (await db.scalars(stmt)).all()
    return [WhatsAppMessageResponse.model_validate(r) for r in rows]


@router.post(
    "/whatsapp/send",
    response_model=WhatsAppMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_whatsapp_cloud_message(
    payload: WhatsAppSendRequest,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
    _org: Organization = Depends(require_plan_feature("whatsapp")),
) -> WhatsAppMessageResponse:
    """
    Sends an outbound text, media, or template message via Meta WhatsApp Cloud API
    (`POST /api/v1/whatsapp/send`), saves it to `whatsapp_messages` under RLS,
    logs a `Touchpoint`, and broadcasts it to `/ws/whatsapp/{org_id}`.
    """
    lead_uid = payload.lead_uid or generate_unified_customer_uid()
    wamid = f"wamid.out.{uuid.uuid4().hex[:18]}"
    delivery_status = "sent"
    cloud_response: Dict[str, Any] = {}

    if settings.WHATSAPP_PHONE_NUMBER_ID and settings.WHATSAPP_ACCESS_TOKEN:
        graph_url = (
            f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}/"
            f"{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
        )
        graph_payload: Dict[str, Any] = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": payload.phone_number,
            "type": payload.message_type,
        }
        if payload.message_type == "text":
            graph_payload["text"] = {"preview_url": False, "body": payload.body}
        elif payload.message_type == "template":
            graph_payload["template"] = {
                "name": payload.template_name or "crm_one_step_notification",
                "language": {"code": payload.template_language},
            }
        else:
            graph_payload[payload.message_type] = {
                "link": payload.media_url,
                "caption": payload.body,
            }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    graph_url,
                    headers={"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"},
                    json=graph_payload,
                )
                resp.raise_for_status()
                cloud_response = resp.json()
                messages_arr = cloud_response.get("messages") or []
                if messages_arr and messages_arr[0].get("id"):
                    wamid = str(messages_arr[0]["id"])
        except Exception as exc:
            delivery_status = "failed"
            cloud_response = {"error": str(exc)}
    else:
        cloud_response = {"simulated": True, "wamid": wamid}

    wa_message = WhatsAppMessage(
        org_id=token_payload.org_id,
        lead_uid=lead_uid,
        lead_id=payload.lead_id,
        contact_id=payload.contact_id,
        phone_number=payload.phone_number,
        contact_name=payload.contact_name,
        direction="outbound",
        message_type=payload.message_type,
        body=payload.body,
        media_url=payload.media_url,
        wamid=wamid,
        status=delivery_status,
        metadata_={"cloud_api_response": cloud_response},
    )
    db.add(wa_message)

    tp = Touchpoint(
        org_id=token_payload.org_id,
        lead_uid=lead_uid,
        lead_id=payload.lead_id,
        contact_id=payload.contact_id,
        channel="واتساب",
        source="WhatsApp Outbound",
        metadata_={"wamid": wamid, "direction": "outbound", "snippet": payload.body[:120]},
    )
    db.add(tp)
    await db.flush()

    serialized = WhatsAppMessageResponse.model_validate(wa_message)
    await whatsapp_ws_manager.broadcast_to_org(
        org_id=token_payload.org_id,
        event_type="whatsapp:message_sent",
        payload=serialized.model_dump(mode="json"),
    )

    return serialized


@router.websocket("/ws/whatsapp/{org_id}")
async def whatsapp_live_websocket(
    websocket: WebSocket,
    org_id: str,
) -> None:
    """
    Real-Time WebSocket endpoint (`/ws/whatsapp/{org_id}` and `/api/v1/ws/whatsapp/{org_id}`):
    Streams inbound & outbound WhatsApp messages and status updates to `WhatsappInboxPage.tsx`.
    """
    resolved_uuid = str(parse_org_uuid_fallback(org_id))
    await whatsapp_ws_manager.connect(resolved_uuid, websocket)
    if org_id != resolved_uuid:
        await whatsapp_ws_manager.connect(org_id, websocket)

    try:
        # Send initial connection acknowledgement with recent messages snapshot
        recent_items: List[Dict[str, Any]] = []
        try:
            async with AsyncSessionLocal() as session:
                await session.execute(
                    text("SET LOCAL app.current_org_id = :org_id"),
                    {"org_id": resolved_uuid},
                )
                rows = (
                    await session.scalars(
                        select(WhatsAppMessage)
                        .order_by(WhatsAppMessage.created_at.desc())
                        .limit(50)
                    )
                ).all()
                recent_items = [
                    WhatsAppMessageResponse.model_validate(r).model_dump(mode="json")
                    for r in reversed(rows)
                ]
        except Exception:
            recent_items = []

        await websocket.send_json(
            {
                "event": "whatsapp:connected",
                "org_id": resolved_uuid,
                "recent_messages": recent_items,
            }
        )

        while True:
            raw_text = await websocket.receive_text()
            try:
                client_msg = json.loads(raw_text)
                if client_msg.get("type") == "ping":
                    await websocket.send_json({"event": "pong", "org_id": resolved_uuid})
            except Exception:
                await websocket.send_json({"event": "ack", "org_id": resolved_uuid})
    except WebSocketDisconnect:
        whatsapp_ws_manager.disconnect(resolved_uuid, websocket)
        whatsapp_ws_manager.disconnect(org_id, websocket)
