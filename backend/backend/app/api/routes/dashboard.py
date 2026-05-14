from fastapi import APIRouter, Depends

from ...core.responses import success_response
from ...models.user import User
from ...schemas.common import SuccessResponse
from ...schemas.dashboard import DashboardOverviewQuery
from ...services.authorization import AuthorizationService
from ...services.dashboard import DashboardService
from ..dependencies import (
    get_authorization_service,
    get_current_user,
    get_dashboard_service,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=SuccessResponse)
async def get_dashboard_overview(
    query: DashboardOverviewQuery = Depends(),
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: DashboardService = Depends(get_dashboard_service),
):
    authorization.ensure_business_access(current_user, query.business_id)
    return success_response(service.get_overview(query))
