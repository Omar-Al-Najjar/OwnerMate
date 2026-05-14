import logging
from uuid import UUID

from fastapi import status

from ..core.exceptions import AppError
from ..models.agent_run import AgentRun
from ..models.generated_content import GeneratedContent
from ..models.review import Review
from ..repositories.agent_run import AgentRunRepository
from ..repositories.business import BusinessRepository
from ..repositories.generated_content import GeneratedContentRepository
from ..repositories.review import ReviewRepository
from ..schemas.content import (
    ContentGenerationResult,
    ContentProviderRequest,
    GenerateMarketingCopyRequest,
    GenerateReplyRequest,
    GeneratedContentRead,
    RegenerateContentRequest,
    SaveGeneratedContentRequest,
    SavedGeneratedContentResult,
)
from .providers import ContentGenerationProvider

logger = logging.getLogger(__name__)


class ContentGenerationService:
    def __init__(
        self,
        *,
        provider: ContentGenerationProvider,
        business_repository: BusinessRepository,
        review_repository: ReviewRepository,
        generated_content_repository: GeneratedContentRepository,
        agent_run_repository: AgentRunRepository,
    ) -> None:
        self.provider = provider
        self.business_repository = business_repository
        self.review_repository = review_repository
        self.generated_content_repository = generated_content_repository
        self.agent_run_repository = agent_run_repository

    def generate_reply(self, payload: GenerateReplyRequest) -> ContentGenerationResult:
        business = self._get_business_or_raise(payload.business_id)
        review = self._get_business_review_or_raise(
            review_id=payload.review_id,
            business_id=business.id,
        )

        agent_run = AgentRun(
            business_id=business.id,
            agent_name="content_generation",
            task_type="generate_reply",
            status="running",
            input_reference={
                "review_id": str(review.id),
                "business_id": str(business.id),
                "provider": self.provider.provider_name,
            },
        )
        provider_request = ContentProviderRequest(
            content_type="review_reply",
            business_id=business.id,
            language=payload.language,
            tone=payload.tone,
            business_context=payload.business_context or business.name,
            review_id=review.id,
            review_text=review.review_text,
            reviewer_name=review.reviewer_name,
            rating=review.rating,
            prompt_context={
                "source_type": review.source_type,
                "business_name": business.name,
                "business_context": payload.business_context or business.name,
            },
        )
        return self._generate_content(agent_run=agent_run, provider_request=provider_request)

    def generate_marketing_copy(
        self, payload: GenerateMarketingCopyRequest
    ) -> ContentGenerationResult:
        business = self._get_business_or_raise(payload.business_id)
        agent_run = AgentRun(
            business_id=business.id,
            agent_name="content_generation",
            task_type="generate_marketing_copy",
            status="running",
            input_reference={
                "business_id": str(business.id),
                "provider": self.provider.provider_name,
            },
        )
        provider_request = ContentProviderRequest(
            content_type="marketing_copy",
            business_id=business.id,
            language=payload.language,
            tone=payload.tone,
            business_context=payload.business_context or business.name,
            prompt_context={
                "business_name": business.name,
                "business_context": payload.business_context or business.name,
                **(payload.prompt_context or {}),
            },
        )
        return self._generate_content(agent_run=agent_run, provider_request=provider_request)

    def regenerate_content(
        self, payload: RegenerateContentRequest
    ) -> ContentGenerationResult:
        existing_content = self._get_generated_content_or_raise(payload.content_id)
        business = self._get_business_or_raise(existing_content.business_id)

        review = None
        if existing_content.review_id is not None:
            review = self.review_repository.get_by_id(existing_content.review_id)
            if review is None or review.business_id != business.id:
                raise AppError(
                    code="REVIEW_NOT_FOUND",
                    message="Review not found for the specified business.",
                    status_code=status.HTTP_404_NOT_FOUND,
                )

        agent_run = AgentRun(
            business_id=business.id,
            agent_name="content_generation",
            task_type="regenerate_content",
            status="running",
            input_reference={
                "content_id": str(existing_content.id),
                "business_id": str(business.id),
                "provider": self.provider.provider_name,
            },
        )
        provider_request = ContentProviderRequest(
            content_type=existing_content.content_type,
            business_id=business.id,
            language=payload.language,
            tone=payload.tone,
            business_context=payload.business_context or business.name,
            review_id=review.id if review is not None else None,
            review_text=review.review_text if review is not None else None,
            reviewer_name=review.reviewer_name if review is not None else None,
            rating=review.rating if review is not None else None,
            prompt_context=self._build_regeneration_prompt_context(
                existing_content=existing_content,
                business_name=business.name,
                business_context=payload.business_context or business.name,
                override_prompt_context=payload.prompt_context,
                review_source_type=review.source_type if review is not None else None,
            ),
        )
        return self._generate_content(agent_run=agent_run, provider_request=provider_request)

    def save_generated_content(
        self, payload: SaveGeneratedContentRequest
    ) -> SavedGeneratedContentResult:
        generated_content = self._get_generated_content_or_raise(payload.content_id)
        generated_content.edited_text = payload.edited_text
        generated_content.created_by_user_id = payload.created_by_user_id
        self.generated_content_repository.save()
        self.generated_content_repository.refresh(generated_content)
        return SavedGeneratedContentResult(
            generated_content=GeneratedContentRead.model_validate(generated_content)
        )

    def get_generated_content(self, content_id: UUID) -> GeneratedContentRead:
        generated_content = self._get_generated_content_or_raise(content_id)
        return GeneratedContentRead.model_validate(generated_content)

    def _generate_content(
        self,
        *,
        agent_run: AgentRun,
        provider_request: ContentProviderRequest,
    ) -> ContentGenerationResult:
        try:
            self.agent_run_repository.add(agent_run)
            provider_result = self.provider.generate(provider_request)
            generated_content = GeneratedContent(
                business_id=provider_request.business_id,
                review_id=provider_request.review_id,
                content_type=provider_request.content_type,
                language=provider_request.language,
                tone=provider_request.tone,
                prompt_context=provider_result.prompt_context,
                generated_text=provider_result.generated_text,
            )
            persisted = self.generated_content_repository.add(generated_content)
            self.agent_run_repository.mark_success(
                agent_run,
                output_reference={
                    "generated_content_id": str(persisted.id),
                    "content_type": persisted.content_type,
                    "provider": provider_result.model_name,
                },
            )
            self.generated_content_repository.save()
            self.agent_run_repository.refresh(agent_run)
            return ContentGenerationResult(
                generated_content=GeneratedContentRead.model_validate(persisted),
                agent_run_id=agent_run.id,
            )
        except AppError:
            self._mark_agent_run_failed(agent_run, "Application error during content generation.")
            raise
        except Exception as exc:
            self.generated_content_repository.rollback()
            logger.exception(
                "Content generation failed for business %s", provider_request.business_id
            )
            self._mark_agent_run_failed(agent_run, str(exc))
            raise AppError(
                code="CONTENT_PROVIDER_ERROR",
                message="Content generation is currently unavailable.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                details={
                    "provider": self.provider.provider_name,
                    "content_type": provider_request.content_type,
                },
            ) from exc

    def _get_business_or_raise(self, business_id):
        business = self.business_repository.get_by_id(business_id)
        if business is None:
            raise AppError(
                code="BUSINESS_NOT_FOUND",
                message="Business not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return business

    def _get_business_review_or_raise(self, *, review_id: UUID, business_id: UUID) -> Review:
        review = self.review_repository.get_by_id(review_id)
        if review is None:
            raise AppError(
                code="REVIEW_NOT_FOUND",
                message="Review not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        if review.business_id != business_id:
            raise AppError(
                code="REVIEW_BUSINESS_SCOPE_MISMATCH",
                message="Review does not belong to the specified business.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        return review

    def _mark_agent_run_failed(self, agent_run: AgentRun, error_message: str) -> None:
        try:
            self.agent_run_repository.mark_failed(agent_run, error_message=error_message[:500])
            self.agent_run_repository.save()
        except Exception:
            self.agent_run_repository.rollback()
            logger.exception("Failed to persist failed content agent run %s", agent_run.id)

    def _get_generated_content_or_raise(self, content_id: UUID) -> GeneratedContent:
        generated_content = self.generated_content_repository.get_by_id(content_id)
        if generated_content is None:
            raise AppError(
                code="GENERATED_CONTENT_NOT_FOUND",
                message="Generated content not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return generated_content

    def _build_regeneration_prompt_context(
        self,
        *,
        existing_content: GeneratedContent,
        business_name: str,
        business_context: str,
        override_prompt_context: dict | None,
        review_source_type: str | None,
    ) -> dict:
        prompt_context = dict(existing_content.prompt_context or {})
        prompt_context["regenerated_from_content_id"] = str(existing_content.id)
        prompt_context["business_name"] = business_name
        prompt_context["business_context"] = business_context
        if review_source_type is not None:
            prompt_context["source_type"] = review_source_type
        if override_prompt_context:
            prompt_context.update(override_prompt_context)
        return prompt_context
