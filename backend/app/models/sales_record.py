from datetime import date
from uuid import UUID

from sqlalchemy import ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, JSONBType, JsonList, TimestampMixin, UUIDPrimaryKeyMixin, UpdatedAtMixin


class SalesRecord(UUIDPrimaryKeyMixin, TimestampMixin, UpdatedAtMixin, Base):
    __tablename__ = "sales_records"
    __table_args__ = (
        UniqueConstraint("business_id", "record_date", name="uq_sales_records_business_date"),
        Index("ix_sales_records_business_id", "business_id"),
        Index("ix_sales_records_record_date", "record_date"),
    )

    business_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
    )
    record_date: Mapped[date] = mapped_column(nullable=False)
    revenue: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    orders: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    refund_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    refund_value: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    channel_revenue: Mapped[dict] = mapped_column(JSONBType, nullable=False, default=dict)
    products: Mapped[JsonList] = mapped_column(JSONBType, nullable=False, default=list)

    business = relationship("Business", back_populates="sales_records")
