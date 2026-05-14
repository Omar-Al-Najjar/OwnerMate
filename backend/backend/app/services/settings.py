from fastapi import status

from ..core.exceptions import AppError
from ..models.business import Business
from ..models.user import User
from ..repositories.business import BusinessRepository
from ..repositories.user import UserRepository
from ..schemas.settings import (
    BusinessSettingsRead,
    BusinessSettingsUpdateRequest,
    LanguagePreferenceUpdateRequest,
    ProfileUpdateRequest,
    SettingsRead,
    ThemePreferenceUpdateRequest,
)


class SettingsService:
    def __init__(
        self,
        *,
        user_repository: UserRepository,
        business_repository: BusinessRepository,
    ) -> None:
        self.user_repository = user_repository
        self.business_repository = business_repository

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

    def update_business_settings(
        self, user: User, payload: BusinessSettingsUpdateRequest
    ) -> SettingsRead:
        stored_user = self._get_user_or_raise(user.id)
        business = self._get_primary_business_or_raise(stored_user.id)
        business.google_review_business_name = payload.google_review_business_name
        self.business_repository.save()
        self.business_repository.refresh(business)
        self.user_repository.refresh(stored_user)
        return self._to_settings_read(stored_user, business=business)

    def _get_user_or_raise(self, user_id):
        user = self.user_repository.get_by_id(user_id)
        if user is None:
            raise AppError(
                code="AUTHENTICATED_USER_NOT_FOUND",
                message="Authenticated user not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return user

    def _to_settings_read(
        self, user: User, business: Business | None = None
    ) -> SettingsRead:
        business = business or self._get_primary_business_or_raise(user.id)
        return SettingsRead(
            user_id=user.id,
            language_preference=user.language_preference,
            theme_preference=user.theme_preference,
            business=BusinessSettingsRead(
                id=business.id,
                name=business.name,
                google_review_business_name=business.google_review_business_name,
            ),
            updated_at=user.updated_at,
        )

    def _get_primary_business_or_raise(self, owner_user_id) -> Business:
        businesses = self.business_repository.list_for_owner(owner_user_id)
        business = businesses[0] if businesses else None
        if business is None:
            raise AppError(
                code="BUSINESS_NOT_FOUND",
                message="No business is configured for the authenticated user.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return business
