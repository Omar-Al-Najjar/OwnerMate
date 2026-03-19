from typing import Protocol

from ...schemas.review import (
    FacebookFetchedReview,
    FacebookReviewImportSourceRequest,
    GoogleFetchedReview,
    GoogleReviewImportSourceRequest,
)


class GoogleReviewImportProvider(Protocol):
    provider_name: str

    def fetch_reviews(
        self, payload: GoogleReviewImportSourceRequest
    ) -> list[GoogleFetchedReview]:
        ...


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
