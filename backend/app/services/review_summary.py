import logging
from collections import Counter

from ..core.exceptions import AppError
from ..models.agent_run import AgentRun
from ..repositories.agent_run import AgentRunRepository
from ..repositories.business import BusinessRepository
from ..repositories.review import ReviewRepository
from ..repositories.sentiment_result import SentimentResultRepository
from ..schemas.review import (
    ReviewIntelligenceReviewItem,
    ReviewSummaryRequest,
    ReviewSummaryResult,
)
from .providers import ReviewIntelligenceProvider

logger = logging.getLogger(__name__)


class ReviewSummaryService:
    def __init__(
        self,
        *,
        review_repository: ReviewRepository,
        business_repository: BusinessRepository,
        sentiment_result_repository: SentimentResultRepository,
        intelligence_provider: ReviewIntelligenceProvider,
        agent_run_repository: AgentRunRepository,
    ) -> None:
        self.review_repository = review_repository
        self.business_repository = business_repository
        self.sentiment_result_repository = sentiment_result_repository
        self.intelligence_provider = intelligence_provider
        self.agent_run_repository = agent_run_repository

    def get_summary(self, payload: ReviewSummaryRequest) -> tuple[ReviewSummaryResult, str]:
        self._ensure_business_exists(payload.business_id)
        agent_run = AgentRun(
            business_id=payload.business_id,
            agent_name="review_summary",
            task_type="get_review_summary",
            status="running",
            input_reference={
                "business_id": str(payload.business_id),
                "limit": payload.limit,
            },
        )

        try:
            self.agent_run_repository.add(agent_run)
            reviews = self.review_repository.list_reviews(
                business_id=payload.business_id,
                limit=payload.limit,
                offset=0,
            )
            latest_sentiments = self.sentiment_result_repository.get_latest_by_review_ids(
                [review.id for review in reviews]
            )
            rating_values = [review.rating for review in reviews if review.rating is not None]
            average_rating = (
                round(sum(rating_values) / len(rating_values), 2) if rating_values else None
            )
            intelligence = self.intelligence_provider.summarize(
                payload=payload,
                reviews=[
                    self._build_intelligence_item(review, latest_sentiments.get(review.id))
                    for review in reviews
                ],
            )
            result = ReviewSummaryResult(
                business_id=payload.business_id,
                total_reviews=len(reviews),
                average_rating=average_rating,
                status_counts=dict(Counter(review.status for review in reviews)),
                language_counts=dict(Counter((review.language or "unknown") for review in reviews)),
                source_counts=dict(Counter(review.source_type for review in reviews)),
                latest_review_ids=[review.id for review in reviews[:5]],
                intelligence=intelligence,
            )
            self.agent_run_repository.mark_success(
                agent_run,
                output_reference={
                    "business_id": str(payload.business_id),
                    "total_reviews": result.total_reviews,
                    "pain_point_count": len(result.intelligence.pain_points),
                    "praise_theme_count": len(result.intelligence.praise_themes),
                },
            )
            self.agent_run_repository.save()
            return result, str(agent_run.id)
        except AppError:
            self._mark_failed(agent_run, "Application error during review summary.")
            raise
        except Exception as exc:
            logger.exception(
                "Review summary orchestration failed for business %s", payload.business_id
            )
            self._mark_failed(agent_run, str(exc))
            raise

    def _ensure_business_exists(self, business_id) -> None:
        business = self.business_repository.get_by_id(business_id)
        if business is None:
            raise AppError(
                code="BUSINESS_NOT_FOUND",
                message="Business not found.",
                status_code=404,
            )

    def _mark_failed(self, agent_run: AgentRun, error_message: str) -> None:
        try:
            self.agent_run_repository.mark_failed(agent_run, error_message=error_message[:500])
            self.agent_run_repository.save()
        except Exception:
            self.agent_run_repository.rollback()
            logger.exception("Failed to persist failed review summary run %s", agent_run.id)

    def _build_intelligence_item(self, review, sentiment_result) -> ReviewIntelligenceReviewItem:
        return ReviewIntelligenceReviewItem(
            review_id=review.id,
            source_type=review.source_type,
            language=review.language,
            rating=review.rating,
            review_text=review.review_text,
            sentiment_label=sentiment_result.label if sentiment_result else None,
            sentiment_confidence=float(sentiment_result.confidence)
            if sentiment_result and sentiment_result.confidence is not None
            else None,
            summary_tags=(sentiment_result.summary_tags or []) if sentiment_result else [],
        )
