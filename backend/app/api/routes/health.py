from fastapi import APIRouter, Response, status

from ...core.responses import success_response
from ...schemas.common import SuccessResponse
from ...services.health import HealthService

router = APIRouter()


@router.get("/health", response_model=SuccessResponse)
async def get_health():
    return success_response(HealthService.get_health_status())


@router.get(
    "/ready",
    response_model=SuccessResponse,
)
async def get_readiness(response: Response):
    readiness = HealthService.get_readiness_status()
    response.status_code = (
        status.HTTP_200_OK
        if readiness.status == "ready"
        else status.HTTP_503_SERVICE_UNAVAILABLE
    )
    return success_response(readiness)
