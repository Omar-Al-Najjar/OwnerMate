from collections.abc import Sequence

from sqlalchemy import select

from ..models.sentiment_result import SentimentResult
from .base import Repository


class SentimentResultRepository(Repository):
    def add(self, sentiment_result: SentimentResult) -> SentimentResult:
        self.session.add(sentiment_result)
        self.session.flush()
        self.session.refresh(sentiment_result)
        return sentiment_result

    def get_latest_by_review_id(self, review_id) -> SentimentResult | None:
        statement = (
            select(SentimentResult)
            .where(SentimentResult.review_id == review_id)
            .order_by(SentimentResult.processed_at.desc(), SentimentResult.created_at.desc())
            .limit(1)
        )
        return self.session.scalar(statement)

    def get_latest_by_review_ids(
        self, review_ids: Sequence
    ) -> dict:
        if not review_ids:
            return {}

        statement = (
            select(SentimentResult)
            .where(SentimentResult.review_id.in_(review_ids))
            .order_by(
                SentimentResult.review_id,
                SentimentResult.processed_at.desc(),
                SentimentResult.created_at.desc(),
            )
        )
        latest_by_review_id: dict = {}
        for sentiment_result in self.session.scalars(statement):
            latest_by_review_id.setdefault(sentiment_result.review_id, sentiment_result)
        return latest_by_review_id

    def refresh(self, sentiment_result: SentimentResult) -> None:
        self.session.refresh(sentiment_result)

    def save(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()
