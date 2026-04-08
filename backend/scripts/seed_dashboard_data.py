from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone

from seed_helpers import (
    DEMO_BUSINESS_NAME,
    delete_seed_reviews,
    ensure_seed_context,
    get_session,
    replace_sentiment,
    rollback_and_close,
    upsert_review,
    upsert_sales_record,
)


REVIEW_SEED_PREFIX = "dashboard-seed-"


def get_env(name: str, default: str) -> str:
    value = os.environ.get(name, default).strip()
    return value or default


def build_review_fixtures(now: datetime) -> list[dict]:
    return [
        {
            "source_type": "google",
            "source_review_id": f"{REVIEW_SEED_PREFIX}001",
            "reviewer_name": "Nora",
            "rating": 5,
            "language": "en",
            "review_text": "Outstanding coffee, fast service, and the staff remembered my order.",
            "status": "responded",
            "response_status": "sent",
            "review_created_at": now - timedelta(hours=6),
            "sentiment_label": "positive",
            "sentiment_confidence": 0.97,
            "summary_tags": ["fast service", "friendly staff", "repeat customer"],
        },
        {
            "source_type": "google",
            "source_review_id": f"{REVIEW_SEED_PREFIX}002",
            "reviewer_name": "Ahmad",
            "rating": 2,
            "language": "ar",
            "review_text": "الطلب تأخر كثيراً والقهوة وصلت باردة.",
            "status": "pending",
            "response_status": None,
            "review_created_at": now - timedelta(days=1, hours=2),
            "sentiment_label": "negative",
            "sentiment_confidence": 0.94,
            "summary_tags": ["late order", "cold coffee"],
        },
        {
            "source_type": "facebook",
            "source_review_id": f"{REVIEW_SEED_PREFIX}003",
            "reviewer_name": "Maya",
            "rating": 4,
            "language": "en",
            "review_text": "Loved the new pistachio dessert box. Delivery took a little longer than expected.",
            "status": "reviewed",
            "response_status": "drafted",
            "review_created_at": now - timedelta(days=2, hours=4),
            "sentiment_label": "positive",
            "sentiment_confidence": 0.81,
            "summary_tags": ["dessert", "delivery delay"],
        },
        {
            "source_type": "google",
            "source_review_id": f"{REVIEW_SEED_PREFIX}004",
            "reviewer_name": "Sara",
            "rating": 1,
            "language": "en",
            "review_text": "The breakfast bundle was missing items and nobody answered the phone.",
            "status": "pending",
            "response_status": None,
            "review_created_at": now - timedelta(days=3),
            "sentiment_label": "negative",
            "sentiment_confidence": 0.98,
            "summary_tags": ["missing items", "unreachable support"],
        },
        {
            "source_type": "facebook",
            "source_review_id": f"{REVIEW_SEED_PREFIX}005",
            "reviewer_name": "Omar",
            "rating": 5,
            "language": "ar",
            "review_text": "الخدمة ممتازة والحلويات طازجة جداً.",
            "status": "responded",
            "response_status": "sent",
            "review_created_at": now - timedelta(days=4, hours=3),
            "sentiment_label": "positive",
            "sentiment_confidence": 0.96,
            "summary_tags": ["fresh desserts", "excellent service"],
        },
        {
            "source_type": "google",
            "source_review_id": f"{REVIEW_SEED_PREFIX}006",
            "reviewer_name": "Layla",
            "rating": 3,
            "language": "en",
            "review_text": "The place is nice, but the queue during lunch is still too long.",
            "status": "reviewed",
            "response_status": "drafted",
            "review_created_at": now - timedelta(days=5, hours=6),
            "sentiment_label": "neutral",
            "sentiment_confidence": 0.63,
            "summary_tags": ["long queue", "lunch rush"],
        },
        {
            "source_type": "google",
            "source_review_id": f"{REVIEW_SEED_PREFIX}007",
            "reviewer_name": "Khaled",
            "rating": 4,
            "language": "ar",
            "review_text": "الطاقم محترف ولكن التطبيق يحتاج تحديث أسرع لحالة الطلب.",
            "status": "pending",
            "response_status": None,
            "review_created_at": now - timedelta(days=7),
            "sentiment_label": "neutral",
            "sentiment_confidence": 0.71,
            "summary_tags": ["professional staff", "order status updates"],
        },
        {
            "source_type": "facebook",
            "source_review_id": f"{REVIEW_SEED_PREFIX}008",
            "reviewer_name": "Rana",
            "rating": 5,
            "language": "en",
            "review_text": "Best iced latte in town and the loyalty bundle is a great deal.",
            "status": "responded",
            "response_status": "sent",
            "review_created_at": now - timedelta(days=8, hours=5),
            "sentiment_label": "positive",
            "sentiment_confidence": 0.93,
            "summary_tags": ["iced latte", "bundle value"],
        },
        {
            "source_type": "google",
            "source_review_id": f"{REVIEW_SEED_PREFIX}009",
            "reviewer_name": "Yousef",
            "rating": 2,
            "language": "en",
            "review_text": "The driver called late and the order was incomplete when it arrived.",
            "status": "reviewed",
            "response_status": "drafted",
            "review_created_at": now - timedelta(days=10, hours=1),
            "sentiment_label": "negative",
            "sentiment_confidence": 0.9,
            "summary_tags": ["delivery issue", "incomplete order"],
        },
        {
            "source_type": "facebook",
            "source_review_id": f"{REVIEW_SEED_PREFIX}010",
            "reviewer_name": "Hiba",
            "rating": 4,
            "language": "ar",
            "review_text": "المكان هادئ ومناسب للعمل لكن أتمنى خيارات إفطار أكثر.",
            "status": "reviewed",
            "response_status": "drafted",
            "review_created_at": now - timedelta(days=12),
            "sentiment_label": "positive",
            "sentiment_confidence": 0.76,
            "summary_tags": ["calm atmosphere", "breakfast variety"],
        },
        {
            "source_type": "google",
            "source_review_id": f"{REVIEW_SEED_PREFIX}011",
            "reviewer_name": "Dana",
            "rating": 5,
            "language": "en",
            "review_text": "Quick pickup, clean packaging, and the team handled a custom order perfectly.",
            "status": "responded",
            "response_status": "sent",
            "review_created_at": now - timedelta(days=15, hours=8),
            "sentiment_label": "positive",
            "sentiment_confidence": 0.95,
            "summary_tags": ["quick pickup", "custom order"],
        },
        {
            "source_type": "facebook",
            "source_review_id": f"{REVIEW_SEED_PREFIX}012",
            "reviewer_name": "Tariq",
            "rating": 1,
            "language": "ar",
            "review_text": "طلبت من خلال الانستغرام ولم يتم تأكيد الطلب إلا بعد وقت طويل.",
            "status": "pending",
            "response_status": None,
            "review_created_at": now - timedelta(days=18),
            "sentiment_label": "negative",
            "sentiment_confidence": 0.92,
            "summary_tags": ["instagram orders", "slow confirmation"],
        },
    ]


def build_sales_fixtures(today: date) -> list[dict]:
    fixtures: list[dict] = []
    for offset in range(30):
        current_date = today - timedelta(days=29 - offset)
        weekday = current_date.weekday()
        weekend_multiplier = 1.2 if weekday in {4, 5} else 1
        revenue = int((1180 + offset * 37 + (weekday * 24)) * weekend_multiplier)
        orders = int((42 + offset % 9 + weekday) * weekend_multiplier)
        refund_count = 1 if offset % 7 == 0 else 0
        refund_value = 35 if refund_count else 0

        walk_in = int(revenue * 0.39)
        delivery_app = int(revenue * 0.29)
        instagram_dm = int(revenue * 0.14)
        whatsapp = revenue - walk_in - delivery_app - instagram_dm

        products = [
            {
                "id": "signature-latte",
                "label": "Signature Latte",
                "category": "signature_drinks",
                "revenue": int(revenue * 0.28),
                "units": max(orders // 3, 1),
            },
            {
                "id": "pistachio-cake",
                "label": "Pistachio Cake",
                "category": "desserts",
                "revenue": int(revenue * 0.22),
                "units": max(orders // 5, 1),
            },
            {
                "id": "breakfast-box",
                "label": "Breakfast Box",
                "category": "breakfast",
                "revenue": int(revenue * 0.19),
                "units": max(orders // 6, 1),
            },
            {
                "id": "office-bundle",
                "label": "Office Bundle",
                "category": "bundles",
                "revenue": int(revenue * 0.16),
                "units": max(orders // 8, 1),
            },
        ]
        tracked_revenue = sum(product["revenue"] for product in products)
        products[0]["revenue"] += revenue - tracked_revenue

        fixtures.append(
            {
                "record_date": current_date,
                "revenue": revenue,
                "orders": orders,
                "refund_count": refund_count,
                "refund_value": refund_value,
                "channel_revenue": {
                    "walk_in": walk_in,
                    "delivery_app": delivery_app,
                    "instagram_dm": instagram_dm,
                    "whatsapp": whatsapp,
                },
                "products": products,
            }
        )
    return fixtures


def main() -> None:
    session = get_session()
    now = datetime.now(timezone.utc)
    try:
        context = ensure_seed_context(
            session,
            email=get_env("SEED_USER_EMAIL", "dashboard-demo@ownermate.local"),
            full_name=get_env("SEED_USER_FULL_NAME", "OwnerMate Demo Owner"),
            business_name=get_env("SEED_BUSINESS_NAME", DEMO_BUSINESS_NAME),
            role=get_env("SEED_USER_ROLE", "owner"),
            language_preference=get_env("SEED_LANGUAGE", "en"),
            theme_preference=get_env("SEED_THEME", "light"),
            supabase_user_id=os.environ.get("SEED_SUPABASE_USER_ID"),
        )

        delete_seed_reviews(
            session,
            business_id=context.business.id,
            prefix=REVIEW_SEED_PREFIX,
        )

        seeded_reviews = 0
        for fixture in build_review_fixtures(now):
            review = upsert_review(
                session,
                business_id=context.business.id,
                source_type=fixture["source_type"],
                source_review_id=fixture["source_review_id"],
                reviewer_name=fixture["reviewer_name"],
                rating=fixture["rating"],
                language=fixture["language"],
                review_text=fixture["review_text"],
                status=fixture["status"],
                response_status=fixture["response_status"],
                review_created_at=fixture["review_created_at"],
                source_metadata={
                    "seed": "dashboard",
                    "seed_version": 1,
                    "display_group": "dashboard_demo",
                },
            )
            replace_sentiment(
                session,
                review_id=review.id,
                label=fixture["sentiment_label"],
                confidence=fixture["sentiment_confidence"],
                detected_language=fixture["language"],
                summary_tags=fixture["summary_tags"],
                processed_at=fixture["review_created_at"] + timedelta(minutes=20),
            )
            seeded_reviews += 1

        seeded_sales_records = 0
        for sales_fixture in build_sales_fixtures(now.date()):
            upsert_sales_record(
                session,
                business_id=context.business.id,
                record_date=sales_fixture["record_date"],
                revenue=sales_fixture["revenue"],
                orders=sales_fixture["orders"],
                refund_count=sales_fixture["refund_count"],
                refund_value=sales_fixture["refund_value"],
                channel_revenue=sales_fixture["channel_revenue"],
                products=sales_fixture["products"],
            )
            seeded_sales_records += 1

        session.commit()

        print(f"SEEDED_USER_EMAIL={context.user.email}")
        print(f"SEEDED_USER_ID={context.user.id}")
        print(f"SEEDED_BUSINESS_ID={context.business.id}")
        print(f"SEEDED_BUSINESS_NAME={context.business.name}")
        print(f"SEEDED_REVIEWS={seeded_reviews}")
        print(f"SEEDED_SALES_RECORDS={seeded_sales_records}")
        session.close()
    except Exception:
        rollback_and_close(session)
        raise


if __name__ == "__main__":
    main()
