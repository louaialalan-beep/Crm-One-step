"""Phase 4: Billing status columns on organizations and is_super_admin on users

Revision ID: 0003_phase4_billing_quotas_super_admin
Revises: 0002_phase3_whatsapp_capi_blueprint_workflow
Create Date: 2026-11-19 02:51:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_phase4_billing_quotas_super_admin"
down_revision: Union[str, None] = "0002_phase3_whatsapp_capi_blueprint_workflow"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("payment_status", sa.String(length=32), nullable=False, server_default="paid"),
    )
    op.add_column(
        "organizations",
        sa.Column("billing_provider", sa.String(length=32), nullable=False, server_default="moyasar"),
    )
    op.add_column(
        "organizations",
        sa.Column("subscription_id", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("is_super_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("users", "is_super_admin")
    op.drop_column("organizations", "subscription_id")
    op.drop_column("organizations", "billing_provider")
    op.drop_column("organizations", "payment_status")
