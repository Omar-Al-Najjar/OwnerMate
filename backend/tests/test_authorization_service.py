from __future__ import annotations

import unittest
from uuid import uuid4

from backend.app.core.exceptions import AppError
from backend.app.models.user import User
from backend.app.services.authorization import AuthorizationService


class FakeBusiness:
    def __init__(self, business_id, owner_user_id) -> None:
        self.id = business_id
        self.owner_user_id = owner_user_id


class FakeReview:
    def __init__(self, review_id, business_id) -> None:
        self.id = review_id
        self.business_id = business_id


class FakeGeneratedContent:
    def __init__(self, content_id, business_id) -> None:
        self.id = content_id
        self.business_id = business_id


class FakeAgentRun:
    def __init__(self, run_id, business_id) -> None:
        self.id = run_id
        self.business_id = business_id


class FakeBusinessRepository:
    def __init__(self, businesses) -> None:
        self.businesses = businesses

    def get_by_id(self, business_id):
        return self.businesses.get(business_id)


class FakeReviewRepository:
    def __init__(self, reviews) -> None:
        self.reviews = reviews

    def get_by_id(self, review_id):
        return self.reviews.get(review_id)


class FakeGeneratedContentRepository:
    def __init__(self, contents) -> None:
        self.contents = contents

    def get_by_id(self, content_id):
        return self.contents.get(content_id)


class FakeAgentRunRepository:
    def __init__(self, agent_runs) -> None:
        self.agent_runs = agent_runs

    def get_by_id(self, run_id):
        return self.agent_runs.get(run_id)


class AuthorizationServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.owner_id = uuid4()
        self.other_user_id = uuid4()
        self.admin_id = uuid4()
        self.business_id = uuid4()
        self.review_id = uuid4()
        self.content_id = uuid4()
        self.run_id = uuid4()

        self.service = AuthorizationService(
            business_repository=FakeBusinessRepository(
                {self.business_id: FakeBusiness(self.business_id, self.owner_id)}
            ),
            review_repository=FakeReviewRepository(
                {self.review_id: FakeReview(self.review_id, self.business_id)}
            ),
            generated_content_repository=FakeGeneratedContentRepository(
                {self.content_id: FakeGeneratedContent(self.content_id, self.business_id)}
            ),
            agent_run_repository=FakeAgentRunRepository(
                {self.run_id: FakeAgentRun(self.run_id, self.business_id)}
            ),
        )
        self.owner = User(id=self.owner_id, email="owner@example.com", role="owner")
        self.other_user = User(
            id=self.other_user_id, email="other@example.com", role="owner"
        )
        self.admin = User(id=self.admin_id, email="admin@example.com", role="admin")

    def test_owner_can_access_owned_business_resources(self) -> None:
        business = self.service.ensure_business_access(self.owner, self.business_id)
        review = self.service.ensure_review_access(self.owner, self.review_id)
        content = self.service.ensure_generated_content_access(self.owner, self.content_id)
        agent_run = self.service.ensure_agent_run_access(self.owner, self.run_id)

        self.assertEqual(business.id, self.business_id)
        self.assertEqual(review.id, self.review_id)
        self.assertEqual(content.id, self.content_id)
        self.assertEqual(agent_run.id, self.run_id)

    def test_admin_can_access_any_business_resource(self) -> None:
        business = self.service.ensure_business_access(self.admin, self.business_id)
        self.assertEqual(business.id, self.business_id)

    def test_non_owner_is_forbidden_from_business_scope(self) -> None:
        with self.assertRaises(AppError) as context:
            self.service.ensure_business_access(self.other_user, self.business_id)

        self.assertEqual(context.exception.code, "FORBIDDEN")
        self.assertEqual(context.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
