from uuid import UUID

from fastapi import APIRouter, Depends

from ...core.responses import success_response
from ...models.user import User
from ...schemas.common import SuccessResponse
from ...schemas.content import (
    GenerateMarketingCopyRequest,
    GenerateReplyRequest,
    RegenerateContentRequest,
    SaveGeneratedContentRequest,
)
from ...services.authorization import AuthorizationService
from ...services.content import ContentGenerationService
from ..dependencies import (
    get_authorization_service,
    get_content_generation_service,
    get_current_user,
)

router = APIRouter(prefix="/content", tags=["content"])


@router.post("/generate/reply", response_model=SuccessResponse)
async def generate_review_reply(
    payload: GenerateReplyRequest,
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: ContentGenerationService = Depends(get_content_generation_service),
):
    authorization.ensure_business_access(current_user, payload.business_id)
    authorization.ensure_review_access(current_user, payload.review_id)
    return success_response(service.generate_reply(payload))


@router.post("/generate/marketing", response_model=SuccessResponse)
async def generate_marketing_copy(
    payload: GenerateMarketingCopyRequest,
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: ContentGenerationService = Depends(get_content_generation_service),
):
    authorization.ensure_business_access(current_user, payload.business_id)
    return success_response(service.generate_marketing_copy(payload))


@router.post("/regenerate", response_model=SuccessResponse)
async def regenerate_content(
    payload: RegenerateContentRequest,
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: ContentGenerationService = Depends(get_content_generation_service),
):
    authorization.ensure_generated_content_access(current_user, payload.content_id)
    return success_response(service.regenerate_content(payload))


@router.post("/save", response_model=SuccessResponse)
async def save_generated_content(
    payload: SaveGeneratedContentRequest,
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: ContentGenerationService = Depends(get_content_generation_service),
):
    authorization.ensure_generated_content_access(current_user, payload.content_id)
    payload = payload.model_copy(update={"created_by_user_id": current_user.id})
    return success_response(service.save_generated_content(payload))


@router.get("/{content_id}", response_model=SuccessResponse)
async def get_generated_content(
    content_id: UUID,
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: ContentGenerationService = Depends(get_content_generation_service),
):
    authorization.ensure_generated_content_access(current_user, content_id)
    return success_response(service.get_generated_content(content_id))
