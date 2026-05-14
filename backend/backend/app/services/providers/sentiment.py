from typing import Any, Protocol

import httpx
from fastapi import status

from ...core.exceptions import AppError

from ...schemas.sentiment import SentimentProviderRequest, SentimentProviderResult


class SentimentAnalysisProvider(Protocol):
    provider_name: str

    def analyze(self, payload: SentimentProviderRequest) -> SentimentProviderResult:
        ...


class MockSentimentProvider:
    provider_name = "mock_sentiment"

    POSITIVE_KEYWORDS = {"great", "excellent", "amazing", "love", "friendly", "good"}
    NEGATIVE_KEYWORDS = {"bad", "terrible", "slow", "late", "awful", "poor", "rude"}
    POSITIVE_KEYWORDS_AR = {"ممتاز", "رائع", "جميل", "أحب", "مميز", "جيد"}
    NEGATIVE_KEYWORDS_AR = {"سيء", "سيئ", "بطيء", "متأخر", "ضعيف", "فظ", "مشكلة"}

    def analyze(self, payload: SentimentProviderRequest) -> SentimentProviderResult:
        text = payload.review_text.lower()
        detected_language = self._detect_language(payload)

        positive_hits = sum(1 for keyword in self.POSITIVE_KEYWORDS if keyword in text)
        negative_hits = sum(1 for keyword in self.NEGATIVE_KEYWORDS if keyword in text)
        positive_hits += sum(1 for keyword in self.POSITIVE_KEYWORDS_AR if keyword in text)
        negative_hits += sum(1 for keyword in self.NEGATIVE_KEYWORDS_AR if keyword in text)

        if payload.rating is not None:
            if payload.rating >= 4:
                positive_hits += 1
            elif payload.rating <= 2:
                negative_hits += 1

        if negative_hits > positive_hits:
            label = "negative"
            confidence = 0.84
            summary_tags = ["needs_attention"]
        elif positive_hits > negative_hits:
            label = "positive"
            confidence = 0.86
            summary_tags = ["customer_praise"]
        else:
            label = "neutral"
            confidence = 0.74
            summary_tags = ["mixed_feedback"]

        if "service" in text:
            summary_tags.append("service")
        if "food" in text:
            summary_tags.append("food")
        if "delivery" in text:
            summary_tags.append("delivery")
        if "خدمة" in text:
            summary_tags.append("service")
        if "طعام" in text or "أكل" in text:
            summary_tags.append("food")
        if "توصيل" in text or "طلب" in text:
            summary_tags.append("delivery")

        return SentimentProviderResult(
            label=label,
            confidence=confidence,
            detected_language=detected_language,
            summary_tags=sorted(set(summary_tags)),
            model_name=self.provider_name,
        )

    def _detect_language(self, payload: SentimentProviderRequest) -> str:
        if payload.language_hint:
            return payload.language_hint.lower()
        if any("\u0600" <= char <= "\u06ff" for char in payload.review_text):
            return "ar"
        return "en"


class SentimentApiProvider:
    provider_name = "sentiment_api"

    def __init__(self, *, base_url: str, timeout_seconds: int = 60) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def analyze(self, payload: SentimentProviderRequest) -> SentimentProviderResult:
        try:
            response = httpx.post(
                f"{self.base_url}/predict",
                json={"text": payload.review_text},
                timeout=self.timeout_seconds,
            )
        except httpx.HTTPError as exc:
            raise AppError(
                code="SENTIMENT_PROVIDER_ERROR",
                message="Failed to reach the sentiment analysis service.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={"reason": str(exc)},
            ) from exc

        body = self._parse_response_body(response)
        label = self._normalize_label(body.get("label"))
        if label is None:
            raise AppError(
                code="SENTIMENT_PROVIDER_ERROR",
                message="Sentiment analysis service returned an invalid label.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={"response": body},
            )

        return SentimentProviderResult(
            label=label,
            confidence=self._normalize_confidence(body.get("confidence")),
            detected_language=self._detect_language(payload),
            summary_tags=[],
            model_name=self.provider_name,
        )

    def _parse_response_body(self, response: httpx.Response) -> dict[str, Any]:
        try:
            body = response.json()
        except ValueError as exc:
            raise AppError(
                code="SENTIMENT_PROVIDER_ERROR",
                message="Sentiment analysis service returned non-JSON data.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={"status_code": response.status_code},
            ) from exc

        if response.status_code == 503:
            raise AppError(
                code="SENTIMENT_MODEL_NOT_READY",
                message="Sentiment model is still loading.",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                details={"response": body},
            )

        if response.status_code >= 400:
            raise AppError(
                code="SENTIMENT_PROVIDER_ERROR",
                message=(
                    body.get("detail")
                    if isinstance(body, dict) and body.get("detail")
                    else "Sentiment analysis service request failed."
                ),
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={"status_code": response.status_code, "response": body},
            )

        if not isinstance(body, dict):
            raise AppError(
                code="SENTIMENT_PROVIDER_ERROR",
                message="Sentiment analysis service returned an invalid payload.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={"response": body},
            )

        return body

    def _normalize_label(self, value: Any) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip().lower()
        mapping = {
            "negative": "negative",
            "neutral": "neutral",
            "positive": "positive",
        }
        return mapping.get(normalized)

    def _normalize_confidence(self, value: Any) -> float | None:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _detect_language(self, payload: SentimentProviderRequest) -> str:
        if payload.language_hint:
            return payload.language_hint.lower()
        if any("\u0600" <= char <= "\u06ff" for char in payload.review_text):
            return "ar"
        return "en"
