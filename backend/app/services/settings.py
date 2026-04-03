from fastapi import status

from ..core.exceptions import AppError
from ..models.user import User
from ..repositories.user import UserRepository
from ..schemas.settings import (
    LanguagePreferenceUpdateRequest,
    ProfileUpdateRequest,
    SettingsRead,
    ThemePreferenceUpdateRequest,
)


class SettingsService:
    def __init__(self, *, user_repository: UserRepository) -> None:
        self.user_repository = user_repository

    def get_settings(self, user: User) -> SettingsRead:
        stored_user = self._get_user_or_raise(user.id)
        return self._to_settings_read(stored_user)

    def update_theme(
        self, user: User, payload: ThemePreferenceUpdateRequest
    ) -> SettingsRead:
        stored_user = self._get_user_or_raise(user.id)
        stored_user.theme_preference = payload.theme_preference
        self.user_repository.save()
        self.user_repository.refresh(stored_user)
        return self._to_settings_read(stored_user)

    def update_language(
        self, user: User, payload: LanguagePreferenceUpdateRequest
    ) -> SettingsRead:
        stored_user = self._get_user_or_raise(user.id)
        stored_user.language_preference = payload.language_preference
        self.user_repository.save()
        self.user_repository.refresh(stored_user)
        return self._to_settings_read(stored_user)

    def update_profile(
        self, user: User, payload: ProfileUpdateRequest
    ) -> SettingsRead:
        stored_user = self._get_user_or_raise(user.id)
        stored_user.full_name = payload.full_name
        self.user_repository.save()
        self.user_repository.refresh(stored_user)
        return self._to_settings_read(stored_user)

    def _get_user_or_raise(self, user_id):
        user = self.user_repository.get_by_id(user_id)
        if user is None:
            raise AppError(
                code="AUTHENTICATED_USER_NOT_FOUND",
                message="Authenticated user not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return user

    def _to_settings_read(self, user: User) -> SettingsRead:
        return SettingsRead(
            user_id=user.id,
            language_preference=user.language_preference,
            theme_preference=user.theme_preference,
            updated_at=user.updated_at,
        )
