"""add supabase user id to users

Revision ID: 20260403_1515
Revises: 20260319_0715
Create Date: 2026-04-03 15:15:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260403_1515"
down_revision: str | Sequence[str] | None = "20260319_0715"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("supabase_user_id", sa.String(), nullable=True))
    op.create_index("ix_users_supabase_user_id", "users", ["supabase_user_id"], unique=False)
    op.create_unique_constraint(
        "uq_users_supabase_user_id",
        "users",
        ["supabase_user_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_supabase_user_id", "users", type_="unique")
    op.drop_index("ix_users_supabase_user_id", table_name="users")
    op.drop_column("users", "supabase_user_id")
