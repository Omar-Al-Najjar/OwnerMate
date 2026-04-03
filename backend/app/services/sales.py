from fastapi import status

from ..core.exceptions import AppError
from ..models.sales_record import SalesRecord
from ..repositories.business import BusinessRepository
from ..repositories.sales_record import SalesRecordRepository
from ..schemas.sales import SalesRecordCreateRequest, SalesRecordRead


class SalesService:
    def __init__(
        self,
        *,
        business_repository: BusinessRepository,
        sales_record_repository: SalesRecordRepository,
    ) -> None:
        self.business_repository = business_repository
        self.sales_record_repository = sales_record_repository

    def create_or_update_record(self, payload: SalesRecordCreateRequest) -> SalesRecordRead:
        business = self.business_repository.get_by_id(payload.business_id)
        if business is None:
            raise AppError(
                code="BUSINESS_NOT_FOUND",
                message="Business not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        existing = self.sales_record_repository.get_by_business_and_date(
            payload.business_id, payload.record_date
        )
        if existing is None:
            existing = self.sales_record_repository.add(
                SalesRecord(
                    business_id=payload.business_id,
                    record_date=payload.record_date,
                    revenue=payload.revenue,
                    orders=payload.orders,
                    refund_count=payload.refund_count,
                    refund_value=payload.refund_value,
                    channel_revenue=payload.channel_revenue,
                    products=[product.model_dump() for product in payload.products],
                )
            )
        else:
            existing.revenue = payload.revenue
            existing.orders = payload.orders
            existing.refund_count = payload.refund_count
            existing.refund_value = payload.refund_value
            existing.channel_revenue = payload.channel_revenue
            existing.products = [product.model_dump() for product in payload.products]

        self.sales_record_repository.save()
        self.sales_record_repository.refresh(existing)
        return SalesRecordRead.model_validate(existing)

    def list_records(self, business_id) -> list[SalesRecordRead]:
        business = self.business_repository.get_by_id(business_id)
        if business is None:
            raise AppError(
                code="BUSINESS_NOT_FOUND",
                message="Business not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        return [
            SalesRecordRead.model_validate(record)
            for record in self.sales_record_repository.list_for_business(business_id)
        ]
