from collections import Counter
from datetime import datetime, timezone

from ..repositories.review import ReviewRepository
from ..repositories.sales_record import SalesRecordRepository
from ..repositories.sentiment_result import SentimentResultRepository
from ..schemas.dashboard import (
    DashboardActivityItem,
    DashboardCapabilities,
    DashboardDistributions,
    DashboardDistributionBucket,
    DashboardMetricSummary,
    DashboardOverviewQuery,
    DashboardOverviewRead,
    DashboardPriorityReviewItem,
    DashboardRecentReviewItem,
    DashboardSalesRecord,
)


class DashboardService:
    def __init__(
        self,
        *,
        review_repository: ReviewRepository,
        sales_record_repository: SalesRecordRepository,
        sentiment_result_repository: SentimentResultRepository,
    ) -> None:
        self.review_repository = review_repository
        self.sales_record_repository = sales_record_repository
        self.sentiment_result_repository = sentiment_result_repository

    def get_overview(self, query: DashboardOverviewQuery) -> DashboardOverviewRead:
        reviews = list(
            self.review_repository.list_reviews(
                business_id=query.business_id,
                limit=query.limit,
                offset=0,
            )
        )
        latest_sentiments = self.sentiment_result_repository.get_latest_by_review_ids(
            [review.id for review in reviews]
        )
        sales_records = self.sales_record_repository.list_for_business(query.business_id)

        sentiment_counts = Counter(
            sentiment.label
            for sentiment in latest_sentiments.values()
            if sentiment.label in {"positive", "neutral", "negative"}
        )
        rating_values = [review.rating for review in reviews if review.rating is not None]
        total_reviews = len(reviews)

        return DashboardOverviewRead(
            business_id=query.business_id,
            generated_at=datetime.now(timezone.utc),
            metrics=DashboardMetricSummary(
                total_reviews=total_reviews,
                average_rating=(
                    round(sum(rating_values) / len(rating_values), 2) if rating_values else None
                ),
                positive_share=(
                    round((sentiment_counts["positive"] / total_reviews) * 100, 2)
                    if total_reviews
                    else 0
                ),
                negative_share=(
                    round((sentiment_counts["negative"] / total_reviews) * 100, 2)
                    if total_reviews
                    else 0
                ),
                pending_reviews=sum(1 for review in reviews if review.status == "pending"),
                reviewed_reviews=sum(1 for review in reviews if review.status == "reviewed"),
                responded_reviews=sum(1 for review in reviews if review.status == "responded"),
                active_sources=len({review.source_type for review in reviews}),
            ),
            distributions=DashboardDistributions(
                sentiment=self._build_distribution(
                    labels=["positive", "neutral", "negative"],
                    counts=sentiment_counts,
                    total=total_reviews,
                ),
                ratings=self._build_distribution(
                    labels=["5", "4", "3", "2", "1"],
                    counts=Counter(str(review.rating) for review in reviews if review.rating is not None),
                    total=total_reviews,
                ),
                sources=self._build_distribution(
                    labels=[label for label, _ in Counter(review.source_type for review in reviews).most_common()],
                    counts=Counter(review.source_type for review in reviews),
                    total=total_reviews,
                ),
                languages=self._build_distribution(
                    labels=[label for label, _ in Counter((review.language or "unknown") for review in reviews).most_common()],
                    counts=Counter((review.language or "unknown") for review in reviews),
                    total=total_reviews,
                ),
            ),
            recent_reviews=[
                self._to_recent_review_item(review, latest_sentiments.get(review.id))
                for review in reviews[: query.recent_limit]
            ],
            priority_reviews=self._build_priority_reviews(
                reviews=reviews,
                latest_sentiments=latest_sentiments,
                limit=query.priority_limit,
            ),
            activity_feed=[
                self._to_activity_item(review, latest_sentiments.get(review.id))
                for review in reviews[: query.activity_limit]
            ],
            sales_records=[
                DashboardSalesRecord(
                    record_date=record.record_date,
                    revenue=record.revenue,
                    orders=record.orders,
                    refund_count=record.refund_count,
                    refund_value=record.refund_value,
                    channel_revenue=record.channel_revenue or {},
                    products=record.products or [],
                )
                for record in sales_records
            ],
            capabilities=DashboardCapabilities(
                sales_data_available=bool(sales_records),
                sales_data_note=(
                    "Sales records are now available from persisted backend data."
                    if sales_records
                    else "Sales metrics are not available in the backend yet."
                ),
            ),
        )

    def _build_distribution(
        self,
        *,
        labels: list[str],
        counts: Counter,
        total: int,
    ) -> list[DashboardDistributionBucket]:
        return [
            DashboardDistributionBucket(
                label=label,
                value=counts.get(label, 0),
                share=round((counts.get(label, 0) / total), 4) if total else 0,
            )
            for label in labels
        ]

    def _to_recent_review_item(self, review, sentiment_result) -> DashboardRecentReviewItem:
        return DashboardRecentReviewItem(
            review_id=review.id,
            source_type=review.source_type,
            reviewer_name=review.reviewer_name,
            rating=review.rating,
            language=review.language,
            review_text=review.review_text,
            review_created_at=review.review_created_at,
            status=review.status,
            sentiment_label=sentiment_result.label if sentiment_result else None,
            sentiment_confidence=(
                float(sentiment_result.confidence)
                if sentiment_result and sentiment_result.confidence is not None
                else None
            ),
            summary_tags=(sentiment_result.summary_tags or []) if sentiment_result else [],
        )

    def _build_priority_reviews(self, *, reviews, latest_sentiments, limit: int):
        prioritized = []
        for review in reviews:
            sentiment_result = latest_sentiments.get(review.id)
            reason = self._get_priority_reason(review, sentiment_result)
            priority = self._get_priority_level(review, sentiment_result, reason)
            prioritized.append(
                DashboardPriorityReviewItem(
                    **self._to_recent_review_item(review, sentiment_result).model_dump(),
                    priority=priority,
                    reason=reason,
                )
            )

        prioritized.sort(
            key=lambda item: (
                self._get_priority_weight(item.priority),
                item.review_created_at or datetime.min.replace(tzinfo=timezone.utc),
            ),
            reverse=True,
        )
        return prioritized[:limit]

    def _to_activity_item(self, review, sentiment_result) -> DashboardActivityItem:
        sentiment_label = sentiment_result.label if sentiment_result else None
        if review.status == "pending" and sentiment_label == "negative":
            activity_type = "negative_alert"
        elif review.status == "pending":
            activity_type = "new_review"
        elif sentiment_label == "positive" and (review.rating or 0) >= 4:
            activity_type = "positive_signal"
        else:
            activity_type = "review_resolved"

        return DashboardActivityItem(
            review_id=review.id,
            type=activity_type,
            occurred_at=review.review_created_at,
            source_type=review.source_type,
            rating=review.rating,
            language=review.language,
            status=review.status,
            sentiment_label=sentiment_label,
            reviewer_name=review.reviewer_name,
        )

    def _get_priority_reason(self, review, sentiment_result):
        sentiment_label = sentiment_result.label if sentiment_result else None
        if sentiment_label == "negative" and (review.rating or 0) <= 2:
            return "negative_low_rating"
        if review.status == "pending" and sentiment_label == "negative":
            return "unreviewed_negative"
        if review.status == "pending":
            return "new_unreviewed"
        return "follow_up_needed"

    def _get_priority_level(self, review, sentiment_result, reason: str):
        confidence = (
            float(sentiment_result.confidence)
            if sentiment_result and sentiment_result.confidence is not None
            else 0
        )
        if reason == "negative_low_rating" or (
            reason == "unreviewed_negative" and confidence >= 0.85
        ):
            return "high"
        if reason in {"unreviewed_negative", "new_unreviewed"}:
            return "medium"
        return "low"

    def _get_priority_weight(self, priority: str) -> int:
        if priority == "high":
            return 3
        if priority == "medium":
            return 2
        return 1
