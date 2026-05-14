from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import (
    Base,
    JSONBType,
    JsonDict,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    UpdatedAtMixin,
    utc_now,
)


class Review(UUIDPrimaryKeyMixin, TimestampMixin, UpdatedAtMixin, Base):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'reviewed', 'responded')",
            name="reviews_status_allowed",
        ),
        CheckConstraint(
            "rating IS NULL OR rating BETWEEN 1 AND 5",
            name="reviews_rating_range",
        ),
        UniqueConstraint(
            "business_id",
            "source_type",
            "source_review_id",
            name="uq_reviews_business_source_review",
        ),
        Index("ix_reviews_business_id", "business_id"),
        Index("ix_reviews_source_type", "source_type"),
        Index("ix_reviews_review_created_at", "review_created_at"),
        Index("ix_reviews_status", "status"),
        Index("ix_reviews_language", "language"),
        Index("ix_reviews_business_status_created_at", "business_id", "status", "review_created_at"),
    )

    business_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
    )
    review_source_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=True,
    )
    source_type: Mapped[str] = mapped_column(String, nullable=False)
    source_review_id: Mapped[str] = mapped_column(String, nullable=False)
    reviewer_name: Mapped[str | None] = mapped_column(String, nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    language: Mapped[str | None] = mapped_column(String, nullable=True)
    review_text: Mapped[str] = mapped_column(Text, nullable=False)
    source_metadata: Mapped[JsonDict | None] = mapped_column(JSONBType, nullable=True)
    review_created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    response_status: Mapped[str | None] = mapped_column(String, nullable=True)

    business = relationship("Business", back_populates="reviews")
    sentiment_results = relationship("SentimentResult", back_populates="review")
    generated_contents = relationship("GeneratedContent", back_populates="review")
