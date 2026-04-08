from dataclasses import dataclass
from hashlib import sha256
from typing import Any, Protocol

import httpx
from fastapi import status

from ...core.exceptions import AppError
from ...schemas.review import (
    FacebookFetchedReview,
    FacebookReviewImportSourceRequest,
    GoogleFetchedReview,
    GoogleReviewImportSourceRequest,
)


@dataclass
class GoogleReviewImportProviderCandidate:
    candidate_id: str
    title: str
    category: str | None
    address: str | None
    review_count: int | None
    review_rating: float | None
    place_id: str | None
    link: str | None


class GoogleReviewImportProvider(Protocol):
    provider_name: str

    def fetch_reviews(
        self, payload: GoogleReviewImportSourceRequest
    ) -> list[GoogleFetchedReview]:
        ...

    def create_import_job(
        self,
        payload: GoogleReviewImportSourceRequest,
        *,
        lookup_override: str | None = None,
        exact_place_locator: str | None = None,
    ) -> "GoogleReviewImportProviderJob":
        ...

    def search_candidates(
        self,
        payload: GoogleReviewImportSourceRequest,
    ) -> list["GoogleReviewImportProviderCandidate"]:
        ...

    def get_import_job(
        self,
        *,
        provider_job_id: str,
        business_name: str,
    ) -> "GoogleReviewImportProviderJob":
        ...

    def fetch_reviews_for_job(
        self,
        *,
        payload: GoogleReviewImportSourceRequest,
        provider_job_id: str,
        candidate_id: str | None = None,
    ) -> list[GoogleFetchedReview]:
        ...


@dataclass
class GoogleReviewImportProviderJob:
    provider_job_id: str
    business_name: str
    status: str
    provider_status: str | None
    message: str
    candidates: list[GoogleReviewImportProviderCandidate] | None = None
    selected_candidate_id: str | None = None


class FacebookReviewImportProvider(Protocol):
    provider_name: str

    def fetch_reviews(
        self, payload: FacebookReviewImportSourceRequest
    ) -> list[FacebookFetchedReview]:
        ...


class MockGoogleReviewImportProvider:
    provider_name = "mock_google_reviews"

    def fetch_reviews(
        self, payload: GoogleReviewImportSourceRequest
    ) -> list[GoogleFetchedReview]:
        if payload.mock_reviews:
            return payload.mock_reviews

        # TODO: Replace this stubbed fetch path with an approved Google Business Profile
        # integration when provider credentials and platform-compliant access are ready.
        location_id = payload.connection.location_id if payload.connection else None
        return [
            GoogleFetchedReview(
                review_id="google-demo-review-1",
                reviewer_name="Demo Customer",
                star_rating=5,
                comment="Great service and friendly staff.",
                language_code="en",
                location_id=location_id or "demo-location",
                location_name="Demo Google Location",
                original_payload={"stub": True, "provider": self.provider_name},
            )
        ]


class GoogleMapsApiReviewImportProvider:
    provider_name = "google_maps_api"

    def __init__(self, *, base_url: str, timeout_seconds: int = 900) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def fetch_reviews(
        self, payload: GoogleReviewImportSourceRequest
    ) -> list[GoogleFetchedReview]:
        if payload.mock_reviews:
            return payload.mock_reviews

        business_name = self._resolve_business_name(payload)
        connection = payload.connection
        request_payload = {
            "business_name": business_name,
            "depth": connection.depth if connection else 1,
            "lang": (connection.lang if connection and connection.lang else "en"),
        }

        try:
            response = httpx.post(
                f"{self.base_url}/reviews",
                json=request_payload,
                timeout=self.timeout_seconds,
            )
        except httpx.HTTPError as exc:
            raise AppError(
                code="GOOGLE_REVIEW_PROVIDER_ERROR",
                message="Failed to reach the Google Maps reviews service.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={"reason": str(exc)},
            ) from exc

        body = self._parse_response_body(response)
        raw_reviews = body.get("reviews")
        if not isinstance(raw_reviews, list):
            raise AppError(
                code="GOOGLE_REVIEW_PROVIDER_ERROR",
                message="Google Maps reviews service returned an invalid payload.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={"response": body},
            )

        normalized_reviews: list[GoogleFetchedReview] = []
        for review in raw_reviews:
            normalized = self._normalize_review(
                business_name=business_name,
                location_id=connection.location_id if connection else None,
                lang=request_payload["lang"],
                review=review,
            )
            if normalized is not None:
                normalized_reviews.append(normalized)

        return normalized_reviews

    def create_import_job(
        self,
        payload: GoogleReviewImportSourceRequest,
        *,
        lookup_override: str | None = None,
        exact_place_locator: str | None = None,
    ) -> GoogleReviewImportProviderJob:
        business_name = lookup_override or self._resolve_business_name(payload)
        connection = payload.connection
        request_payload = {
            "business_name": business_name,
            "exact_place_locator": exact_place_locator,
            "depth": connection.depth if connection else 1,
            "lang": (connection.lang if connection and connection.lang else "en"),
        }

        try:
            response = httpx.post(
                f"{self.base_url}/review-jobs",
                json=request_payload,
                timeout=30,
            )
        except httpx.HTTPError as exc:
            raise AppError(
                code="GOOGLE_REVIEW_PROVIDER_ERROR",
                message="Failed to create a Google review import job.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={"reason": str(exc)},
            ) from exc

        body = self._parse_response_body(response)
        provider_job_id = body.get("job_id")
        if not provider_job_id:
            raise AppError(
                code="GOOGLE_REVIEW_PROVIDER_ERROR",
                message="Google Maps reviews service did not return a job id.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={"response": body},
            )

        return GoogleReviewImportProviderJob(
            provider_job_id=str(provider_job_id),
            business_name=business_name,
            status=str(body.get("status") or "queued"),
            provider_status=(
                str(body.get("provider_status"))
                if body.get("provider_status") is not None
                else None
            ),
            message=str(
                body.get("message")
                or f"Google review collection started for {business_name}."
            ),
            candidates=[
                GoogleReviewImportProviderCandidate(
                    candidate_id=str(candidate.get("candidate_id")),
                    title=str(candidate.get("title") or "Google place"),
                    category=self._normalize_optional_string(candidate.get("category")),
                    address=self._normalize_optional_string(candidate.get("address")),
                    review_count=self._normalize_int(candidate.get("review_count")),
                    review_rating=self._normalize_float(candidate.get("review_rating")),
                    place_id=self._normalize_optional_string(candidate.get("place_id")),
                    link=self._normalize_optional_string(candidate.get("link")),
                )
                for candidate in (body.get("candidates") or [])
                if isinstance(candidate, dict) and candidate.get("candidate_id")
            ]
            or None,
            selected_candidate_id=self._normalize_optional_string(body.get("selected_candidate_id")),
        )

    def search_candidates(
        self,
        payload: GoogleReviewImportSourceRequest,
    ) -> list[GoogleReviewImportProviderCandidate]:
        business_name = self._resolve_business_name(payload)
        connection = payload.connection
        request_payload = {
            "business_name": business_name,
            "lang": (connection.lang if connection and connection.lang else "en"),
        }

        try:
            response = httpx.post(
                f"{self.base_url}/review-candidates",
                json=request_payload,
                timeout=30,
            )
        except httpx.HTTPError as exc:
            raise AppError(
                code="GOOGLE_REVIEW_PROVIDER_ERROR",
                message="Failed to search Google place candidates.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={"reason": str(exc)},
            ) from exc

        body = self._parse_response_body(response)
        return [
            GoogleReviewImportProviderCandidate(
                candidate_id=str(candidate.get("candidate_id")),
                title=str(candidate.get("title") or "Google place"),
                category=self._normalize_optional_string(candidate.get("category")),
                address=self._normalize_optional_string(candidate.get("address")),
                review_count=self._normalize_int(candidate.get("review_count")),
                review_rating=self._normalize_float(candidate.get("review_rating")),
                place_id=self._normalize_optional_string(candidate.get("place_id")),
                link=self._normalize_optional_string(candidate.get("link")),
            )
            for candidate in (body.get("candidates") or [])
            if isinstance(candidate, dict) and candidate.get("candidate_id")
        ]

    def get_import_job(
        self,
        *,
        provider_job_id: str,
        business_name: str,
    ) -> GoogleReviewImportProviderJob:
        try:
            response = httpx.get(
                f"{self.base_url}/review-jobs/{provider_job_id}",
                params={"business_name": business_name},
                timeout=30,
            )
        except httpx.HTTPError as exc:
            raise AppError(
                code="GOOGLE_REVIEW_PROVIDER_ERROR",
                message="Failed to fetch Google review import status.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={"reason": str(exc), "provider_job_id": provider_job_id},
            ) from exc

        body = self._parse_response_body(response)
        return GoogleReviewImportProviderJob(
            provider_job_id=provider_job_id,
            business_name=business_name,
            status=str(body.get("status") or "running"),
            provider_status=(
                str(body.get("provider_status"))
                if body.get("provider_status") is not None
                else None
            ),
            message=str(
                body.get("message")
                or f"Google review collection is still running for {business_name}."
            ),
            candidates=[
                GoogleReviewImportProviderCandidate(
                    candidate_id=str(candidate.get("candidate_id")),
                    title=str(candidate.get("title") or "Google place"),
                    category=self._normalize_optional_string(candidate.get("category")),
                    address=self._normalize_optional_string(candidate.get("address")),
                    review_count=self._normalize_int(candidate.get("review_count")),
                    review_rating=self._normalize_float(candidate.get("review_rating")),
                    place_id=self._normalize_optional_string(candidate.get("place_id")),
                    link=self._normalize_optional_string(candidate.get("link")),
                )
                for candidate in (body.get("candidates") or [])
                if isinstance(candidate, dict) and candidate.get("candidate_id")
            ]
            or None,
            selected_candidate_id=self._normalize_optional_string(body.get("selected_candidate_id")),
        )

    def fetch_reviews_for_job(
        self,
        *,
        payload: GoogleReviewImportSourceRequest,
        provider_job_id: str,
        candidate_id: str | None = None,
    ) -> list[GoogleFetchedReview]:
        if payload.mock_reviews:
            return payload.mock_reviews

        business_name = self._resolve_business_name(payload)
        try:
            response = httpx.get(
                f"{self.base_url}/review-jobs/{provider_job_id}/reviews",
                params={
                    "business_name": business_name,
                    **({"candidate_id": candidate_id} if candidate_id else {}),
                },
                timeout=self.timeout_seconds,
            )
        except httpx.HTTPError as exc:
            raise AppError(
                code="GOOGLE_REVIEW_PROVIDER_ERROR",
                message="Failed to download Google reviews from the completed import job.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={"reason": str(exc), "provider_job_id": provider_job_id},
            ) from exc

        body = self._parse_response_body(response)
        raw_reviews = body.get("reviews")
        if not isinstance(raw_reviews, list):
            raise AppError(
                code="GOOGLE_REVIEW_PROVIDER_ERROR",
                message="Google Maps reviews service returned an invalid reviews payload.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={"response": body},
            )

        connection = payload.connection
        normalized_reviews: list[GoogleFetchedReview] = []
        for review in raw_reviews:
            normalized = self._normalize_review(
                business_name=business_name,
                location_id=connection.location_id if connection else None,
                lang=(connection.lang if connection and connection.lang else "en"),
                review=review,
            )
            if normalized is not None:
                normalized_reviews.append(normalized)

        return normalized_reviews

    def _resolve_business_name(self, payload: GoogleReviewImportSourceRequest) -> str:
        connection = payload.connection
        candidates = [
            connection.business_name if connection else None,
            connection.location_id if connection else None,
            connection.account_id if connection else None,
        ]
        for candidate in candidates:
            if candidate:
                return candidate

        raise AppError(
            code="GOOGLE_REVIEW_QUERY_REQUIRED",
            message=(
                "A Google business lookup string is required. "
                "Provide connection.business_name for Google review import."
            ),
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        )

    def _parse_response_body(self, response: httpx.Response) -> dict[str, Any]:
        try:
            body = response.json()
        except ValueError as exc:
            raise AppError(
                code="GOOGLE_REVIEW_PROVIDER_ERROR",
                message="Google Maps reviews service returned non-JSON data.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={"status_code": response.status_code},
            ) from exc

        if response.status_code >= 400:
            provider_message = (
                body.get("detail")
                if isinstance(body, dict) and body.get("detail")
                else "Google Maps reviews service request failed."
            )
            message = self._normalize_provider_error_message(provider_message)
            raise AppError(
                code="GOOGLE_REVIEW_PROVIDER_ERROR",
                message=message,
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={
                    "status_code": response.status_code,
                    "response": body,
                },
            )

        if not isinstance(body, dict):
            raise AppError(
                code="GOOGLE_REVIEW_PROVIDER_ERROR",
                message="Google Maps reviews service returned an invalid payload.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={"response": body},
            )

        return body

    def _normalize_provider_error_message(self, message: str) -> str:
        normalized = message.lower()
        if "timed out waiting for job" in normalized or "scraping timed out" in normalized:
            return (
                "Google review import is taking longer than expected. "
                "Please try again with a more specific business name, branch, or city."
            )
        return message

    def _normalize_review(
        self,
        *,
        business_name: str,
        location_id: str | None,
        lang: str,
        review: Any,
    ) -> GoogleFetchedReview | None:
        if not isinstance(review, dict):
            return None

        comment = str(review.get("text") or "").strip()
        if not comment:
            return None

        reviewer_name = self._normalize_optional_string(review.get("author"))
        rating = self._normalize_rating(review.get("rating"))
        review_id = self._build_review_id(
            business_name=business_name,
            reviewer_name=reviewer_name,
            rating=rating,
            comment=comment,
        )

        return GoogleFetchedReview(
            review_id=review_id,
            reviewer_name=reviewer_name,
            star_rating=rating,
            comment=comment,
            language_code=lang,
            location_id=location_id,
            location_name=business_name,
            original_payload=review,
        )

    def _build_review_id(
        self,
        *,
        business_name: str,
        reviewer_name: str | None,
        rating: int | None,
        comment: str,
    ) -> str:
        identity = "|".join(
            [
                business_name.strip().lower(),
                (reviewer_name or "").strip().lower(),
                str(rating or ""),
                comment.strip(),
            ]
        )
        return f"gmaps-{sha256(identity.encode('utf-8')).hexdigest()[:24]}"

    def _normalize_optional_string(self, value: Any) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None

    def _normalize_rating(self, value: Any) -> int | None:
        if value is None:
            return None
        try:
            normalized = round(float(value))
        except (TypeError, ValueError):
            return None
        if normalized < 1 or normalized > 5:
            return None
        return int(normalized)

    def _normalize_int(self, value: Any) -> int | None:
        if value is None:
            return None
        try:
            return int(float(str(value).strip()))
        except (TypeError, ValueError):
            return None

    def _normalize_float(self, value: Any) -> float | None:
        if value is None:
            return None
        try:
            return float(str(value).strip())
        except (TypeError, ValueError):
            return None


class MockFacebookReviewImportProvider:
    provider_name = "mock_facebook_reviews"

    def fetch_reviews(
        self, payload: FacebookReviewImportSourceRequest
    ) -> list[FacebookFetchedReview]:
        if payload.mock_reviews:
            return payload.mock_reviews

        # TODO: Replace this stubbed fetch path with an approved Facebook/Meta integration
        # when compliant access, permissions, and app configuration are available.
        page_id = payload.connection.page_id if payload.connection else None
        return [
            FacebookFetchedReview(
                review_id="facebook-demo-review-1",
                reviewer_name="Demo Visitor",
                recommendation="positive",
                review_text="Loved the experience and would recommend this place.",
                language_code="en",
                page_id=page_id or "demo-page",
                original_payload={"stub": True, "provider": self.provider_name},
            )
        ]

    def create_import_job(
        self,
        payload: GoogleReviewImportSourceRequest,
        *,
        lookup_override: str | None = None,
        exact_place_locator: str | None = None,
    ) -> GoogleReviewImportProviderJob:
        del exact_place_locator
        business_name = (
            lookup_override
            or payload.connection.business_name
            if payload.connection and payload.connection.business_name
            else "Mock Google business"
        )
        return GoogleReviewImportProviderJob(
            provider_job_id="mock-google-import-job",
            business_name=business_name,
            status="success",
            provider_status="ok",
            message=f"Mock Google reviews are ready for {business_name}.",
        )

    def search_candidates(
        self,
        payload: GoogleReviewImportSourceRequest,
    ) -> list[GoogleReviewImportProviderCandidate]:
        business_name = (
            payload.connection.business_name
            if payload.connection and payload.connection.business_name
            else "Mock Google business"
        )
        return [
            GoogleReviewImportProviderCandidate(
                candidate_id="mock-place-1",
                title=business_name,
                category="Mock Google place",
                address="Mock address",
                review_count=None,
                review_rating=None,
                place_id="mock-place-1",
                link=None,
            )
        ]

    def get_import_job(
        self,
        *,
        provider_job_id: str,
        business_name: str,
    ) -> GoogleReviewImportProviderJob:
        return GoogleReviewImportProviderJob(
            provider_job_id=provider_job_id,
            business_name=business_name,
            status="success",
            provider_status="ok",
            message=f"Mock Google reviews are ready for {business_name}.",
        )

    def fetch_reviews_for_job(
        self,
        *,
        payload: GoogleReviewImportSourceRequest,
        provider_job_id: str,
        candidate_id: str | None = None,
    ) -> list[GoogleFetchedReview]:
        del provider_job_id, candidate_id
        return self.fetch_reviews(payload)
