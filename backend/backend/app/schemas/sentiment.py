from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


SentimentLabel = Literal["positive", "neutral", "negative"]


class SentimentAnalyzeRequest(BaseModel):
    review_id: UUID
    language_hint: str | None = None

    @field_validator("language_hint", mode="before")
    @classmethod
    def normalize_language_hint(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        return normalized or None


class SentimentAnalyzeBatchRequest(BaseModel):
    review_ids: list[UUID] = Field(min_length=1)
    language_hint: str | None = None

    @field_validator("language_hint", mode="before")
    @classmethod
    def normalize_batch_language_hint(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        return normalized or None


class SentimentProviderRequest(BaseModel):
    review_id: UUID
    review_text: str
    rating: int | None = None
    language_hint: str | None = None


class SentimentProviderResult(BaseModel):
    label: SentimentLabel
    confidence: float | None = None
    detected_language: str | None = None
    summary_tags: list[str] = Field(default_factory=list)
    model_name: str


class SentimentResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    review_id: UUID
    label: SentimentLabel
    confidence: float | None
    detected_language: str | None
    summary_tags: list[str] | None
    model_name: str | None
    processed_at: datetime
    created_at: datetime


class SentimentAnalysisResult(BaseModel):
    review_id: UUID
    sentiment_result: SentimentResultRead
    agent_run_id: UUID


class SentimentFailureResult(BaseModel):
    review_id: UUID
    error_code: str
    message: str


class SentimentAnalysisBatchResult(BaseModel):
    results: list[SentimentAnalysisResult]
    failures: list[SentimentFailureResult] = Field(default_factory=list)


class SentimentProviderSettings(BaseModel):
    provider_name: str
    mode: str

    @field_validator("provider_name", "mode")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return value.strip().lower()
