from uuid import UUID

from sqlalchemy import select

from ..models.user import User
from .base import Repository


class UserRepository(Repository):
    def get_by_id(self, user_id: UUID) -> User | None:
        statement = select(User).where(User.id == user_id)
        return self.session.scalar(statement)

    def get_by_email(self, email: str) -> User | None:
        statement = select(User).where(User.email == email)
        return self.session.scalar(statement)

    def get_by_supabase_user_id(self, supabase_user_id: str) -> User | None:
        statement = select(User).where(User.supabase_user_id == supabase_user_id)
        return self.session.scalar(statement)

    def add(self, user: User) -> User:
        self.session.add(user)
        self.session.flush()
        self.session.refresh(user)
        return user

    def save(self) -> None:
        self.session.commit()

    def refresh(self, user: User) -> None:
        self.session.refresh(user)
