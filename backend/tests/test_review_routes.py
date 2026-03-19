from __future__ import annotations

from datetime import datetime, timezone
import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.api.dependencies import (
    get_authorization_service,
    get_current_user,
    get_review_service,
    get_source_review_import_service,
)
from backend.app.core.exceptions import AppError
from backend.app.main import app
from backend.app.models.user import User
from backend.app.schemas.review import (
    FacebookReviewImportSourceRequest,
    GoogleReviewImportSourceRequest,
    ReviewBusinessScope,
    ReviewDetailResponse,
    ReviewImportDuplicate,
    ReviewImportResult,
    ReviewListQuery,
    ReviewRead,
    ReviewStatusUpdateRequest,
)


class FakeReviewService:
    def __init__(self) -> None:
        self.last_list_query: ReviewListQuery | None = None
        self.last_get_scope: ReviewBusinessScope | None = None
        self.last_status_scope: ReviewBusinessScope | None = None
        self.last_status_payload: ReviewStatusUpdateRequest | None = None

        now = datetime.now(timezone.utc)
        self.sample_review = ReviewRead(
            id=uuid4(),
            business_id=uuid4(),
            review_source_id=uuid4(),
            source_type="google",
            source_review_id="ext-1",
            reviewer_name="Jane",
            rating=5,
            language="en",
            review_text="Great service",
            source_metadata={"platform_location_id": "abc123"},
            review_created_at=now,
            ingested_at=now,
            status="pending",
            response_status=None,
            created_at=now,
            updated_at=now,
        )

    def list_reviews(self, query: ReviewListQuery) -> list[ReviewRead]:
        self.last_list_query = query
        return [self.sample_review]

    def get_review(
        self, review_id, scope: ReviewBusinessScope
    ) -> ReviewDetailResponse:
        self.last_get_scope = scope
        if review_id != self.sample_review.id:
            raise AppError(
                code="REVIEW_NOT_FOUND",
                message="Review not found.",
                status_code=404,
            )
        return ReviewDetailResponse.model_validate(self.sample_review)

    def import_reviews(self, payload) -> ReviewImportResult:
        return ReviewImportResult(
            source=payload.source,
            business_id=payload.business_id,
            review_source_id=payload.review_source_id,
            requested_count=len(payload.reviews),
            imported_count=1,
            duplicate_count=1,
            processed_count=len(payload.reviews),
            imported_reviews=[self.sample_review],
            duplicates=[
                ReviewImportDuplicate(
                    source_review_id="existing-external-id",
                    reason="already_imported",
                )
            ],
        )

    def update_review_status(
        self,
        review_id,
        scope: ReviewBusinessScope,
        payload: ReviewStatusUpdateRequest,
    ) -> ReviewRead:
        self.last_status_scope = scope
        self.last_status_payload = payload
        updated = self.sample_review.model_copy(update={"id": review_id, "status": payload.status})
        return ReviewRead.model_validate(updated)


class FakeSourceReviewImportService:
    def __init__(self) -> None:
        self.last_google_payload: GoogleReviewImportSourceRequest | None = None
        self.last_facebook_payload: FacebookReviewImportSourceRequest | None = None

    def import_google_reviews(
        self, payload: GoogleReviewImportSourceRequest
    ) -> ReviewImportResult:
        self.last_google_payload = payload
        return ReviewImportResult(
            source="google",
            business_id=payload.business_id,
            review_source_id=payload.review_source_id,
            requested_count=max(len(payload.mock_reviews), 1),
            imported_count=1,
            duplicate_count=0,
            processed_count=max(len(payload.mock_reviews), 1),
            imported_reviews=[],
            duplicates=[],
        )

    def import_facebook_reviews(
        self, payload: FacebookReviewImportSourceRequest
    ) -> ReviewImportResult:
        self.last_facebook_payload = payload
        return ReviewImportResult(
            source="facebook",
            business_id=payload.business_id,
            review_source_id=payload.review_source_id,
            requested_count=max(len(payload.mock_reviews), 1),
            imported_count=1,
            duplicate_count=0,
            processed_count=max(len(payload.mock_reviews), 1),
            imported_reviews=[],
            duplicates=[],
        )


class FakeAuthorizationService:
    def ensure_business_access(self, user, business_id):
        return None


class ReviewRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fake_service = FakeReviewService()
        self.fake_source_service = FakeSourceReviewImportService()
        self.user = User(id=uuid4(), email="owner@example.com", role="owner")
        app.dependency_overrides[get_review_service] = lambda: self.fake_service
        app.dependency_overrides[get_source_review_import_service] = (
            lambda: self.fake_source_service
        )
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_authorization_service] = (
            lambda: FakeAuthorizationService()
        )
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_list_reviews_returns_success_envelope_and_filters(self) -> None:
        business_id = str(uuid4())

        response = self.client.get(
            "/reviews",
            params={
                "business_id": business_id,
                "source_type": "Google",
                "language": "EN",
                "min_rating": 4,
                "search_text": "Great",
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(len(body["data"]), 1)
        self.assertEqual(body["data"][0]["source_metadata"], {"platform_location_id": "abc123"})
        self.assertIsNotNone(self.fake_service.last_list_query)
        self.assertEqual(str(self.fake_service.last_list_query.business_id), business_id)
        self.assertEqual(self.fake_service.last_list_query.source_type, "google")
        self.assertEqual(self.fake_service.last_list_query.language, "en")
        self.assertEqual(self.fake_service.last_list_query.min_rating, 4)
        self.assertEqual(self.fake_service.last_list_query.search_text, "great")

    def test_get_review_requires_business_scope_query_param(self) -> None:
        response = self.client.get(f"/reviews/{self.fake_service.sample_review.id}")

        self.assertEqual(response.status_code, 422)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"]["code"], "VALIDATION_ERROR")

    def test_get_review_returns_business_scoped_detail(self) -> None:
        response = self.client.get(
            f"/reviews/{self.fake_service.sample_review.id}",
            params={"business_id": str(self.fake_service.sample_review.business_id)},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(
            body["data"]["business_id"],
            str(self.fake_service.sample_review.business_id),
        )
        self.assertIsNotNone(self.fake_service.last_get_scope)
        self.assertEqual(
            self.fake_service.last_get_scope.business_id,
            self.fake_service.sample_review.business_id,
        )

    def test_import_reviews_returns_structured_result(self) -> None:
        business_id = str(uuid4())
        review_source_id = str(uuid4())

        response = self.client.post(
            "/reviews/import",
            json={
                "business_id": business_id,
                "review_source_id": review_source_id,
                "source": "google",
                "reviews": [
                    {
                        "source_review_id": "external-review-id",
                        "reviewer_name": "Jane Doe",
                        "rating": 5,
                        "language": "en",
                        "review_text": "Great service",
                        "source_metadata": {"platform_location_id": "abc123"},
                    },
                    {
                        "source_review_id": "existing-external-id",
                        "review_text": "Already imported",
                    },
                ],
            },
        )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["requested_count"], 2)
        self.assertEqual(body["data"]["imported_count"], 1)
        self.assertEqual(body["data"]["duplicate_count"], 1)
        self.assertEqual(
            body["data"]["duplicates"][0],
            {
                "source_review_id": "existing-external-id",
                "reason": "already_imported",
            },
        )

    def test_patch_status_requires_business_scope_and_returns_success_envelope(self) -> None:
        review_id = str(uuid4())
        business_id = str(self.fake_service.sample_review.business_id)

        response = self.client.patch(
            f"/reviews/{review_id}/status",
            params={"business_id": business_id},
            json={"status": "reviewed"},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["status"], "reviewed")
        self.assertIsNotNone(self.fake_service.last_status_scope)
        self.assertEqual(str(self.fake_service.last_status_scope.business_id), business_id)
        self.assertEqual(self.fake_service.last_status_payload.status, "reviewed")

    def test_import_google_reviews_returns_structured_result(self) -> None:
        business_id = str(uuid4())
        review_source_id = str(uuid4())

        response = self.client.post(
            "/reviews/import/google",
            json={
                "business_id": business_id,
                "review_source_id": review_source_id,
                "connection": {"location_id": "google-location-1"},
                "fetch": {"limit": 5},
                "mock_reviews": [
                    {
                        "review_id": "g-1",
                        "reviewer_name": "Jane Doe",
                        "star_rating": 5,
                        "comment": "Great service",
                        "language_code": "en",
                        "location_id": "google-location-1",
                        "location_name": "Main Branch",
                    }
                ],
            },
        )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["source"], "google")
        self.assertIsNotNone(self.fake_source_service.last_google_payload)
        self.assertEqual(
            self.fake_source_service.last_google_payload.connection.location_id,
            "google-location-1",
        )
        self.assertEqual(len(self.fake_source_service.last_google_payload.mock_reviews), 1)

    def test_import_facebook_reviews_returns_structured_result(self) -> None:
        business_id = str(uuid4())

        response = self.client.post(
            "/reviews/import/facebook",
            json={
                "business_id": business_id,
                "connection": {"page_id": "fb-page-1"},
                "mock_reviews": [
                    {
                        "review_id": "fb-1",
                        "reviewer_name": "Ali",
                        "recommendation": "positive",
                        "review_text": "Would recommend",
                        "language_code": "en",
                        "page_id": "fb-page-1",
                    }
                ],
            },
        )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["source"], "facebook")
        self.assertIsNotNone(self.fake_source_service.last_facebook_payload)
        self.assertEqual(
            self.fake_source_service.last_facebook_payload.connection.page_id,
            "fb-page-1",
        )
        self.assertEqual(len(self.fake_source_service.last_facebook_payload.mock_reviews), 1)


if __name__ == "__main__":
    unittest.main()
