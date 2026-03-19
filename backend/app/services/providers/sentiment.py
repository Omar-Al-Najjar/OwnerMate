from typing import Protocol

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
