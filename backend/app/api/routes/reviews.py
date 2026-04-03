from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile, status

from ...core.responses import success_response
from ...models.user import User
from ...schemas.common import SuccessResponse
from ...schemas.review import (
    FacebookReviewImportSourceRequest,
    GoogleReviewImportSourceRequest,
    ReviewBusinessScope,
    ReviewImportRequest,
    ReviewUploadImportRequest,
    ReviewListQuery,
    ReviewStatusUpdateRequest,
)
from ...services.authorization import AuthorizationService
from ...services.review import ReviewService
from ...services.review_upload import ReviewUploadImportService
from ...services.source_review_import import SourceReviewImportService
from ..dependencies import (
    get_authorization_service,
    get_current_user,
    get_review_service,
    get_review_upload_import_service,
    get_source_review_import_service,
    parse_review_upload_import_request,
)

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("", response_model=SuccessResponse)
async def list_reviews(
    query: ReviewListQuery = Depends(),
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: ReviewService = Depends(get_review_service),
):
    authorization.ensure_business_access(current_user, query.business_id)
    return success_response(service.list_reviews(query))


@router.get("/{review_id}", response_model=SuccessResponse)
async def get_review(
    review_id: UUID,
    scope: ReviewBusinessScope = Depends(),
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: ReviewService = Depends(get_review_service),
):
    authorization.ensure_business_access(current_user, scope.business_id)
    return success_response(service.get_review(review_id, scope))


@router.post("/import", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def import_reviews(
    payload: ReviewImportRequest,
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: ReviewService = Depends(get_review_service),
):
    authorization.ensure_business_access(current_user, payload.business_id)
    result = service.import_reviews(payload)
    return success_response(result)


@router.post(
    "/import/upload",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
)
async def import_uploaded_reviews(
    payload: ReviewUploadImportRequest = Depends(parse_review_upload_import_request),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: ReviewUploadImportService = Depends(get_review_upload_import_service),
):
    authorization.ensure_business_access(current_user, payload.business_id)
    result = service.import_reviews(
        upload=payload,
        filename=file.filename or "uploaded-file",
        content_type=file.content_type,
        content=await file.read(),
    )
    return success_response(result)


@router.post(
    "/import/google",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
)
async def import_google_reviews(
    payload: GoogleReviewImportSourceRequest,
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: SourceReviewImportService = Depends(get_source_review_import_service),
):
    authorization.ensure_business_access(current_user, payload.business_id)
    return success_response(service.import_google_reviews(payload))


@router.post(
    "/import/facebook",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
)
async def import_facebook_reviews(
    payload: FacebookReviewImportSourceRequest,
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: SourceReviewImportService = Depends(get_source_review_import_service),
):
    authorization.ensure_business_access(current_user, payload.business_id)
    return success_response(service.import_facebook_reviews(payload))


@router.patch("/{review_id}/status", response_model=SuccessResponse)
async def update_review_status(
    review_id: UUID,
    payload: ReviewStatusUpdateRequest,
    scope: ReviewBusinessScope = Depends(),
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: ReviewService = Depends(get_review_service),
):
    authorization.ensure_business_access(current_user, scope.business_id)
    return success_response(service.update_review_status(review_id, scope, payload))
