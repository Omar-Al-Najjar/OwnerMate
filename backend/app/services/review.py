from collections.abc import Sequence
from uuid import UUID

from fastapi import status
from sqlalchemy.exc import IntegrityError

from ..core.exceptions import AppError
from ..models.review import Review
from ..repositories.business import BusinessRepository
from ..repositories.review import ReviewRepository
from ..schemas.review import (
    ReviewImportDuplicate,
    ReviewImportRequest,
    ReviewImportResult,
    ReviewImportItem,
    ReviewBusinessScope,
    ReviewDetailResponse,
    ReviewListQuery,
    ReviewRead,
    ReviewStatusUpdateRequest,
)


class ReviewService:
    def __init__(
        self,
        *,
        review_repository: ReviewRepository,
        business_repository: BusinessRepository,
    ) -> None:
        self.review_repository = review_repository
        self.business_repository = business_repository

    def list_reviews(self, query: ReviewListQuery) -> list[ReviewRead]:
        self._ensure_business_exists(query.business_id)
        reviews = self.review_repository.list_reviews(
            business_id=query.business_id,
            review_source_id=query.review_source_id,
            source_type=query.source_type,
            status=query.status,
            language=query.language,
            min_rating=query.min_rating,
            max_rating=query.max_rating,
            reviewer_name=query.reviewer_name,
            search_text=query.search_text,
            created_from=query.created_from,
            created_to=query.created_to,
            limit=query.limit,
            offset=query.offset,
        )
        return [ReviewRead.model_validate(review) for review in reviews]

    def get_review(self, review_id: UUID, scope: ReviewBusinessScope) -> ReviewDetailResponse:
        self._ensure_business_exists(scope.business_id)
        review = self.review_repository.get_by_id(review_id, business_id=scope.business_id)
        if review is None:
            raise AppError(
                code="REVIEW_NOT_FOUND",
                message="Review not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return ReviewDetailResponse.model_validate(review)

    def import_reviews(self, payload: ReviewImportRequest) -> ReviewImportResult:
        self._ensure_business_exists(payload.business_id)

        normalized_items = [self._normalize_item(item) for item in payload.reviews]
        deduped_items, payload_duplicates = self._drop_duplicate_items_in_payload(
            normalized_items
        )
        source_ids = [item.source_review_id for item in deduped_items]
        existing_ids = self.review_repository.get_existing_source_ids(
            business_id=payload.business_id,
            source_type=payload.source,
            source_review_ids=source_ids,
        )

        duplicates: list[ReviewImportDuplicate] = list(payload_duplicates)
        pending_reviews: list[Review] = []

        for item in deduped_items:
            if item.source_review_id in existing_ids:
                duplicates.append(
                    ReviewImportDuplicate(
                        source_review_id=item.source_review_id,
                        reason="already_imported",
                    )
                )
                continue

            pending_reviews.append(
                Review(
                    business_id=payload.business_id,
                    review_source_id=payload.review_source_id,
                    source_type=payload.source,
                    source_review_id=item.source_review_id,
                    reviewer_name=item.reviewer_name,
                    rating=item.rating,
                    language=item.language,
                    review_text=item.review_text,
                    source_metadata=item.source_metadata,
                    review_created_at=item.review_created_at,
                    status=item.status,
                    response_status=item.response_status,
                )
            )

        try:
            created = self.review_repository.add_many(pending_reviews) if pending_reviews else []
            self.review_repository.save()
        except IntegrityError as exc:
            self.review_repository.rollback()
            raise AppError(
                code="REVIEW_IMPORT_CONFLICT",
                message="Review import conflicted with existing records.",
                status_code=status.HTTP_409_CONFLICT,
                details={"reason": str(exc.orig)},
            ) from exc

        imported_reviews = [ReviewRead.model_validate(review) for review in created]
        unique_duplicates = self._deduplicate_duplicate_results(duplicates)
        return ReviewImportResult(
            source=payload.source,
            business_id=payload.business_id,
            review_source_id=payload.review_source_id,
            requested_count=len(payload.reviews),
            imported_count=len(imported_reviews),
            duplicate_count=len(unique_duplicates),
            processed_count=len(payload.reviews),
            imported_reviews=imported_reviews,
            duplicates=unique_duplicates,
        )

    def update_review_status(
        self,
        review_id: UUID,
        scope: ReviewBusinessScope,
        payload: ReviewStatusUpdateRequest,
    ) -> ReviewRead:
        self._ensure_business_exists(scope.business_id)
        review = self.review_repository.get_by_id(review_id, business_id=scope.business_id)
        if review is None:
            raise AppError(
                code="REVIEW_NOT_FOUND",
                message="Review not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        review.status = payload.status
        self.review_repository.save()
        self.review_repository.refresh(review)
        return ReviewRead.model_validate(review)

    def _ensure_business_exists(self, business_id: UUID) -> None:
        business = self.business_repository.get_by_id(business_id)
        if business is None:
            raise AppError(
                code="BUSINESS_NOT_FOUND",
                message="Business not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

    def _normalize_item(self, item: ReviewImportItem) -> ReviewImportItem:
        normalized_language = item.language.lower() if item.language else None
        return item.model_copy(
            update={
                "language": normalized_language,
                "review_text": item.review_text.strip(),
                "reviewer_name": item.reviewer_name.strip()
                if item.reviewer_name
                else None,
                "response_status": item.response_status.strip()
                if item.response_status
                else None,
                "source_metadata": item.source_metadata or None,
            }
        )

    def _drop_duplicate_items_in_payload(
        self, items: Sequence[ReviewImportItem]
    ) -> tuple[list[ReviewImportItem], list[ReviewImportDuplicate]]:
        seen: set[str] = set()
        deduped: list[ReviewImportItem] = []
        duplicates: list[ReviewImportDuplicate] = []
        for item in items:
            if item.source_review_id in seen:
                duplicates.append(
                    ReviewImportDuplicate(
                        source_review_id=item.source_review_id,
                        reason="duplicate_in_payload",
                    )
                )
                continue
            seen.add(item.source_review_id)
            deduped.append(item)
        return deduped, duplicates

    def _deduplicate_duplicate_results(
        self, duplicates: Sequence[ReviewImportDuplicate]
    ) -> list[ReviewImportDuplicate]:
        unique_by_key: dict[tuple[str, str], ReviewImportDuplicate] = {}
        for duplicate in duplicates:
            unique_by_key[(duplicate.source_review_id, duplicate.reason)] = duplicate
        return sorted(
            unique_by_key.values(),
            key=lambda duplicate: (duplicate.source_review_id, duplicate.reason),
        )
