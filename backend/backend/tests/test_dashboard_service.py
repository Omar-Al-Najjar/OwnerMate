from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
import unittest
from uuid import uuid4

from backend.app.schemas.dashboard import DashboardOverviewQuery
from backend.app.services.dashboard import DashboardService


class FakeReviewRepository:
    def __init__(self, reviews) -> None:
        self.reviews = list(reviews)

    def list_reviews(self, **kwargs):
        del kwargs
        return list(self.reviews)


class FakeSentimentResultRepository:
    def __init__(self, latest_by_review_id) -> None:
        self.latest_by_review_id = dict(latest_by_review_id)

    def get_latest_by_review_ids(self, review_ids):
        return {
            review_id: self.latest_by_review_id[review_id]
            for review_id in review_ids
            if review_id in self.latest_by_review_id
        }


class FakeSalesRecordRepository:
    def __init__(self, sales_records) -> None:
        self.sales_records = list(sales_records)

    def list_for_business(self, business_id):
        del business_id
        return list(self.sales_records)


class DashboardServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.business_id = uuid4()
        now = datetime(2026, 4, 30, 12, 0, tzinfo=timezone.utc)

        self.reviews = [
            self._review(
                source_type="google",
                language="en",
                rating=5,
                status="pending",
                review_created_at=now,
                reviewer_name="Lina",
                review_text="Amazing service",
            ),
            self._review(
                source_type="google",
                language="en",
                rating=1,
                status="pending",
                review_created_at=now - timedelta(days=2),
                reviewer_name="Omar",
                review_text="Bad experience",
            ),
            self._review(
                source_type="facebook",
                language="ar",
                rating=4,
                status="reviewed",
                review_created_at=now - timedelta(days=8),
                reviewer_name="Maya",
                review_text="Very good",
            ),
            self._review(
                source_type="google",
                language="en",
                rating=2,
                status="responded",
                review_created_at=now - timedelta(days=10),
                reviewer_name="Rami",
                review_text="Needs work",
            ),
            self._review(
                source_type="tripadvisor",
                language="fr",
                rating=3,
                status="reviewed",
                review_created_at=now - timedelta(days=40),
                reviewer_name="Sara",
                review_text="Average",
            ),
        ]

        self.sentiments = {
            self.reviews[0].id: self._sentiment("positive", Decimal("0.9400"), ["service"]),
            self.reviews[1].id: self._sentiment("negative", Decimal("0.9800"), ["delay"]),
            self.reviews[2].id: self._sentiment("positive", Decimal("0.8700"), ["taste"]),
            self.reviews[3].id: self._sentiment("negative", Decimal("0.8200"), ["support"]),
            self.reviews[4].id: self._sentiment("neutral", Decimal("0.7000"), ["location"]),
        }

        self.sales_records = [
            self._sales_record(now.date(), 5000, 50, 2, 200),
            self._sales_record(now.date() - timedelta(days=1), 4500, 45, 1, 100),
            self._sales_record(now.date() - timedelta(days=2), 4300, 43, 1, 80),
            self._sales_record(now.date() - timedelta(days=8), 3000, 30, 2, 120),
            self._sales_record(now.date() - timedelta(days=10), 2500, 25, 1, 60),
            self._sales_record(now.date() - timedelta(days=40), 1800, 18, 0, 0),
        ]

        self.service = DashboardService(
            review_repository=FakeReviewRepository(self.reviews),
            sales_record_repository=FakeSalesRecordRepository(self.sales_records),
            sentiment_result_repository=FakeSentimentResultRepository(self.sentiments),
        )

    def test_overview_applies_filters_and_returns_extended_fields(self) -> None:
        overview = self.service.get_overview(
            DashboardOverviewQuery(
                business_id=self.business_id,
                range="7d",
                source="google",
                language="en",
                sentiment="positive",
                recent_limit=3,
                priority_limit=3,
                activity_limit=3,
            )
        )

        self.assertEqual(overview.metrics.total_reviews, 1)
        self.assertEqual(overview.metrics.positive_share, 100)
        self.assertEqual(overview.filter_options.sources, ["facebook", "google", "tripadvisor"])
        self.assertEqual(overview.filter_options.languages, ["ar", "en", "fr"])
        self.assertEqual(
            overview.filter_options.sentiments,
            ["positive", "neutral", "negative"],
        )
        self.assertEqual(len(overview.review_timeseries), 7)
        self.assertEqual(overview.review_timeseries[-1].total_reviews, 1)
        self.assertEqual(overview.review_timeseries[-1].positive_reviews, 1)
        self.assertEqual(overview.recent_reviews[0].reviewer_name, "Lina")
        self.assertEqual(len(overview.sales_records), 3)
        self.assertEqual(overview.sales_summary.total_orders, 138)

    def test_overview_builds_comparison_from_previous_window(self) -> None:
        overview = self.service.get_overview(
            DashboardOverviewQuery(
                business_id=self.business_id,
                range="30d",
            )
        )

        self.assertEqual(overview.metrics.total_reviews, 4)
        self.assertEqual(overview.comparison.total_reviews.current, 4)
        self.assertEqual(overview.comparison.total_reviews.previous, 1)
        self.assertEqual(overview.comparison.total_reviews.delta, 3)
        self.assertEqual(overview.comparison.total_reviews.percentage_change, 300.0)
        self.assertEqual(overview.comparison.total_revenue.current, 19300)
        self.assertEqual(overview.comparison.total_revenue.previous, 1800)
        self.assertEqual(overview.comparison.total_revenue.delta, 17500)
        self.assertAlmostEqual(overview.comparison.positive_share.current, 50.0)
        self.assertEqual(len(overview.priority_reviews), 4)

    def _review(
        self,
        *,
        source_type: str,
        language: str,
        rating: int,
        status: str,
        review_created_at: datetime,
        reviewer_name: str,
        review_text: str,
    ):
        return SimpleNamespace(
            id=uuid4(),
            business_id=self.business_id,
            source_type=source_type,
            language=language,
            rating=rating,
            status=status,
            reviewer_name=reviewer_name,
            review_text=review_text,
            review_created_at=review_created_at,
            created_at=review_created_at,
        )

    def _sentiment(self, label: str, confidence: Decimal, summary_tags: list[str]):
        return SimpleNamespace(
            label=label,
            confidence=confidence,
            summary_tags=summary_tags,
        )

    def _sales_record(
        self,
        record_date: date,
        revenue: int,
        orders: int,
        refund_count: int,
        refund_value: int,
    ):
        return SimpleNamespace(
            record_date=record_date,
            revenue=revenue,
            orders=orders,
            refund_count=refund_count,
            refund_value=refund_value,
            channel_revenue={},
            products=[],
        )


if __name__ == "__main__":
    unittest.main()
