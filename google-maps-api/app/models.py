from pydantic import BaseModel, Field, field_validator


class ReviewsRequest(BaseModel):
    business_name: str = Field(..., description="Name of the business to look up", examples=["Starbucks New York"])
    depth: int = Field(1, ge=1, le=10, description="Scroll depth in search results (more depth = more businesses matched)")
    lang: str = Field("en", description="ISO 639-1 two-letter language code (e.g. 'en', 'ar', 'de', 'fr')")

    @field_validator("lang")
    @classmethod
    def lang_must_be_two_chars(cls, v: str) -> str:
        if len(v) != 2:
            raise ValueError("lang must be a 2-letter ISO 639-1 language code (e.g. 'en', 'ar', 'de')")
        return v.lower()


class Review(BaseModel):
    author: str | None = None
    rating: float | None = None
    text: str | None = None


class ReviewsResponse(BaseModel):
    business_name: str
    reviews: list[Review]
