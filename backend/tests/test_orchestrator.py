from __future__ import annotations

from datetime import datetime, timezone
import unittest
from uuid import uuid4

from backend.app.agents.orchestrator import OrchestratorAgent
from backend.app.core.exceptions import AppError
from backend.app.schemas.agent import AgentRouteRequest
from backend.app.schemas.content import ContentGenerationResult, GeneratedContentRead
from backend.app.schemas.review import ReviewSummaryResult
from backend.app.schemas.sentiment import (
    SentimentAnalysisBatchResult,
    SentimentAnalysisResult,
    SentimentFailureResult,
    SentimentResultRead,
)


class FakeReviewIngestionService:
    def import_reviews(self, payload):
        return (
            type(
                "ImportResult",
                (),
                {"model_dump": lambda self, mode="json": {"source": payload.source}},
            )(),
            str(uuid4()),
        )


class FakeSentimentAnalysisService:
    def analyze_review(self, payload):
        now = datetime.now(timezone.utc)
        return SentimentAnalysisResult(
            review_id=payload.review_id,
            sentiment_result=SentimentResultRead(
                id=uuid4(),
                review_id=payload.review_id,
                label="positive",
                confidence=0.9,
                detected_language="en",
                summary_tags=["customer_praise"],
                model_name="mock_sentiment",
                processed_at=now,
                created_at=now,
            ),
            agent_run_id=uuid4(),
        )

    def analyze_review_batch(self, payload):
        now = datetime.now(timezone.utc)
        return SentimentAnalysisBatchResult(
            results=[
                SentimentAnalysisResult(
                    review_id=payload.review_ids[0],
                    sentiment_result=SentimentResultRead(
                        id=uuid4(),
                        review_id=payload.review_ids[0],
                        label="negative",
                        confidence=0.8,
                        detected_language="ar",
                        summary_tags=["service"],
                        model_name="mock_sentiment",
                        processed_at=now,
                        created_at=now,
                    ),
                    agent_run_id=uuid4(),
                )
            ],
            failures=[
                SentimentFailureResult(
                    review_id=payload.review_ids[-1],
                    error_code="REVIEW_NOT_FOUND",
                    message="Review not found.",
                )
            ]
            if len(payload.review_ids) > 1
            else [],
        )


class FakeContentGenerationService:
    def generate_reply(self, payload):
        return self._build_result(payload.business_id, payload.review_id, "review_reply")

    def generate_marketing_copy(self, payload):
        return self._build_result(payload.business_id, None, "marketing_copy")

    def _build_result(self, business_id, review_id, content_type):
        now = datetime.now(timezone.utc)
        return ContentGenerationResult(
            generated_content=GeneratedContentRead(
                id=uuid4(),
                business_id=business_id,
                review_id=review_id,
                content_type=content_type,
                language="en",
                tone="professional",
                prompt_context={"provider": "mock_content"},
                generated_text="generated text",
                edited_text=None,
                created_by_user_id=None,
                created_at=now,
                updated_at=now,
            ),
            agent_run_id=uuid4(),
        )


class FakeReviewSummaryService:
    def get_summary(self, payload):
        return (
            ReviewSummaryResult(
                business_id=payload.business_id,
                total_reviews=1,
                average_rating=5.0,
                status_counts={"pending": 1},
                language_counts={"en": 1},
                source_counts={"google": 1},
                latest_review_ids=[uuid4()],
            ),
            str(uuid4()),
        )


class FakeAgentRunRepository:
    def get_by_id(self, run_id):
        return type(
            "AgentRunRow",
            (),
            {
                "id": run_id,
                "business_id": uuid4(),
                "initiated_by_user_id": None,
                "agent_name": "sentiment_analysis",
                "task_type": "analyze_review",
                "status": "success",
                "input_reference": {"review_id": str(uuid4())},
                "output_reference": {"sentiment_result_id": str(uuid4())},
                "error_message": None,
                "started_at": datetime.now(timezone.utc),
                "finished_at": datetime.now(timezone.utc),
                "created_at": datetime.now(timezone.utc),
            },
        )()


class OrchestratorAgentTests(unittest.TestCase):
    def setUp(self) -> None:
        self.orchestrator = OrchestratorAgent(
            review_ingestion_service=FakeReviewIngestionService(),
            sentiment_analysis_service=FakeSentimentAnalysisService(),
            content_generation_service=FakeContentGenerationService(),
            review_summary_service=FakeReviewSummaryService(),
            agent_run_repository=FakeAgentRunRepository(),
        )

    def test_route_returns_supported_service_for_generate_reply(self) -> None:
        result = self.orchestrator.route(
            AgentRouteRequest(
                task="generate_reply",
                payload={
                    "business_id": str(uuid4()),
                    "review_id": str(uuid4()),
                    "language": "en",
                },
            )
        )

        self.assertEqual(result.task_type, "generate_reply")
        self.assertEqual(result.agent_name, "content_generation")

    def test_run_returns_structured_batch_result(self) -> None:
        review_id = uuid4()
        missing_review_id = uuid4()

        result = self.orchestrator.run(
            "analyze_review_batch",
            {"review_ids": [str(review_id), str(missing_review_id)]},
        )

        self.assertEqual(result.task_type, "analyze_review_batch")
        self.assertEqual(result.status, "success")
        self.assertEqual(result.meta["agent"], "sentiment_analysis")
        self.assertEqual(len(result.data["results"]), 1)
        self.assertEqual(len(result.data["failures"]), 1)

    def test_run_raises_structured_error_for_unsupported_task(self) -> None:
        with self.assertRaises(AppError) as raised:
            self.orchestrator.run("forecast_reviews", {})

        self.assertEqual(raised.exception.code, "UNSUPPORTED_TASK")

    def test_get_run_returns_agent_run_read(self) -> None:
        run_id = uuid4()
        result = self.orchestrator.get_run(run_id)

        self.assertEqual(result.id, run_id)
        self.assertEqual(result.agent_name, "sentiment_analysis")


if __name__ == "__main__":
    unittest.main()
