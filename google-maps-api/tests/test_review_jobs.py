from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from app.job_store import ReviewJobStore
from app.models import PlaceResult, Review, ReviewCandidate, ReviewJobCreateRequest, StoredReviewJob
from app.review_jobs import ReviewJobManager


class ReviewJobManagerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store = ReviewJobStore(Path(self.temp_dir.name))
        self.manager = ReviewJobManager(self.store)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_run_job_marks_ambiguous_matches_as_needs_selection(self) -> None:
        request = ReviewJobCreateRequest(
            business_name="zanjbeel irbid",
            lang="en",
            depth=1,
        )
        job = self.manager.create_job(request)
        place_results = [
            PlaceResult(
                candidate=ReviewCandidate(
                    candidate_id="place-1",
                    title="Zanjabeel",
                    address="30 street, Irbid",
                    place_id="place-1",
                ),
                reviews=[Review(author="A", rating=4.0, text="Nice")],
            ),
            PlaceResult(
                candidate=ReviewCandidate(
                    candidate_id="place-2",
                    title="Zanjbeel",
                    address="Prince Hasan St., Irbid",
                    place_id="place-2",
                ),
                reviews=[Review(author="B", rating=5.0, text="Great")],
            ),
        ]

        async def fake_find_places(*, business_name: str, depth: int, lang: str):
            del business_name, depth, lang
            return place_results

        with patch("app.review_jobs.find_places", side_effect=fake_find_places):
            asyncio.run(self.manager.run_job(job.job_id))

        stored = self.store.get(job.job_id)
        self.assertIsNotNone(stored)
        assert stored is not None
        self.assertEqual(stored.status, "needs_selection")
        self.assertEqual(stored.provider_status, "ambiguous")
        self.assertEqual(len(stored.candidates), 2)

    def test_get_job_reviews_returns_selected_candidate_reviews(self) -> None:
        job = StoredReviewJob(
            job_id="job-1",
            business_name="zanjbeel irbid",
            status="needs_selection",
            provider_status="ambiguous",
            message="Choose a place.",
            candidates=[
                ReviewCandidate(candidate_id="place-1", title="Place 1"),
                ReviewCandidate(candidate_id="place-2", title="Place 2"),
            ],
            place_results=[
                PlaceResult(
                    candidate=ReviewCandidate(candidate_id="place-1", title="Place 1"),
                    reviews=[Review(author="A", rating=4.0, text="Review 1")],
                ),
                PlaceResult(
                    candidate=ReviewCandidate(candidate_id="place-2", title="Place 2"),
                    reviews=[Review(author="B", rating=5.0, text="Review 2")],
                ),
            ],
            started_at=None,
            finished_at=None,
        )
        self.store.save(job)

        result = asyncio.run(
            self.manager.get_job_reviews(job_id="job-1", candidate_id="place-2")
        )

        self.assertEqual(result.job_id, "job-1")
        self.assertEqual(len(result.reviews), 1)
        self.assertEqual(result.reviews[0].text, "Review 2")

    def test_get_job_reviews_requires_candidate_for_ambiguous_job(self) -> None:
        job = StoredReviewJob(
            job_id="job-1",
            business_name="zanjbeel irbid",
            status="needs_selection",
            provider_status="ambiguous",
            message="Choose a place.",
            candidates=[
                ReviewCandidate(candidate_id="place-1", title="Place 1"),
                ReviewCandidate(candidate_id="place-2", title="Place 2"),
            ],
            place_results=[
                PlaceResult(
                    candidate=ReviewCandidate(candidate_id="place-1", title="Place 1"),
                    reviews=[Review(author="A", rating=4.0, text="Review 1")],
                ),
                PlaceResult(
                    candidate=ReviewCandidate(candidate_id="place-2", title="Place 2"),
                    reviews=[Review(author="B", rating=5.0, text="Review 2")],
                ),
            ],
            started_at=None,
            finished_at=None,
        )
        self.store.save(job)

        with self.assertRaises(HTTPException) as raised:
            asyncio.run(self.manager.get_job_reviews(job_id="job-1"))

        self.assertEqual(raised.exception.status_code, 409)

    def test_run_job_persists_auto_selected_candidate_from_exact_locator(self) -> None:
        request = ReviewJobCreateRequest(
            business_name="adidas outlet",
            lang="en",
            depth=1,
            exact_place_locator="https://www.google.com/maps/place/?q=place_id:place-2",
        )
        job = self.manager.create_job(request)
        place_results = [
            PlaceResult(
                candidate=ReviewCandidate(
                    candidate_id="place-1",
                    title="Adidas",
                    link="https://www.google.com/maps/place/adidas-1",
                    place_id="place-1",
                ),
                reviews=[Review(author="A", rating=4.0, text="Review 1")],
            ),
            PlaceResult(
                candidate=ReviewCandidate(
                    candidate_id="place-2",
                    title="Adidas Outlet Store",
                    link="https://www.google.com/maps/place/adidas-2",
                    place_id="place-2",
                ),
                reviews=[Review(author="B", rating=5.0, text="Review 2")],
            ),
        ]

        async def fake_find_places(*, business_name: str, depth: int, lang: str):
            del business_name, depth, lang
            return place_results

        async def fake_fetch_candidate_reviews(candidate, *, lang: str):
            del candidate, lang
            return [Review(author="B", rating=5.0, text="Review 2")]

        with patch("app.review_jobs.find_places", side_effect=fake_find_places), patch(
            "app.review_jobs.fetch_candidate_reviews",
            side_effect=fake_fetch_candidate_reviews,
        ):
            asyncio.run(self.manager.run_job(job.job_id))

        stored = self.store.get(job.job_id)
        self.assertIsNotNone(stored)
        assert stored is not None
        self.assertEqual(stored.status, "success")
        self.assertEqual(stored.selected_candidate_id, "place-2")

        reviews = asyncio.run(self.manager.get_job_reviews(job_id=job.job_id))
        self.assertEqual(len(reviews.reviews), 1)
        self.assertEqual(reviews.reviews[0].text, "Review 2")

    def test_get_job_reviews_fetches_missing_reviews_for_selected_candidate(self) -> None:
        job = StoredReviewJob(
            job_id="job-2",
            business_name="Cafe Amal",
            status="success",
            provider_status="done",
            message="Ready",
            selected_candidate_id="place-1",
            candidates=[ReviewCandidate(candidate_id="place-1", title="Place 1", place_id="place-1")],
            place_results=[
                PlaceResult(
                    candidate=ReviewCandidate(candidate_id="place-1", title="Place 1", place_id="place-1"),
                    reviews=[],
                )
            ],
        )
        self.store.save(job)

        async def fake_fetch_candidate_reviews(candidate, *, lang: str):
            del candidate, lang
            return [Review(author="A", rating=4.0, text="Fetched later")]

        with patch(
            "app.review_jobs.fetch_candidate_reviews",
            side_effect=fake_fetch_candidate_reviews,
        ):
            result = asyncio.run(self.manager.get_job_reviews(job_id="job-2"))

        self.assertEqual(len(result.reviews), 1)
        self.assertEqual(result.reviews[0].text, "Fetched later")


if __name__ == "__main__":
    unittest.main()
