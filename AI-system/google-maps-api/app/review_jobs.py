from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException, status

from app.job_store import ReviewJobStore
from app.models import (
    PlaceResult,
    Review,
    ReviewCandidate,
    ReviewCandidatesResponse,
    ReviewJobCreateRequest,
    ReviewJobRead,
    ReviewJobReviewsResponse,
    StoredReviewJob,
)
from app.review_page_client import ReviewPageScrapeError, fetch_candidate_reviews
from app.scraper_client import ScraperError, find_places


class ReviewJobManager:
    def __init__(self, store: ReviewJobStore | None = None) -> None:
        self.store = store or ReviewJobStore()

    def create_job(self, request: ReviewJobCreateRequest) -> ReviewJobRead:
        job = StoredReviewJob(
            job_id=str(uuid4()),
            business_name=request.business_name,
            exact_place_locator=request.exact_place_locator,
            depth=request.depth,
            lang=request.lang,
            status="queued",
            provider_status="pending",
            message=f"Google review collection started for {request.business_name}.",
            started_at=datetime.now(UTC),
        )
        self.store.save(job)
        return self._to_job_read(job)

    async def run_job(self, job_id: str) -> None:
        job = self._get_job_or_raise(job_id)
        if job.status in {"success", "failed", "needs_selection"}:
            return

        job.status = "running"
        job.provider_status = "searching"
        job.message = f"Google review collection is running for {job.business_name}."
        self.store.save(job)

        try:
            place_results = await find_places(
                business_name=job.business_name,
                depth=job.depth,
                lang=job.lang,
            )
        except ScraperError as exc:
            self._mark_failed(job, str(exc))
            return
        except Exception as exc:  # pragma: no cover - defensive guard
            self._mark_failed(job, f"Unexpected error while collecting Google reviews: {exc}")
            return

        selected_candidate_id = self._select_candidate_id(
            place_results,
            job.exact_place_locator,
        )
        job.candidates = [result.candidate for result in place_results]
        job.selected_candidate_id = selected_candidate_id
        job.place_results = place_results
        job.finished_at = datetime.now(UTC)

        if len(place_results) > 1 and selected_candidate_id is None:
            job.status = "needs_selection"
            job.provider_status = "ambiguous"
            job.message = (
                f"Multiple Google places matched {job.business_name}. "
                "Choose the correct place before importing reviews."
            )
            self.store.save(job)
            return

        try:
            selected_place_result = self._select_place_result(
                job.place_results,
                candidate_id=selected_candidate_id,
            )
            try:
                fetched_reviews = await self._fetch_reviews_for_candidate(
                    job=job,
                    candidate=selected_place_result.candidate,
                )
            except ReviewPageScrapeError:
                if not selected_place_result.reviews:
                    raise
            else:
                selected_place_result.reviews = self._merge_reviews(
                    selected_place_result.reviews,
                    fetched_reviews,
                )
            self.store.save(job)
        except ReviewPageScrapeError as exc:
            self._mark_failed(job, str(exc))
            return

        job.status = "success"
        job.provider_status = "done"
        job.message = f"Google review collection completed for {job.business_name}."
        self.store.save(job)

    def get_job(self, job_id: str) -> ReviewJobRead:
        job = self._get_job_or_raise(job_id)
        job = self.store.mark_timed_out_if_stale(job)
        return self._to_job_read(job)

    async def search_candidates(
        self,
        request: ReviewJobCreateRequest,
    ) -> ReviewCandidatesResponse:
        try:
            place_results = await find_places(
                business_name=request.business_name,
                depth=request.depth,
                lang=request.lang,
            )
        except ScraperError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        candidates = [result.candidate for result in place_results]
        message = f"Found {len(candidates)} Google places for {request.business_name}."
        return ReviewCandidatesResponse(
            business_name=request.business_name,
            message=message,
            candidates=candidates,
        )

    async def get_job_reviews(
        self,
        *,
        job_id: str,
        candidate_id: str | None = None,
    ) -> ReviewJobReviewsResponse:
        job = self._get_job_or_raise(job_id)
        job = self.store.mark_timed_out_if_stale(job)

        if job.status in {"queued", "running"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Google review collection is still running for this job.",
            )
        if job.status == "failed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=job.message,
            )

        place_result = self._select_place_result(
            job.place_results,
            candidate_id=candidate_id,
            fallback_candidate_id=job.selected_candidate_id,
        )
        if not place_result.reviews:
            place_result.reviews = await self._fetch_reviews_for_candidate(
                job=job,
                candidate=place_result.candidate,
            )
            self.store.save(job)
        return ReviewJobReviewsResponse(
            job_id=job.job_id,
            business_name=job.business_name,
            reviews=list(place_result.reviews),
        )

    def _select_place_result(
        self,
        place_results: list[PlaceResult],
        *,
        candidate_id: str | None,
        fallback_candidate_id: str | None = None,
    ) -> PlaceResult:
        selected_candidate_id = candidate_id or fallback_candidate_id
        if selected_candidate_id:
            for result in place_results:
                if result.candidate.candidate_id == selected_candidate_id:
                    return result
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected Google place was not found for this job.",
            )

        if len(place_results) == 1:
            return place_results[0]

        if len(place_results) == 0:
            return PlaceResult(
                candidate=ReviewCandidate(
                    candidate_id="empty",
                    title="Google place",
                ),
                reviews=[],
            )

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This job matched multiple Google places. Provide candidate_id to choose one.",
        )

    def _select_candidate_id(
        self,
        place_results: list[PlaceResult],
        exact_place_locator: str | None,
    ) -> str | None:
        if len(place_results) == 1:
            return place_results[0].candidate.candidate_id
        if not exact_place_locator:
            return None

        normalized_locator = exact_place_locator.strip().lower()
        for result in place_results:
            candidate = result.candidate
            if candidate.link and normalized_locator in candidate.link.strip().lower():
                return candidate.candidate_id
            if candidate.link and candidate.link.strip().lower() in normalized_locator:
                return candidate.candidate_id
            if candidate.place_id and candidate.place_id.strip().lower() in normalized_locator:
                return candidate.candidate_id
        return None

    def _mark_failed(self, job: StoredReviewJob, message: str) -> None:
        normalized = message.lower()
        provider_status = "timed_out" if "timed out" in normalized else "error"
        if provider_status == "timed_out":
            message = (
                f"Google review lookup timed out for {job.business_name}. "
                "Try a more specific business name, branch, or city."
            )

        job.status = "failed"
        job.provider_status = provider_status
        job.message = message
        job.finished_at = datetime.now(UTC)
        self.store.save(job)

    async def _fetch_reviews_for_candidate(
        self,
        *,
        job: StoredReviewJob,
        candidate: ReviewCandidate,
    ):
        return await fetch_candidate_reviews(candidate, lang=job.lang)

    def _merge_reviews(
        self,
        existing_reviews: list[Review],
        fetched_reviews: list[Review],
    ) -> list[Review]:
        merged: list[Review] = []
        seen: set[str] = set()

        for review in [*existing_reviews, *fetched_reviews]:
            identity = self._build_review_identity(review)
            if identity in seen:
                continue
            seen.add(identity)
            merged.append(review)

        return merged

    def _build_review_identity(self, review: Review) -> str:
        return "|".join(
            [
                str(review.author or "").strip().lower(),
                str(review.rating or ""),
                str(review.text or "").strip(),
                str(review.date or "").strip().lower(),
            ]
        )

    def _get_job_or_raise(self, job_id: str) -> StoredReviewJob:
        job = self.store.get(job_id)
        if job is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Google review job not found.",
            )
        return job

    def _to_job_read(self, job: StoredReviewJob) -> ReviewJobRead:
        return ReviewJobRead(
            job_id=job.job_id,
            business_name=job.business_name,
            status=job.status,
            provider_status=job.provider_status,
            message=job.message,
            candidates=job.candidates,
            selected_candidate_id=job.selected_candidate_id,
            started_at=job.started_at,
            finished_at=job.finished_at,
        )
