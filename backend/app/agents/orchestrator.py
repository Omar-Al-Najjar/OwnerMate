import logging
from typing import Any
from uuid import UUID

from pydantic import ValidationError

from ..core.exceptions import AppError
from ..repositories.agent_run import AgentRunRepository
from ..schemas.agent import (
    AgentRouteRequest,
    AgentRouteResult,
    AgentRunRead,
    AgentTaskResult,
    SupportedAgentTask,
)
from ..schemas.content import GenerateMarketingCopyRequest, GenerateReplyRequest
from ..schemas.review import ReviewImportRequest, ReviewSummaryRequest
from ..schemas.sentiment import SentimentAnalyzeBatchRequest, SentimentAnalyzeRequest
from ..services.content import ContentGenerationService
from ..services.review_ingestion import ReviewIngestionService
from ..services.review_summary import ReviewSummaryService
from ..services.sentiment import SentimentAnalysisService

logger = logging.getLogger(__name__)


class OrchestratorAgent:
    """Coordinates task routing without embedding business logic in the orchestrator."""

    ROUTE_MAP: dict[SupportedAgentTask, tuple[str, str, type]] = {
        "import_reviews": ("review_ingestion", "ReviewIngestionService", ReviewImportRequest),
        "analyze_review": (
            "sentiment_analysis",
            "SentimentAnalysisService",
            SentimentAnalyzeRequest,
        ),
        "analyze_review_batch": (
            "sentiment_analysis",
            "SentimentAnalysisService",
            SentimentAnalyzeBatchRequest,
        ),
        "generate_reply": (
            "content_generation",
            "ContentGenerationService",
            GenerateReplyRequest,
        ),
        "generate_marketing_copy": (
            "content_generation",
            "ContentGenerationService",
            GenerateMarketingCopyRequest,
        ),
        "get_review_summary": ("review_summary", "ReviewSummaryService", ReviewSummaryRequest),
    }

    def __init__(
        self,
        *,
        review_ingestion_service: ReviewIngestionService,
        sentiment_analysis_service: SentimentAnalysisService,
        content_generation_service: ContentGenerationService,
        review_summary_service: ReviewSummaryService,
        agent_run_repository: AgentRunRepository,
    ) -> None:
        self.review_ingestion_service = review_ingestion_service
        self.sentiment_analysis_service = sentiment_analysis_service
        self.content_generation_service = content_generation_service
        self.review_summary_service = review_summary_service
        self.agent_run_repository = agent_run_repository

    def route(self, request: AgentRouteRequest) -> AgentRouteResult:
        task = self._validate_supported_task(request.task)
        agent_name, service_name, schema = self.ROUTE_MAP[task]
        self._validate_payload(schema=schema, payload=request.payload)
        return AgentRouteResult(
            task_type=task,
            status="supported",
            agent_name=agent_name,
            service_name=service_name,
        )

    def run(self, task: str, payload: dict[str, Any]) -> AgentTaskResult:
        validated_task = self._validate_supported_task(task)
        _, _, schema = self.ROUTE_MAP[validated_task]
        validated_payload = self._validate_payload(schema=schema, payload=payload)

        if validated_task == "import_reviews":
            result, agent_run_id = self.review_ingestion_service.import_reviews(validated_payload)
            return self._build_task_result(
                task_type=validated_task,
                agent_name="review_ingestion",
                data=result.model_dump(mode="json"),
                agent_run_id=agent_run_id,
            )

        if validated_task == "analyze_review":
            result = self.sentiment_analysis_service.analyze_review(validated_payload)
            return self._build_task_result(
                task_type=validated_task,
                agent_name="sentiment_analysis",
                data=result.model_dump(mode="json"),
                agent_run_id=str(result.agent_run_id),
            )

        if validated_task == "analyze_review_batch":
            result = self.sentiment_analysis_service.analyze_review_batch(validated_payload)
            batch_run_ids = [str(item.agent_run_id) for item in result.results]
            return AgentTaskResult(
                task_type=validated_task,
                status="success",
                data=result.model_dump(mode="json"),
                meta={
                    "agent": "sentiment_analysis",
                    "agent_run_ids": batch_run_ids,
                },
            )

        if validated_task == "generate_reply":
            result = self.content_generation_service.generate_reply(validated_payload)
            return self._build_task_result(
                task_type=validated_task,
                agent_name="content_generation",
                data=result.model_dump(mode="json"),
                agent_run_id=str(result.agent_run_id),
            )

        if validated_task == "generate_marketing_copy":
            result = self.content_generation_service.generate_marketing_copy(validated_payload)
            return self._build_task_result(
                task_type=validated_task,
                agent_name="content_generation",
                data=result.model_dump(mode="json"),
                agent_run_id=str(result.agent_run_id),
            )

        if validated_task == "get_review_summary":
            result, agent_run_id = self.review_summary_service.get_summary(validated_payload)
            return self._build_task_result(
                task_type=validated_task,
                agent_name="review_summary",
                data=result.model_dump(mode="json"),
                agent_run_id=agent_run_id,
            )

        raise AppError(
            code="UNSUPPORTED_TASK",
            message="Task type is not supported.",
            status_code=400,
        )

    def get_run(self, run_id: UUID) -> AgentRunRead:
        agent_run = self.agent_run_repository.get_by_id(run_id)
        if agent_run is None:
            raise AppError(
                code="AGENT_RUN_NOT_FOUND",
                message="Agent run not found.",
                status_code=404,
            )
        return AgentRunRead.model_validate(agent_run)

    def _validate_payload(self, *, schema: type, payload: dict[str, Any]):
        try:
            return schema.model_validate(payload)
        except ValidationError as exc:
            logger.debug("Invalid payload for orchestrated task: %s", exc.errors())
            raise AppError(
                code="INVALID_TASK_PAYLOAD",
                message="Payload is invalid for the selected task.",
                status_code=422,
                details=exc.errors(),
            ) from exc

    def _build_task_result(
        self,
        *,
        task_type: SupportedAgentTask,
        agent_name: str,
        data: dict[str, Any],
        agent_run_id: str,
    ) -> AgentTaskResult:
        return AgentTaskResult(
            task_type=task_type,
            status="success",
            data=data,
            meta={
                "agent": agent_name,
                "agent_run_id": agent_run_id,
            },
        )

    def _validate_supported_task(self, task: str) -> SupportedAgentTask:
        if task not in self.ROUTE_MAP:
            raise AppError(
                code="UNSUPPORTED_TASK",
                message="Task type is not supported.",
                status_code=400,
                details={"task": task},
            )
        return task  # type: ignore[return-value]
