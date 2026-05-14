from __future__ import annotations

from datetime import datetime, timezone
import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.api.dependencies import (
    get_auth_service,
    get_current_user,
    get_db_session,
    get_token_verifier_factory,
)
from backend.app.core.exceptions import AppError
from backend.app.main import app
from backend.app.models.user import User
from backend.app.schemas.auth import (
    AuthenticatedUserRead,
    LogoutResult,
    SessionBusinessRead,
    SessionRead,
)
from backend.app.services.token_verifier import VerifiedIdentity


class FakeAuthService:
    def __init__(self, user: User) -> None:
        self.user = user

    def get_session(self, user: User) -> SessionRead:
        return SessionRead(
            user=AuthenticatedUserRead(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                role=user.role,
                language_preference=user.language_preference,
                theme_preference=user.theme_preference,
            ),
            businesses=[
                SessionBusinessRead(
                    id=uuid4(),
                    name="Cafe Amal",
                    owner_user_id=user.id,
                    default_language="en",
                )
            ],
            authenticated_at=datetime.now(timezone.utc),
        )

    def get_or_create_user_for_identity(self, identity: VerifiedIdentity) -> User:
        if identity.email != self.user.email:
            raise AssertionError("Unexpected verified identity email passed to fake auth service.")
        return self.user

    def logout(self) -> LogoutResult:
        return LogoutResult(
            status="signed_out",
            message="Session logout completed on the backend boundary.",
        )


class FakeSession:
    def scalar(self, statement):
        return None


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


class AuthRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.user = User(
            id=uuid4(),
            email="owner@example.com",
            role="owner",
            full_name="Owner User",
            language_preference="en",
            theme_preference="dark",
        )
        self.identity = VerifiedIdentity(
            subject="supabase-user-123",
            email=self.user.email,
            full_name=self.user.full_name,
            role="owner",
            language_preference=self.user.language_preference,
            theme_preference=self.user.theme_preference,
        )
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_auth_service] = lambda: FakeAuthService(self.user)
        app.dependency_overrides[get_token_verifier_factory] = lambda: (
            lambda: FakeTokenVerifier(identity=self.identity)
        )
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_get_auth_me_returns_authenticated_session(self) -> None:
        response = self.client.get("/auth/me")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["user"]["id"], str(self.user.id))
        self.assertEqual(body["data"]["businesses"][0]["owner_user_id"], str(self.user.id))

    def test_post_logout_returns_success_and_clears_session_cookies(self) -> None:
        response = self.client.post("/auth/logout")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["status"], "signed_out")
        set_cookie = response.headers.get("set-cookie", "")
        self.assertIn("sb-access-token=", set_cookie)

    def test_auth_me_requires_authentication(self) -> None:
        app.dependency_overrides.clear()
        app.dependency_overrides[get_db_session] = lambda: FakeSession()
        self.client = TestClient(app)

        response = self.client.get("/auth/me")

        self.assertEqual(response.status_code, 401)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"]["code"], "AUTHENTICATION_REQUIRED")

    def test_auth_me_accepts_valid_bearer_token(self) -> None:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides[get_db_session] = lambda: FakeSession()
        self.client = TestClient(app)

        response = self.client.get(
            "/auth/me",
            headers={"Authorization": "Bearer valid-token"},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["user"]["email"], self.user.email)

    def test_auth_me_rejects_invalid_bearer_header_shape(self) -> None:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides[get_db_session] = lambda: FakeSession()
        self.client = TestClient(app)

        response = self.client.get(
            "/auth/me",
            headers={"Authorization": "Token valid-token"},
        )

        self.assertEqual(response.status_code, 401)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"]["code"], "AUTHENTICATION_FAILED")

    def test_auth_me_rejects_expired_bearer_token(self) -> None:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides[get_db_session] = lambda: FakeSession()
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

        response = self.client.get(
            "/auth/me",
            headers={"Authorization": "Bearer valid-token"},
        )

        self.assertEqual(response.status_code, 401)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"]["code"], "AUTHENTICATION_TOKEN_EXPIRED")


if __name__ == "__main__":
    unittest.main()
