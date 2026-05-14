"""add review and sentiment value checks

Revision ID: 20260319_0645
Revises: 20260319_0625
Create Date: 2026-03-19 06:45:00
"""

from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260319_0645"
down_revision = "20260319_0625"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_reviews_reviews_rating_range",
        "reviews",
        "rating IS NULL OR rating BETWEEN 1 AND 5",
    )
    op.create_check_constraint(
        "ck_sentiment_results_sentiment_results_confidence_range",
        "sentiment_results",
        "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_sentiment_results_sentiment_results_confidence_range",
        "sentiment_results",
        type_="check",
    )
    op.drop_constraint(
        "ck_reviews_reviews_rating_range",
        "reviews",
        type_="check",
    )
