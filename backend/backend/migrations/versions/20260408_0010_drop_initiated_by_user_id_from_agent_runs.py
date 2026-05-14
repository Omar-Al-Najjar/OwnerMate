"""drop initiated_by_user_id from agent_runs

Revision ID: 20260408_0010
Revises: 20260407_1030_add_google_business_fields_to_businesses
Create Date: 2026-04-08 00:10:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260408_0010"
down_revision = "20260407_1030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "fk_agent_runs_initiated_by_user_id_users",
        "agent_runs",
        type_="foreignkey",
    )
    op.drop_column("agent_runs", "initiated_by_user_id")


def downgrade() -> None:
    op.add_column(
        "agent_runs",
        sa.Column(
            "initiated_by_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_agent_runs_initiated_by_user_id_users",
        "agent_runs",
        "users",
        ["initiated_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
