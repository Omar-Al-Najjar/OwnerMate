from datetime import datetime
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func, select

from ..models.review import Review
from ..models.sentiment_result import SentimentResult
from .base import Repository


class ReviewRepository(Repository):
    def _latest_sentiment_subquery(self):
        ranked_sentiments = (
            select(
                SentimentResult.review_id.label("review_id"),
                SentimentResult.label.label("sentiment_label"),
                func.row_number()
                .over(
                    partition_by=SentimentResult.review_id,
                    order_by=(
                        SentimentResult.processed_at.desc(),
                        SentimentResult.created_at.desc(),
                    ),
                )
                .label("sentiment_rank"),
            )
            .subquery()
        )

        return (
            select(
                ranked_sentiments.c.review_id,
                ranked_sentiments.c.sentiment_label,
            )
            .where(ranked_sentiments.c.sentiment_rank == 1)
            .subquery()
        )

    def _apply_list_review_filters(
        self,
        statement,
        *,
        review_source_id: UUID | None = None,
        source_type: str | None = None,
        status: str | None = None,
        sentiment_label: str | None = None,
        language: str | None = None,
        min_rating: int | None = None,
        max_rating: int | None = None,
        reviewer_name: str | None = None,
        search_text: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        latest_sentiment_subquery=None,
    ):
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
        if sentiment_label and latest_sentiment_subquery is not None:
            statement = statement.where(
                latest_sentiment_subquery.c.sentiment_label == sentiment_label
            )

        return statement

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

    def list_review_page(
        self,
        *,
        business_id: UUID,
        review_source_id: UUID | None = None,
        source_type: str | None = None,
        status: str | None = None,
        sentiment_label: str | None = None,
        language: str | None = None,
        min_rating: int | None = None,
        max_rating: int | None = None,
        reviewer_name: str | None = None,
        search_text: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        date_order: str = "newest",
        limit: int = 25,
        offset: int = 0,
    ) -> Sequence[dict]:
        latest_sentiment_subquery = self._latest_sentiment_subquery()
        statement = (
            select(
                Review.id.label("id"),
                Review.source_type.label("source_type"),
                Review.reviewer_name.label("reviewer_name"),
                Review.rating.label("rating"),
                Review.language.label("language"),
                Review.review_text.label("review_text"),
                Review.review_created_at.label("review_created_at"),
                Review.status.label("status"),
                latest_sentiment_subquery.c.sentiment_label.label("sentiment_label"),
            )
            .select_from(Review)
            .outerjoin(
                latest_sentiment_subquery,
                latest_sentiment_subquery.c.review_id == Review.id,
            )
            .where(Review.business_id == business_id)
        )

        statement = self._apply_list_review_filters(
            statement,
            review_source_id=review_source_id,
            source_type=source_type,
            status=status,
            sentiment_label=sentiment_label,
            language=language,
            min_rating=min_rating,
            max_rating=max_rating,
            reviewer_name=reviewer_name,
            search_text=search_text,
            created_from=created_from,
            created_to=created_to,
            latest_sentiment_subquery=latest_sentiment_subquery,
        )

        created_order = (
            Review.review_created_at.asc().nullsfirst()
            if date_order == "oldest"
            else Review.review_created_at.desc().nullslast()
        )
        created_at_order = (
            Review.created_at.asc() if date_order == "oldest" else Review.created_at.desc()
        )

        statement = statement.order_by(created_order, created_at_order).limit(limit).offset(
            offset
        )
        return self.session.execute(statement).mappings().all()

    def count_review_page(
        self,
        *,
        business_id: UUID,
        review_source_id: UUID | None = None,
        source_type: str | None = None,
        status: str | None = None,
        sentiment_label: str | None = None,
        language: str | None = None,
        min_rating: int | None = None,
        max_rating: int | None = None,
        reviewer_name: str | None = None,
        search_text: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
    ) -> int:
        latest_sentiment_subquery = self._latest_sentiment_subquery()
        statement = (
            select(func.count())
            .select_from(Review)
            .outerjoin(
                latest_sentiment_subquery,
                latest_sentiment_subquery.c.review_id == Review.id,
            )
            .where(Review.business_id == business_id)
        )

        statement = self._apply_list_review_filters(
            statement,
            review_source_id=review_source_id,
            source_type=source_type,
            status=status,
            sentiment_label=sentiment_label,
            language=language,
            min_rating=min_rating,
            max_rating=max_rating,
            reviewer_name=reviewer_name,
            search_text=search_text,
            created_from=created_from,
            created_to=created_to,
            latest_sentiment_subquery=latest_sentiment_subquery,
        )
        return int(self.session.scalar(statement) or 0)

    def list_source_types(self, *, business_id: UUID) -> Sequence[str]:
        statement = (
            select(Review.source_type)
            .where(Review.business_id == business_id)
            .distinct()
            .order_by(Review.source_type.asc())
        )
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
