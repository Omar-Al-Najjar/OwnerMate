from functools import lru_cache

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from .config import get_settings


@lru_cache
def create_db_engine() -> Engine:
    settings = get_settings()
    if not settings.database_url:
        raise ValueError("DATABASE_URL is required to initialize the database engine.")
    return create_engine(settings.database_url, pool_pre_ping=True)


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(
        bind=create_db_engine(),
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )


def check_database_connection() -> tuple[bool, str | None]:
    try:
        engine = create_db_engine()
    except ValueError as exc:
        return False, str(exc)

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, None
    except Exception as exc:
        return False, str(exc)
