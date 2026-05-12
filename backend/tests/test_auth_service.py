from __future__ import annotations

import unittest
from uuid import uuid4

from backend.app.models.business import Business
from backend.app.models.user import User
from backend.app.services.auth import AuthService
from backend.app.services.token_verifier import VerifiedIdentity


class FakeUserRepository:
    def __init__(self, user: User | None) -> None:
        self.user = user
        self.saved = 0
        self.refreshed = 0
        self.added = 0

    def get_by_supabase_user_id(self, supabase_user_id: str) -> User | None:
        if self.user and self.user.supabase_user_id == supabase_user_id:
            return self.user
        return None

    def get_by_email(self, email: str) -> User | None:
        if self.user and self.user.email == email:
            return self.user
        return None

    def add(self, user: User) -> User:
        self.added += 1
        self.user = user
        return user

    def save(self) -> None:
        self.saved += 1

    def refresh(self, user: User) -> None:
        self.refreshed += 1


class FakeBusinessRepository:
    def __init__(self, businesses: list[Business]) -> None:
        self.businesses = list(businesses)
        self.list_calls = 0
        self.add_calls = 0

    def list_for_owner(self, owner_user_id):
        self.list_calls += 1
        return [
            business
            for business in self.businesses
            if business.owner_user_id == owner_user_id
        ]

    def add(self, business: Business) -> Business:
        self.add_calls += 1
        self.businesses.append(business)
        return business


class AuthServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.user = User(
            id=uuid4(),
            email="owner@example.com",
            supabase_user_id="supabase-user-123",
            full_name="Owner Example",
            role="owner",
            language_preference="en",
            theme_preference="dark",
        )
        self.identity = VerifiedIdentity(
            subject="supabase-user-123",
            email="owner@example.com",
            full_name="Owner Example",
            role="owner",
            language_preference="en",
            theme_preference="dark",
        )

    def test_existing_unchanged_user_does_not_save_again(self) -> None:
        business_repository = FakeBusinessRepository(
            [
                Business(
                    owner_user_id=self.user.id,
                    name="Owner Example Business",
                    default_language="en",
                )
            ]
        )
        user_repository = FakeUserRepository(self.user)
        service = AuthService(
            business_repository=business_repository,
            user_repository=user_repository,
        )

        user = service.get_or_create_user_for_identity(self.identity)

        self.assertIs(user, self.user)
        self.assertEqual(user_repository.saved, 0)
        self.assertEqual(user_repository.refreshed, 0)
        self.assertEqual(business_repository.list_calls, 1)
        self.assertEqual(business_repository.add_calls, 0)

    def test_existing_user_without_business_creates_default_business_once(self) -> None:
        business_repository = FakeBusinessRepository([])
        user_repository = FakeUserRepository(self.user)
        service = AuthService(
            business_repository=business_repository,
            user_repository=user_repository,
        )

        user = service.get_or_create_user_for_identity(self.identity)

        self.assertIs(user, self.user)
        self.assertEqual(user_repository.saved, 1)
        self.assertEqual(user_repository.refreshed, 1)
        self.assertEqual(business_repository.list_calls, 1)
        self.assertEqual(business_repository.add_calls, 1)
        self.assertEqual(len(business_repository.businesses), 1)


if __name__ == "__main__":
    unittest.main()
