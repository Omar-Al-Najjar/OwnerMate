from uuid import UUID

from sqlalchemy import select

from ..models.sales_record import SalesRecord
from .base import Repository


class SalesRecordRepository(Repository):
    def add(self, sales_record: SalesRecord) -> SalesRecord:
        self.session.add(sales_record)
        self.session.flush()
        self.session.refresh(sales_record)
        return sales_record

    def get_by_business_and_date(self, business_id: UUID, record_date) -> SalesRecord | None:
        statement = select(SalesRecord).where(
            SalesRecord.business_id == business_id,
            SalesRecord.record_date == record_date,
        )
        return self.session.scalar(statement)

    def list_for_business(self, business_id: UUID) -> list[SalesRecord]:
        statement = (
            select(SalesRecord)
            .where(SalesRecord.business_id == business_id)
            .order_by(SalesRecord.record_date.asc())
        )
        return list(self.session.scalars(statement))

    def save(self) -> None:
        self.session.commit()

    def refresh(self, sales_record: SalesRecord) -> None:
        self.session.refresh(sales_record)
