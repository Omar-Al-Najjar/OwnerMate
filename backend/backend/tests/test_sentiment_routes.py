from __future__ import annotations

from datetime import datetime, timezone
import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.api.dependencies import (
    get_authorization_service,
    get_current_user,
    get_sentiment_analysis_service,
)
from backend.app.main import app
from backend.app.models.user import User
from backend.app.schemas.sentiment import (
    SentimentAnalysisBatchResult,
    SentimentAnalysisResult,
    SentimentFailureResult,
    SentimentResultRead,
)


class FakeSentimentAnalysisService:
    def __init__(self) -> None:
        self.last_analyze_payload = None
        self.last_batch_payload = None
        self.last_review_id = None

        now = datetime.now(timezone.utc)
        self.sentiment_result = SentimentResultRead(
            id=uuid4(),
            review_id=uuid4(),
            label="negative",
            confidence=0.93,
            detected_language="ar",
            summary_tags=["service"],
            model_name="mock_sentiment",
            processed_at=now,
            created_at=now,
        )

    def analyze_review(self, payload):
        self.last_analyze_payload = payload
        return SentimentAnalysisResult(
            review_id=payload.review_id,
            sentiment_result=self.sentiment_result.model_copy(update={"review_id": payload.review_id}),
            agent_run_id=uuid4(),
        )

    def analyze_review_batch(self, payload):
        self.last_batch_payload = payload
        return SentimentAnalysisBatchResult(
            results=[
                SentimentAnalysisResult(
                    review_id=payload.review_ids[0],
                    sentiment_result=self.sentiment_result.model_copy(
                        update={"review_id": payload.review_ids[0]}
                    ),
                    agent_run_id=uuid4(),
                )
            ],
            failures=[
                SentimentFailureResult(
                    review_id=payload.review_ids[-1],
                    error_code="REVIEW_NOT_FOUND",
                    message="Review not found.",
                )
            ]
            if len(payload.review_ids) > 1
            else [],
        )

    def get_review_sentiment(self, review_id):
        self.last_review_id = review_id
        return self.sentiment_result.model_copy(update={"review_id": review_id})


class FakeAuthorizationService:
    def ensure_review_access(self, user, review_id):
        return None

    def ensure_review_batch_access(self, user, review_ids):
        return None


class SentimentRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fake_service = FakeSentimentAnalysisService()
        self.user = User(id=uuid4(), email="owner@example.com", role="owner")
        app.dependency_overrides[get_sentiment_analysis_service] = lambda: self.fake_service
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_authorization_service] = (
            lambda: FakeAuthorizationService()
        )
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_analyze_review_returns_success_envelope(self) -> None:
        review_id = str(uuid4())

        response = self.client.post(
            "/sentiment/analyze",
            json={"review_id": review_id, "language_hint": "AR"},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["review_id"], review_id)
        self.assertEqual(body["data"]["sentiment_result"]["label"], "negative")
        self.assertEqual(self.fake_service.last_analyze_payload.language_hint, "ar")

    def test_analyze_batch_returns_results_and_failures(self) -> None:
        review_id = str(uuid4())
        missing_id = str(uuid4())

        response = self.client.post(
            "/sentiment/analyze-batch",
            json={"review_ids": [review_id, missing_id], "language_hint": "en"},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(len(body["data"]["results"]), 1)
        self.assertEqual(len(body["data"]["failures"]), 1)
        self.assertEqual(body["data"]["failures"][0]["review_id"], missing_id)

    def test_get_review_sentiment_returns_latest_result(self) -> None:
        review_id = str(uuid4())

        response = self.client.get(f"/sentiment/reviews/{review_id}")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["review_id"], review_id)
        self.assertEqual(body["data"]["model_name"], "mock_sentiment")


if __name__ == "__main__":
    unittest.main()
