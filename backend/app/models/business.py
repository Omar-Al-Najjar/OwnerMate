from uuid import UUID

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin, UpdatedAtMixin


class Business(UUIDPrimaryKeyMixin, TimestampMixin, UpdatedAtMixin, Base):
    __tablename__ = "businesses"
    __table_args__ = (
        Index("ix_businesses_owner_user_id", "owner_user_id"),
        Index("ix_businesses_default_language", "default_language"),
    )

    owner_user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    industry: Mapped[str | None] = mapped_column(String, nullable=True)
    country_code: Mapped[str | None] = mapped_column(String, nullable=True)
    default_language: Mapped[str | None] = mapped_column(String, nullable=True)

    owner = relationship("User", back_populates="businesses")
    reviews = relationship("Review", back_populates="business")
    sales_records = relationship("SalesRecord", back_populates="business")
    generated_contents = relationship("GeneratedContent", back_populates="business")
    agent_runs = relationship("AgentRun", back_populates="business")
