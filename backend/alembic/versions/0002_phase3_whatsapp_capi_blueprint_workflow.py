"""Phase 3: WhatsApp Cloud API messages, Meta CAPI events log, Blueprints & Workflow Engine with RLS

Revision ID: 0002_phase3_whatsapp_capi_blueprint_workflow
Revises: 0001_initial_crm_one_step_rls
Create Date: 2026-11-19 02:36:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0002_phase3_whatsapp_capi_blueprint_workflow"
down_revision: Union[str, None] = "0001_initial_crm_one_step_rls"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PHASE3_RLS_TABLES = [
    "whatsapp_messages",
    "capi_events_log",
    "blueprints",
    "blueprint_transitions",
    "workflow_rules",
    "workflow_logs",
]


def upgrade() -> None:
    # 1. whatsapp_messages
    op.create_table(
        "whatsapp_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lead_uid", sa.String(length=32), nullable=False),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="SET NULL"), nullable=True),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("phone_number", sa.String(length=50), nullable=False),
        sa.Column("contact_name", sa.String(length=200), nullable=True),
        sa.Column("direction", sa.String(length=20), nullable=False, server_default="inbound"),
        sa.Column("message_type", sa.String(length=32), nullable=False, server_default="text"),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("media_url", sa.Text(), nullable=True),
        sa.Column("wamid", sa.String(length=160), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="received"),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_whatsapp_messages_org_id", "whatsapp_messages", ["org_id"])
    op.create_index("ix_whatsapp_messages_lead_uid", "whatsapp_messages", ["lead_uid"])
    op.create_index("ix_whatsapp_messages_phone_number", "whatsapp_messages", ["phone_number"])
    op.create_index("ix_whatsapp_messages_wamid", "whatsapp_messages", ["wamid"])

    # 2. capi_events_log
    op.create_table(
        "capi_events_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lead_uid", sa.String(length=32), nullable=False),
        sa.Column("event_name", sa.String(length=64), nullable=False, server_default="Purchase"),
        sa.Column("event_id", sa.String(length=160), nullable=False),
        sa.Column("entity_type", sa.String(length=40), nullable=True),
        sa.Column("entity_id", sa.String(length=80), nullable=True),
        sa.Column("value", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="SAR"),
        sa.Column("hashed_email", sa.String(length=128), nullable=True),
        sa.Column("hashed_phone", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="queued"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("response_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_capi_events_log_org_id", "capi_events_log", ["org_id"])
    op.create_index("ix_capi_events_log_lead_uid", "capi_events_log", ["lead_uid"])
    op.create_index("ix_capi_events_log_event_name", "capi_events_log", ["event_name"])

    # 3. blueprints
    op.create_table(
        "blueprints",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("module", sa.String(length=64), nullable=False, server_default="deals"),
        sa.Column("field_name", sa.String(length=64), nullable=False, server_default="stage"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("stages", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_blueprints_org_id", "blueprints", ["org_id"])

    # 4. blueprint_transitions
    op.create_table(
        "blueprint_transitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("blueprint_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("blueprints.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("from_stage", sa.String(length=100), nullable=False),
        sa.Column("to_stage", sa.String(length=100), nullable=False),
        sa.Column("before_rules", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("during_required_fields", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("after_actions", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("sla_hours", sa.Integer(), nullable=False, server_default="48"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_blueprint_transitions_org_id", "blueprint_transitions", ["org_id"])
    op.create_index("ix_blueprint_transitions_from_to", "blueprint_transitions", ["from_stage", "to_stage"])

    # 5. workflow_rules
    op.create_table(
        "workflow_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("module", sa.String(length=64), nullable=False, server_default="deals"),
        sa.Column("trigger_type", sa.String(length=64), nullable=False, server_default="on_stage_change"),
        sa.Column("conditions", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("actions", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("executions_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_workflow_rules_org_id", "workflow_rules", ["org_id"])

    # 6. workflow_logs
    op.create_table(
        "workflow_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rule_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("workflow_rules.id", ondelete="SET NULL"), nullable=True),
        sa.Column("blueprint_transition_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("blueprint_transitions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("module", sa.String(length=64), nullable=False),
        sa.Column("record_id", sa.String(length=80), nullable=False),
        sa.Column("lead_uid", sa.String(length=32), nullable=True),
        sa.Column("action_type", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="executed"),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("executed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_workflow_logs_org_id", "workflow_logs", ["org_id"])
    op.create_index("ix_workflow_logs_record_id", "workflow_logs", ["record_id"])

    # Enable PostgreSQL Row-Level Security (RLS) on all Phase 3 operational tables
    for table_name in PHASE3_RLS_TABLES:
        op.execute(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY;")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table_name}
            USING (org_id = current_setting('app.current_org_id', true)::uuid)
            WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
            """
        )


def downgrade() -> None:
    for table_name in reversed(PHASE3_RLS_TABLES):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table_name};")
        op.execute(f"ALTER TABLE {table_name} DISABLE ROW LEVEL SECURITY;")
        op.drop_table(table_name)
