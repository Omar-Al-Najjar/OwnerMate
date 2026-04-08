from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


ReviewJobStatus = Literal["queued", "running", "needs_selection", "success", "failed"]


class BusinessLookupRequest(BaseModel):
    business_name: str = Field(
        ...,
        description="Name of the business to look up",
        examples=["Starbucks New York"],
    )
    lang: str = Field(
        "en",
        description="ISO 639-1 two-letter language code (e.g. 'en', 'ar', 'de', 'fr')",
    )

    @field_validator("business_name")
    @classmethod
    def business_name_must_not_be_empty(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("business_name must not be empty")
        return normalized

    @field_validator("lang")
    @classmethod
    def lang_must_be_two_chars(cls, value: str) -> str:
        normalized = value.strip().lower()
        if len(normalized) != 2:
            raise ValueError(
                "lang must be a 2-letter ISO 639-1 language code (e.g. 'en', 'ar', 'de')"
            )
        return normalized


class ReviewsRequest(BusinessLookupRequest):
    depth: int = Field(
        1,
        ge=1,
        le=10,
        description="Scroll depth in search results (more depth = more businesses matched)",
    )


class ReviewJobCreateRequest(ReviewsRequest):
    exact_place_locator: str | None = Field(
        default=None,
        description=(
            "Optional direct Google Maps locator for a specific place. "
            "When provided, the service tries to auto-select the matching place."
        ),
    )

    @field_validator("exact_place_locator", mode="before")
    @classmethod
    def normalize_exact_place_locator(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class ReviewCandidateSearchRequest(BusinessLookupRequest):
    depth: int = Field(
        1,
        ge=1,
        le=10,
        description="Scroll depth in search results while searching for Google place candidates",
    )


class Review(BaseModel):
    author: str | None = None
    rating: float | None = None
    text: str | None = None
    date: str | None = None


class ReviewCandidate(BaseModel):
    candidate_id: str
    title: str
    category: str | None = None
    address: str | None = None
    review_count: int | None = None
    review_rating: float | None = None
    place_id: str | None = None
    link: str | None = None


class PlaceResult(BaseModel):
    candidate: ReviewCandidate
    reviews: list[Review] = Field(default_factory=list)


class ReviewsResponse(BaseModel):
    business_name: str
    reviews: list[Review]


class ReviewCandidatesResponse(BaseModel):
    business_name: str
    message: str
    candidates: list[ReviewCandidate] = Field(default_factory=list)


class ReviewJobRead(BaseModel):
    job_id: str
    business_name: str
    status: ReviewJobStatus
    provider_status: str | None = None
    message: str
    candidates: list[ReviewCandidate] = Field(default_factory=list)
    selected_candidate_id: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class ReviewJobReviewsResponse(BaseModel):
    job_id: str
    business_name: str
    reviews: list[Review] = Field(default_factory=list)


class StoredReviewJob(BaseModel):
    job_id: str
    business_name: str
    exact_place_locator: str | None = None
    depth: int = 1
    lang: str = "en"
    status: ReviewJobStatus = "queued"
    provider_status: str | None = None
    message: str
    candidates: list[ReviewCandidate] = Field(default_factory=list)
    selected_candidate_id: str | None = None
    place_results: list[PlaceResult] = Field(default_factory=list)
    started_at: datetime | None = None
    finished_at: datetime | None = None
