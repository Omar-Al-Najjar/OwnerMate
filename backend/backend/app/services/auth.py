from datetime import datetime, timezone
from time import monotonic

from ..models.business import Business
from ..models.user import User
from ..repositories.user import UserRepository
from ..repositories.business import BusinessRepository
from ..schemas.auth import (
    AuthenticatedUserRead,
    LogoutResult,
    SessionBusinessRead,
    SessionRead,
)
from .token_verifier import VerifiedIdentity

USER_IDENTITY_CACHE_TTL_SECONDS = 60
_user_identity_cache: dict[str, tuple[float, User]] = {}


class AuthService:
    def __init__(
        self,
        *,
        business_repository: BusinessRepository,
        user_repository: UserRepository,
    ) -> None:
        self.business_repository = business_repository
        self.user_repository = user_repository

    def get_session(self, user: User, businesses: list[Business] | None = None) -> SessionRead:
        resolved_businesses = (
            businesses
            if businesses is not None
            else self.business_repository.list_for_owner(user.id)
        )
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
                for business in resolved_businesses
            ],
            authenticated_at=datetime.now(timezone.utc),
        )

    def logout(self) -> LogoutResult:
        return LogoutResult(
            status="signed_out",
            message="Session logout completed on the backend boundary.",
        )

    def get_or_create_user_for_identity(self, identity: VerifiedIdentity) -> User:
        cached = _user_identity_cache.get(identity.subject)
        if cached and cached[0] > monotonic():
            return cached[1]

        user = self.user_repository.get_by_supabase_user_id(identity.subject)
        if user is None:
            user = self.user_repository.get_by_email(identity.email)

        if user is None:
            user = self.user_repository.add(
                User(
                    email=identity.email,
                    supabase_user_id=identity.subject,
                    full_name=identity.full_name,
                    role=self._resolve_role(identity.role),
                    language_preference=identity.language_preference,
                    theme_preference=identity.theme_preference,
                )
            )
            self._ensure_default_business_for_user(user, businesses=[])
            self.user_repository.save()
            self.user_repository.refresh(user)
            self._cache_user_identity(identity.subject, user)
            return user

        businesses = self.business_repository.list_for_owner(user.id)
        is_dirty = False

        if user.supabase_user_id != identity.subject:
            user.supabase_user_id = identity.subject
            is_dirty = True
        if user.email != identity.email:
            user.email = identity.email
            is_dirty = True
        if user.full_name != identity.full_name:
            user.full_name = identity.full_name
            is_dirty = True
        if (
            identity.language_preference is not None
            and user.language_preference != identity.language_preference
        ):
            user.language_preference = identity.language_preference
            is_dirty = True
        if (
            identity.theme_preference is not None
            and user.theme_preference != identity.theme_preference
        ):
            user.theme_preference = identity.theme_preference
            is_dirty = True

        business_count_before = len(businesses)
        businesses = self._ensure_default_business_for_user(user, businesses=businesses)
        if is_dirty or len(businesses) != business_count_before:
            self.user_repository.save()
            self.user_repository.refresh(user)
        self._cache_user_identity(identity.subject, user)
        return user

    def _cache_user_identity(self, subject: str, user: User) -> None:
        cached_user = User(
            email=user.email,
            supabase_user_id=user.supabase_user_id,
            full_name=user.full_name,
            role=user.role,
            language_preference=user.language_preference,
            theme_preference=user.theme_preference,
        )
        cached_user.id = user.id
        _user_identity_cache[subject] = (
            monotonic() + USER_IDENTITY_CACHE_TTL_SECONDS,
            cached_user,
        )

        if len(_user_identity_cache) > 256:
            oldest_subject = next(iter(_user_identity_cache))
            _user_identity_cache.pop(oldest_subject, None)

    def _resolve_role(self, role: str | None) -> str:
        if role in {"owner", "manager", "admin", "staff"}:
            return role
        return "owner"

    def _ensure_default_business_for_user(
        self, user: User, businesses: list[Business] | None = None
    ) -> list[Business]:
        resolved_businesses = (
            businesses
            if businesses is not None
            else self.business_repository.list_for_owner(user.id)
        )
        if resolved_businesses:
            return resolved_businesses

        business_name = self._build_default_business_name(user)
        created_business = self.business_repository.add(
            Business(
                owner_user_id=user.id,
                name=business_name,
                default_language=user.language_preference,
            )
        )
        return [*resolved_businesses, created_business]

    def _build_default_business_name(self, user: User) -> str:
        if user.full_name:
            return f"{user.full_name} Business"

        email_local_part = user.email.split("@", 1)[0].replace(".", " ").strip()
        if email_local_part:
            normalized = " ".join(part.capitalize() for part in email_local_part.split())
            return f"{normalized} Business"

        return "OwnerMate Business"
