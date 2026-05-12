from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .review import ReviewStatus
from .sales import SalesProductPayload

DashboardTimeRange = Literal["7d", "30d", "all"]
DashboardSentimentLabel = Literal["positive", "neutral", "negative"]


class DashboardOverviewQuery(BaseModel):
    business_id: UUID
    limit: int = Field(default=200, ge=1, le=500)
    recent_limit: int = Field(default=5, ge=1, le=10)
    priority_limit: int = Field(default=5, ge=1, le=10)
    activity_limit: int = Field(default=6, ge=1, le=12)
    range: DashboardTimeRange = "all"
    source: str | None = None
    language: str | None = None
    sentiment: DashboardSentimentLabel | None = None

    @field_validator("source", "language", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        return normalized or None


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
    sentiment_label: DashboardSentimentLabel | None = None
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
    sentiment_label: DashboardSentimentLabel | None = None
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


class DashboardFilterOptions(BaseModel):
    sources: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    sentiments: list[DashboardSentimentLabel] = Field(
        default_factory=lambda: ["positive", "neutral", "negative"]
    )


class DashboardReviewTimeSeriesPoint(BaseModel):
    date: date
    total_reviews: int = 0
    positive_reviews: int = 0
    positive_share: float = 0


class DashboardSalesRecord(BaseModel):
    record_date: date
    revenue: int
    orders: int
    refund_count: int
    refund_value: int
    channel_revenue: dict[str, int] = Field(default_factory=dict)
    products: list[SalesProductPayload] = Field(default_factory=list)


class DashboardSalesSummary(BaseModel):
    total_revenue: int = 0
    total_orders: int = 0
    average_order_value: float = 0
    refund_count: int = 0
    refund_value: int = 0
    refund_rate: float = 0


class DashboardComparisonMetric(BaseModel):
    current: float | None = 0
    previous: float | None = 0
    delta: float | None = 0
    percentage_change: float | None = None


class DashboardComparison(BaseModel):
    total_reviews: DashboardComparisonMetric = Field(default_factory=DashboardComparisonMetric)
    average_rating: DashboardComparisonMetric = Field(default_factory=DashboardComparisonMetric)
    positive_share: DashboardComparisonMetric = Field(default_factory=DashboardComparisonMetric)
    negative_share: DashboardComparisonMetric = Field(default_factory=DashboardComparisonMetric)
    pending_reviews: DashboardComparisonMetric = Field(default_factory=DashboardComparisonMetric)
    reviewed_reviews: DashboardComparisonMetric = Field(default_factory=DashboardComparisonMetric)
    responded_reviews: DashboardComparisonMetric = Field(default_factory=DashboardComparisonMetric)
    active_sources: DashboardComparisonMetric = Field(default_factory=DashboardComparisonMetric)
    total_revenue: DashboardComparisonMetric = Field(default_factory=DashboardComparisonMetric)
    total_orders: DashboardComparisonMetric = Field(default_factory=DashboardComparisonMetric)
    average_order_value: DashboardComparisonMetric = Field(default_factory=DashboardComparisonMetric)
    refund_count: DashboardComparisonMetric = Field(default_factory=DashboardComparisonMetric)
    refund_value: DashboardComparisonMetric = Field(default_factory=DashboardComparisonMetric)
    refund_rate: DashboardComparisonMetric = Field(default_factory=DashboardComparisonMetric)


class DashboardOverviewRead(BaseModel):
    business_id: UUID
    generated_at: datetime
    metrics: DashboardMetricSummary
    distributions: DashboardDistributions
    recent_reviews: list[DashboardRecentReviewItem] = Field(default_factory=list)
    priority_reviews: list[DashboardPriorityReviewItem] = Field(default_factory=list)
    activity_feed: list[DashboardActivityItem] = Field(default_factory=list)
    filter_options: DashboardFilterOptions = Field(default_factory=DashboardFilterOptions)
    review_timeseries: list[DashboardReviewTimeSeriesPoint] = Field(default_factory=list)
    comparison: DashboardComparison = Field(default_factory=DashboardComparison)
    sales_summary: DashboardSalesSummary = Field(default_factory=DashboardSalesSummary)
    sales_records: list[DashboardSalesRecord] = Field(default_factory=list)
    capabilities: DashboardCapabilities = Field(default_factory=DashboardCapabilities)
