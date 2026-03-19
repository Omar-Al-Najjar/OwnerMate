from sqlalchemy.orm import Session


class Repository:
    """Base repository type for future persistence adapters."""

    def __init__(self, session: Session) -> None:
        self.session = session
