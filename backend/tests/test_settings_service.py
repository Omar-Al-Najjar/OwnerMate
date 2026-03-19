from __future__ import annotations

from datetime import datetime, timezone
import unittest
from uuid import uuid4

from backend.app.core.exceptions import AppError
from backend.app.models.user import User
from backend.app.schemas.settings import (
    LanguagePreferenceUpdateRequest,
    ThemePreferenceUpdateRequest,
)
from backend.app.services.settings import SettingsService


class FakeUserRepository:
    def __init__(self, users: dict) -> None:
        self.users = users
        self.saved = False

    def get_by_id(self, user_id):
        return self.users.get(user_id)

    def save(self):
        self.saved = True

    def refresh(self, user):
        user.updated_at = datetime.now(timezone.utc)


class SettingsServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.user_id = uuid4()
        self.user = User(
            id=self.user_id,
            email="owner@example.com",
            role="owner",
            language_preference="en",
            theme_preference="light",
        )
        self.user.updated_at = datetime.now(timezone.utc)
        self.repository = FakeUserRepository({self.user_id: self.user})
        self.service = SettingsService(user_repository=self.repository)

    def test_get_settings_returns_authenticated_user_preferences(self) -> None:
        result = self.service.get_settings(self.user)

        self.assertEqual(result.user_id, self.user_id)
        self.assertEqual(result.language_preference, "en")
        self.assertEqual(result.theme_preference, "light")

    def test_update_theme_updates_authenticated_user(self) -> None:
        result = self.service.update_theme(
            self.user,
            ThemePreferenceUpdateRequest(theme_preference="dark"),
        )

        self.assertEqual(result.theme_preference, "dark")
        self.assertTrue(self.repository.saved)

    def test_update_language_updates_authenticated_user(self) -> None:
        result = self.service.update_language(
            self.user,
            LanguagePreferenceUpdateRequest(language_preference="ar"),
        )

        self.assertEqual(result.language_preference, "ar")
        self.assertTrue(self.repository.saved)

    def test_missing_authenticated_user_raises(self) -> None:
        missing_user = User(
            id=uuid4(),
            email="missing@example.com",
            role="owner",
        )

        with self.assertRaises(AppError) as raised:
            self.service.get_settings(missing_user)

        self.assertEqual(raised.exception.code, "AUTHENTICATED_USER_NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
