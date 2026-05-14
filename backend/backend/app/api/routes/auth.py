from fastapi import APIRouter, Depends, Response

from ...core.responses import success_response
from ...models.user import User
from ...schemas.common import SuccessResponse
from ...services.auth import AuthService
from ..dependencies import get_auth_service, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=SuccessResponse)
async def get_authenticated_session(
    current_user: User = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
):
    return success_response(service.get_session(current_user))


@router.post("/logout", response_model=SuccessResponse)
async def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
):
    del current_user
    for cookie_name in ("sb-access-token", "sb-refresh-token", "access_token", "refresh_token"):
        response.delete_cookie(cookie_name)
    return success_response(service.logout())
