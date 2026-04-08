from __future__ import annotations

import unittest
from unittest.mock import patch
from uuid import uuid4

import httpx

from backend.app.core.exceptions import AppError
from backend.app.schemas.review import GoogleReviewImportSourceRequest
from backend.app.services.providers.review_import import GoogleMapsApiReviewImportProvider


class GoogleMapsReviewImportProviderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.provider = GoogleMapsApiReviewImportProvider(
            base_url="http://google-maps-api.local",
            timeout_seconds=123,
        )

    def test_fetch_reviews_maps_service_response_into_google_reviews(self) -> None:
        payload = GoogleReviewImportSourceRequest.model_validate(
            {
                "business_id": str(uuid4()),
                "connection": {
                    "business_name": "Cafe Amal Amman",
                    "lang": "ar",
                    "depth": 2,
                    "location_id": "loc-123",
                },
            }
        )

        with patch("backend.app.services.providers.review_import.httpx.post") as mocked_post:
            mocked_post.return_value = httpx.Response(
                200,
                json={
                    "business_name": "Cafe Amal Amman",
                    "reviews": [
                        {
                            "author": "Jane Doe",
                            "rating": 4.0,
                            "text": "Lovely atmosphere and friendly staff.",
                        }
                    ],
                },
            )

            reviews = self.provider.fetch_reviews(payload)

        self.assertEqual(len(reviews), 1)
        self.assertEqual(reviews[0].reviewer_name, "Jane Doe")
        self.assertEqual(reviews[0].star_rating, 4)
        self.assertEqual(reviews[0].comment, "Lovely atmosphere and friendly staff.")
        self.assertEqual(reviews[0].language_code, "ar")
        self.assertEqual(reviews[0].location_id, "loc-123")
        self.assertEqual(reviews[0].location_name, "Cafe Amal Amman")
        self.assertTrue(reviews[0].review_id.startswith("gmaps-"))
        mocked_post.assert_called_once_with(
            "http://google-maps-api.local/reviews",
            json={
                "business_name": "Cafe Amal Amman",
                "depth": 2,
                "lang": "ar",
            },
            timeout=123,
        )

    def test_fetch_reviews_requires_a_lookup_string(self) -> None:
        payload = GoogleReviewImportSourceRequest.model_validate(
            {
                "business_id": str(uuid4()),
            }
        )

        with self.assertRaises(AppError) as raised:
            self.provider.fetch_reviews(payload)

        self.assertEqual(raised.exception.code, "GOOGLE_REVIEW_QUERY_REQUIRED")

    def test_create_import_job_returns_provider_job_metadata(self) -> None:
        payload = GoogleReviewImportSourceRequest.model_validate(
            {
                "business_id": str(uuid4()),
                "connection": {
                    "business_name": "Cafe Amal Amman",
                    "lang": "ar",
                    "depth": 2,
                },
            }
        )

        with patch("backend.app.services.providers.review_import.httpx.post") as mocked_post:
            mocked_post.return_value = httpx.Response(
                202,
                json={
                    "job_id": "job-123",
                    "business_name": "Cafe Amal Amman",
                    "status": "queued",
                    "message": "Google review collection started for Cafe Amal Amman.",
                },
            )

            result = self.provider.create_import_job(payload)

        self.assertEqual(result.provider_job_id, "job-123")
        self.assertEqual(result.business_name, "Cafe Amal Amman")
        self.assertEqual(result.status, "queued")
        mocked_post.assert_called_once_with(
            "http://google-maps-api.local/review-jobs",
            json={
                "business_name": "Cafe Amal Amman",
                "exact_place_locator": None,
                "depth": 2,
                "lang": "ar",
            },
            timeout=30,
        )

    def test_create_import_job_forwards_exact_place_locator_when_resolved(self) -> None:
        payload = GoogleReviewImportSourceRequest.model_validate(
            {
                "business_id": str(uuid4()),
                "connection": {
                    "business_name": "zanjbeel irbid",
                    "lang": "en",
                    "depth": 1,
                },
            }
        )

        with patch("backend.app.services.providers.review_import.httpx.post") as mocked_post:
            mocked_post.return_value = httpx.Response(
                202,
                json={
                    "job_id": "job-123",
                    "business_name": "Zanjabeel, 30, street, Irbid",
                    "status": "queued",
                    "message": "Google review collection started.",
                },
            )

            self.provider.create_import_job(
                payload,
                lookup_override="Zanjabeel, 30, street, Irbid",
                exact_place_locator="https://www.google.com/maps/preview/place/Zanjabeel",
            )

        mocked_post.assert_called_once_with(
            "http://google-maps-api.local/review-jobs",
            json={
                "business_name": "Zanjabeel, 30, street, Irbid",
                "exact_place_locator": "https://www.google.com/maps/preview/place/Zanjabeel",
                "depth": 1,
                "lang": "en",
            },
            timeout=30,
        )

    def test_search_candidates_returns_google_place_options(self) -> None:
        payload = GoogleReviewImportSourceRequest.model_validate(
            {
                "business_id": str(uuid4()),
                "connection": {
                    "business_name": "zanjbeel irbid",
                    "lang": "en",
                },
            }
        )

        with patch("backend.app.services.providers.review_import.httpx.post") as mocked_post:
            mocked_post.return_value = httpx.Response(
                200,
                json={
                    "business_name": "zanjbeel irbid",
                    "message": "Found 2 Google places for zanjbeel irbid.",
                    "candidates": [
                        {
                            "candidate_id": "place-1",
                            "title": "Zanjabeel",
                            "category": "Restaurant",
                            "address": "Zanjabeel, 30, street, Irbid",
                            "review_count": None,
                            "review_rating": 4.2,
                            "place_id": "ChIJXQngPIt2HBURSKMqyxh2Igo",
                            "link": "https://www.google.com/maps/preview/place/Zanjabeel",
                        },
                        {
                            "candidate_id": "place-2",
                            "title": "Zanjbeel",
                            "category": "Fast food restaurant",
                            "address": "Zanjbeel, Pr. Hasan St., Irbid",
                            "review_count": None,
                            "review_rating": 3.8,
                            "place_id": "ChIJtZGXDgB3HBUReHxHBMB--ew",
                            "link": "https://www.google.com/maps/preview/place/Zanjbeel-2",
                        },
                    ],
                },
            )

            result = self.provider.search_candidates(payload)

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].candidate_id, "place-1")
        mocked_post.assert_called_once_with(
            "http://google-maps-api.local/review-candidates",
            json={
                "business_name": "zanjbeel irbid",
                "lang": "en",
            },
            timeout=30,
        )

    def test_get_import_job_returns_provider_status(self) -> None:
        with patch("backend.app.services.providers.review_import.httpx.get") as mocked_get:
            mocked_get.return_value = httpx.Response(
                200,
                json={
                    "job_id": "job-123",
                    "status": "running",
                    "provider_status": "pending",
                    "message": "Google review collection is still running for Cafe Amal Amman.",
                },
            )

            result = self.provider.get_import_job(
                provider_job_id="job-123",
                business_name="Cafe Amal Amman",
            )

        self.assertEqual(result.provider_job_id, "job-123")
        self.assertEqual(result.status, "running")
        self.assertEqual(result.provider_status, "pending")
        mocked_get.assert_called_once_with(
            "http://google-maps-api.local/review-jobs/job-123",
            params={"business_name": "Cafe Amal Amman"},
            timeout=30,
        )

    def test_get_import_job_preserves_timeout_failure_status(self) -> None:
        with patch("backend.app.services.providers.review_import.httpx.get") as mocked_get:
            mocked_get.return_value = httpx.Response(
                200,
                json={
                    "job_id": "job-123",
                    "status": "failed",
                    "provider_status": "timed_out",
                    "message": (
                        "Google review lookup timed out for zanjbeel irbid. "
                        "Try a more specific business name, branch, or city."
                    ),
                },
            )

            result = self.provider.get_import_job(
                provider_job_id="job-123",
                business_name="zanjbeel irbid",
            )

        self.assertEqual(result.status, "failed")
        self.assertEqual(result.provider_status, "timed_out")
        self.assertIn("timed out", result.message.lower())

    def test_get_import_job_returns_candidates_for_ambiguous_lookup(self) -> None:
        with patch("backend.app.services.providers.review_import.httpx.get") as mocked_get:
            mocked_get.return_value = httpx.Response(
                200,
                json={
                    "job_id": "job-123",
                    "status": "needs_selection",
                    "provider_status": "ambiguous",
                    "message": "Multiple Google places matched zanjbeel irbid. Choose the correct place before importing reviews.",
                    "candidates": [
                        {
                            "candidate_id": "place-1",
                            "title": "Zanjabeel",
                            "category": "Restaurant",
                            "address": "30 street, Irbid",
                            "review_count": 0,
                            "review_rating": 4.2,
                            "place_id": "place-1",
                            "link": "https://maps.google.com/?q=place-1",
                        }
                    ],
                },
            )

            result = self.provider.get_import_job(
                provider_job_id="job-123",
                business_name="zanjbeel irbid",
            )

        self.assertEqual(result.status, "needs_selection")
        self.assertEqual(result.provider_status, "ambiguous")
        self.assertEqual(result.candidates[0].candidate_id, "place-1")

    def test_fetch_reviews_for_completed_job_uses_job_reviews_endpoint(self) -> None:
        payload = GoogleReviewImportSourceRequest.model_validate(
            {
                "business_id": str(uuid4()),
                "connection": {
                    "business_name": "Cafe Amal Amman",
                    "lang": "ar",
                    "location_id": "loc-123",
                },
            }
        )

        with patch("backend.app.services.providers.review_import.httpx.get") as mocked_get:
            mocked_get.return_value = httpx.Response(
                200,
                json={
                    "job_id": "job-123",
                    "business_name": "Cafe Amal Amman",
                    "reviews": [
                        {
                            "author": "Jane Doe",
                            "rating": 4.0,
                            "text": "Lovely atmosphere and friendly staff.",
                        }
                    ],
                },
            )

            reviews = self.provider.fetch_reviews_for_job(
                payload=payload,
                provider_job_id="job-123",
            )

        self.assertEqual(len(reviews), 1)
        self.assertEqual(reviews[0].reviewer_name, "Jane Doe")
        self.assertEqual(reviews[0].language_code, "ar")
        mocked_get.assert_called_once_with(
            "http://google-maps-api.local/review-jobs/job-123/reviews",
            params={"business_name": "Cafe Amal Amman"},
            timeout=123,
        )

    def test_fetch_reviews_for_completed_job_includes_candidate_id_when_selected(self) -> None:
        payload = GoogleReviewImportSourceRequest.model_validate(
            {
                "business_id": str(uuid4()),
                "connection": {
                    "business_name": "zanjbeel irbid",
                    "lang": "en",
                },
            }
        )

        with patch("backend.app.services.providers.review_import.httpx.get") as mocked_get:
            mocked_get.return_value = httpx.Response(
                200,
                json={
                    "job_id": "job-123",
                    "business_name": "zanjbeel irbid",
                    "reviews": [],
                },
            )

            self.provider.fetch_reviews_for_job(
                payload=payload,
                provider_job_id="job-123",
                candidate_id="place-1",
            )

        mocked_get.assert_called_once_with(
            "http://google-maps-api.local/review-jobs/job-123/reviews",
            params={"business_name": "zanjbeel irbid", "candidate_id": "place-1"},
            timeout=123,
        )

    def test_fetch_reviews_surfaces_provider_failures(self) -> None:
        payload = GoogleReviewImportSourceRequest.model_validate(
            {
                "business_id": str(uuid4()),
                "connection": {"business_name": "Cafe Amal Amman"},
            }
        )

        with patch("backend.app.services.providers.review_import.httpx.post") as mocked_post:
            mocked_post.return_value = httpx.Response(
                502,
                json={"detail": "upstream scraper timed out"},
            )

            with self.assertRaises(AppError) as raised:
                self.provider.fetch_reviews(payload)

        self.assertEqual(raised.exception.code, "GOOGLE_REVIEW_PROVIDER_ERROR")


if __name__ == "__main__":
    unittest.main()
