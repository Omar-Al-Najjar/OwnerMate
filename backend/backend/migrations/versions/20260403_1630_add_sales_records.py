"""add sales records

Revision ID: 20260403_1630
Revises: 20260403_1515
Create Date: 2026-04-03 16:30:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260403_1630"
down_revision: str | Sequence[str] | None = "20260403_1515"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sales_records",
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("record_date", sa.Date(), nullable=False),
        sa.Column("revenue", sa.Integer(), nullable=False),
        sa.Column("orders", sa.Integer(), nullable=False),
        sa.Column("refund_count", sa.Integer(), nullable=False),
        sa.Column("refund_value", sa.Integer(), nullable=False),
        sa.Column("channel_revenue", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("products", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sales_records")),
        sa.UniqueConstraint("business_id", "record_date", name="uq_sales_records_business_date"),
    )
    op.create_index(
        op.f("ix_sales_records_business_id"), "sales_records", ["business_id"], unique=False
    )
    op.create_index(
        op.f("ix_sales_records_record_date"), "sales_records", ["record_date"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_sales_records_record_date"), table_name="sales_records")
    op.drop_index(op.f("ix_sales_records_business_id"), table_name="sales_records")
    op.drop_table("sales_records")
