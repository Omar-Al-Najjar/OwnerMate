from __future__ import annotations

from datetime import datetime, timezone
import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.api.dependencies import get_current_user, get_db_session, get_settings_service
from backend.app.main import app
from backend.app.models.user import User
from backend.app.schemas.settings import SettingsRead


class FakeSettingsService:
    def __init__(self, user_id) -> None:
        self.user_id = user_id
        self.last_user = None
        self.last_theme_payload = None
        self.last_language_payload = None
        self.now = datetime.now(timezone.utc)

    def get_settings(self, user):
        self.last_user = user
        return SettingsRead(
            user_id=user.id,
            language_preference="en",
            theme_preference="light",
            updated_at=self.now,
        )

    def update_theme(self, user, payload):
        self.last_user = user
        self.last_theme_payload = payload
        return SettingsRead(
            user_id=user.id,
            language_preference="en",
            theme_preference=payload.theme_preference,
            updated_at=self.now,
        )

    def update_language(self, user, payload):
        self.last_user = user
        self.last_language_payload = payload
        return SettingsRead(
            user_id=user.id,
            language_preference=payload.language_preference,
            theme_preference="light",
            updated_at=self.now,
        )


class SettingsRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.user = User(
            id=uuid4(),
            email="owner@example.com",
            role="owner",
            language_preference="en",
            theme_preference="light",
        )
        self.fake_service = FakeSettingsService(self.user.id)
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_settings_service] = lambda: self.fake_service
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_get_settings_returns_authenticated_user_preferences(self) -> None:
        response = self.client.get("/settings")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["user_id"], str(self.user.id))
        self.assertEqual(body["data"]["theme_preference"], "light")

    def test_patch_theme_updates_authenticated_user_preference(self) -> None:
        response = self.client.patch("/settings/theme", json={"theme_preference": "dark"})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["theme_preference"], "dark")
        self.assertEqual(self.fake_service.last_theme_payload.theme_preference, "dark")

    def test_patch_language_updates_authenticated_user_preference(self) -> None:
        response = self.client.patch(
            "/settings/language", json={"language_preference": "ar"}
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["language_preference"], "ar")
        self.assertEqual(self.fake_service.last_language_payload.language_preference, "ar")

    def test_authentication_required_returns_structured_error(self) -> None:
        app.dependency_overrides.clear()
        app.dependency_overrides[get_db_session] = lambda: FakeSession()
        self.client = TestClient(app)

        response = self.client.get("/settings")

        self.assertEqual(response.status_code, 401)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"]["code"], "AUTHENTICATION_REQUIRED")

    def test_invalid_authenticated_user_header_returns_structured_error(self) -> None:
        app.dependency_overrides.clear()
        app.dependency_overrides[get_db_session] = lambda: FakeSession()
        self.client = TestClient(app)

        response = self.client.get("/settings", headers={"X-User-Id": "not-a-uuid"})

        self.assertEqual(response.status_code, 401)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"]["code"], "INVALID_AUTHENTICATED_USER")

    def test_missing_authenticated_user_record_returns_structured_error(self) -> None:
        app.dependency_overrides.clear()
        app.dependency_overrides[get_db_session] = lambda: FakeSession()
        self.client = TestClient(app)

        response = self.client.get("/settings", headers={"X-User-Id": str(uuid4())})

        self.assertEqual(response.status_code, 404)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"]["code"], "AUTHENTICATED_USER_NOT_FOUND")


class FakeSession:
    def scalar(self, statement):
        return None


if __name__ == "__main__":
    unittest.main()
