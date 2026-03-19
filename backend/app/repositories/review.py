from datetime import datetime
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func, select

from ..models.review import Review
from .base import Repository


class ReviewRepository(Repository):
    def list_reviews(
        self,
        *,
        business_id: UUID,
        review_source_id: UUID | None = None,
        source_type: str | None = None,
        status: str | None = None,
        language: str | None = None,
        min_rating: int | None = None,
        max_rating: int | None = None,
        reviewer_name: str | None = None,
        search_text: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[Review]:
        statement: Select[tuple[Review]] = select(Review).where(
            Review.business_id == business_id
        )

        if review_source_id:
            statement = statement.where(Review.review_source_id == review_source_id)
        if source_type:
            statement = statement.where(Review.source_type == source_type)
        if status:
            statement = statement.where(Review.status == status)
        if language:
            statement = statement.where(Review.language == language)
        if min_rating is not None:
            statement = statement.where(Review.rating >= min_rating)
        if max_rating is not None:
            statement = statement.where(Review.rating <= max_rating)
        if reviewer_name:
            statement = statement.where(
                func.lower(Review.reviewer_name).contains(reviewer_name)
            )
        if search_text:
            statement = statement.where(func.lower(Review.review_text).contains(search_text))
        if created_from is not None:
            statement = statement.where(Review.review_created_at >= created_from)
        if created_to is not None:
            statement = statement.where(Review.review_created_at <= created_to)

        statement = statement.order_by(
            Review.review_created_at.desc().nullslast(),
            Review.created_at.desc(),
        ).limit(limit).offset(offset)
        return self.session.scalars(statement).all()

    def get_by_id(
        self,
        review_id: UUID,
        *,
        business_id: UUID | None = None,
    ) -> Review | None:
        statement = select(Review).where(Review.id == review_id)
        if business_id is not None:
            statement = statement.where(Review.business_id == business_id)
        return self.session.scalar(statement)

    def get_existing_source_ids(
        self,
        *,
        business_id: UUID,
        source_type: str,
        source_review_ids: Sequence[str],
    ) -> set[str]:
        if not source_review_ids:
            return set()

        statement = select(Review.source_review_id).where(
            Review.business_id == business_id,
            Review.source_type == source_type,
            Review.source_review_id.in_(source_review_ids),
        )
        return set(self.session.scalars(statement).all())

    def add_many(self, reviews: Sequence[Review]) -> Sequence[Review]:
        self.session.add_all(reviews)
        self.session.flush()
        for review in reviews:
            self.session.refresh(review)
        return reviews

    def save(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()

    def refresh(self, review: Review) -> None:
        self.session.refresh(review)
