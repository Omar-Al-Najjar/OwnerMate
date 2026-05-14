import logging
from uuid import UUID

from fastapi import status

from ..core.exceptions import AppError
from ..models.agent_run import AgentRun
from ..models.sentiment_result import SentimentResult
from ..repositories.agent_run import AgentRunRepository
from ..repositories.review import ReviewRepository
from ..repositories.sentiment_result import SentimentResultRepository
from ..schemas.sentiment import (
    SentimentAnalysisBatchResult,
    SentimentAnalysisResult,
    SentimentAnalyzeBatchRequest,
    SentimentAnalyzeRequest,
    SentimentFailureResult,
    SentimentProviderRequest,
    SentimentResultRead,
)
from .providers import SentimentAnalysisProvider

logger = logging.getLogger(__name__)


class SentimentAnalysisService:
    def __init__(
        self,
        *,
        provider: SentimentAnalysisProvider,
        review_repository: ReviewRepository,
        sentiment_result_repository: SentimentResultRepository,
        agent_run_repository: AgentRunRepository,
    ) -> None:
        self.provider = provider
        self.review_repository = review_repository
        self.sentiment_result_repository = sentiment_result_repository
        self.agent_run_repository = agent_run_repository

    def analyze_review(self, payload: SentimentAnalyzeRequest) -> SentimentAnalysisResult:
        review = self._get_review_or_raise(payload.review_id)
        existing_result = self.sentiment_result_repository.get_latest_by_review_id(review.id)
        agent_run = AgentRun(
            business_id=review.business_id,
            agent_name="sentiment_analysis",
            task_type="analyze_review",
            status="running",
            input_reference={"review_id": str(review.id), "provider": self.provider.provider_name},
        )

        try:
            self.agent_run_repository.add(agent_run)
            provider_result = self.provider.analyze(
                SentimentProviderRequest(
                    review_id=review.id,
                    review_text=review.review_text,
                    rating=review.rating,
                    language_hint=payload.language_hint or review.language,
                )
            )

            persisted = self._persist_sentiment_result(
                review_id=review.id,
                provider_result=provider_result,
                existing_result=existing_result,
            )
            self.agent_run_repository.mark_success(
                agent_run,
                output_reference={
                    "sentiment_result_id": str(persisted.id),
                    "review_id": str(review.id),
                    "provider": provider_result.model_name,
                },
            )
            self.agent_run_repository.save()
            self.agent_run_repository.refresh(agent_run)
            return SentimentAnalysisResult(
                review_id=review.id,
                sentiment_result=SentimentResultRead.model_validate(persisted),
                agent_run_id=agent_run.id,
            )
        except AppError:
            self._mark_agent_run_failed(agent_run, "Application error during sentiment analysis.")
            raise
        except Exception as exc:
            self.sentiment_result_repository.rollback()
            logger.exception("Sentiment analysis failed for review %s", review.id)
            self._mark_agent_run_failed(agent_run, str(exc))
            raise AppError(
                code="SENTIMENT_PROVIDER_ERROR",
                message="Sentiment analysis is currently unavailable.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={"provider": self.provider.provider_name, "review_id": str(review.id)},
            ) from exc

    def analyze_review_batch(
        self, payload: SentimentAnalyzeBatchRequest
    ) -> SentimentAnalysisBatchResult:
        results: list[SentimentAnalysisResult] = []
        failures: list[SentimentFailureResult] = []

        for review_id in payload.review_ids:
            try:
                results.append(
                    self.analyze_review(
                        SentimentAnalyzeRequest(
                            review_id=review_id,
                            language_hint=payload.language_hint,
                        )
                    )
                )
            except AppError as exc:
                failures.append(
                    SentimentFailureResult(
                        review_id=review_id,
                        error_code=exc.code,
                        message=exc.message,
                    )
                )

        return SentimentAnalysisBatchResult(results=results, failures=failures)

    def get_review_sentiment(self, review_id: UUID) -> SentimentResultRead:
        self._get_review_or_raise(review_id)
        sentiment_result = self.sentiment_result_repository.get_latest_by_review_id(review_id)
        if sentiment_result is None:
            raise AppError(
                code="SENTIMENT_RESULT_NOT_FOUND",
                message="Sentiment result not found for review.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return SentimentResultRead.model_validate(sentiment_result)

    def _get_review_or_raise(self, review_id: UUID):
        review = self.review_repository.get_by_id(review_id)
        if review is None:
            raise AppError(
                code="REVIEW_NOT_FOUND",
                message="Review not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return review

    def _mark_agent_run_failed(self, agent_run: AgentRun, error_message: str) -> None:
        try:
            self.agent_run_repository.mark_failed(agent_run, error_message=error_message[:500])
            self.agent_run_repository.save()
        except Exception:
            self.agent_run_repository.rollback()
            logger.exception("Failed to persist failed sentiment agent run %s", agent_run.id)

    def _persist_sentiment_result(
        self,
        *,
        review_id: UUID,
        provider_result,
        existing_result: SentimentResult | None,
    ) -> SentimentResult:
        if existing_result is not None:
            existing_result.label = provider_result.label
            existing_result.confidence = provider_result.confidence
            existing_result.detected_language = provider_result.detected_language
            existing_result.summary_tags = provider_result.summary_tags
            existing_result.model_name = provider_result.model_name
            persisted = existing_result
        else:
            persisted = self.sentiment_result_repository.add(
                SentimentResult(
                    review_id=review_id,
                    label=provider_result.label,
                    confidence=provider_result.confidence,
                    detected_language=provider_result.detected_language,
                    summary_tags=provider_result.summary_tags,
                    model_name=provider_result.model_name,
                )
            )
        self.sentiment_result_repository.save()
        self.sentiment_result_repository.refresh(persisted)
        return persisted
