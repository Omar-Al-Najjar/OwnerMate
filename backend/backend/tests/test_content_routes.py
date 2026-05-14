from __future__ import annotations

from datetime import datetime, timezone
import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.api.dependencies import (
    get_authorization_service,
    get_content_generation_service,
    get_current_user,
)
from backend.app.main import app
from backend.app.models.user import User
from backend.app.schemas.content import (
    ContentGenerationResult,
    GeneratedContentRead,
    SavedGeneratedContentResult,
)


class FakeContentGenerationService:
    def __init__(self) -> None:
        self.last_reply_payload = None
        self.last_marketing_payload = None
        self.last_regenerate_payload = None
        self.last_save_payload = None
        self.last_content_id = None

        now = datetime.now(timezone.utc)
        self.generated_content = GeneratedContentRead(
            id=uuid4(),
            business_id=uuid4(),
            review_id=uuid4(),
            content_type="review_reply",
            language="en",
            tone="professional",
            prompt_context={"business_name": "Cafe Amal"},
            generated_text="Thank you for your review.",
            edited_text=None,
            created_by_user_id=None,
            created_at=now,
            updated_at=now,
        )

    def generate_reply(self, payload):
        self.last_reply_payload = payload
        return ContentGenerationResult(
            generated_content=self.generated_content.model_copy(
                update={
                    "business_id": payload.business_id,
                    "review_id": payload.review_id,
                    "language": payload.language,
                    "tone": payload.tone,
                }
            ),
            agent_run_id=uuid4(),
        )

    def generate_marketing_copy(self, payload):
        self.last_marketing_payload = payload
        return ContentGenerationResult(
            generated_content=self.generated_content.model_copy(
                update={
                    "id": uuid4(),
                    "review_id": None,
                    "content_type": "marketing_copy",
                    "business_id": payload.business_id,
                    "language": payload.language,
                    "tone": payload.tone,
                }
            ),
            agent_run_id=uuid4(),
        )

    def regenerate_content(self, payload):
        self.last_regenerate_payload = payload
        return ContentGenerationResult(
            generated_content=self.generated_content.model_copy(
                update={
                    "id": uuid4(),
                    "language": payload.language,
                    "tone": payload.tone,
                }
            ),
            agent_run_id=uuid4(),
        )

    def save_generated_content(self, payload):
        self.last_save_payload = payload
        return SavedGeneratedContentResult(
            generated_content=self.generated_content.model_copy(
                update={
                    "id": payload.content_id,
                    "edited_text": payload.edited_text,
                    "created_by_user_id": payload.created_by_user_id,
                }
            )
        )

    def get_generated_content(self, content_id):
        self.last_content_id = content_id
        return self.generated_content.model_copy(update={"id": content_id})


class ExplodingContentGenerationService(FakeContentGenerationService):
    def generate_marketing_copy(self, payload):
        del payload
        raise RuntimeError("provider token leaked")


class FakeAuthorizationService:
    def ensure_business_access(self, user, business_id):
        return None

    def ensure_review_access(self, user, review_id):
        class Review:
            def __init__(self, business_id):
                self.business_id = business_id

        return Review(business_id=self.generated_content.business_id)

    def ensure_generated_content_access(self, user, content_id):
        return None

    def __init__(self, business_id) -> None:
        self.generated_content = type("GeneratedContent", (), {"business_id": business_id})()


class ContentRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fake_service = FakeContentGenerationService()
        self.user = User(id=uuid4(), email="owner@example.com", role="owner")
        app.dependency_overrides[get_content_generation_service] = lambda: self.fake_service
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_authorization_service] = (
            lambda: FakeAuthorizationService(self.fake_service.generated_content.business_id)
        )
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_generate_reply_returns_success_envelope(self) -> None:
        business_id = str(self.fake_service.generated_content.business_id)
        review_id = str(uuid4())

        response = self.client.post(
            "/content/generate/reply",
            json={
                "business_id": business_id,
                "review_id": review_id,
                "language": "AR",
                "tone": "Warm",
                "business_context": "Cafe Amal",
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["generated_content"]["language"], "ar")
        self.assertEqual(self.fake_service.last_reply_payload.tone, "warm")

    def test_generate_marketing_returns_success_envelope(self) -> None:
        business_id = str(uuid4())

        response = self.client.post(
            "/content/generate/marketing",
            json={
                "business_id": business_id,
                "language": "en",
                "tone": "friendly",
                "business_context": "Cafe Amal",
                "prompt_context": {"audience": "locals"},
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["generated_content"]["content_type"], "marketing_copy")

    def test_regenerate_returns_success_envelope(self) -> None:
        content_id = str(uuid4())

        response = self.client.post(
            "/content/regenerate",
            json={
                "content_id": content_id,
                "language": "en",
                "tone": "professional",
                "business_context": "Cafe Amal",
                "prompt_context": {"retry_reason": "shorter"},
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["generated_content"]["tone"], "professional")
        self.assertEqual(str(self.fake_service.last_regenerate_payload.content_id), content_id)

    def test_save_returns_saved_generated_content(self) -> None:
        content_id = str(uuid4())
        editor_id = str(uuid4())

        response = self.client.post(
            "/content/save",
            json={
                "content_id": content_id,
                "edited_text": "Updated copy",
                "created_by_user_id": editor_id,
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["generated_content"]["edited_text"], "Updated copy")
        self.assertEqual(
            str(self.fake_service.last_save_payload.created_by_user_id), str(self.user.id)
        )

    def test_get_generated_content_returns_success_envelope(self) -> None:
        content_id = str(uuid4())

        response = self.client.get(f"/content/{content_id}")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["id"], content_id)

    def test_unhandled_content_errors_do_not_expose_raw_exception_text(self) -> None:
        app.dependency_overrides[get_content_generation_service] = (
            lambda: ExplodingContentGenerationService()
        )
        client = TestClient(app, raise_server_exceptions=False)

        response = client.post(
            "/content/generate/marketing",
            json={
                "business_id": str(uuid4()),
                "language": "en",
                "tone": "friendly",
            },
        )

        self.assertEqual(response.status_code, 500)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"]["code"], "INTERNAL_SERVER_ERROR")
        self.assertNotIn("details", body["error"])
        self.assertNotIn("provider token leaked", response.text)


if __name__ == "__main__":
    unittest.main()
