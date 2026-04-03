from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .review import ReviewStatus
from .sales import SalesProductPayload


class DashboardOverviewQuery(BaseModel):
    business_id: UUID
    limit: int = Field(default=200, ge=1, le=500)
    recent_limit: int = Field(default=5, ge=1, le=10)
    priority_limit: int = Field(default=5, ge=1, le=10)
    activity_limit: int = Field(default=6, ge=1, le=12)


class DashboardMetricSummary(BaseModel):
    total_reviews: int
    average_rating: float | None = None
    positive_share: float = 0
    negative_share: float = 0
    pending_reviews: int = 0
    reviewed_reviews: int = 0
    responded_reviews: int = 0
    active_sources: int = 0


class DashboardDistributionBucket(BaseModel):
    label: str
    value: int
    share: float


class DashboardRecentReviewItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    review_id: UUID
    source_type: str
    reviewer_name: str | None = None
    rating: int | None = None
    language: str | None = None
    review_text: str
    review_created_at: datetime | None = None
    status: ReviewStatus
    sentiment_label: Literal["positive", "neutral", "negative"] | None = None
    sentiment_confidence: float | None = None
    summary_tags: list[str] = Field(default_factory=list)


class DashboardPriorityReviewItem(DashboardRecentReviewItem):
    priority: Literal["high", "medium", "low"]
    reason: Literal[
        "negative_low_rating",
        "unreviewed_negative",
        "new_unreviewed",
        "follow_up_needed",
    ]


class DashboardActivityItem(BaseModel):
    review_id: UUID
    type: Literal["new_review", "negative_alert", "review_resolved", "positive_signal"]
    occurred_at: datetime | None = None
    source_type: str
    rating: int | None = None
    language: str | None = None
    status: ReviewStatus
    sentiment_label: Literal["positive", "neutral", "negative"] | None = None
    reviewer_name: str | None = None


class DashboardDistributions(BaseModel):
    sentiment: list[DashboardDistributionBucket] = Field(default_factory=list)
    ratings: list[DashboardDistributionBucket] = Field(default_factory=list)
    sources: list[DashboardDistributionBucket] = Field(default_factory=list)
    languages: list[DashboardDistributionBucket] = Field(default_factory=list)


class DashboardCapabilities(BaseModel):
    review_data_available: bool = True
    sales_data_available: bool = False
    sales_data_note: str = "Sales metrics are not available in the backend yet."


class DashboardSalesRecord(BaseModel):
    record_date: date
    revenue: int
    orders: int
    refund_count: int
    refund_value: int
    channel_revenue: dict[str, int] = Field(default_factory=dict)
    products: list[SalesProductPayload] = Field(default_factory=list)


class DashboardOverviewRead(BaseModel):
    business_id: UUID
    generated_at: datetime
    metrics: DashboardMetricSummary
    distributions: DashboardDistributions
    recent_reviews: list[DashboardRecentReviewItem] = Field(default_factory=list)
    priority_reviews: list[DashboardPriorityReviewItem] = Field(default_factory=list)
    activity_feed: list[DashboardActivityItem] = Field(default_factory=list)
    sales_records: list[DashboardSalesRecord] = Field(default_factory=list)
    capabilities: DashboardCapabilities = Field(default_factory=DashboardCapabilities)
