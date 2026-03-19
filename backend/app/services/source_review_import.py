from ..schemas.review import (
    FacebookFetchedReview,
    FacebookReviewImportSourceRequest,
    GoogleFetchedReview,
    GoogleReviewImportSourceRequest,
    ReviewImportItem,
    ReviewImportRequest,
    ReviewImportResult,
)
from .providers import FacebookReviewImportProvider, GoogleReviewImportProvider
from .review import ReviewService


class SourceReviewImportService:
    def __init__(
        self,
        *,
        review_service: ReviewService,
        google_provider: GoogleReviewImportProvider,
        facebook_provider: FacebookReviewImportProvider,
    ) -> None:
        self.review_service = review_service
        self.google_provider = google_provider
        self.facebook_provider = facebook_provider

    def import_google_reviews(
        self, payload: GoogleReviewImportSourceRequest
    ) -> ReviewImportResult:
        fetched_reviews = self.google_provider.fetch_reviews(payload)
        import_payload = ReviewImportRequest(
            business_id=payload.business_id,
            review_source_id=payload.review_source_id,
            source="google",
            reviews=[
                self._build_google_import_item(review)
                for review in fetched_reviews[: payload.fetch.limit]
            ],
        )
        return self.review_service.import_reviews(import_payload)

    def import_facebook_reviews(
        self, payload: FacebookReviewImportSourceRequest
    ) -> ReviewImportResult:
        fetched_reviews = self.facebook_provider.fetch_reviews(payload)
        import_payload = ReviewImportRequest(
            business_id=payload.business_id,
            review_source_id=payload.review_source_id,
            source="facebook",
            reviews=[
                self._build_facebook_import_item(review)
                for review in fetched_reviews[: payload.fetch.limit]
            ],
        )
        return self.review_service.import_reviews(import_payload)

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
