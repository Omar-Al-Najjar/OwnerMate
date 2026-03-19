from collections import Counter, defaultdict
from typing import Protocol

from ...schemas.review import (
    ActionableNegativeFeedbackItem,
    ReviewIntelligenceResult,
    ReviewIntelligenceReviewItem,
    ReviewSummaryRequest,
    ReviewThemeSummary,
)


class ReviewIntelligenceProvider(Protocol):
    provider_name: str

    def summarize(
        self,
        *,
        payload: ReviewSummaryRequest,
        reviews: list[ReviewIntelligenceReviewItem],
    ) -> ReviewIntelligenceResult:
        ...


class MockReviewIntelligenceProvider:
    provider_name = "mock_review_intelligence"

    FALLBACK_NEGATIVE_THEME = "needs attention"
    FALLBACK_POSITIVE_THEME = "customer praise"

    def summarize(
        self,
        *,
        payload: ReviewSummaryRequest,
        reviews: list[ReviewIntelligenceReviewItem],
    ) -> ReviewIntelligenceResult:
        negative_reviews = [
            review
            for review in reviews
            if review.sentiment_label == "negative"
            or (review.sentiment_label is None and review.rating is not None and review.rating <= 2)
        ]
        positive_reviews = [
            review
            for review in reviews
            if review.sentiment_label == "positive"
            or (review.sentiment_label is None and review.rating is not None and review.rating >= 4)
        ]

        pain_points = self._build_theme_summaries(
            reviews=negative_reviews,
            fallback_theme=self.FALLBACK_NEGATIVE_THEME,
            limit=payload.max_themes,
        )
        praise_themes = self._build_theme_summaries(
            reviews=positive_reviews,
            fallback_theme=self.FALLBACK_POSITIVE_THEME,
            limit=payload.max_themes,
        )
        actionable_negative_feedback = self._build_actionable_feedback(
            reviews=negative_reviews,
            limit=payload.max_actionable_items,
        )

        return ReviewIntelligenceResult(
            pain_points=pain_points,
            praise_themes=praise_themes,
            actionable_negative_feedback=actionable_negative_feedback,
        )

    def _build_theme_summaries(
        self,
        *,
        reviews: list[ReviewIntelligenceReviewItem],
        fallback_theme: str,
        limit: int,
    ) -> list[ReviewThemeSummary]:
        theme_counts: Counter[str] = Counter()
        theme_reviews: dict[str, list[ReviewIntelligenceReviewItem]] = defaultdict(list)

        for review in reviews:
            themes = review.summary_tags or [fallback_theme]
            for theme in themes:
                normalized_theme = theme.strip().lower()
                if not normalized_theme:
                    continue
                theme_counts[normalized_theme] += 1
                theme_reviews[normalized_theme].append(review)

        results: list[ReviewThemeSummary] = []
        for theme, count in theme_counts.most_common(limit):
            related_reviews = theme_reviews[theme]
            results.append(
                ReviewThemeSummary(
                    theme=theme,
                    review_count=count,
                    sentiment_labels=sorted(
                        {
                            review.sentiment_label
                            for review in related_reviews
                            if review.sentiment_label is not None
                        }
                    ),
                    sample_review_ids=[review.review_id for review in related_reviews[:3]],
                    sample_excerpts=[
                        self._excerpt(review.review_text) for review in related_reviews[:3]
                    ],
                )
            )

        return results

    def _build_actionable_feedback(
        self, *, reviews: list[ReviewIntelligenceReviewItem], limit: int
    ) -> list[ActionableNegativeFeedbackItem]:
        sorted_reviews = sorted(
            reviews,
            key=lambda review: (
                review.sentiment_confidence or 0,
                -(review.rating or 5),
                len(review.review_text),
            ),
            reverse=True,
        )

        items: list[ActionableNegativeFeedbackItem] = []
        for review in sorted_reviews[:limit]:
            issue = (review.summary_tags[0] if review.summary_tags else self.FALLBACK_NEGATIVE_THEME)
            items.append(
                ActionableNegativeFeedbackItem(
                    review_id=review.review_id,
                    source_type=review.source_type,
                    language=review.language,
                    rating=review.rating,
                    sentiment_label=review.sentiment_label,
                    confidence=review.sentiment_confidence,
                    issue=issue,
                    review_excerpt=self._excerpt(review.review_text),
                )
            )
        return items

    def _excerpt(self, text: str, *, max_length: int = 160) -> str:
        normalized = " ".join(text.split())
        if len(normalized) <= max_length:
            return normalized
        return f"{normalized[: max_length - 3].rstrip()}..."
