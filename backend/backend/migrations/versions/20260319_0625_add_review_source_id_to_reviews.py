"""add review_source_id to reviews

Revision ID: 20260319_0625
Revises: 20260319_0536
Create Date: 2026-03-19 06:25:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260319_0625"
down_revision = "20260319_0536"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "reviews",
        sa.Column("review_source_id", postgresql.UUID(as_uuid=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("reviews", "review_source_id")
