from __future__ import annotations

import unittest
from unittest.mock import patch
from uuid import uuid4

import httpx

from backend.app.core.exceptions import AppError
from backend.app.schemas.sentiment import SentimentProviderRequest
from backend.app.services.providers.sentiment import SentimentApiProvider


class SentimentApiProviderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.provider = SentimentApiProvider(
            base_url="http://sentiment-api.local",
            timeout_seconds=42,
        )
        self.payload = SentimentProviderRequest(
            review_id=uuid4(),
            review_text="Great service and lovely staff.",
            rating=5,
            language_hint="en",
        )

    def test_analyze_maps_service_response_into_provider_result(self) -> None:
        with patch("backend.app.services.providers.sentiment.httpx.post") as mocked_post:
            mocked_post.return_value = httpx.Response(
                200,
                json={
                    "label": "POSITIVE",
                    "confidence": 0.9731,
                    "scores": {
                        "NEGATIVE": 0.01,
                        "NEUTRAL": 0.0169,
                        "POSITIVE": 0.9731,
                    },
                    "processing_time_ms": 18.4,
                },
            )

            result = self.provider.analyze(self.payload)

        self.assertEqual(result.label, "positive")
        self.assertEqual(result.confidence, 0.9731)
        self.assertEqual(result.detected_language, "en")
        self.assertEqual(result.summary_tags, [])
        self.assertEqual(result.model_name, "sentiment_api")
        mocked_post.assert_called_once_with(
            "http://sentiment-api.local/predict",
            json={"text": "Great service and lovely staff."},
            timeout=42,
        )

    def test_analyze_surfaces_model_loading_state(self) -> None:
        with patch("backend.app.services.providers.sentiment.httpx.post") as mocked_post:
            mocked_post.return_value = httpx.Response(
                503,
                json={"detail": "Model not loaded yet"},
            )

            with self.assertRaises(AppError) as raised:
                self.provider.analyze(self.payload)

        self.assertEqual(raised.exception.code, "SENTIMENT_MODEL_NOT_READY")

    def test_analyze_rejects_invalid_labels(self) -> None:
        with patch("backend.app.services.providers.sentiment.httpx.post") as mocked_post:
            mocked_post.return_value = httpx.Response(
                200,
                json={
                    "label": "MIXED",
                    "confidence": 0.51,
                },
            )

            with self.assertRaises(AppError) as raised:
                self.provider.analyze(self.payload)

        self.assertEqual(raised.exception.code, "SENTIMENT_PROVIDER_ERROR")


if __name__ == "__main__":
    unittest.main()
