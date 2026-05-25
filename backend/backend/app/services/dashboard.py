from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
import logging
from time import monotonic, perf_counter
from typing import Any

from ..repositories.review import ReviewRepository
from ..repositories.sales_record import SalesRecordRepository
from ..repositories.sentiment_result import SentimentResultRepository
from ..schemas.dashboard import (
    DashboardActivityItem,
    DashboardCapabilities,
    DashboardComparison,
    DashboardComparisonMetric,
    DashboardDistributions,
    DashboardDistributionBucket,
    DashboardFilterOptions,
    DashboardMetricSummary,
    DashboardOverviewQuery,
    DashboardOverviewRead,
    DashboardPriorityReviewItem,
    DashboardRecentReviewItem,
    DashboardReviewTimeSeriesPoint,
    DashboardSalesRecord,
    DashboardSalesSummary,
)

SENTIMENT_LABELS = ("positive", "neutral", "negative")
DASHBOARD_OVERVIEW_CACHE_TTL_SECONDS = 60
_dashboard_overview_cache: dict[tuple, tuple[float, DashboardOverviewRead]] = {}
timing_logger = logging.getLogger("uvicorn.error")


@dataclass
class ReviewWindowContext:
    current_reviews: list[Any]
    previous_reviews: list[Any]
    latest_sentiments: dict[Any, Any]
    current_start: datetime | None
    current_end: datetime | None


@dataclass
class SalesWindowContext:
    current_records: list[Any]
    previous_records: list[Any]


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
        started_at = perf_counter()
        cache_key = (
            str(query.business_id),
            query.limit,
            query.recent_limit,
            query.priority_limit,
            query.activity_limit,
            query.range,
            query.source or "",
            query.language or "",
            query.sentiment or "",
        )
        cached = _dashboard_overview_cache.get(cache_key)
        if cached and cached[0] > monotonic():
            timing_logger.info("dashboard overview cache hit in %.1fms", (perf_counter() - started_at) * 1000)
            return cached[1]

        reviews = list(
            self.review_repository.list_reviews(
                business_id=query.business_id,
                limit=query.limit,
                offset=0,
            )
        )
        reviews_loaded_at = perf_counter()
        latest_sentiments = self.sentiment_result_repository.get_latest_by_review_ids(
            [review.id for review in reviews]
        )
        sentiments_loaded_at = perf_counter()
        sales_records = sorted(
            self.sales_record_repository.list_for_business(query.business_id),
            key=lambda record: record.record_date,
        )
        sales_loaded_at = perf_counter()

        review_context = self._build_review_window_context(
            query=query,
            reviews=reviews,
            latest_sentiments=latest_sentiments,
        )
        sales_context = self._build_sales_window_context(
            range_name=query.range,
            sales_records=sales_records,
        )

        overview = DashboardOverviewRead(
            business_id=query.business_id,
            generated_at=datetime.now(timezone.utc),
            metrics=self._build_metric_summary(
                review_context.current_reviews,
                latest_sentiments,
            ),
            distributions=self._build_distributions(
                review_context.current_reviews,
                latest_sentiments,
            ),
            recent_reviews=[
                self._to_recent_review_item(review, latest_sentiments.get(review.id))
                for review in review_context.current_reviews[: query.recent_limit]
            ],
            priority_reviews=self._build_priority_reviews(
                reviews=review_context.current_reviews,
                latest_sentiments=latest_sentiments,
                limit=query.priority_limit,
            ),
            activity_feed=[
                self._to_activity_item(review, latest_sentiments.get(review.id))
                for review in review_context.current_reviews[: query.activity_limit]
            ],
            filter_options=self._build_filter_options(reviews),
            review_timeseries=self._build_review_timeseries(
                reviews=review_context.current_reviews,
                latest_sentiments=latest_sentiments,
                current_start=review_context.current_start,
                current_end=review_context.current_end,
            ),
            comparison=self._build_comparison(
                review_context=review_context,
                sales_context=sales_context,
                latest_sentiments=latest_sentiments,
            ),
            sales_summary=self._build_sales_summary(sales_context.current_records),
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
                for record in sales_context.current_records
            ],
            capabilities=DashboardCapabilities(
                review_data_available=bool(reviews),
                sales_data_available=bool(sales_records),
                sales_data_note=(
                    "Sales records are now available from persisted backend data."
                    if sales_records
                    else "Sales metrics are not available in the backend yet."
                ),
            ),
        )
        finished_at = perf_counter()
        _dashboard_overview_cache[cache_key] = (
            monotonic() + DASHBOARD_OVERVIEW_CACHE_TTL_SECONDS,
            overview,
        )
        timing_logger.info(
            "dashboard overview timings reviews=%.1fms sentiments=%.1fms sales=%.1fms compute=%.1fms total=%.1fms",
            (reviews_loaded_at - started_at) * 1000,
            (sentiments_loaded_at - reviews_loaded_at) * 1000,
            (sales_loaded_at - sentiments_loaded_at) * 1000,
            (finished_at - sales_loaded_at) * 1000,
            (finished_at - started_at) * 1000,
        )
        return overview

    def _build_review_window_context(
        self,
        *,
        query: DashboardOverviewQuery,
        reviews: list[Any],
        latest_sentiments: dict[Any, Any],
    ) -> ReviewWindowContext:
        latest_timestamp = self._get_latest_review_timestamp(reviews)
        current_start: datetime | None = None
        current_end: datetime | None = latest_timestamp

        if latest_timestamp is not None and query.range != "all":
            day_count = 7 if query.range == "7d" else 30
            current_start = latest_timestamp - timedelta(days=day_count - 1)

        current_reviews = [
            review
            for review in reviews
            if self._matches_review_filters(
                review=review,
                sentiment_result=latest_sentiments.get(review.id),
                source=query.source,
                language=query.language,
                sentiment=query.sentiment,
                created_from=current_start,
                created_to=current_end,
            )
        ]

        previous_reviews: list[Any] = []
        if query.range != "all" and current_start is not None and current_end is not None:
            window_duration = current_end - current_start
            previous_end = current_start - timedelta(microseconds=1)
            previous_start = previous_end - window_duration
            previous_reviews = [
                review
                for review in reviews
                if self._matches_review_filters(
                    review=review,
                    sentiment_result=latest_sentiments.get(review.id),
                    source=query.source,
                    language=query.language,
                    sentiment=query.sentiment,
                    created_from=previous_start,
                    created_to=previous_end,
                )
            ]

        return ReviewWindowContext(
            current_reviews=current_reviews,
            previous_reviews=previous_reviews,
            latest_sentiments=latest_sentiments,
            current_start=current_start,
            current_end=current_end,
        )

    def _build_sales_window_context(
        self,
        *,
        range_name: str,
        sales_records: list[Any],
    ) -> SalesWindowContext:
        if range_name == "all" or not sales_records:
            return SalesWindowContext(current_records=sales_records, previous_records=[])

        latest_date = sales_records[-1].record_date
        day_count = 7 if range_name == "7d" else 30
        current_start = latest_date - timedelta(days=day_count - 1)
        current_records = [
            record for record in sales_records if record.record_date >= current_start
        ]

        window_duration_days = (latest_date - current_start).days
        previous_end = current_start - timedelta(days=1)
        previous_start = previous_end - timedelta(days=window_duration_days)
        previous_records = [
            record
            for record in sales_records
            if previous_start <= record.record_date <= previous_end
        ]

        return SalesWindowContext(
            current_records=current_records,
            previous_records=previous_records,
        )

    def _build_metric_summary(
        self,
        reviews: list[Any],
        latest_sentiments: dict[Any, Any],
    ) -> DashboardMetricSummary:
        total_reviews = len(reviews)
        rating_values = [review.rating for review in reviews if review.rating is not None]
        sentiment_counts = self._get_sentiment_counts(reviews, latest_sentiments)

        return DashboardMetricSummary(
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
        )

    def _build_distributions(
        self,
        reviews: list[Any],
        latest_sentiments: dict[Any, Any],
    ) -> DashboardDistributions:
        total_reviews = len(reviews)
        source_counts = Counter(review.source_type for review in reviews)
        language_counts = Counter((review.language or "unknown") for review in reviews)

        return DashboardDistributions(
            sentiment=self._build_distribution(
                labels=list(SENTIMENT_LABELS),
                counts=self._get_sentiment_counts(reviews, latest_sentiments),
                total=total_reviews,
            ),
            ratings=self._build_distribution(
                labels=["5", "4", "3", "2", "1"],
                counts=Counter(
                    str(review.rating) for review in reviews if review.rating is not None
                ),
                total=total_reviews,
            ),
            sources=self._build_distribution(
                labels=[label for label, _ in source_counts.most_common()],
                counts=source_counts,
                total=total_reviews,
            ),
            languages=self._build_distribution(
                labels=[label for label, _ in language_counts.most_common()],
                counts=language_counts,
                total=total_reviews,
            ),
        )

    def _build_filter_options(self, reviews: list[Any]) -> DashboardFilterOptions:
        sources = sorted(
            {
                review.source_type.strip().lower()
                for review in reviews
                if getattr(review, "source_type", None)
            }
        )
        languages = sorted(
            {
                review.language.strip().lower()
                for review in reviews
                if getattr(review, "language", None)
            }
        )
        return DashboardFilterOptions(sources=sources, languages=languages)

    def _build_review_timeseries(
        self,
        *,
        reviews: list[Any],
        latest_sentiments: dict[Any, Any],
        current_start: datetime | None,
        current_end: datetime | None,
    ) -> list[DashboardReviewTimeSeriesPoint]:
        if not reviews:
            return []

        bucket_counts: dict[date, dict[str, int]] = defaultdict(
            lambda: {"total_reviews": 0, "positive_reviews": 0}
        )
        review_dates = [self._get_review_timestamp(review).date() for review in reviews]
        start_date = current_start.date() if current_start is not None else min(review_dates)
        end_date = current_end.date() if current_end is not None else max(review_dates)

        for review in reviews:
            review_date = self._get_review_timestamp(review).date()
            bucket = bucket_counts[review_date]
            bucket["total_reviews"] += 1

            sentiment_result = latest_sentiments.get(review.id)
            if sentiment_result and sentiment_result.label == "positive":
                bucket["positive_reviews"] += 1

        points: list[DashboardReviewTimeSeriesPoint] = []
        cursor = start_date
        while cursor <= end_date:
            bucket = bucket_counts[cursor]
            total_reviews = bucket["total_reviews"]
            positive_reviews = bucket["positive_reviews"]
            points.append(
                DashboardReviewTimeSeriesPoint(
                    date=cursor,
                    total_reviews=total_reviews,
                    positive_reviews=positive_reviews,
                    positive_share=(
                        round((positive_reviews / total_reviews) * 100, 2)
                        if total_reviews
                        else 0
                    ),
                )
            )
            cursor += timedelta(days=1)

        return points

    def _build_sales_summary(self, sales_records: list[Any]) -> DashboardSalesSummary:
        total_revenue = sum(record.revenue for record in sales_records)
        total_orders = sum(record.orders for record in sales_records)
        refund_count = sum(record.refund_count for record in sales_records)
        refund_value = sum(record.refund_value for record in sales_records)
        average_order_value = total_revenue / total_orders if total_orders else 0
        refund_rate = (refund_count / total_orders) * 100 if total_orders else 0

        return DashboardSalesSummary(
            total_revenue=total_revenue,
            total_orders=total_orders,
            average_order_value=round(average_order_value, 2),
            refund_count=refund_count,
            refund_value=refund_value,
            refund_rate=round(refund_rate, 2),
        )

    def _build_comparison(
        self,
        *,
        review_context: ReviewWindowContext,
        sales_context: SalesWindowContext,
        latest_sentiments: dict[Any, Any],
    ) -> DashboardComparison:
        current_review_metrics = self._build_metric_summary(
            review_context.current_reviews,
            latest_sentiments,
        )
        previous_review_metrics = self._build_metric_summary(
            review_context.previous_reviews,
            latest_sentiments,
        )
        current_sales_summary = self._build_sales_summary(sales_context.current_records)
        previous_sales_summary = self._build_sales_summary(sales_context.previous_records)

        return DashboardComparison(
            total_reviews=self._build_comparison_metric(
                current_review_metrics.total_reviews,
                previous_review_metrics.total_reviews,
            ),
            average_rating=self._build_comparison_metric(
                current_review_metrics.average_rating,
                previous_review_metrics.average_rating,
            ),
            positive_share=self._build_comparison_metric(
                current_review_metrics.positive_share,
                previous_review_metrics.positive_share,
            ),
            negative_share=self._build_comparison_metric(
                current_review_metrics.negative_share,
                previous_review_metrics.negative_share,
            ),
            pending_reviews=self._build_comparison_metric(
                current_review_metrics.pending_reviews,
                previous_review_metrics.pending_reviews,
            ),
            reviewed_reviews=self._build_comparison_metric(
                current_review_metrics.reviewed_reviews,
                previous_review_metrics.reviewed_reviews,
            ),
            responded_reviews=self._build_comparison_metric(
                current_review_metrics.responded_reviews,
                previous_review_metrics.responded_reviews,
            ),
            active_sources=self._build_comparison_metric(
                current_review_metrics.active_sources,
                previous_review_metrics.active_sources,
            ),
            total_revenue=self._build_comparison_metric(
                current_sales_summary.total_revenue,
                previous_sales_summary.total_revenue,
            ),
            total_orders=self._build_comparison_metric(
                current_sales_summary.total_orders,
                previous_sales_summary.total_orders,
            ),
            average_order_value=self._build_comparison_metric(
                current_sales_summary.average_order_value,
                previous_sales_summary.average_order_value,
            ),
            refund_count=self._build_comparison_metric(
                current_sales_summary.refund_count,
                previous_sales_summary.refund_count,
            ),
            refund_value=self._build_comparison_metric(
                current_sales_summary.refund_value,
                previous_sales_summary.refund_value,
            ),
            refund_rate=self._build_comparison_metric(
                current_sales_summary.refund_rate,
                previous_sales_summary.refund_rate,
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

    def _to_recent_review_item(self, review: Any, sentiment_result: Any) -> DashboardRecentReviewItem:
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

    def _build_priority_reviews(
        self,
        *,
        reviews: list[Any],
        latest_sentiments: dict[Any, Any],
        limit: int,
    ) -> list[DashboardPriorityReviewItem]:
        prioritized: list[DashboardPriorityReviewItem] = []
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

    def _to_activity_item(self, review: Any, sentiment_result: Any) -> DashboardActivityItem:
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

    def _matches_review_filters(
        self,
        *,
        review: Any,
        sentiment_result: Any,
        source: str | None,
        language: str | None,
        sentiment: str | None,
        created_from: datetime | None,
        created_to: datetime | None,
    ) -> bool:
        review_timestamp = self._get_review_timestamp(review)
        if created_from is not None and review_timestamp < created_from:
            return False
        if created_to is not None and review_timestamp > created_to:
            return False
        if source is not None and (review.source_type or "").strip().lower() != source:
            return False
        if language is not None and (review.language or "").strip().lower() != language:
            return False
        if sentiment is not None and (
            sentiment_result is None or sentiment_result.label != sentiment
        ):
            return False
        return True

    def _get_latest_review_timestamp(self, reviews: list[Any]) -> datetime | None:
        if not reviews:
            return None
        return max(self._get_review_timestamp(review) for review in reviews)

    def _get_review_timestamp(self, review: Any) -> datetime:
        review_created_at = getattr(review, "review_created_at", None)
        if review_created_at is not None:
            return review_created_at
        created_at = getattr(review, "created_at", None)
        if created_at is not None:
            return created_at
        return datetime.combine(date.today(), time.min, tzinfo=timezone.utc)

    def _get_sentiment_counts(
        self,
        reviews: list[Any],
        latest_sentiments: dict[Any, Any],
    ) -> Counter:
        counts: Counter = Counter()
        for review in reviews:
            sentiment_result = latest_sentiments.get(review.id)
            if sentiment_result and sentiment_result.label in SENTIMENT_LABELS:
                counts[sentiment_result.label] += 1
        return counts

    def _build_comparison_metric(
        self,
        current: float | int | None,
        previous: float | int | None,
    ) -> DashboardComparisonMetric:
        normalized_current = 0 if current is None else current
        normalized_previous = 0 if previous is None else previous
        delta = normalized_current - normalized_previous
        percentage_change = None
        if normalized_previous:
            percentage_change = round((delta / normalized_previous) * 100, 2)

        return DashboardComparisonMetric(
            current=self._round_metric_value(current),
            previous=self._round_metric_value(previous),
            delta=self._round_metric_value(delta),
            percentage_change=percentage_change,
        )

    def _round_metric_value(self, value: float | int | None) -> float | int | None:
        if value is None:
            return None
        if isinstance(value, float):
            return round(value, 2)
        return value

    def _get_priority_reason(self, review: Any, sentiment_result: Any) -> str:
        sentiment_label = sentiment_result.label if sentiment_result else None
        if sentiment_label == "negative" and (review.rating or 0) <= 2:
            return "negative_low_rating"
        if review.status == "pending" and sentiment_label == "negative":
            return "unreviewed_negative"
        if review.status == "pending":
            return "new_unreviewed"
        return "follow_up_needed"

    def _get_priority_level(self, review: Any, sentiment_result: Any, reason: str) -> str:
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
