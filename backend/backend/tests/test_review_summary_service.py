from __future__ import annotations

from datetime import datetime, timezone
import unittest
from uuid import uuid4

from backend.app.core.exceptions import AppError
from backend.app.models.review import Review
from backend.app.models.sentiment_result import SentimentResult
from backend.app.schemas.review import ReviewSummaryRequest
from backend.app.services.providers.review_intelligence import MockReviewIntelligenceProvider
from backend.app.services.review_summary import ReviewSummaryService


class FakeBusinessRepository:
    def __init__(self, existing_business_ids: set) -> None:
        self.existing_business_ids = existing_business_ids

    def get_by_id(self, business_id):
        if business_id in self.existing_business_ids:
            return object()
        return None


class FakeReviewRepository:
    def __init__(self, reviews: list[Review]) -> None:
        self.reviews = reviews
        self.last_list_kwargs = None

    def list_reviews(self, **kwargs):
        self.last_list_kwargs = kwargs
        return self.reviews[: kwargs.get("limit", len(self.reviews))]


class FakeSentimentResultRepository:
    def __init__(self, latest_by_review_id: dict) -> None:
        self.latest_by_review_id = latest_by_review_id

    def get_latest_by_review_ids(self, review_ids):
        return {
            review_id: sentiment
            for review_id, sentiment in self.latest_by_review_id.items()
            if review_id in set(review_ids)
        }


class FakeAgentRunRepository:
    def __init__(self) -> None:
        self.saved = False
        self.rolled_back = False

    def add(self, agent_run):
        agent_run.id = uuid4()
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


class ReviewSummaryServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.business_id = uuid4()
        now = datetime.now(timezone.utc)
        self.review_a = Review(
            id=uuid4(),
            business_id=self.business_id,
            source_type="google",
            source_review_id="r-1",
            review_text="Slow service and cold food.",
            language="en",
            rating=1,
            status="pending",
            review_created_at=now,
        )
        self.review_b = Review(
            id=uuid4(),
            business_id=self.business_id,
            source_type="facebook",
            source_review_id="r-2",
            review_text="Friendly staff and amazing food.",
            language="en",
            rating=5,
            status="reviewed",
            review_created_at=now,
        )
        self.sentiments = {
            self.review_a.id: SentimentResult(
                review_id=self.review_a.id,
                label="negative",
                confidence=0.92,
                detected_language="en",
                summary_tags=["service", "food"],
                model_name="mock_sentiment",
            ),
            self.review_b.id: SentimentResult(
                review_id=self.review_b.id,
                label="positive",
                confidence=0.89,
                detected_language="en",
                summary_tags=["customer_praise", "food"],
                model_name="mock_sentiment",
            ),
        }
        self.agent_run_repository = FakeAgentRunRepository()
        self.service = ReviewSummaryService(
            review_repository=FakeReviewRepository([self.review_a, self.review_b]),
            business_repository=FakeBusinessRepository({self.business_id}),
            sentiment_result_repository=FakeSentimentResultRepository(self.sentiments),
            intelligence_provider=MockReviewIntelligenceProvider(),
            agent_run_repository=self.agent_run_repository,
        )

    def test_get_summary_builds_grounded_review_intelligence(self) -> None:
        result, agent_run_id = self.service.get_summary(
            ReviewSummaryRequest(
                business_id=self.business_id,
                limit=10,
                max_themes=3,
                max_actionable_items=3,
            )
        )

        self.assertEqual(result.total_reviews, 2)
        self.assertEqual(result.average_rating, 3.0)
        self.assertEqual(result.intelligence.pain_points[0].theme, "service")
        self.assertIn(self.review_a.id, result.intelligence.pain_points[0].sample_review_ids)
        self.assertEqual(result.intelligence.praise_themes[0].theme, "customer_praise")
        self.assertEqual(
            result.intelligence.actionable_negative_feedback[0].review_id,
            self.review_a.id,
        )
        self.assertIn("Slow service", result.intelligence.actionable_negative_feedback[0].review_excerpt)
        self.assertTrue(agent_run_id)
        self.assertTrue(self.agent_run_repository.saved)

    def test_get_summary_raises_for_missing_business(self) -> None:
        service = ReviewSummaryService(
            review_repository=FakeReviewRepository([]),
            business_repository=FakeBusinessRepository(set()),
            sentiment_result_repository=FakeSentimentResultRepository({}),
            intelligence_provider=MockReviewIntelligenceProvider(),
            agent_run_repository=FakeAgentRunRepository(),
        )

        with self.assertRaises(AppError) as raised:
            service.get_summary(ReviewSummaryRequest(business_id=uuid4()))

        self.assertEqual(raised.exception.code, "BUSINESS_NOT_FOUND")

    def test_mock_provider_stays_within_review_scope(self) -> None:
        result, _ = self.service.get_summary(
            ReviewSummaryRequest(
                business_id=self.business_id,
                limit=10,
                max_themes=3,
                max_actionable_items=3,
            )
        )

        serialized = result.model_dump_json().lower()
        self.assertNotIn("trend", serialized)
        self.assertNotIn("forecast", serialized)
        self.assertNotIn("predict", serialized)


if __name__ == "__main__":
    unittest.main()
