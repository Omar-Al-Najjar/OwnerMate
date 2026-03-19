from collections.abc import Sequence
from uuid import UUID

from fastapi import status

from ..core.exceptions import AppError
from ..models.user import User
from ..repositories.agent_run import AgentRunRepository
from ..repositories.business import BusinessRepository
from ..repositories.generated_content import GeneratedContentRepository
from ..repositories.review import ReviewRepository


class AuthorizationService:
    def __init__(
        self,
        *,
        business_repository: BusinessRepository,
        review_repository: ReviewRepository,
        generated_content_repository: GeneratedContentRepository,
        agent_run_repository: AgentRunRepository,
    ) -> None:
        self.business_repository = business_repository
        self.review_repository = review_repository
        self.generated_content_repository = generated_content_repository
        self.agent_run_repository = agent_run_repository

    def ensure_business_access(self, user: User, business_id: UUID):
        business = self.business_repository.get_by_id(business_id)
        if business is None:
            raise AppError(
                code="BUSINESS_NOT_FOUND",
                message="Business not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        self._ensure_user_can_access_business(user, business.id, business.owner_user_id)
        return business

    def ensure_review_access(self, user: User, review_id: UUID):
        review = self.review_repository.get_by_id(review_id)
        if review is None:
            raise AppError(
                code="REVIEW_NOT_FOUND",
                message="Review not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        self.ensure_business_access(user, review.business_id)
        return review

    def ensure_review_batch_access(self, user: User, review_ids: Sequence[UUID]) -> None:
        for review_id in review_ids:
            self.ensure_review_access(user, review_id)

    def ensure_generated_content_access(self, user: User, content_id: UUID):
        generated_content = self.generated_content_repository.get_by_id(content_id)
        if generated_content is None:
            raise AppError(
                code="GENERATED_CONTENT_NOT_FOUND",
                message="Generated content not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        self.ensure_business_access(user, generated_content.business_id)
        return generated_content

    def ensure_agent_run_access(self, user: User, run_id: UUID):
        agent_run = self.agent_run_repository.get_by_id(run_id)
        if agent_run is None:
            raise AppError(
                code="AGENT_RUN_NOT_FOUND",
                message="Agent run not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        self.ensure_business_access(user, agent_run.business_id)
        return agent_run

    def authorize_agent_task(self, user: User, task: str, payload: dict) -> None:
        normalized_task = task.strip().lower()

        if normalized_task in {
            "import_reviews",
            "generate_reply",
            "generate_marketing_copy",
            "get_review_summary",
        }:
            business_id = payload.get("business_id")
            if business_id is None:
                return
            self.ensure_business_access(user, UUID(str(business_id)))
            if normalized_task == "generate_reply":
                review_id = payload.get("review_id")
                if review_id is None:
                    return
                review = self.ensure_review_access(user, UUID(str(review_id)))
                if str(review.business_id) != str(business_id):
                    raise AppError(
                        code="REVIEW_BUSINESS_SCOPE_MISMATCH",
                        message="Review does not belong to the specified business.",
                        status_code=status.HTTP_400_BAD_REQUEST,
                    )
            return

        if normalized_task == "analyze_review":
            review_id = payload.get("review_id")
            if review_id is None:
                return
            self.ensure_review_access(user, UUID(str(review_id)))
            return

        if normalized_task == "analyze_review_batch":
            review_ids = payload.get("review_ids")
            if not isinstance(review_ids, list):
                return
            self.ensure_review_batch_access(user, [UUID(str(review_id)) for review_id in review_ids])

    def _ensure_user_can_access_business(
        self, user: User, business_id: UUID, owner_user_id: UUID
    ) -> None:
        if user.role == "admin":
            return
        if owner_user_id != user.id:
            raise AppError(
                code="FORBIDDEN",
                message="You do not have access to this business.",
                status_code=status.HTTP_403_FORBIDDEN,
                details={
                    "resource": "business",
                    "business_id": str(business_id),
                },
            )
