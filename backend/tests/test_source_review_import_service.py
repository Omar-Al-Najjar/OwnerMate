from __future__ import annotations

from datetime import datetime, timezone
import unittest
from uuid import uuid4

from backend.app.schemas.review import (
    FacebookReviewImportSourceRequest,
    GoogleReviewImportSourceRequest,
)
from backend.app.services.source_review_import import SourceReviewImportService


class FakeGoogleProvider:
    provider_name = "mock_google_reviews"

    def fetch_reviews(self, payload: GoogleReviewImportSourceRequest):
        return payload.mock_reviews


class FakeFacebookProvider:
    provider_name = "mock_facebook_reviews"

    def fetch_reviews(self, payload: FacebookReviewImportSourceRequest):
        return payload.mock_reviews


class FakeReviewService:
    def __init__(self) -> None:
        self.last_payload = None

    def import_reviews(self, payload):
        self.last_payload = payload
        return {
            "source": payload.source,
            "business_id": payload.business_id,
            "review_source_id": payload.review_source_id,
            "requested_count": len(payload.reviews),
            "imported_count": len(payload.reviews),
            "duplicate_count": 0,
            "processed_count": len(payload.reviews),
            "imported_reviews": [],
            "duplicates": [],
        }


class SourceReviewImportServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.review_service = FakeReviewService()
        self.service = SourceReviewImportService(
            review_service=self.review_service,
            google_provider=FakeGoogleProvider(),
            facebook_provider=FakeFacebookProvider(),
        )

    def test_google_reviews_are_normalized_into_common_import_payload(self) -> None:
        business_id = uuid4()
        review_source_id = uuid4()
        payload = GoogleReviewImportSourceRequest.model_validate(
            {
                "business_id": str(business_id),
                "review_source_id": str(review_source_id),
                "connection": {"location_id": "loc-1"},
                "mock_reviews": [
                    {
                        "review_id": "g-1",
                        "reviewer_name": "Jane",
                        "star_rating": 5,
                        "comment": "Great service",
                        "language_code": "EN",
                        "create_time": datetime.now(timezone.utc).isoformat(),
                        "location_id": "loc-1",
                        "location_name": "Main Branch",
                        "original_payload": {"etag": "abc"},
                    }
                ],
            }
        )

        result = self.service.import_google_reviews(payload)

        self.assertEqual(result["source"], "google")
        self.assertIsNotNone(self.review_service.last_payload)
        self.assertEqual(self.review_service.last_payload.source, "google")
        self.assertEqual(self.review_service.last_payload.review_source_id, review_source_id)
        normalized_review = self.review_service.last_payload.reviews[0]
        self.assertEqual(normalized_review.source_review_id, "g-1")
        self.assertEqual(normalized_review.rating, 5)
        self.assertEqual(normalized_review.language, "EN")
        self.assertEqual(
            normalized_review.source_metadata,
            {
                "provider": "mock_google_reviews",
                "location_id": "loc-1",
                "location_name": "Main Branch",
                "original_payload": {"etag": "abc"},
            },
        )

    def test_facebook_reviews_preserve_source_metadata(self) -> None:
        business_id = uuid4()
        payload = FacebookReviewImportSourceRequest.model_validate(
            {
                "business_id": str(business_id),
                "connection": {"page_id": "fb-1"},
                "mock_reviews": [
                    {
                        "review_id": "fb-1",
                        "reviewer_name": "Ali",
                        "recommendation": "negative",
                        "rating": 2,
                        "review_text": "Slow service",
                        "language_code": "ar",
                        "page_id": "fb-1",
                        "original_payload": {"source": "fixture"},
                    }
                ],
            }
        )

        result = self.service.import_facebook_reviews(payload)

        self.assertEqual(result["source"], "facebook")
        normalized_review = self.review_service.last_payload.reviews[0]
        self.assertEqual(normalized_review.source_review_id, "fb-1")
        self.assertEqual(normalized_review.rating, 2)
        self.assertEqual(normalized_review.review_text, "Slow service")
        self.assertEqual(
            normalized_review.source_metadata,
            {
                "provider": "mock_facebook_reviews",
                "page_id": "fb-1",
                "recommendation": "negative",
                "original_payload": {"source": "fixture"},
            },
        )


if __name__ == "__main__":
    unittest.main()
