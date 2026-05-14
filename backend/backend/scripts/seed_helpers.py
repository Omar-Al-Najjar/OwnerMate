from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
import sys
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = CURRENT_DIR.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.db import get_session_factory
from app.models.business import Business
from app.models.review import Review
from app.models.sales_record import SalesRecord
from app.models.sentiment_result import SentimentResult
from app.models.user import User


DEMO_BUSINESS_NAME = "OwnerMate Dashboard Demo"
DEMO_BUSINESS_CREATED_AT = datetime(2020, 1, 1, tzinfo=timezone.utc)


@dataclass(frozen=True)
class SeedContext:
    user: User
    business: Business


def get_session() -> Session:
    return get_session_factory()()


def ensure_user(
    session: Session,
    *,
    email: str,
    full_name: str,
    role: str = "owner",
    language_preference: str = "en",
    theme_preference: str = "light",
    supabase_user_id: str | None = None,
) -> User:
    user = session.scalar(select(User).where(User.email == email))
    if user is None and supabase_user_id:
        user = session.scalar(
            select(User).where(User.supabase_user_id == supabase_user_id)
        )

    if user is None:
        user = User(
            email=email,
            full_name=full_name,
            role=role,
            language_preference=language_preference,
            theme_preference=theme_preference,
            supabase_user_id=supabase_user_id,
        )
        session.add(user)
        session.flush()
        return user

    user.email = email
    user.full_name = full_name
    user.role = role
    user.language_preference = language_preference
    user.theme_preference = theme_preference
    if supabase_user_id:
        user.supabase_user_id = supabase_user_id
    session.flush()
    return user


def ensure_demo_business(
    session: Session,
    *,
    owner_user_id: UUID,
    business_name: str = DEMO_BUSINESS_NAME,
    industry: str = "food_beverage",
    country_code: str = "JO",
    default_language: str = "en",
) -> Business:
    owner_businesses = list(
        session.scalars(
            select(Business)
            .where(Business.owner_user_id == owner_user_id)
            .order_by(Business.created_at.asc(), Business.id.asc())
        )
    )

    business = next(
        (item for item in owner_businesses if item.name == business_name),
        None,
    )

    # Reuse the owner's oldest business if one already exists to keep seeded data
    # anchored to a single business instead of creating duplicates across reruns.
    if business is None and owner_businesses:
        business = owner_businesses[0]

    if business is None:
        business = Business(
            owner_user_id=owner_user_id,
            name=business_name,
            industry=industry,
            country_code=country_code,
            default_language=default_language,
            created_at=DEMO_BUSINESS_CREATED_AT,
            updated_at=DEMO_BUSINESS_CREATED_AT,
        )
        session.add(business)
        session.flush()
        return business

    if business.name == business_name:
        if business.created_at > DEMO_BUSINESS_CREATED_AT:
            business.created_at = DEMO_BUSINESS_CREATED_AT

    business.industry = industry
    business.country_code = country_code
    business.default_language = default_language
    session.flush()
    return business


def ensure_seed_context(
    session: Session,
    *,
    email: str,
    full_name: str,
    business_name: str = DEMO_BUSINESS_NAME,
    role: str = "owner",
    language_preference: str = "en",
    theme_preference: str = "light",
    supabase_user_id: str | None = None,
) -> SeedContext:
    user = ensure_user(
        session,
        email=email,
        full_name=full_name,
        role=role,
        language_preference=language_preference,
        theme_preference=theme_preference,
        supabase_user_id=supabase_user_id,
    )
    business = ensure_demo_business(
        session,
        owner_user_id=user.id,
        business_name=business_name,
        default_language=language_preference,
    )
    return SeedContext(user=user, business=business)


def upsert_review(
    session: Session,
    *,
    business_id: UUID,
    source_type: str,
    source_review_id: str,
    reviewer_name: str,
    rating: int,
    language: str,
    review_text: str,
    status: str,
    response_status: str | None,
    review_created_at: datetime,
    source_metadata: dict,
) -> Review:
    review = session.scalar(
        select(Review).where(
            Review.business_id == business_id,
            Review.source_type == source_type,
            Review.source_review_id == source_review_id,
        )
    )

    if review is None:
        review = Review(
            business_id=business_id,
            source_type=source_type,
            source_review_id=source_review_id,
        )
        session.add(review)

    review.reviewer_name = reviewer_name
    review.rating = rating
    review.language = language
    review.review_text = review_text
    review.status = status
    review.response_status = response_status
    review.review_created_at = review_created_at
    review.source_metadata = source_metadata
    session.flush()
    return review


def replace_sentiment(
    session: Session,
    *,
    review_id: UUID,
    label: str,
    confidence: float,
    detected_language: str,
    summary_tags: list[str],
    model_name: str = "dashboard_seed_v1",
    processed_at: datetime | None = None,
) -> SentimentResult:
    session.execute(delete(SentimentResult).where(SentimentResult.review_id == review_id))
    sentiment = SentimentResult(
        review_id=review_id,
        label=label,
        confidence=Decimal(str(confidence)),
        detected_language=detected_language,
        summary_tags=summary_tags,
        model_name=model_name,
        processed_at=processed_at or datetime.now(timezone.utc),
    )
    session.add(sentiment)
    session.flush()
    return sentiment


def upsert_sales_record(
    session: Session,
    *,
    business_id: UUID,
    record_date: date,
    revenue: int,
    orders: int,
    refund_count: int,
    refund_value: int,
    channel_revenue: dict[str, int],
    products: list[dict],
) -> SalesRecord:
    sales_record = session.scalar(
        select(SalesRecord).where(
            SalesRecord.business_id == business_id,
            SalesRecord.record_date == record_date,
        )
    )

    if sales_record is None:
        sales_record = SalesRecord(
            business_id=business_id,
            record_date=record_date,
        )
        session.add(sales_record)

    sales_record.revenue = revenue
    sales_record.orders = orders
    sales_record.refund_count = refund_count
    sales_record.refund_value = refund_value
    sales_record.channel_revenue = channel_revenue
    sales_record.products = products
    session.flush()
    return sales_record


def delete_seed_reviews(session: Session, *, business_id: UUID, prefix: str) -> None:
    seeded_reviews = session.scalars(
        select(Review.id).where(
            Review.business_id == business_id,
            Review.source_review_id.like(f"{prefix}%"),
        )
    ).all()
    if not seeded_reviews:
        return

    session.execute(delete(SentimentResult).where(SentimentResult.review_id.in_(seeded_reviews)))
    session.execute(delete(Review).where(Review.id.in_(seeded_reviews)))


def rollback_and_close(session: Session) -> None:
    session.rollback()
    session.close()
