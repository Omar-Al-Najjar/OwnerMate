"""create initial persistence schema

Revision ID: 20260319_0536
Revises:
Create Date: 2026-03-19 05:36:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260319_0536"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=True),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("language_preference", sa.String(), nullable=True),
        sa.Column("theme_preference", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "role IN ('owner', 'manager', 'admin', 'staff')",
            name="ck_users_users_role_allowed",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_role", "users", ["role"], unique=False)
    op.create_index(
        "ix_users_language_preference",
        "users",
        ["language_preference"],
        unique=False,
    )

    op.create_table(
        "businesses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("industry", sa.String(), nullable=True),
        sa.Column("country_code", sa.String(), nullable=True),
        sa.Column("default_language", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["owner_user_id"],
            ["users.id"],
            name="fk_businesses_owner_user_id_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_businesses"),
    )
    op.create_index(
        "ix_businesses_owner_user_id",
        "businesses",
        ["owner_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_businesses_default_language",
        "businesses",
        ["default_language"],
        unique=False,
    )

    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_type", sa.String(), nullable=False),
        sa.Column("source_review_id", sa.String(), nullable=False),
        sa.Column("reviewer_name", sa.String(), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("language", sa.String(), nullable=True),
        sa.Column("review_text", sa.Text(), nullable=False),
        sa.Column("review_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("response_status", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('pending', 'reviewed', 'responded')",
            name="ck_reviews_reviews_status_allowed",
        ),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["businesses.id"],
            name="fk_reviews_business_id_businesses",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_reviews"),
        sa.UniqueConstraint(
            "business_id",
            "source_type",
            "source_review_id",
            name="uq_reviews_business_source_review",
        ),
    )
    op.create_index("ix_reviews_business_id", "reviews", ["business_id"], unique=False)
    op.create_index("ix_reviews_source_type", "reviews", ["source_type"], unique=False)
    op.create_index(
        "ix_reviews_review_created_at",
        "reviews",
        ["review_created_at"],
        unique=False,
    )
    op.create_index("ix_reviews_status", "reviews", ["status"], unique=False)
    op.create_index("ix_reviews_language", "reviews", ["language"], unique=False)
    op.create_index(
        "ix_reviews_business_status_created_at",
        "reviews",
        ["business_id", "status", "review_created_at"],
        unique=False,
    )

    op.create_table(
        "sentiment_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("review_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("confidence", sa.Numeric(5, 4), nullable=True),
        sa.Column("detected_language", sa.String(), nullable=True),
        sa.Column("summary_tags", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("model_name", sa.String(), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "label IN ('positive', 'neutral', 'negative')",
            name="ck_sentiment_results_sentiment_results_label_allowed",
        ),
        sa.ForeignKeyConstraint(
            ["review_id"],
            ["reviews.id"],
            name="fk_sentiment_results_review_id_reviews",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_sentiment_results"),
    )
    op.create_index(
        "ix_sentiment_results_review_id",
        "sentiment_results",
        ["review_id"],
        unique=False,
    )
    op.create_index(
        "ix_sentiment_results_label",
        "sentiment_results",
        ["label"],
        unique=False,
    )

    op.create_table(
        "generated_contents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("review_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("language", sa.String(), nullable=False),
        sa.Column("tone", sa.String(), nullable=True),
        sa.Column("prompt_context", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("generated_text", sa.Text(), nullable=False),
        sa.Column("edited_text", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "content_type IN ('review_reply', 'marketing_copy')",
            name="ck_generated_contents_generated_contents_content_type_allowed",
        ),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["businesses.id"],
            name="fk_generated_contents_business_id_businesses",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            name="fk_generated_contents_created_by_user_id_users",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["review_id"],
            ["reviews.id"],
            name="fk_generated_contents_review_id_reviews",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_generated_contents"),
    )
    op.create_index(
        "ix_generated_contents_business_id",
        "generated_contents",
        ["business_id"],
        unique=False,
    )
    op.create_index(
        "ix_generated_contents_review_id",
        "generated_contents",
        ["review_id"],
        unique=False,
    )
    op.create_index(
        "ix_generated_contents_content_type",
        "generated_contents",
        ["content_type"],
        unique=False,
    )

    op.create_table(
        "agent_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("initiated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("agent_name", sa.String(), nullable=False),
        sa.Column("task_type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("input_reference", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("output_reference", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'success', 'failed')",
            name="ck_agent_runs_agent_runs_status_allowed",
        ),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["businesses.id"],
            name="fk_agent_runs_business_id_businesses",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["initiated_by_user_id"],
            ["users.id"],
            name="fk_agent_runs_initiated_by_user_id_users",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_agent_runs"),
    )
    op.create_index("ix_agent_runs_business_id", "agent_runs", ["business_id"], unique=False)
    op.create_index("ix_agent_runs_task_type", "agent_runs", ["task_type"], unique=False)
    op.create_index("ix_agent_runs_status", "agent_runs", ["status"], unique=False)
    op.create_index("ix_agent_runs_started_at", "agent_runs", ["started_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_agent_runs_started_at", table_name="agent_runs")
    op.drop_index("ix_agent_runs_status", table_name="agent_runs")
    op.drop_index("ix_agent_runs_task_type", table_name="agent_runs")
    op.drop_index("ix_agent_runs_business_id", table_name="agent_runs")
    op.drop_table("agent_runs")

    op.drop_index("ix_generated_contents_content_type", table_name="generated_contents")
    op.drop_index("ix_generated_contents_review_id", table_name="generated_contents")
    op.drop_index("ix_generated_contents_business_id", table_name="generated_contents")
    op.drop_table("generated_contents")

    op.drop_index("ix_sentiment_results_label", table_name="sentiment_results")
    op.drop_index("ix_sentiment_results_review_id", table_name="sentiment_results")
    op.drop_table("sentiment_results")

    op.drop_index("ix_reviews_business_status_created_at", table_name="reviews")
    op.drop_index("ix_reviews_language", table_name="reviews")
    op.drop_index("ix_reviews_status", table_name="reviews")
    op.drop_index("ix_reviews_review_created_at", table_name="reviews")
    op.drop_index("ix_reviews_source_type", table_name="reviews")
    op.drop_index("ix_reviews_business_id", table_name="reviews")
    op.drop_table("reviews")

    op.drop_index("ix_businesses_default_language", table_name="businesses")
    op.drop_index("ix_businesses_owner_user_id", table_name="businesses")
    op.drop_table("businesses")

    op.drop_index("ix_users_language_preference", table_name="users")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_table("users")
