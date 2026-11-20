"""Phase 6: ZATCA Phase 2 Tax Invoicing fields on invoices (UBL 2.1 XML, SHA-256 Hash, ECDSA Signature, Clearance/Reporting Status)

Revision ID: 0005_phase6_zatca_phase2_invoices
Revises: 0004_phase5_email_messages_rls
Create Date: 2026-11-20 02:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_phase6_zatca_phase2_invoices"
down_revision: Union[str, None] = "0004_phase5_email_messages_rls"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("xml_content", sa.Text(), nullable=True))
    op.add_column("invoices", sa.Column("zatca_hash", sa.String(length=128), nullable=True))
    op.add_column(
        "invoices",
        sa.Column(
            "zatca_status",
            sa.String(length=64),
            nullable=False,
            server_default="PHASE1_READY",
        ),
    )
    op.add_column("invoices", sa.Column("zatca_uuid", sa.String(length=64), nullable=True))
    op.add_column("invoices", sa.Column("zatca_signature", sa.Text(), nullable=True))
    op.add_column("invoices", sa.Column("zatca_pih", sa.String(length=128), nullable=True))
    op.add_column(
        "invoices",
        sa.Column(
            "zatca_invoice_type",
            sa.String(length=32),
            nullable=False,
            server_default="B2B_STANDARD",
        ),
    )
    op.add_column(
        "invoices",
        sa.Column("zatca_submitted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("invoices", "zatca_submitted_at")
    op.drop_column("invoices", "zatca_invoice_type")
    op.drop_column("invoices", "zatca_pih")
    op.drop_column("invoices", "zatca_signature")
    op.drop_column("invoices", "zatca_uuid")
    op.drop_column("invoices", "zatca_status")
    op.drop_column("invoices", "zatca_hash")
    op.drop_column("invoices", "xml_content")
