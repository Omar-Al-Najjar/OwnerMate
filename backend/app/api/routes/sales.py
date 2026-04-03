from uuid import UUID

from fastapi import APIRouter, Depends

from ...core.responses import success_response
from ...models.user import User
from ...schemas.common import SuccessResponse
from ...schemas.sales import SalesRecordCreateRequest
from ...services.authorization import AuthorizationService
from ...services.sales import SalesService
from ..dependencies import (
    get_authorization_service,
    get_current_user,
    get_sales_service,
)

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("/{business_id}", response_model=SuccessResponse)
async def list_sales_records(
    business_id: UUID,
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: SalesService = Depends(get_sales_service),
):
    authorization.ensure_business_access(current_user, business_id)
    return success_response(service.list_records(business_id))


@router.post("/records", response_model=SuccessResponse)
async def create_or_update_sales_record(
    payload: SalesRecordCreateRequest,
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    service: SalesService = Depends(get_sales_service),
):
    authorization.ensure_business_access(current_user, payload.business_id)
    return success_response(service.create_or_update_record(payload))
