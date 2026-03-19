from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SessionBusinessRead(BaseModel):
    id: UUID
    name: str
    owner_user_id: UUID
    default_language: str | None = None


class AuthenticatedUserRead(BaseModel):
    id: UUID
    email: str
    full_name: str | None = None
    role: str
    language_preference: str | None = None
    theme_preference: str | None = None


class SessionRead(BaseModel):
    user: AuthenticatedUserRead
    businesses: list[SessionBusinessRead]
    authenticated_at: datetime


class LogoutResult(BaseModel):
    status: str
    message: str
