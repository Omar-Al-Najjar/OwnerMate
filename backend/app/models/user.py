from sqlalchemy import CheckConstraint, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin, UpdatedAtMixin


class User(UUIDPrimaryKeyMixin, TimestampMixin, UpdatedAtMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('owner', 'manager', 'admin', 'staff')",
            name="users_role_allowed",
        ),
        Index("ix_users_supabase_user_id", "supabase_user_id"),
        Index("ix_users_role", "role"),
        Index("ix_users_language_preference", "language_preference"),
    )

    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    supabase_user_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    full_name: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, nullable=False)
    language_preference: Mapped[str | None] = mapped_column(String, nullable=True)
    theme_preference: Mapped[str | None] = mapped_column(String, nullable=True)

    businesses = relationship("Business", back_populates="owner")
    generated_contents = relationship("GeneratedContent", back_populates="created_by")
    initiated_agent_runs = relationship("AgentRun", back_populates="initiated_by")
