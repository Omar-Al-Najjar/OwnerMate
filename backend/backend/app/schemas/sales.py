from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


SalesChannelId = Literal["walk_in", "delivery_app", "instagram_dm", "whatsapp"]
SalesProductCategory = Literal["signature_drinks", "desserts", "breakfast", "bundles"]


class SalesProductPayload(BaseModel):
    id: str
    label: str
    category: SalesProductCategory
    revenue: int = Field(ge=0)
    units: int = Field(ge=0)

    @field_validator("id", "label", mode="before")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value must not be empty.")
        return normalized


class SalesRecordCreateRequest(BaseModel):
    business_id: UUID
    record_date: date
    revenue: int = Field(ge=0)
    orders: int = Field(ge=0)
    refund_count: int = Field(default=0, ge=0)
    refund_value: int = Field(default=0, ge=0)
    channel_revenue: dict[SalesChannelId, int] = Field(default_factory=dict)
    products: list[SalesProductPayload] = Field(default_factory=list)

    @field_validator("channel_revenue")
    @classmethod
    def validate_channel_revenue(cls, value: dict[SalesChannelId, int]) -> dict[SalesChannelId, int]:
        return {key: max(0, int(amount)) for key, amount in value.items()}


class SalesRecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    record_date: date
    revenue: int
    orders: int
    refund_count: int
    refund_value: int
    channel_revenue: dict[str, int]
    products: list[SalesProductPayload]
    created_at: datetime
    updated_at: datetime
