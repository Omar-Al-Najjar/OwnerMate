from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin, UpdatedAtMixin


class GeneratedContent(UUIDPrimaryKeyMixin, TimestampMixin, UpdatedAtMixin, Base):
    __tablename__ = "generated_contents"
    __table_args__ = (
        CheckConstraint(
            "content_type IN ('review_reply', 'marketing_copy')",
            name="generated_contents_content_type_allowed",
        ),
        Index("ix_generated_contents_business_id", "business_id"),
        Index("ix_generated_contents_review_id", "review_id"),
        Index("ix_generated_contents_content_type", "content_type"),
    )

    business_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
    )
    review_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("reviews.id", ondelete="SET NULL"),
        nullable=True,
    )
    content_type: Mapped[str] = mapped_column(String, nullable=False)
    language: Mapped[str] = mapped_column(String, nullable=False)
    tone: Mapped[str | None] = mapped_column(String, nullable=True)
    prompt_context: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    generated_text: Mapped[str] = mapped_column(Text, nullable=False)
    edited_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    business = relationship("Business", back_populates="generated_contents")
    review = relationship("Review", back_populates="generated_contents")
    created_by = relationship("User", back_populates="generated_contents")
