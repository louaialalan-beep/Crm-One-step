"""Phase 5: Two-way Email (email_messages table with org_id, lead_uid, and PostgreSQL RLS)

Revision ID: 0004_phase5_email_messages_rls
Revises: 0003_phase4_billing_quotas_super_admin
Create Date: 2026-11-20 02:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0004_phase5_email_messages_rls"
down_revision: Union[str, None] = "0003_phase4_billing_quotas_super_admin"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("lead_uid", sa.String(length=32), nullable=False),
        sa.Column(
            "lead_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("leads.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "contact_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("contacts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "deal_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("deals.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("direction", sa.String(length=20), nullable=False, server_default="outbound"),
        sa.Column("from_email", sa.String(length=255), nullable=False),
        sa.Column("to_email", sa.String(length=255), nullable=False),
        sa.Column("cc_email", sa.String(length=500), nullable=True),
        sa.Column("subject", sa.String(length=500), nullable=False, server_default="(بدون عنوان)"),
        sa.Column("body_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("body_html", sa.Text(), nullable=True),
        sa.Column("message_id_header", sa.String(length=255), nullable=True),
        sa.Column("in_reply_to", sa.String(length=255), nullable=True),
        sa.Column("folder", sa.String(length=64), nullable=False, server_default="INBOX"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="sent"),
        sa.Column(
            "attachments",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_email_messages_org_id", "email_messages", ["org_id"])
    op.create_index("ix_email_messages_lead_uid", "email_messages", ["lead_uid"])
    op.create_index("ix_email_messages_lead_id", "email_messages", ["lead_id"])
    op.create_index("ix_email_messages_deal_id", "email_messages", ["deal_id"])
    op.create_index("ix_email_messages_direction", "email_messages", ["direction"])
    op.create_index("ix_email_messages_message_id_header", "email_messages", ["message_id_header"])

    # Enable PostgreSQL Row-Level Security (RLS) on email_messages
    op.execute("ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE email_messages FORCE ROW LEVEL SECURITY;")
    op.execute(
        """
        CREATE POLICY tenant_isolation_policy ON email_messages
        USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
        WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON email_messages;")
    op.drop_table("email_messages")
