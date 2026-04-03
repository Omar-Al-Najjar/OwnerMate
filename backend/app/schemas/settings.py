from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


ThemePreference = Literal["light", "dark", "system"]
LanguagePreference = Literal["ar", "en"]


class SettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    language_preference: LanguagePreference | None = None
    theme_preference: ThemePreference | None = None
    updated_at: datetime


class ThemePreferenceUpdateRequest(BaseModel):
    theme_preference: ThemePreference

    @field_validator("theme_preference", mode="before")
    @classmethod
    def normalize_theme(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Theme preference must not be empty.")
        return normalized


class LanguagePreferenceUpdateRequest(BaseModel):
    language_preference: LanguagePreference

    @field_validator("language_preference", mode="before")
    @classmethod
    def normalize_language(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Language preference must not be empty.")
        return normalized


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None

    @field_validator("full_name", mode="before")
    @classmethod
    def normalize_full_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None
