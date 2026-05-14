from __future__ import annotations

from datetime import datetime, timezone
import unittest
from uuid import uuid4

from backend.app.core.exceptions import AppError
from backend.app.models.review import Review
from backend.app.models.sentiment_result import SentimentResult
from backend.app.schemas.sentiment import SentimentAnalyzeBatchRequest, SentimentAnalyzeRequest
from backend.app.services.sentiment import SentimentAnalysisService


class FakeSentimentProvider:
    provider_name = "mock_sentiment"

    def analyze(self, payload):
        text = payload.review_text.lower()
        if "slow" in text or "بطيء" in text:
            label = "negative"
            confidence = 0.88
            tags = ["service"]
        elif "great" in text or "رائع" in text:
            label = "positive"
            confidence = 0.91
            tags = ["customer_praise"]
        else:
            label = "neutral"
            confidence = 0.72
            tags = ["mixed_feedback"]

        return type(
            "ProviderResult",
            (),
            {
                "label": label,
                "confidence": confidence,
                "detected_language": payload.language_hint or "en",
                "summary_tags": tags,
                "model_name": self.provider_name,
            },
        )()


class FakeReviewRepository:
    def __init__(self, reviews: dict) -> None:
        self.reviews = reviews

    def get_by_id(self, review_id, *, business_id=None):
        review = self.reviews.get(review_id)
        if review is None:
            return None
        if business_id is not None and review.business_id != business_id:
            return None
        return review


class FakeSentimentResultRepository:
    def __init__(self) -> None:
        self.by_review_id: dict = {}
        self.saved = False
        self.rolled_back = False

    def add(self, sentiment_result: SentimentResult) -> SentimentResult:
        now = datetime.now(timezone.utc)
        sentiment_result.id = uuid4()
        sentiment_result.created_at = now
        sentiment_result.updated_at = now
        sentiment_result.processed_at = now
        self.by_review_id[sentiment_result.review_id] = sentiment_result
        return sentiment_result

    def get_latest_by_review_id(self, review_id):
        return self.by_review_id.get(review_id)

    def save(self) -> None:
        self.saved = True

    def rollback(self) -> None:
        self.rolled_back = True

    def refresh(self, sentiment_result) -> None:
        return None


class FakeAgentRunRepository:
    def __init__(self) -> None:
        self.added_runs = []
        self.saved = False
        self.rolled_back = False

    def add(self, agent_run):
        agent_run.id = uuid4()
        self.added_runs.append(agent_run)
        return agent_run

    def mark_success(self, agent_run, *, output_reference):
        agent_run.status = "success"
        agent_run.output_reference = output_reference
        return agent_run

    def mark_failed(self, agent_run, *, error_message):
        agent_run.status = "failed"
        agent_run.error_message = error_message
        return agent_run

    def save(self):
        self.saved = True

    def rollback(self):
        self.rolled_back = True

    def refresh(self, agent_run):
        return None


class SentimentAnalysisServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.review_id = uuid4()
        self.review = Review(
            id=self.review_id,
            business_id=uuid4(),
            source_type="google",
            source_review_id="r-1",
            review_text="Great service",
            language="en",
            rating=5,
            status="pending",
        )
        self.sentiment_repository = FakeSentimentResultRepository()
        self.agent_run_repository = FakeAgentRunRepository()
        self.service = SentimentAnalysisService(
            provider=FakeSentimentProvider(),
            review_repository=FakeReviewRepository({self.review_id: self.review}),
            sentiment_result_repository=self.sentiment_repository,
            agent_run_repository=self.agent_run_repository,
        )

    def test_analyze_review_persists_sentiment_result(self) -> None:
        result = self.service.analyze_review(
            SentimentAnalyzeRequest(review_id=self.review_id, language_hint="en")
        )

        self.assertEqual(result.review_id, self.review_id)
        self.assertEqual(result.sentiment_result.label, "positive")
        self.assertEqual(result.sentiment_result.model_name, "mock_sentiment")
        self.assertTrue(self.sentiment_repository.saved)
        self.assertTrue(self.agent_run_repository.saved)

    def test_analyze_review_reuses_existing_row_for_duplicate_analysis(self) -> None:
        existing = self.sentiment_repository.add(
            SentimentResult(
                review_id=self.review_id,
                label="neutral",
                confidence=0.5,
                detected_language="en",
                summary_tags=["old"],
                model_name="mock_sentiment",
            )
        )

        result = self.service.analyze_review(SentimentAnalyzeRequest(review_id=self.review_id))

        self.assertEqual(result.sentiment_result.id, existing.id)
        self.assertEqual(result.sentiment_result.label, "positive")
        self.assertEqual(len(self.sentiment_repository.by_review_id), 1)

    def test_analyze_batch_collects_failures_without_aborting(self) -> None:
        missing_review_id = uuid4()

        result = self.service.analyze_review_batch(
            SentimentAnalyzeBatchRequest(review_ids=[self.review_id, missing_review_id])
        )

        self.assertEqual(len(result.results), 1)
        self.assertEqual(len(result.failures), 1)
        self.assertEqual(result.failures[0].review_id, missing_review_id)
        self.assertEqual(result.failures[0].error_code, "REVIEW_NOT_FOUND")

    def test_get_review_sentiment_returns_latest_result(self) -> None:
        persisted = self.sentiment_repository.add(
            SentimentResult(
                review_id=self.review_id,
                label="negative",
                confidence=0.88,
                detected_language="ar",
                summary_tags=["service"],
                model_name="mock_sentiment",
            )
        )

        result = self.service.get_review_sentiment(self.review_id)

        self.assertEqual(result.id, persisted.id)
        self.assertEqual(result.label, "negative")

    def test_get_review_sentiment_raises_when_missing(self) -> None:
        with self.assertRaises(AppError) as raised:
            self.service.get_review_sentiment(self.review_id)

        self.assertEqual(raised.exception.code, "SENTIMENT_RESULT_NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
