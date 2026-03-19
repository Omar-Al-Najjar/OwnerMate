from uuid import UUID

from sqlalchemy import select

from ..models.business import Business
from .base import Repository


class BusinessRepository(Repository):
    def get_by_id(self, business_id: UUID) -> Business | None:
        statement = select(Business).where(Business.id == business_id)
        return self.session.scalar(statement)

    def list_for_owner(self, owner_user_id: UUID) -> list[Business]:
        statement = (
            select(Business)
            .where(Business.owner_user_id == owner_user_id)
            .order_by(Business.created_at.asc())
        )
        return self.session.scalars(statement).all()
