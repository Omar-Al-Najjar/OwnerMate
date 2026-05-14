from __future__ import annotations

from datetime import datetime, timezone
import unittest
from uuid import uuid4

from backend.app.core.exceptions import AppError
from backend.app.models.review import Review
from backend.app.models.sentiment_result import SentimentResult
from backend.app.schemas.review import (
    ReviewBusinessScope,
    ReviewImportItem,
    ReviewImportRequest,
    ReviewListQuery,
    ReviewStatusUpdateRequest,
)
from backend.app.services.review import ReviewService
from backend.app.schemas.sentiment import SentimentAnalysisBatchResult, SentimentAnalysisResult, SentimentResultRead


class FakeBusinessRepository:
    def __init__(self, existing_business_ids: set):
        self.existing_business_ids = existing_business_ids

    def get_by_id(self, business_id):
        if business_id in self.existing_business_ids:
            return object()
        return None


class FakeReviewRepository:
    def __init__(self, existing_source_ids: set[str] | None = None) -> None:
        self.existing_source_ids = existing_source_ids or set()
        self.added_reviews: list[Review] = []
        self.listed_reviews: list[Review] = []
        self.last_list_kwargs: dict | None = None
        self.saved = False
        self.rolled_back = False
        self.review_by_id: dict = {}

    def list_reviews(self, **kwargs):
        self.last_list_kwargs = kwargs
        return self.listed_reviews

    def get_by_id(self, review_id, *, business_id=None):
        review = self.review_by_id.get(review_id)
        if review is None:
            return None
        if business_id is not None and review.business_id != business_id:
            return None
        return review

    def get_existing_source_ids(self, **kwargs):
        requested = set(kwargs["source_review_ids"])
        return self.existing_source_ids & requested

    def add_many(self, reviews):
        now = datetime.now(timezone.utc)
        for review in reviews:
            review.id = uuid4()
            review.ingested_at = now
            review.created_at = now
            review.updated_at = now
        self.added_reviews.extend(reviews)
        return reviews

    def save(self) -> None:
        self.saved = True

    def rollback(self) -> None:
        self.rolled_back = True

    def refresh(self, review) -> None:
        return None


class FakeSentimentResultRepository:
    def __init__(self) -> None:
        self.by_review_id: dict = {}

    def get_latest_by_review_ids(self, review_ids):
        return {
            review_id: self.by_review_id.get(review_id)
            for review_id in review_ids
            if self.by_review_id.get(review_id) is not None
        }

    def get_latest_by_review_id(self, review_id):
        return self.by_review_id.get(review_id)


class FakeSentimentAnalysisService:
    def __init__(self, repository: FakeSentimentResultRepository) -> None:
        self.repository = repository
        self.analyzed_review_ids: list = []
        self.batch_review_ids: list = []

    def analyze_review(self, payload):
        self.analyzed_review_ids.append(payload.review_id)
        now = datetime.now(timezone.utc)
        result = SentimentResult(
            review_id=payload.review_id,
            label="positive",
            confidence=0.91,
            detected_language=payload.language_hint or "en",
            summary_tags=["customer_praise"],
            model_name="mock_sentiment",
        )
        result.id = uuid4()
        result.created_at = now
        result.updated_at = now
        result.processed_at = now
        self.repository.by_review_id[payload.review_id] = result
        return SentimentAnalysisResult(
            review_id=payload.review_id,
            sentiment_result=SentimentResultRead.model_validate(result),
            agent_run_id=uuid4(),
        )

    def analyze_review_batch(self, payload):
        self.batch_review_ids.extend(payload.review_ids)
        results = [self.analyze_review(type("Payload", (), {"review_id": review_id, "language_hint": payload.language_hint})()) for review_id in payload.review_ids]
        return SentimentAnalysisBatchResult(results=results, failures=[])


class ReviewServiceTests(unittest.TestCase):
    def test_import_reviews_normalizes_and_skips_duplicates(self) -> None:
        business_id = uuid4()
        review_source_id = uuid4()
        review_repository = FakeReviewRepository(existing_source_ids={"ext-2"})
        sentiment_repository = FakeSentimentResultRepository()
        service = ReviewService(
            review_repository=review_repository,
            business_repository=FakeBusinessRepository({business_id}),
            sentiment_result_repository=sentiment_repository,
            sentiment_analysis_service=FakeSentimentAnalysisService(sentiment_repository),
        )

        payload = ReviewImportRequest(
            business_id=business_id,
            review_source_id=review_source_id,
            source="Google",
            reviews=[
                ReviewImportItem(
                    source_review_id=" ext-1 ",
                    reviewer_name=" Jane ",
                    language=" EN ",
                    review_text=" Great service ",
                    source_metadata={"location_id": "abc"},
                ),
                ReviewImportItem(
                    source_review_id="ext-1",
                    reviewer_name="Jane Again",
                    language="en",
                    review_text="duplicate in payload",
                ),
                ReviewImportItem(
                    source_review_id="ext-2",
                    reviewer_name="John",
                    language="ar",
                    review_text="existing in db",
                ),
            ],
        )

        result = service.import_reviews(payload)

        self.assertEqual(result.imported_count, 1)
        self.assertEqual(result.duplicate_count, 2)
        self.assertEqual(result.requested_count, 3)
        self.assertEqual(result.processed_count, 3)
        self.assertEqual(
            [(item.source_review_id, item.reason) for item in result.duplicates],
            [("ext-1", "duplicate_in_payload"), ("ext-2", "already_imported")],
        )
        self.assertTrue(review_repository.saved)
        self.assertEqual(len(review_repository.added_reviews), 1)
        created_review = review_repository.added_reviews[0]
        self.assertEqual(created_review.review_source_id, review_source_id)
        self.assertEqual(created_review.source_type, "google")
        self.assertEqual(created_review.reviewer_name, "Jane")
        self.assertEqual(created_review.language, "en")
        self.assertEqual(created_review.review_text, "Great service")
        self.assertEqual(created_review.source_metadata, {"location_id": "abc"})
        self.assertIsNotNone(result.imported_reviews[0].sentiment)
        self.assertEqual(result.imported_reviews[0].sentiment.label, "positive")

    def test_import_reviews_requires_existing_business(self) -> None:
        service = ReviewService(
            review_repository=FakeReviewRepository(),
            business_repository=FakeBusinessRepository(set()),
            sentiment_result_repository=FakeSentimentResultRepository(),
            sentiment_analysis_service=FakeSentimentAnalysisService(
                FakeSentimentResultRepository()
            ),
        )

        with self.assertRaises(AppError) as raised:
            service.import_reviews(
                ReviewImportRequest(
                    business_id=uuid4(),
                    source="google",
                    reviews=[
                        ReviewImportItem(
                            source_review_id="ext-1",
                            review_text="Hello",
                        )
                    ],
                )
            )

        self.assertEqual(raised.exception.code, "BUSINESS_NOT_FOUND")

    def test_update_review_status_raises_for_missing_review(self) -> None:
        business_id = uuid4()
        service = ReviewService(
            review_repository=FakeReviewRepository(),
            business_repository=FakeBusinessRepository({business_id}),
            sentiment_result_repository=FakeSentimentResultRepository(),
            sentiment_analysis_service=FakeSentimentAnalysisService(
                FakeSentimentResultRepository()
            ),
        )

        with self.assertRaises(AppError) as raised:
            service.update_review_status(
                uuid4(),
                ReviewBusinessScope(business_id=business_id),
                ReviewStatusUpdateRequest(status="reviewed"),
            )

        self.assertEqual(raised.exception.code, "REVIEW_NOT_FOUND")

    def test_get_review_requires_matching_business_scope(self) -> None:
        business_id = uuid4()
        other_business_id = uuid4()
        review_id = uuid4()
        review_repository = FakeReviewRepository()
        sentiment_repository = FakeSentimentResultRepository()
        review_repository.review_by_id[review_id] = Review(
            id=review_id,
            business_id=business_id,
            source_type="google",
            source_review_id="ext-1",
            review_text="Scoped review",
            status="pending",
        )
        service = ReviewService(
            review_repository=review_repository,
            business_repository=FakeBusinessRepository({business_id, other_business_id}),
            sentiment_result_repository=sentiment_repository,
            sentiment_analysis_service=FakeSentimentAnalysisService(sentiment_repository),
        )

        with self.assertRaises(AppError) as raised:
            service.get_review(
                review_id,
                ReviewBusinessScope(business_id=other_business_id),
            )

        self.assertEqual(raised.exception.code, "REVIEW_NOT_FOUND")

    def test_list_reviews_passes_supported_filters(self) -> None:
        business_id = uuid4()
        review_repository = FakeReviewRepository()
        sentiment_repository = FakeSentimentResultRepository()
        review_id = uuid4()
        review_repository.listed_reviews = [
            Review(
                id=review_id,
                business_id=business_id,
                source_type="google",
                source_review_id="ext-1",
                reviewer_name="Jane",
                language="en",
                review_text="Great service",
                ingested_at=datetime.now(timezone.utc),
                status="pending",
            )
        ]
        review_repository.listed_reviews[0].created_at = datetime.now(timezone.utc)
        review_repository.listed_reviews[0].updated_at = datetime.now(timezone.utc)
        sentiment_service = FakeSentimentAnalysisService(sentiment_repository)
        service = ReviewService(
            review_repository=review_repository,
            business_repository=FakeBusinessRepository({business_id}),
            sentiment_result_repository=sentiment_repository,
            sentiment_analysis_service=sentiment_service,
        )

        results = service.list_reviews(
            ReviewListQuery(
                business_id=business_id,
                source_type="google",
                status="pending",
                language="EN",
                min_rating=3,
                max_rating=5,
                reviewer_name=" Jane ",
                search_text=" Slow service ",
                limit=25,
                offset=5,
            )
        )

        self.assertEqual(
            review_repository.last_list_kwargs,
            {
                "business_id": business_id,
                "review_source_id": None,
                "source_type": "google",
                "status": "pending",
                "language": "en",
                "min_rating": 3,
                "max_rating": 5,
                "reviewer_name": "jane",
                "search_text": "slow service",
                "created_from": None,
                "created_to": None,
                "limit": 25,
                "offset": 5,
            },
        )
        self.assertEqual(sentiment_service.analyzed_review_ids, [review_id])
        self.assertEqual(results[0].sentiment.label, "positive")


if __name__ == "__main__":
    unittest.main()
