from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now


class SentimentResult(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "sentiment_results"
    __table_args__ = (
        CheckConstraint(
            "label IN ('positive', 'neutral', 'negative')",
            name="sentiment_results_label_allowed",
        ),
        CheckConstraint(
            "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)",
            name="sentiment_results_confidence_range",
        ),
        Index("ix_sentiment_results_review_id", "review_id"),
        Index("ix_sentiment_results_label", "label"),
    )

    review_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("reviews.id", ondelete="CASCADE"),
        nullable=False,
    )
    label: Mapped[str] = mapped_column(String, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    detected_language: Mapped[str | None] = mapped_column(String, nullable=True)
    summary_tags: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    model_name: Mapped[str | None] = mapped_column(String, nullable=True)
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    review = relationship("Review", back_populates="sentiment_results")
