from uuid import UUID

from fastapi import APIRouter, Depends

from ...core.responses import success_response
from ...models.user import User
from ...schemas.common import SuccessResponse
from ...schemas.sentiment import SentimentAnalyzeBatchRequest, SentimentAnalyzeRequest
from ...services.authorization import AuthorizationService
from ...services.sentiment import SentimentAnalysisService
from ..dependencies import (
    get_authorization_service,
    get_current_user,
    get_sentiment_analysis_service,
)

router = APIRouter(prefix="/sentiment", tags=["sentiment"])


@router.post("/analyze", response_model=SuccessResponse)
async def analyze_review_sentiment(
    payload: SentimentAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: SentimentAnalysisService = Depends(get_sentiment_analysis_service),
):
    authorization.ensure_review_access(current_user, payload.review_id)
    return success_response(service.analyze_review(payload))


@router.post("/analyze-batch", response_model=SuccessResponse)
async def analyze_review_sentiment_batch(
    payload: SentimentAnalyzeBatchRequest,
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: SentimentAnalysisService = Depends(get_sentiment_analysis_service),
):
    authorization.ensure_review_batch_access(current_user, payload.review_ids)
    return success_response(service.analyze_review_batch(payload))


@router.get("/reviews/{review_id}", response_model=SuccessResponse)
async def get_review_sentiment(
    review_id: UUID,
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: SentimentAnalysisService = Depends(get_sentiment_analysis_service),
):
    authorization.ensure_review_access(current_user, review_id)
    return success_response(service.get_review_sentiment(review_id))
