from __future__ import annotations

from datetime import datetime, timezone
import unittest
from uuid import uuid4

from backend.app.core.exceptions import AppError
from backend.app.models.business import Business
from backend.app.models.generated_content import GeneratedContent
from backend.app.models.review import Review
from backend.app.schemas.content import (
    GenerateMarketingCopyRequest,
    GenerateReplyRequest,
    RegenerateContentRequest,
    SaveGeneratedContentRequest,
)
from backend.app.services.content import ContentGenerationService


class FakeContentProvider:
    provider_name = "mock_content"

    def generate(self, payload):
        return type(
            "ProviderResult",
            (),
            {
                "generated_text": f"{payload.content_type}:{payload.language}:{payload.tone or 'default'}",
                "model_name": self.provider_name,
                "prompt_context": payload.prompt_context or {},
            },
        )()


class FakeBusinessRepository:
    def __init__(self, businesses: dict) -> None:
        self.businesses = businesses

    def get_by_id(self, business_id):
        return self.businesses.get(business_id)


class FakeReviewRepository:
    def __init__(self, reviews: dict) -> None:
        self.reviews = reviews

    def get_by_id(self, review_id, *, business_id=None):
        review = self.reviews.get(review_id)
        if review is None:
            return None
        if business_id is not None and review.business_id != business_id:
            return None
        return review


class FakeGeneratedContentRepository:
    def __init__(self) -> None:
        self.contents: dict = {}
        self.saved = False
        self.rolled_back = False

    def get_by_id(self, content_id):
        return self.contents.get(content_id)

    def add(self, generated_content: GeneratedContent):
        now = datetime.now(timezone.utc)
        generated_content.id = uuid4()
        generated_content.created_at = now
        generated_content.updated_at = now
        self.contents[generated_content.id] = generated_content
        return generated_content

    def save(self):
        self.saved = True

    def rollback(self):
        self.rolled_back = True

    def refresh(self, generated_content):
        return None


class FakeAgentRunRepository:
    def __init__(self) -> None:
        self.saved = False
        self.rolled_back = False

    def add(self, agent_run):
        agent_run.id = uuid4()
        return agent_run

    def mark_success(self, agent_run, *, output_reference):
        agent_run.status = "success"
        agent_run.output_reference = output_reference
        return agent_run

    def mark_failed(self, agent_run, *, error_message):
        agent_run.status = "failed"
        agent_run.error_message = error_message
        return agent_run

    def save(self):
        self.saved = True

    def rollback(self):
        self.rolled_back = True

    def refresh(self, agent_run):
        return None


class ContentGenerationServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.business_id = uuid4()
        self.review_id = uuid4()
        self.business = Business(
            id=self.business_id,
            owner_user_id=uuid4(),
            name="Cafe Amal",
            default_language="en",
        )
        self.review = Review(
            id=self.review_id,
            business_id=self.business_id,
            source_type="google",
            source_review_id="r-1",
            review_text="Great service",
            reviewer_name="Jane",
            rating=5,
            language="en",
            status="pending",
        )
        self.generated_content_repository = FakeGeneratedContentRepository()
        self.agent_run_repository = FakeAgentRunRepository()
        self.service = ContentGenerationService(
            provider=FakeContentProvider(),
            business_repository=FakeBusinessRepository({self.business_id: self.business}),
            review_repository=FakeReviewRepository({self.review_id: self.review}),
            generated_content_repository=self.generated_content_repository,
            agent_run_repository=self.agent_run_repository,
        )

    def test_generate_reply_persists_generated_content(self) -> None:
        result = self.service.generate_reply(
            GenerateReplyRequest(
                business_id=self.business_id,
                review_id=self.review_id,
                language="en",
                tone="professional",
                business_context="Cafe Amal downtown branch",
            )
        )

        self.assertEqual(result.generated_content.content_type, "review_reply")
        self.assertEqual(result.generated_content.review_id, self.review_id)
        self.assertEqual(
            result.generated_content.prompt_context["business_context"],
            "Cafe Amal downtown branch",
        )
        self.assertTrue(self.generated_content_repository.saved)

    def test_generate_marketing_copy_persists_generated_content(self) -> None:
        result = self.service.generate_marketing_copy(
            GenerateMarketingCopyRequest(
                business_id=self.business_id,
                language="ar",
                tone="friendly",
                business_context="Cafe Amal",
                prompt_context={"audience": "families"},
            )
        )

        self.assertEqual(result.generated_content.content_type, "marketing_copy")
        self.assertEqual(result.generated_content.language, "ar")
        self.assertEqual(result.generated_content.prompt_context["audience"], "families")

    def test_regenerate_content_creates_new_generated_content_row(self) -> None:
        original = self.generated_content_repository.add(
            GeneratedContent(
                business_id=self.business_id,
                review_id=self.review_id,
                content_type="review_reply",
                language="en",
                tone="professional",
                prompt_context={"previous": True},
                generated_text="old text",
            )
        )

        result = self.service.regenerate_content(
            RegenerateContentRequest(
                content_id=original.id,
                language="ar",
                tone="warm",
                business_context="Cafe Amal refreshed",
                prompt_context={"retry_reason": "tone adjustment"},
            )
        )

        self.assertNotEqual(result.generated_content.id, original.id)
        self.assertEqual(
            result.generated_content.prompt_context["regenerated_from_content_id"],
            str(original.id),
        )
        self.assertEqual(result.generated_content.prompt_context["retry_reason"], "tone adjustment")

    def test_save_generated_content_persists_edited_text(self) -> None:
        content = self.generated_content_repository.add(
            GeneratedContent(
                business_id=self.business_id,
                review_id=None,
                content_type="marketing_copy",
                language="en",
                tone="friendly",
                prompt_context={"seed": True},
                generated_text="generated text",
            )
        )
        editor_id = uuid4()

        result = self.service.save_generated_content(
            SaveGeneratedContentRequest(
                content_id=content.id,
                edited_text="edited text",
                created_by_user_id=editor_id,
            )
        )

        self.assertEqual(result.generated_content.edited_text, "edited text")
        self.assertEqual(result.generated_content.created_by_user_id, editor_id)

    def test_get_generated_content_returns_saved_record(self) -> None:
        content = self.generated_content_repository.add(
            GeneratedContent(
                business_id=self.business_id,
                review_id=None,
                content_type="marketing_copy",
                language="en",
                tone=None,
                prompt_context=None,
                generated_text="generated text",
            )
        )

        result = self.service.get_generated_content(content.id)

        self.assertEqual(result.id, content.id)
        self.assertEqual(result.generated_text, "generated text")

    def test_get_generated_content_raises_for_missing_record(self) -> None:
        with self.assertRaises(AppError) as raised:
            self.service.get_generated_content(uuid4())

        self.assertEqual(raised.exception.code, "GENERATED_CONTENT_NOT_FOUND")

    def test_generate_reply_raises_scope_mismatch_for_review_from_other_business(self) -> None:
        other_business_id = uuid4()
        other_review_id = uuid4()
        other_review = Review(
            id=other_review_id,
            business_id=other_business_id,
            source_type="google",
            source_review_id="r-2",
            review_text="Wrong business",
            reviewer_name="Omar",
            rating=1,
            language="en",
            status="pending",
        )
        self.service.review_repository.reviews[other_review_id] = other_review

        with self.assertRaises(AppError) as raised:
            self.service.generate_reply(
                GenerateReplyRequest(
                    business_id=self.business_id,
                    review_id=other_review_id,
                    language="en",
                    tone="professional",
                )
            )

        self.assertEqual(raised.exception.code, "REVIEW_BUSINESS_SCOPE_MISMATCH")


if __name__ == "__main__":
    unittest.main()
