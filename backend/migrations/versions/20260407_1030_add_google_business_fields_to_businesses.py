"""add google business fields to businesses

Revision ID: 20260407_1030
Revises: 20260403_1630
Create Date: 2026-04-07 10:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260407_1030"
down_revision = "20260403_1630"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "businesses",
        sa.Column("google_review_business_name", sa.String(), nullable=True),
    )
    op.add_column(
        "businesses",
        sa.Column("google_maps_url", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("businesses", "google_maps_url")
    op.drop_column("businesses", "google_review_business_name")
