from __future__ import annotations

from datetime import datetime, timezone
import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.api.dependencies import (
    get_authorization_service,
    get_current_user,
    get_dashboard_service,
)
from backend.app.core.exceptions import AppError
from backend.app.main import app
from backend.app.models.user import User
from backend.app.schemas.dashboard import (
    DashboardActivityItem,
    DashboardCapabilities,
    DashboardDistributions,
    DashboardDistributionBucket,
    DashboardMetricSummary,
    DashboardOverviewRead,
    DashboardPriorityReviewItem,
    DashboardRecentReviewItem,
)


class FakeDashboardService:
    def __init__(self) -> None:
        self.last_query = None
        now = datetime.now(timezone.utc)
        self.business_id = uuid4()
        self.payload = DashboardOverviewRead(
            business_id=self.business_id,
            generated_at=now,
            metrics=DashboardMetricSummary(
                total_reviews=8,
                average_rating=4.1,
                positive_share=62.5,
                negative_share=12.5,
                pending_reviews=2,
                reviewed_reviews=4,
                responded_reviews=2,
                active_sources=3,
            ),
            distributions=DashboardDistributions(
                sentiment=[
                    DashboardDistributionBucket(label="positive", value=5, share=0.625),
                    DashboardDistributionBucket(label="neutral", value=2, share=0.25),
                    DashboardDistributionBucket(label="negative", value=1, share=0.125),
                ],
                ratings=[],
                sources=[],
                languages=[],
            ),
            recent_reviews=[
                DashboardRecentReviewItem(
                    review_id=uuid4(),
                    source_type="google",
                    reviewer_name="Nora",
                    rating=5,
                    language="en",
                    review_text="Great service",
                    review_created_at=now,
                    status="pending",
                    sentiment_label="positive",
                    sentiment_confidence=0.91,
                    summary_tags=["service"],
                )
            ],
            priority_reviews=[
                DashboardPriorityReviewItem(
                    review_id=uuid4(),
                    source_type="google",
                    reviewer_name="Sam",
                    rating=1,
                    language="en",
                    review_text="Very disappointed",
                    review_created_at=now,
                    status="pending",
                    sentiment_label="negative",
                    sentiment_confidence=0.95,
                    summary_tags=["needs_attention"],
                    priority="high",
                    reason="negative_low_rating",
                )
            ],
            activity_feed=[
                DashboardActivityItem(
                    review_id=uuid4(),
                    type="negative_alert",
                    occurred_at=now,
                    source_type="google",
                    rating=1,
                    language="en",
                    status="pending",
                    sentiment_label="negative",
                    reviewer_name="Sam",
                )
            ],
            capabilities=DashboardCapabilities(),
        )

    def get_overview(self, query):
        self.last_query = query
        return self.payload


class FakeAuthorizationService:
    def ensure_business_access(self, user, business_id):
        del user, business_id
        return None


class RejectingAuthorizationService:
    def ensure_business_access(self, user, business_id):
        del user, business_id
        raise AppError(
            code="FORBIDDEN",
            message="You do not have access to this business.",
            status_code=403,
        )


class DashboardRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.user = User(id=uuid4(), email="owner@example.com", role="owner")
        self.fake_service = FakeDashboardService()
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_dashboard_service] = lambda: self.fake_service
        app.dependency_overrides[get_authorization_service] = (
            lambda: FakeAuthorizationService()
        )
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_dashboard_overview_returns_review_focused_payload(self) -> None:
        response = self.client.get(
            "/dashboard/overview",
            params={
                "business_id": str(self.fake_service.business_id),
                "limit": 150,
                "recent_limit": 3,
                "priority_limit": 2,
                "activity_limit": 4,
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["metrics"]["total_reviews"], 8)
        self.assertFalse(body["data"]["capabilities"]["sales_data_available"])
        self.assertEqual(body["data"]["recent_reviews"][0]["sentiment_label"], "positive")
        self.assertIsNotNone(self.fake_service.last_query)
        self.assertEqual(self.fake_service.last_query.limit, 150)
        self.assertEqual(self.fake_service.last_query.recent_limit, 3)

    def test_dashboard_overview_rejects_forbidden_business_scope(self) -> None:
        app.dependency_overrides[get_authorization_service] = (
            lambda: RejectingAuthorizationService()
        )

        response = self.client.get(
            "/dashboard/overview",
            params={"business_id": str(self.fake_service.business_id)},
        )

        self.assertEqual(response.status_code, 403)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"]["code"], "FORBIDDEN")


if __name__ == "__main__":
    unittest.main()
