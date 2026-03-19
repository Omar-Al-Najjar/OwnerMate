from ..core.config import get_settings
from .providers import (
    ContentGenerationProvider,
    FacebookReviewImportProvider,
    GoogleReviewImportProvider,
    MockContentGenerationProvider,
    MockFacebookReviewImportProvider,
    MockGoogleReviewImportProvider,
    MockReviewIntelligenceProvider,
    MockSentimentProvider,
    ReviewIntelligenceProvider,
    SentimentAnalysisProvider,
)


def get_sentiment_provider() -> SentimentAnalysisProvider:
    settings = get_settings()
    if settings.sentiment_provider == "mock":
        return MockSentimentProvider()
    raise ValueError(f"Unsupported sentiment provider: {settings.sentiment_provider}")


def get_content_provider() -> ContentGenerationProvider:
    settings = get_settings()
    if settings.content_provider == "mock":
        return MockContentGenerationProvider()
    raise ValueError(f"Unsupported content provider: {settings.content_provider}")


def get_google_review_provider() -> GoogleReviewImportProvider:
    settings = get_settings()
    if settings.google_review_provider == "mock":
        return MockGoogleReviewImportProvider()
    raise ValueError(f"Unsupported Google review provider: {settings.google_review_provider}")


def get_facebook_review_provider() -> FacebookReviewImportProvider:
    settings = get_settings()
    if settings.facebook_review_provider == "mock":
        return MockFacebookReviewImportProvider()
    raise ValueError(
        f"Unsupported Facebook review provider: {settings.facebook_review_provider}"
    )


def get_review_intelligence_provider() -> ReviewIntelligenceProvider:
    settings = get_settings()
    if settings.review_intelligence_provider == "mock":
        return MockReviewIntelligenceProvider()
    raise ValueError(
        "Unsupported review intelligence provider: "
        f"{settings.review_intelligence_provider}"
    )
