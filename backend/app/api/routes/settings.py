from fastapi import APIRouter, Depends

from ...core.responses import success_response
from ...models.user import User
from ...schemas.common import SuccessResponse
from ...schemas.settings import (
    LanguagePreferenceUpdateRequest,
    ThemePreferenceUpdateRequest,
)
from ...services.settings import SettingsService
from ..dependencies import get_current_user, get_settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SuccessResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    service: SettingsService = Depends(get_settings_service),
):
    return success_response(service.get_settings(current_user))


@router.patch("/theme", response_model=SuccessResponse)
async def update_theme_preference(
    payload: ThemePreferenceUpdateRequest,
    current_user: User = Depends(get_current_user),
    service: SettingsService = Depends(get_settings_service),
):
    return success_response(service.update_theme(current_user, payload))


@router.patch("/language", response_model=SuccessResponse)
async def update_language_preference(
    payload: LanguagePreferenceUpdateRequest,
    current_user: User = Depends(get_current_user),
    service: SettingsService = Depends(get_settings_service),
):
    return success_response(service.update_language(current_user, payload))
