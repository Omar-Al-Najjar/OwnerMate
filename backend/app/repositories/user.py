from uuid import UUID

from sqlalchemy import select

from ..models.user import User
from .base import Repository


class UserRepository(Repository):
    def get_by_id(self, user_id: UUID) -> User | None:
        statement = select(User).where(User.id == user_id)
        return self.session.scalar(statement)

    def save(self) -> None:
        self.session.commit()

    def refresh(self, user: User) -> None:
        self.session.refresh(user)
