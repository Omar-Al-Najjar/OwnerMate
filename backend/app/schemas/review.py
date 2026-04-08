from datetime import datetime
from enum import Enum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .sentiment import SentimentResultRead

ReviewStatus = Literal["pending", "reviewed", "responded"]
FacebookRecommendation = Literal["positive", "negative", "neutral"]
GoogleImportJobStatus = Literal["queued", "running", "needs_selection", "success", "failed"]


class ReviewUploadFormat(str, Enum):
    CSV = "csv"
    XLSX = "xlsx"
    JSON = "json"
    TXT = "txt"
    SQLITE = "sqlite"


class ReviewListQuery(BaseModel):
    business_id: UUID
    review_source_id: UUID | None = None
    source_type: str | None = None
    status: ReviewStatus | None = None
    language: str | None = None
    min_rating: int | None = Field(default=None, ge=1, le=5)
    max_rating: int | None = Field(default=None, ge=1, le=5)
    reviewer_name: str | None = None
    search_text: str | None = None
    created_from: datetime | None = None
    created_to: datetime | None = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)

    @field_validator(
        "source_type",
        "language",
        "reviewer_name",
        "search_text",
        mode="before",
    )
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        return normalized or None

    @field_validator("max_rating")
    @classmethod
    def validate_rating_range(
        cls, value: int | None, info
    ) -> int | None:
        min_rating = info.data.get("min_rating")
        if value is not None and min_rating is not None and value < min_rating:
            raise ValueError("max_rating must be greater than or equal to min_rating.")
        return value

    @field_validator("created_to")
    @classmethod
    def validate_created_range(
        cls, value: datetime | None, info
    ) -> datetime | None:
        created_from = info.data.get("created_from")
        if value is not None and created_from is not None and value < created_from:
            raise ValueError("created_to must be greater than or equal to created_from.")
        return value


class ReviewBusinessScope(BaseModel):
    business_id: UUID


class ReviewImportItem(BaseModel):
    source_review_id: str
    reviewer_name: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    language: str | None = None
    review_text: str
    review_created_at: datetime | None = None
    status: ReviewStatus = "pending"
    response_status: str | None = None
    source_metadata: dict[str, Any] | None = None

    @field_validator("source_review_id", "review_text")
    @classmethod
    def require_non_empty_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value must not be empty.")
        return normalized

    @field_validator("reviewer_name", "language", "response_status", mode="before")
    @classmethod
    def normalize_nullable_strings(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        if normalized and normalized == value:
            return normalized
        return normalized


class ReviewImportRequest(BaseModel):
    business_id: UUID
    review_source_id: UUID | None = None
    source: str
    reviews: list[ReviewImportItem] = Field(min_length=1)

    @field_validator("source")
    @classmethod
    def normalize_source(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Source must not be empty.")
        return normalized


class ReviewUploadImportRequest(BaseModel):
    business_id: UUID
    review_source_id: UUID | None = None
    source: str

    @field_validator("source")
    @classmethod
    def normalize_source(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Source must not be empty.")
        return normalized


class ReviewUploadPreprocessingSummary(BaseModel):
    original_filename: str
    detected_format: ReviewUploadFormat
    staged_format: Literal["csv"] = "csv"
    source_row_count: int
    mapped_columns: dict[str, str]
    selected_source_name: str | None = None


class ReviewSourceFetchOptions(BaseModel):
    limit: int = Field(default=50, ge=1, le=100)
    since: datetime | None = None


class GoogleReviewImportConnection(BaseModel):
    account_id: str | None = None
    business_name: str | None = None
    lang: str | None = None
    location_id: str | None = None
    depth: int = Field(default=1, ge=1, le=10)

    @field_validator(
        "account_id",
        "business_name",
        "location_id",
        mode="before",
    )
    @classmethod
    def normalize_nullable_strings(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("lang", mode="before")
    @classmethod
    def normalize_lang(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        return normalized or None

    @field_validator("lang")
    @classmethod
    def validate_lang(cls, value: str | None) -> str | None:
        if value is not None and len(value) != 2:
            raise ValueError("lang must be a 2-letter ISO 639-1 language code.")
        return value


class FacebookReviewImportConnection(BaseModel):
    page_id: str | None = None

    @field_validator("page_id", mode="before")
    @classmethod
    def normalize_page_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class GoogleFetchedReview(BaseModel):
    review_id: str
    reviewer_name: str | None = None
    star_rating: int | None = Field(default=None, ge=1, le=5)
    comment: str
    language_code: str | None = None
    create_time: datetime | None = None
    location_id: str | None = None
    location_name: str | None = None
    original_payload: dict[str, Any] | None = None

    @field_validator("review_id", "comment")
    @classmethod
    def require_non_empty_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value must not be empty.")
        return normalized

    @field_validator(
        "reviewer_name",
        "language_code",
        "location_id",
        "location_name",
        mode="before",
    )
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class FacebookFetchedReview(BaseModel):
    review_id: str
    reviewer_name: str | None = None
    recommendation: FacebookRecommendation | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    review_text: str
    language_code: str | None = None
    created_time: datetime | None = None
    page_id: str | None = None
    original_payload: dict[str, Any] | None = None

    @field_validator("review_id", "review_text")
    @classmethod
    def require_non_empty_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value must not be empty.")
        return normalized

    @field_validator("reviewer_name", "language_code", "page_id", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class GoogleReviewImportSourceRequest(BaseModel):
    business_id: UUID
    review_source_id: UUID | None = None
    connection: GoogleReviewImportConnection | None = None
    fetch: ReviewSourceFetchOptions = Field(default_factory=ReviewSourceFetchOptions)
    mock_reviews: list[GoogleFetchedReview] = Field(default_factory=list)


class FacebookReviewImportSourceRequest(BaseModel):
    business_id: UUID
    review_source_id: UUID | None = None
    connection: FacebookReviewImportConnection | None = None
    fetch: ReviewSourceFetchOptions = Field(default_factory=ReviewSourceFetchOptions)
    mock_reviews: list[FacebookFetchedReview] = Field(default_factory=list)


class ReviewStatusUpdateRequest(BaseModel):
    status: ReviewStatus


class ReviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    review_source_id: UUID | None
    source_type: str
    source_review_id: str
    reviewer_name: str | None
    rating: int | None
    language: str | None
    review_text: str
    source_metadata: dict[str, Any] | None
    review_created_at: datetime | None
    ingested_at: datetime
    status: ReviewStatus
    response_status: str | None
    sentiment: SentimentResultRead | None = None
    created_at: datetime
    updated_at: datetime


class ReviewDetailResponse(ReviewRead):
    pass


class ReviewImportDuplicate(BaseModel):
    source_review_id: str
    reason: Literal["duplicate_in_payload", "already_imported"]


class ReviewImportResult(BaseModel):
    source: str
    business_id: UUID
    review_source_id: UUID | None = None
    requested_count: int
    imported_count: int
    duplicate_count: int
    processed_count: int
    imported_reviews: list[ReviewRead]
    duplicates: list[ReviewImportDuplicate]


class GoogleReviewImportCandidate(BaseModel):
    candidate_id: str
    title: str
    category: str | None = None
    address: str | None = None
    review_count: int | None = None
    review_rating: float | None = None
    place_id: str | None = None
    link: str | None = None


class GoogleReviewImportJobRead(BaseModel):
    agent_run_id: UUID
    business_id: UUID
    status: GoogleImportJobStatus
    business_name: str
    provider_name: str
    provider_job_id: str | None = None
    provider_status: str | None = None
    message: str
    imported_count: int | None = None
    duplicate_count: int | None = None
    processed_count: int | None = None
    candidates: list[GoogleReviewImportCandidate] = Field(default_factory=list)
    selected_candidate_id: str | None = None
    imported_reviews: list[ReviewRead] = Field(default_factory=list)
    duplicates: list[ReviewImportDuplicate] = Field(default_factory=list)
    started_at: datetime | None = None
    finished_at: datetime | None = None


class GoogleReviewImportSelectionRequest(BaseModel):
    candidate_id: str

    @field_validator("candidate_id")
    @classmethod
    def require_candidate_id(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("candidate_id must not be empty.")
        return normalized


class ReviewSummaryRequest(BaseModel):
    business_id: UUID
    limit: int = Field(default=100, ge=1, le=500)
    max_themes: int = Field(default=5, ge=1, le=10)
    max_actionable_items: int = Field(default=5, ge=1, le=20)


class ReviewIntelligenceReviewItem(BaseModel):
    review_id: UUID
    source_type: str
    language: str | None = None
    rating: int | None = None
    review_text: str
    sentiment_label: Literal["positive", "neutral", "negative"] | None = None
    sentiment_confidence: float | None = None
    summary_tags: list[str] = Field(default_factory=list)


class ReviewThemeSummary(BaseModel):
    theme: str
    review_count: int
    sentiment_labels: list[Literal["positive", "neutral", "negative"]] = Field(
        default_factory=list
    )
    sample_review_ids: list[UUID] = Field(default_factory=list)
    sample_excerpts: list[str] = Field(default_factory=list)


class ActionableNegativeFeedbackItem(BaseModel):
    review_id: UUID
    source_type: str
    language: str | None = None
    rating: int | None = None
    sentiment_label: Literal["positive", "neutral", "negative"] | None = None
    confidence: float | None = None
    issue: str
    review_excerpt: str


class ReviewIntelligenceResult(BaseModel):
    pain_points: list[ReviewThemeSummary] = Field(default_factory=list)
    praise_themes: list[ReviewThemeSummary] = Field(default_factory=list)
    actionable_negative_feedback: list[ActionableNegativeFeedbackItem] = Field(
        default_factory=list
    )


class ReviewSummaryResult(BaseModel):
    business_id: UUID
    total_reviews: int
    average_rating: float | None
    status_counts: dict[str, int]
    language_counts: dict[str, int]
    source_counts: dict[str, int]
    latest_review_ids: list[UUID]
    intelligence: ReviewIntelligenceResult = Field(
        default_factory=ReviewIntelligenceResult
    )
