from __future__ import annotations

from datetime import datetime, timezone
import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.api.dependencies import (
    get_auth_service,
    get_current_user,
    get_db_session,
    get_settings_service,
    get_token_verifier_factory,
)
from backend.app.core.exceptions import AppError
from backend.app.main import app
from backend.app.models.user import User
from backend.app.schemas.settings import SettingsRead
from backend.app.services.token_verifier import VerifiedIdentity


class FakeSettingsService:
    def __init__(self, user_id) -> None:
        self.user_id = user_id
        self.last_user = None
        self.last_theme_payload = None
        self.last_language_payload = None
        self.last_profile_payload = None
        self.last_business_payload = None
        self.now = datetime.now(timezone.utc)

    def get_settings(self, user):
        self.last_user = user
        return SettingsRead(
            user_id=user.id,
            language_preference="en",
            theme_preference="light",
            business={
                "id": str(uuid4()),
                "name": "OwnerMate Test Business",
                "google_review_business_name": "Cafe Amal Amman",
            },
            updated_at=self.now,
        )

    def update_theme(self, user, payload):
        self.last_user = user
        self.last_theme_payload = payload
        return SettingsRead(
            user_id=user.id,
            language_preference="en",
            theme_preference=payload.theme_preference,
            business={
                "id": str(uuid4()),
                "name": "OwnerMate Test Business",
                "google_review_business_name": None,
            },
            updated_at=self.now,
        )

    def update_language(self, user, payload):
        self.last_user = user
        self.last_language_payload = payload
        return SettingsRead(
            user_id=user.id,
            language_preference=payload.language_preference,
            theme_preference="light",
            business={
                "id": str(uuid4()),
                "name": "OwnerMate Test Business",
                "google_review_business_name": None,
            },
            updated_at=self.now,
        )

    def update_profile(self, user, payload):
        self.last_user = user
        self.last_profile_payload = payload
        return SettingsRead(
            user_id=user.id,
            language_preference="en",
            theme_preference="light",
            business={
                "id": str(uuid4()),
                "name": "OwnerMate Test Business",
                "google_review_business_name": None,
            },
            updated_at=self.now,
        )

    def update_business_settings(self, user, payload):
        self.last_user = user
        self.last_business_payload = payload
        return SettingsRead(
            user_id=user.id,
            language_preference="en",
            theme_preference="light",
            business={
                "id": str(uuid4()),
                "name": "OwnerMate Test Business",
                "google_review_business_name": payload.google_review_business_name,
            },
            updated_at=self.now,
        )


class FakeAuthService:
    def __init__(self, user: User) -> None:
        self.user = user

    def get_or_create_user_for_identity(self, identity: VerifiedIdentity) -> User:
        if identity.email != self.user.email:
            raise AssertionError("Unexpected verified identity email passed to fake auth service.")
        return self.user


class FakeTokenVerifier:
    def __init__(self, *, identity: VerifiedIdentity | None = None, error: AppError | None = None):
        self.identity = identity
        self.error = error

    def verify_access_token(self, token: str) -> VerifiedIdentity:
        if token != "valid-token":
            raise AssertionError("Unexpected token passed to fake token verifier.")
        if self.error is not None:
            raise self.error
        if self.identity is None:
            raise AssertionError("Fake token verifier requires an identity or an error.")
        return self.identity


class SettingsRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.user = User(
            id=uuid4(),
            email="owner@example.com",
            role="owner",
            language_preference="en",
            theme_preference="light",
        )
        self.identity = VerifiedIdentity(
            subject="supabase-user-123",
            email=self.user.email,
            full_name=self.user.full_name,
            role="owner",
            language_preference=self.user.language_preference,
            theme_preference=self.user.theme_preference,
        )
        self.fake_service = FakeSettingsService(self.user.id)
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_settings_service] = lambda: self.fake_service
        app.dependency_overrides[get_auth_service] = lambda: FakeAuthService(self.user)
        app.dependency_overrides[get_token_verifier_factory] = lambda: (
            lambda: FakeTokenVerifier(identity=self.identity)
        )
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
        self.assertEqual(body["data"]["business"]["name"], "OwnerMate Test Business")

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

    def test_patch_profile_updates_authenticated_user_name(self) -> None:
        response = self.client.patch(
            "/settings/profile", json={"full_name": "Owner Mate"}
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(self.fake_service.last_profile_payload.full_name, "Owner Mate")

    def test_patch_business_updates_authenticated_business_settings(self) -> None:
        response = self.client.patch(
            "/settings/business",
            json={
                "google_review_business_name": "Cafe Amal Amman",
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(
            self.fake_service.last_business_payload.google_review_business_name,
            "Cafe Amal Amman",
        )

    def test_authentication_required_returns_structured_error(self) -> None:
        app.dependency_overrides.clear()
        app.dependency_overrides[get_db_session] = lambda: FakeSession()
        self.client = TestClient(app)

        response = self.client.get("/settings")

        self.assertEqual(response.status_code, 401)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"]["code"], "AUTHENTICATION_REQUIRED")

    def test_invalid_authorization_header_returns_structured_error(self) -> None:
        app.dependency_overrides.clear()
        app.dependency_overrides[get_db_session] = lambda: FakeSession()
        self.client = TestClient(app)

        response = self.client.get("/settings", headers={"Authorization": "Token invalid"})

        self.assertEqual(response.status_code, 401)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"]["code"], "AUTHENTICATION_FAILED")

    def test_expired_bearer_token_returns_structured_error(self) -> None:
        app.dependency_overrides.clear()
        app.dependency_overrides[get_db_session] = lambda: FakeSession()
        app.dependency_overrides[get_auth_service] = lambda: FakeAuthService(self.user)
        app.dependency_overrides[get_token_verifier_factory] = lambda: (
            lambda: FakeTokenVerifier(
                error=AppError(
                    code="AUTHENTICATION_TOKEN_EXPIRED",
                    message="Authentication token has expired.",
                    status_code=401,
                )
            )
        )
        self.client = TestClient(app)

        response = self.client.get("/settings", headers={"Authorization": "Bearer valid-token"})

        self.assertEqual(response.status_code, 401)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"]["code"], "AUTHENTICATION_TOKEN_EXPIRED")


class FakeSession:
    def scalar(self, statement):
        return None


if __name__ == "__main__":
    unittest.main()
