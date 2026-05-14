from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


ContentType = Literal["review_reply", "marketing_copy"]


class ContentLanguageMixin(BaseModel):
    language: str
    tone: str | None = None

    @field_validator("language")
    @classmethod
    def normalize_language(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Language must not be empty.")
        return normalized

    @field_validator("tone", mode="before")
    @classmethod
    def normalize_optional_tone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized.lower() or None


class GenerateReplyRequest(ContentLanguageMixin):
    business_id: UUID
    review_id: UUID
    business_context: str | None = None

    @field_validator("business_context", mode="before")
    @classmethod
    def normalize_business_context(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class GenerateMarketingCopyRequest(ContentLanguageMixin):
    business_id: UUID
    business_context: str | None = None
    prompt_context: dict | None = None

    @field_validator("business_context", mode="before")
    @classmethod
    def normalize_business_context(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class RegenerateContentRequest(ContentLanguageMixin):
    content_id: UUID
    business_context: str | None = None
    prompt_context: dict | None = None

    @field_validator("business_context", mode="before")
    @classmethod
    def normalize_business_context(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class SaveGeneratedContentRequest(BaseModel):
    content_id: UUID
    edited_text: str
    created_by_user_id: UUID | None = None

    @field_validator("edited_text")
    @classmethod
    def require_non_empty_edited_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Edited text must not be empty.")
        return normalized


class ContentProviderRequest(BaseModel):
    content_type: ContentType
    business_id: UUID
    language: str
    tone: str | None = None
    business_context: str | None = None
    review_id: UUID | None = None
    review_text: str | None = None
    reviewer_name: str | None = None
    rating: int | None = None
    prompt_context: dict | None = None


class ContentProviderResult(BaseModel):
    generated_text: str
    model_name: str
    prompt_context: dict | None = None


class GeneratedContentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    review_id: UUID | None
    content_type: ContentType
    language: str
    tone: str | None
    prompt_context: dict | None
    generated_text: str
    edited_text: str | None
    created_by_user_id: UUID | None
    created_at: datetime
    updated_at: datetime


class ContentGenerationResult(BaseModel):
    generated_content: GeneratedContentRead
    agent_run_id: UUID


class SavedGeneratedContentResult(BaseModel):
    generated_content: GeneratedContentRead


class ContentProviderSettings(BaseModel):
    provider_name: str
    mode: str

    @field_validator("provider_name", "mode")
    @classmethod
    def normalize_provider_text(cls, value: str) -> str:
        return value.strip().lower()
