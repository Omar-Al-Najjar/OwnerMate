from __future__ import annotations

from datetime import datetime, timezone
import unittest
from uuid import uuid4

from backend.app.models.agent_run import AgentRun
from backend.app.schemas.review import (
    FacebookReviewImportSourceRequest,
    GoogleReviewImportSourceRequest,
    GoogleReviewImportSelectionRequest,
    ReviewImportResult,
)
from backend.app.services.providers.review_import import GoogleReviewImportProviderJob
from backend.app.services.providers.review_import import GoogleReviewImportProviderCandidate
from backend.app.services.source_review_import import SourceReviewImportService


class FakeGoogleProvider:
    provider_name = "mock_google_reviews"

    def __init__(self) -> None:
        self.jobs: dict[str, GoogleReviewImportProviderJob] = {}
        self.job_reviews: dict[str, list] = {}
        self.last_fetch_candidate_id: str | None = None

    def fetch_reviews(self, payload: GoogleReviewImportSourceRequest):
        return payload.mock_reviews

    def create_import_job(
        self,
        payload: GoogleReviewImportSourceRequest,
        *,
        lookup_override: str | None = None,
        exact_place_locator: str | None = None,
    ) -> GoogleReviewImportProviderJob:
        del exact_place_locator
        business_name = lookup_override or payload.connection.business_name or "Unknown Business"
        self.job_reviews["google-job-1"] = list(payload.mock_reviews)
        if business_name == "zanjbeel irbid":
            job = GoogleReviewImportProviderJob(
                provider_job_id="google-job-1",
                business_name=business_name,
                status="needs_selection",
                provider_status="ambiguous",
                message=f"Multiple Google places matched {business_name}.",
                candidates=self.search_candidates(payload),
            )
            self.jobs[job.provider_job_id] = job
            return job
        job = GoogleReviewImportProviderJob(
            provider_job_id="google-job-1",
            business_name=business_name,
            status="queued",
            provider_status="pending",
            message=f"Google review import queued for {business_name}.",
        )
        self.jobs[job.provider_job_id] = job
        return job

    def search_candidates(
        self,
        payload: GoogleReviewImportSourceRequest,
    ) -> list[GoogleReviewImportProviderCandidate]:
        business_name = payload.connection.business_name or "Unknown Business"
        if business_name == "zanjbeel irbid":
            return [
                GoogleReviewImportProviderCandidate(
                    candidate_id="place-1",
                    title="Zanjabeel",
                    category="Restaurant",
                    address="30, street, Irbid",
                    review_count=None,
                    review_rating=4.2,
                    place_id="place-1",
                    link=None,
                ),
                GoogleReviewImportProviderCandidate(
                    candidate_id="place-2",
                    title="Zanjbeel",
                    category="Fast food restaurant",
                    address="Pr. Hasan St., Irbid",
                    review_count=None,
                    review_rating=3.8,
                    place_id="place-2",
                    link=None,
                ),
            ]
        return []

    def get_import_job(
        self,
        *,
        provider_job_id: str,
        business_name: str,
    ) -> GoogleReviewImportProviderJob:
        del business_name
        return self.jobs[provider_job_id]

    def fetch_reviews_for_job(
        self,
        *,
        payload: GoogleReviewImportSourceRequest,
        provider_job_id: str,
        candidate_id: str | None = None,
    ):
        del payload
        self.last_fetch_candidate_id = candidate_id
        return self.job_reviews.get(provider_job_id, [])


class FakeFacebookProvider:
    provider_name = "mock_facebook_reviews"

    def fetch_reviews(self, payload: FacebookReviewImportSourceRequest):
        return payload.mock_reviews


class EmptyGoogleProvider(FakeGoogleProvider):
    provider_name = "empty_google_reviews"

    def fetch_reviews(self, payload: GoogleReviewImportSourceRequest):
        del payload
        return []

    def fetch_reviews_for_job(
        self,
        *,
        payload: GoogleReviewImportSourceRequest,
        provider_job_id: str,
        candidate_id: str | None = None,
    ):
        del payload, provider_job_id, candidate_id
        return []


class FakeReviewService:
    def __init__(self) -> None:
        self.last_payload = None

    def import_reviews(self, payload):
        self.last_payload = payload
        return ReviewImportResult(
            source=payload.source,
            business_id=payload.business_id,
            review_source_id=payload.review_source_id,
            requested_count=len(payload.reviews),
            imported_count=len(payload.reviews),
            duplicate_count=0,
            processed_count=len(payload.reviews),
            imported_reviews=[],
            duplicates=[],
        )


class FakeAgentRunRepository:
    def __init__(self) -> None:
        self.items: dict = {}

    def add(self, agent_run: AgentRun) -> AgentRun:
        if agent_run.id is None:
            agent_run.id = uuid4()
        self.items[agent_run.id] = agent_run
        return agent_run

    def save(self) -> None:
        return None

    def refresh(self, agent_run: AgentRun) -> None:
        return None

    def rollback(self) -> None:
        return None

    def get_by_id(self, agent_run_id):
        return self.items.get(agent_run_id)

    def mark_success(self, agent_run: AgentRun, *, output_reference: dict) -> AgentRun:
        agent_run.status = "success"
        agent_run.output_reference = output_reference
        agent_run.finished_at = datetime.now(timezone.utc)
        self.items[agent_run.id] = agent_run
        return agent_run

    def mark_failed(self, agent_run: AgentRun, *, error_message: str) -> AgentRun:
        agent_run.status = "failed"
        agent_run.error_message = error_message
        agent_run.finished_at = datetime.now(timezone.utc)
        self.items[agent_run.id] = agent_run
        return agent_run


class SourceReviewImportServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.review_service = FakeReviewService()
        self.google_provider = FakeGoogleProvider()
        self.agent_run_repository = FakeAgentRunRepository()
        self.service = SourceReviewImportService(
            review_service=self.review_service,
            google_provider=self.google_provider,
            facebook_provider=FakeFacebookProvider(),
            agent_run_repository=self.agent_run_repository,
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

        self.assertEqual(result.source, "google")
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

    def test_create_google_import_job_persists_agent_run_metadata(self) -> None:
        business_id = uuid4()
        payload = GoogleReviewImportSourceRequest.model_validate(
            {
                "business_id": str(business_id),
                "connection": {
                    "business_name": "Cafe Amal Amman",
                    "lang": "ar",
                    "depth": 2,
                },
                "fetch": {"limit": 10},
            }
        )

        result = self.service.create_google_import_job(payload)

        self.assertEqual(result.status, "queued")
        self.assertEqual(result.business_name, "Cafe Amal Amman")
        self.assertEqual(result.provider_job_id, "google-job-1")
        persisted = self.agent_run_repository.get_by_id(result.agent_run_id)
        self.assertIsNotNone(persisted)
        self.assertEqual(persisted.task_type, "import_google_reviews")
        self.assertEqual(persisted.input_reference["provider_job_id"], "google-job-1")
        self.assertEqual(persisted.input_reference["business_name"], "Cafe Amal Amman")

    def test_get_google_import_job_finalizes_successful_job(self) -> None:
        business_id = uuid4()
        payload = GoogleReviewImportSourceRequest.model_validate(
            {
                "business_id": str(business_id),
                "connection": {"business_name": "Cafe Amal Amman"},
                "mock_reviews": [
                    {
                        "review_id": "g-1",
                        "reviewer_name": "Jane",
                        "star_rating": 5,
                        "comment": "Great service",
                        "language_code": "en",
                    }
                ],
            }
        )

        created = self.service.create_google_import_job(payload)
        self.google_provider.jobs["google-job-1"] = GoogleReviewImportProviderJob(
            provider_job_id="google-job-1",
            business_name="Cafe Amal Amman",
            status="success",
            provider_status="done",
            message="Google review import completed for Cafe Amal Amman.",
        )

        result = self.service.get_google_import_job(created.agent_run_id)

        self.assertEqual(result.status, "success")
        self.assertEqual(result.imported_count, 1)
        self.assertEqual(result.processed_count, 1)
        self.assertEqual(self.review_service.last_payload.source, "google")
        persisted = self.agent_run_repository.get_by_id(created.agent_run_id)
        self.assertEqual(persisted.status, "success")
        self.assertIsNotNone(persisted.finished_at)

    def test_get_google_import_job_uses_provider_selected_candidate_id(self) -> None:
        business_id = uuid4()
        payload = GoogleReviewImportSourceRequest.model_validate(
            {
                "business_id": str(business_id),
                "connection": {"business_name": "Adidas Outlet Store Airport Road Amman"},
                "mock_reviews": [
                    {
                        "review_id": "g-1",
                        "reviewer_name": "Jane",
                        "star_rating": 5,
                        "comment": "Great service",
                        "language_code": "en",
                    }
                ],
            }
        )

        created = self.service.create_google_import_job(payload)
        self.google_provider.jobs["google-job-1"] = GoogleReviewImportProviderJob(
            provider_job_id="google-job-1",
            business_name="Adidas Outlet Store Airport Road Amman",
            status="success",
            provider_status="done",
            message="Google review import completed.",
            selected_candidate_id="place-2",
        )

        result = self.service.get_google_import_job(created.agent_run_id)

        self.assertEqual(result.status, "success")
        self.assertEqual(result.selected_candidate_id, "place-2")
        self.assertEqual(self.google_provider.last_fetch_candidate_id, "place-2")

    def test_get_google_import_job_marks_success_without_reviews_as_failed(self) -> None:
        business_id = uuid4()
        service = SourceReviewImportService(
            review_service=self.review_service,
            google_provider=EmptyGoogleProvider(),
            facebook_provider=FakeFacebookProvider(),
            agent_run_repository=self.agent_run_repository,
        )
        payload = GoogleReviewImportSourceRequest.model_validate(
            {
                "business_id": str(business_id),
                "connection": {"business_name": "Cafe Amal Amman"},
            }
        )

        created = service.create_google_import_job(payload)
        service.google_provider.jobs["google-job-1"] = GoogleReviewImportProviderJob(
            provider_job_id="google-job-1",
            business_name="Cafe Amal Amman",
            status="success",
            provider_status="ok",
            message="Reviews are ready for Cafe Amal Amman.",
        )

        result = service.get_google_import_job(created.agent_run_id)

        self.assertEqual(result.status, "failed")
        self.assertEqual(result.provider_status, "no_reviews")
        self.assertEqual(result.imported_count, 0)
        self.assertEqual(result.processed_count, 0)
        self.assertIn("no google reviews were available", result.message.lower())
        persisted = self.agent_run_repository.get_by_id(created.agent_run_id)
        self.assertEqual(persisted.status, "failed")
        self.assertEqual(persisted.output_reference["provider_status"], "no_reviews")

    def test_create_google_import_job_returns_needs_selection_for_ambiguous_search(self) -> None:
        business_id = uuid4()
        payload = GoogleReviewImportSourceRequest.model_validate(
            {
                "business_id": str(business_id),
                "connection": {"business_name": "zanjbeel irbid"},
                "mock_reviews": [
                    {
                        "review_id": "g-1",
                        "reviewer_name": "Dana",
                        "star_rating": 5,
                        "comment": "Very good",
                        "language_code": "en",
                    }
                ],
            }
        )

        result = self.service.create_google_import_job(payload)

        self.assertEqual(result.status, "needs_selection")
        self.assertEqual(len(result.candidates), 2)
        self.assertEqual(result.provider_job_id, "google-job-1")
        persisted = self.agent_run_repository.get_by_id(result.agent_run_id)
        self.assertEqual(persisted.input_reference["job_status"], "needs_selection")

    def test_select_google_import_job_candidate_starts_provider_job_after_selection(self) -> None:
        business_id = uuid4()
        payload = GoogleReviewImportSourceRequest.model_validate(
            {
                "business_id": str(business_id),
                "connection": {"business_name": "zanjbeel irbid"},
                "mock_reviews": [
                    {
                        "review_id": "g-1",
                        "reviewer_name": "Dana",
                        "star_rating": 5,
                        "comment": "Very good",
                        "language_code": "en",
                    }
                ],
            }
        )

        created = self.service.create_google_import_job(payload)
        result = self.service.select_google_import_job_candidate(
            created.agent_run_id,
            GoogleReviewImportSelectionRequest(candidate_id="place-1"),
        )

        self.assertEqual(result.status, "success")
        self.assertEqual(result.selected_candidate_id, "place-1")
        self.assertEqual(result.provider_job_id, "google-job-1")
        persisted = self.agent_run_repository.get_by_id(created.agent_run_id)
        self.assertEqual(persisted.input_reference["selected_candidate_id"], "place-1")
        self.assertEqual(persisted.input_reference["job_status"], "needs_selection")
        self.assertEqual(persisted.input_reference["selected_lookup"], "Zanjabeel, 30, street, Irbid")
        self.assertEqual(
            persisted.input_reference["selected_exact_locator"],
            "https://www.google.com/maps/search/?api=1&query_place_id=place-1",
        )

    def test_google_reviews_returns_empty_result_when_provider_finds_nothing(self) -> None:
        business_id = uuid4()
        service = SourceReviewImportService(
            review_service=self.review_service,
            google_provider=EmptyGoogleProvider(),
            facebook_provider=FakeFacebookProvider(),
            agent_run_repository=self.agent_run_repository,
        )
        payload = GoogleReviewImportSourceRequest.model_validate(
            {
                "business_id": str(business_id),
                "connection": {"business_name": "Missing Business"},
            }
        )

        result = service.import_google_reviews(payload)

        self.assertEqual(result.imported_count, 0)
        self.assertEqual(result.requested_count, 0)
        self.assertEqual(result.processed_count, 0)

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

        self.assertEqual(result.source, "facebook")
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
