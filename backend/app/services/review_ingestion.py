import logging

from ..core.exceptions import AppError
from ..models.agent_run import AgentRun
from ..repositories.agent_run import AgentRunRepository
from ..schemas.review import ReviewImportRequest, ReviewImportResult
from .review import ReviewService

logger = logging.getLogger(__name__)


class ReviewIngestionService:
    def __init__(
        self,
        *,
        review_service: ReviewService,
        agent_run_repository: AgentRunRepository,
    ) -> None:
        self.review_service = review_service
        self.agent_run_repository = agent_run_repository

    def import_reviews(self, payload: ReviewImportRequest) -> tuple[ReviewImportResult, str]:
        agent_run = AgentRun(
            business_id=payload.business_id,
            agent_name="review_ingestion",
            task_type="import_reviews",
            status="running",
            input_reference={
                "business_id": str(payload.business_id),
                "review_source_id": str(payload.review_source_id)
                if payload.review_source_id
                else None,
                "source": payload.source,
                "review_count": len(payload.reviews),
            },
        )

        try:
            self.agent_run_repository.add(agent_run)
            result = self.review_service.import_reviews(payload)
            self.agent_run_repository.mark_success(
                agent_run,
                output_reference={
                    "business_id": str(result.business_id),
                    "imported_count": result.imported_count,
                    "duplicate_count": result.duplicate_count,
                },
            )
            self.agent_run_repository.save()
            return result, str(agent_run.id)
        except AppError:
            self._mark_failed(agent_run, "Application error during review import.")
            raise
        except Exception as exc:
            logger.exception(
                "Review ingestion orchestration failed for business %s", payload.business_id
            )
            self._mark_failed(agent_run, str(exc))
            raise

    def _mark_failed(self, agent_run: AgentRun, error_message: str) -> None:
        try:
            self.agent_run_repository.mark_failed(agent_run, error_message=error_message[:500])
            self.agent_run_repository.save()
        except Exception:
            self.agent_run_repository.rollback()
            logger.exception("Failed to persist failed review ingestion run %s", agent_run.id)
