from datetime import datetime, timezone

from ..models.user import User
from ..repositories.business import BusinessRepository
from ..schemas.auth import (
    AuthenticatedUserRead,
    LogoutResult,
    SessionBusinessRead,
    SessionRead,
)


class AuthService:
    def __init__(self, *, business_repository: BusinessRepository) -> None:
        self.business_repository = business_repository

    def get_session(self, user: User) -> SessionRead:
        businesses = self.business_repository.list_for_owner(user.id)
        return SessionRead(
            user=AuthenticatedUserRead(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                role=user.role,
                language_preference=user.language_preference,
                theme_preference=user.theme_preference,
            ),
            businesses=[
                SessionBusinessRead(
                    id=business.id,
                    name=business.name,
                    owner_user_id=business.owner_user_id,
                    default_language=business.default_language,
                )
                for business in businesses
            ],
            authenticated_at=datetime.now(timezone.utc),
        )

    def logout(self) -> LogoutResult:
        return LogoutResult(
            status="signed_out",
            message="Session logout completed on the backend boundary.",
        )
