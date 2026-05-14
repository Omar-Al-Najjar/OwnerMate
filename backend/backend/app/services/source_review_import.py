from uuid import UUID

from ..core.exceptions import AppError
from ..models.agent_run import AgentRun
from ..repositories.agent_run import AgentRunRepository
from ..schemas.review import (
    FacebookFetchedReview,
    FacebookReviewImportSourceRequest,
    GoogleFetchedReview,
    GoogleReviewImportCandidate,
    GoogleReviewImportJobRead,
    GoogleReviewImportSelectionRequest,
    GoogleReviewImportSourceRequest,
    ReviewImportItem,
    ReviewImportRequest,
    ReviewImportResult,
)
from .providers import (
    FacebookReviewImportProvider,
    GoogleReviewImportProvider,
    GoogleReviewImportProviderCandidate,
    GoogleReviewImportProviderJob,
)
from .review import ReviewService


class SourceReviewImportService:
    def __init__(
        self,
        *,
        review_service: ReviewService,
        google_provider: GoogleReviewImportProvider,
        facebook_provider: FacebookReviewImportProvider,
        agent_run_repository: AgentRunRepository,
    ) -> None:
        self.review_service = review_service
        self.google_provider = google_provider
        self.facebook_provider = facebook_provider
        self.agent_run_repository = agent_run_repository

    def create_google_import_job(
        self, payload: GoogleReviewImportSourceRequest
    ) -> GoogleReviewImportJobRead:
        provider_job = self.google_provider.create_import_job(payload)
        candidates = list(provider_job.candidates or [])
        status = provider_job.status
        provider_status = provider_job.provider_status
        message = provider_job.message
        selected_candidate_id: str | None = provider_job.selected_candidate_id
        selected_lookup: str | None = None
        selected_exact_locator: str | None = None

        agent_run = AgentRun(
            business_id=payload.business_id,
            agent_name="review_ingestion",
            task_type="import_google_reviews",
            status=self._normalize_agent_run_status(status),
            input_reference={
                "source": "google",
                "business_name": (
                    provider_job.business_name if provider_job is not None else self._resolve_payload_business_name(payload)
                ),
                "lang": payload.connection.lang if payload.connection else None,
                "depth": payload.connection.depth if payload.connection else 1,
                "fetch_limit": payload.fetch.limit,
                "provider": self.google_provider.provider_name,
                "provider_job_id": provider_job.provider_job_id,
                "provider_status": provider_status,
                "message": message,
                "job_status": status,
                "selected_candidate_id": selected_candidate_id,
                "selected_lookup": selected_lookup,
                "selected_exact_locator": selected_exact_locator,
                "candidates": [
                    self._build_google_candidate_read(candidate).model_dump(mode="json")
                    for candidate in candidates
                ],
            },
        )
        self.agent_run_repository.add(agent_run)
        self.agent_run_repository.save()
        self.agent_run_repository.refresh(agent_run)
        return self._build_google_job_read(agent_run=agent_run, provider_job=provider_job)

    def get_google_import_job(self, run_id: UUID) -> GoogleReviewImportJobRead:
        agent_run = self._get_agent_run_or_raise(run_id)

        if agent_run.task_type != "import_google_reviews":
            raise AppError(
                code="AGENT_RUN_NOT_FOUND",
                message="Google review import job not found.",
                status_code=404,
            )

        if agent_run.status in {"success", "failed"}:
            return self._build_google_job_read(agent_run=agent_run)

        input_reference = dict(agent_run.input_reference or {})
        provider_job_id = input_reference.get("provider_job_id")
        business_name = input_reference.get("business_name")
        if not provider_job_id:
            if input_reference.get("job_status") == "needs_selection":
                return self._build_google_job_read(agent_run=agent_run)
            raise AppError(
                code="GOOGLE_IMPORT_JOB_INVALID",
                message="Google review import job is missing provider metadata.",
                status_code=500,
            )
        if not business_name:
            raise AppError(
                code="GOOGLE_IMPORT_JOB_INVALID",
                message="Google review import job is missing provider metadata.",
                status_code=500,
            )

        provider_job = self.google_provider.get_import_job(
            provider_job_id=str(provider_job_id),
            business_name=str(business_name),
        )

        input_reference["provider_status"] = provider_job.provider_status
        input_reference["message"] = provider_job.message
        input_reference["job_status"] = provider_job.status
        if provider_job.selected_candidate_id:
            input_reference["selected_candidate_id"] = provider_job.selected_candidate_id
        input_reference["candidates"] = [
            self._build_google_candidate_read(candidate).model_dump(mode="json")
            for candidate in (provider_job.candidates or [])
        ]
        if agent_run.status != self._normalize_agent_run_status(provider_job.status):
            agent_run.status = self._normalize_agent_run_status(provider_job.status)
        agent_run.input_reference = input_reference
        self.agent_run_repository.save()
        self.agent_run_repository.refresh(agent_run)

        if provider_job.status == "success":
            finalized_result = self._finalize_google_import(
                agent_run=agent_run,
                payload=self._rebuild_google_payload(agent_run),
                provider_job=provider_job,
            )
            return finalized_result

        if provider_job.status == "needs_selection":
            return self._build_google_job_read(agent_run=agent_run, provider_job=provider_job)

        if provider_job.status == "failed":
            self.agent_run_repository.mark_failed(agent_run, error_message=provider_job.message)
            self.agent_run_repository.save()
            self.agent_run_repository.refresh(agent_run)
            return self._build_google_job_read(agent_run=agent_run, provider_job=provider_job)

        return self._build_google_job_read(agent_run=agent_run, provider_job=provider_job)

    def select_google_import_job_candidate(
        self,
        run_id: UUID,
        payload: GoogleReviewImportSelectionRequest,
    ) -> GoogleReviewImportJobRead:
        agent_run = self._get_agent_run_or_raise(run_id)
        input_reference = dict(agent_run.input_reference or {})
        stored_candidates = [
            GoogleReviewImportCandidate.model_validate(candidate)
            for candidate in (input_reference.get("candidates") or [])
            if isinstance(candidate, dict)
        ]
        if not stored_candidates and input_reference.get("provider_job_id"):
            provider_job = self.google_provider.get_import_job(
                provider_job_id=str(input_reference["provider_job_id"]),
                business_name=self._resolve_input_business_name(input_reference),
            )
            stored_candidates = [
                self._build_google_candidate_read(candidate)
                for candidate in (provider_job.candidates or [])
            ]
            input_reference["candidates"] = [
                candidate.model_dump(mode="json") for candidate in stored_candidates
            ]
        selected_candidate = self._find_candidate_or_raise(
            [
                GoogleReviewImportProviderCandidate(
                    candidate_id=candidate.candidate_id,
                    title=candidate.title,
                    category=candidate.category,
                    address=candidate.address,
                    review_count=candidate.review_count,
                    review_rating=candidate.review_rating,
                    place_id=candidate.place_id,
                    link=candidate.link,
                )
                for candidate in stored_candidates
            ],
            payload.candidate_id,
        )
        selected_lookup = self._build_candidate_lookup(selected_candidate)
        selected_exact_locator = self._build_candidate_exact_locator(selected_candidate)
        input_reference["selected_candidate_id"] = payload.candidate_id
        input_reference["selected_candidate_title"] = selected_candidate.title
        input_reference["selected_lookup"] = selected_lookup
        input_reference["selected_exact_locator"] = selected_exact_locator
        provider_job_id = input_reference.get("provider_job_id")
        business_name = self._resolve_input_business_name(input_reference)

        if not provider_job_id:
            provider_job = self.google_provider.create_import_job(
                self._rebuild_google_payload(agent_run),
                lookup_override=selected_lookup,
                exact_place_locator=selected_exact_locator,
            )
            input_reference["provider_job_id"] = provider_job.provider_job_id
            input_reference["provider_status"] = provider_job.provider_status
            input_reference["message"] = provider_job.message
            input_reference["job_status"] = provider_job.status
            agent_run.status = self._normalize_agent_run_status(provider_job.status)
            agent_run.input_reference = input_reference
            self.agent_run_repository.save()
            self.agent_run_repository.refresh(agent_run)
            return self._build_google_job_read(agent_run=agent_run, provider_job=provider_job)

        provider_job = self.google_provider.get_import_job(
            provider_job_id=str(provider_job_id),
            business_name=business_name,
        )
        agent_run.input_reference = input_reference
        self.agent_run_repository.save()
        self.agent_run_repository.refresh(agent_run)

        return self._finalize_google_import(
            agent_run=agent_run,
            payload=self._rebuild_google_payload(agent_run),
            provider_job=provider_job,
            candidate_id=payload.candidate_id,
        )

    def import_google_reviews(
        self, payload: GoogleReviewImportSourceRequest
    ) -> ReviewImportResult:
        fetched_reviews = self.google_provider.fetch_reviews(payload)
        return self._import_google_reviews_from_fetched(payload, fetched_reviews)

    def import_facebook_reviews(
        self, payload: FacebookReviewImportSourceRequest
    ) -> ReviewImportResult:
        fetched_reviews = self.facebook_provider.fetch_reviews(payload)
        selected_reviews = fetched_reviews[: payload.fetch.limit]
        if not selected_reviews:
            return self._build_empty_import_result(
                source="facebook",
                business_id=payload.business_id,
                review_source_id=payload.review_source_id,
            )
        import_payload = ReviewImportRequest(
            business_id=payload.business_id,
            review_source_id=payload.review_source_id,
            source="facebook",
            reviews=[self._build_facebook_import_item(review) for review in selected_reviews],
        )
        return self.review_service.import_reviews(import_payload)

    def _finalize_google_import(
        self,
        *,
        agent_run: AgentRun,
        payload: GoogleReviewImportSourceRequest,
        provider_job: GoogleReviewImportProviderJob,
        candidate_id: str | None = None,
    ) -> GoogleReviewImportJobRead:
        resolved_candidate_id = (
            candidate_id
            or provider_job.selected_candidate_id
            or dict(agent_run.input_reference or {}).get("selected_candidate_id")
        )
        fetched_reviews = self.google_provider.fetch_reviews_for_job(
            payload=payload,
            provider_job_id=provider_job.provider_job_id,
            candidate_id=resolved_candidate_id,
        )
        if not fetched_reviews:
            return self._mark_google_import_no_reviews(
                agent_run=agent_run,
                provider_job=provider_job,
                candidate_id=resolved_candidate_id,
            )

        import_result = self._import_google_reviews_from_fetched(
            payload,
            fetched_reviews,
        )
        self.agent_run_repository.mark_success(
            agent_run,
            output_reference={
                "provider_job_id": provider_job.provider_job_id,
                "provider_status": provider_job.provider_status,
                "message": provider_job.message,
                "business_name": provider_job.business_name,
                "selected_candidate_id": resolved_candidate_id,
                "imported_count": import_result.imported_count,
                "duplicate_count": import_result.duplicate_count,
                "processed_count": import_result.processed_count,
                "imported_reviews": [review.model_dump(mode="json") for review in import_result.imported_reviews],
                "duplicates": [duplicate.model_dump(mode="json") for duplicate in import_result.duplicates],
            },
        )
        self.agent_run_repository.save()
        self.agent_run_repository.refresh(agent_run)
        return self._build_google_job_read(agent_run=agent_run, provider_job=provider_job)

    def _mark_google_import_no_reviews(
        self,
        *,
        agent_run: AgentRun,
        provider_job: GoogleReviewImportProviderJob,
        candidate_id: str | None = None,
    ) -> GoogleReviewImportJobRead:
        message = (
            f"We found {provider_job.business_name} successfully, "
            "but no Google reviews were available to import."
        )
        input_reference = dict(agent_run.input_reference or {})
        input_reference["provider_status"] = "no_reviews"
        input_reference["job_status"] = "failed"
        input_reference["message"] = message
        agent_run.input_reference = input_reference
        agent_run.output_reference = {
            "provider_job_id": provider_job.provider_job_id,
            "provider_status": "no_reviews",
            "message": message,
            "business_name": provider_job.business_name,
            "selected_candidate_id": candidate_id,
            "imported_count": 0,
            "duplicate_count": 0,
            "processed_count": 0,
            "imported_reviews": [],
            "duplicates": [],
        }
        self.agent_run_repository.mark_failed(agent_run, error_message=message)
        self.agent_run_repository.save()
        self.agent_run_repository.refresh(agent_run)
        return self._build_google_job_read(agent_run=agent_run)

    def _import_google_reviews_from_fetched(
        self,
        payload: GoogleReviewImportSourceRequest,
        fetched_reviews: list[GoogleFetchedReview],
    ) -> ReviewImportResult:
        selected_reviews = fetched_reviews[: payload.fetch.limit]
        if not selected_reviews:
            return self._build_empty_import_result(
                source="google",
                business_id=payload.business_id,
                review_source_id=payload.review_source_id,
            )
        import_payload = ReviewImportRequest(
            business_id=payload.business_id,
            review_source_id=payload.review_source_id,
            source="google",
            reviews=[self._build_google_import_item(review) for review in selected_reviews],
        )
        return self.review_service.import_reviews(import_payload)

    def _rebuild_google_payload(self, agent_run: AgentRun) -> GoogleReviewImportSourceRequest:
        input_reference = dict(agent_run.input_reference or {})
        connection = {
            "business_name": input_reference.get("business_name"),
            "lang": input_reference.get("lang"),
            "depth": input_reference.get("depth") or 1,
        }
        fetch = {
            "limit": input_reference.get("fetch_limit") or 50,
        }
        return GoogleReviewImportSourceRequest.model_validate(
            {
                "business_id": str(agent_run.business_id),
                "connection": connection,
                "fetch": fetch,
            }
        )

    def _build_google_job_read(
        self,
        *,
        agent_run: AgentRun,
        provider_job: GoogleReviewImportProviderJob | None = None,
    ) -> GoogleReviewImportJobRead:
        input_reference = dict(agent_run.input_reference or {})
        output_reference = dict(agent_run.output_reference or {})
        effective_status = (
            agent_run.status
            if agent_run.status in {"success", "failed"}
            else (
                provider_job.status
                if provider_job is not None
                else input_reference.get("job_status") or agent_run.status
            )
        )
        provider_job_id = (
            provider_job.provider_job_id
            if provider_job is not None
            else input_reference.get("provider_job_id") or output_reference.get("provider_job_id")
        )
        provider_status = (
            provider_job.provider_status
            if provider_job is not None
            else input_reference.get("provider_status") or output_reference.get("provider_status")
        )
        business_name = (
            provider_job.business_name
            if provider_job is not None
            else str(
                input_reference.get("business_name")
                or output_reference.get("business_name")
                or "Google business"
            )
        )
        message = (
            str(
                output_reference.get("message")
                or (
                    provider_job.message
                    if provider_job is not None
                    else input_reference.get("message")
                )
                or self._default_job_message(agent_run.status, business_name)
            )
        )
        imported_reviews = output_reference.get("imported_reviews") or []
        duplicates = output_reference.get("duplicates") or []
        candidates = (
            [
                self._build_google_candidate_read(candidate)
                for candidate in (provider_job.candidates or [])
            ]
            if provider_job is not None
            else [
                GoogleReviewImportCandidate.model_validate(candidate)
                for candidate in (input_reference.get("candidates") or [])
                if isinstance(candidate, dict)
            ]
        )
        selected_candidate_id = (
            provider_job.selected_candidate_id
            if provider_job is not None and provider_job.selected_candidate_id is not None
            else (
            input_reference.get("selected_candidate_id")
            or output_reference.get("selected_candidate_id")
            )
        )

        return GoogleReviewImportJobRead(
            agent_run_id=agent_run.id,
            business_id=agent_run.business_id,
            status=self._normalize_google_job_status(effective_status),
            business_name=business_name,
            provider_name=str(input_reference.get("provider") or self.google_provider.provider_name),
            provider_job_id=str(provider_job_id) if provider_job_id is not None else None,
            provider_status=str(provider_status) if provider_status is not None else None,
            message=message,
            imported_count=output_reference.get("imported_count"),
            duplicate_count=output_reference.get("duplicate_count"),
            processed_count=output_reference.get("processed_count"),
            candidates=candidates,
            selected_candidate_id=(
                str(selected_candidate_id) if selected_candidate_id is not None else None
            ),
            imported_reviews=imported_reviews,
            duplicates=duplicates,
            started_at=agent_run.started_at,
            finished_at=agent_run.finished_at,
        )

    def _default_job_message(self, status: str, business_name: str) -> str:
        if status == "success":
            return f"Google review import completed for {business_name}."
        if status == "failed":
            return f"Google review import failed for {business_name}."
        if status == "queued":
            return f"Google review import is queued for {business_name}."
        return f"Google review import is running for {business_name}."

    def _normalize_agent_run_status(self, status: str) -> str:
        if status == "queued":
            return "queued"
        if status in {"running", "needs_selection"}:
            return "running"
        return status

    def _normalize_google_job_status(self, status: str) -> str:
        if status == "queued":
            return "queued"
        if status == "needs_selection":
            return "needs_selection"
        if status == "success":
            return "success"
        if status == "failed":
            return "failed"
        return "running"

    def _build_google_candidate_read(
        self,
        candidate: GoogleReviewImportProviderCandidate,
    ) -> GoogleReviewImportCandidate:
        return GoogleReviewImportCandidate(
            candidate_id=candidate.candidate_id,
            title=candidate.title,
            category=candidate.category,
            address=candidate.address,
            review_count=candidate.review_count,
            review_rating=candidate.review_rating,
            place_id=candidate.place_id,
            link=candidate.link,
        )

    def _find_candidate_or_raise(
        self,
        candidates: list[GoogleReviewImportProviderCandidate],
        candidate_id: str,
    ) -> GoogleReviewImportProviderCandidate:
        for candidate in candidates:
            if candidate.candidate_id == candidate_id:
                return candidate
        raise AppError(
            code="GOOGLE_IMPORT_CANDIDATE_NOT_FOUND",
            message="Selected Google place was not found for this import job.",
            status_code=404,
        )

    def _build_candidate_lookup(
        self,
        candidate: GoogleReviewImportProviderCandidate,
    ) -> str:
        title = candidate.title.strip()
        address = candidate.address.strip() if candidate.address else ""
        if address and address.casefold().startswith(title.casefold()):
            return address
        parts = [title]
        if address:
            parts.append(address)
        return ", ".join(part.strip() for part in parts if part and part.strip())

    def _build_candidate_exact_locator(
        self,
        candidate: GoogleReviewImportProviderCandidate,
    ) -> str | None:
        if candidate.link and candidate.link.strip():
            return candidate.link.strip()
        if candidate.place_id and candidate.place_id.strip():
            return (
                "https://www.google.com/maps/search/?api=1&query_place_id="
                f"{candidate.place_id.strip()}"
            )
        return None

    def _resolve_payload_business_name(self, payload: GoogleReviewImportSourceRequest) -> str:
        if payload.connection and payload.connection.business_name:
            return payload.connection.business_name
        return "Google business"

    def _resolve_input_business_name(self, input_reference: dict) -> str:
        return str(input_reference.get("business_name") or "Google business")

    def _get_agent_run_or_raise(self, run_id: UUID) -> AgentRun:
        agent_run = self.agent_run_repository.get_by_id(run_id)
        if agent_run is None:
            raise AppError(
                code="AGENT_RUN_NOT_FOUND",
                message="Agent run not found.",
                status_code=404,
            )
        return agent_run

    def _build_google_import_item(self, review: GoogleFetchedReview) -> ReviewImportItem:
        source_metadata = {
            "provider": self.google_provider.provider_name,
            "location_id": review.location_id,
            "location_name": review.location_name,
        }
        if review.original_payload:
            source_metadata["original_payload"] = review.original_payload

        return ReviewImportItem(
            source_review_id=review.review_id,
            reviewer_name=review.reviewer_name,
            rating=review.star_rating,
            language=review.language_code,
            review_text=review.comment,
            review_created_at=review.create_time,
            source_metadata={key: value for key, value in source_metadata.items() if value is not None},
        )

    def _build_facebook_import_item(self, review: FacebookFetchedReview) -> ReviewImportItem:
        source_metadata = {
            "provider": self.facebook_provider.provider_name,
            "page_id": review.page_id,
            "recommendation": review.recommendation,
        }
        if review.original_payload:
            source_metadata["original_payload"] = review.original_payload

        return ReviewImportItem(
            source_review_id=review.review_id,
            reviewer_name=review.reviewer_name,
            rating=review.rating,
            language=review.language_code,
            review_text=review.review_text,
            review_created_at=review.created_time,
            source_metadata={key: value for key, value in source_metadata.items() if value is not None},
        )

    def _build_empty_import_result(
        self,
        *,
        source: str,
        business_id,
        review_source_id,
    ) -> ReviewImportResult:
        return ReviewImportResult(
            source=source,
            business_id=business_id,
            review_source_id=review_source_id,
            requested_count=0,
            imported_count=0,
            duplicate_count=0,
            processed_count=0,
            imported_reviews=[],
            duplicates=[],
        )
