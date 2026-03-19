from collections.abc import Generator

from uuid import UUID

from fastapi import Depends, Header, status
from sqlalchemy.orm import Session

from ..agents.orchestrator import OrchestratorAgent
from ..core.db import get_session_factory
from ..core.exceptions import AppError
from ..repositories.agent_run import AgentRunRepository
from ..repositories.business import BusinessRepository
from ..repositories.generated_content import GeneratedContentRepository
from ..repositories.review import ReviewRepository
from ..repositories.sentiment_result import SentimentResultRepository
from ..repositories.user import UserRepository
from ..models.user import User
from ..services.auth import AuthService
from ..services.authorization import AuthorizationService
from ..services.content import ContentGenerationService
from ..services.provider_factory import (
    get_content_provider,
    get_facebook_review_provider,
    get_google_review_provider,
    get_review_intelligence_provider,
    get_sentiment_provider,
)
from ..services.review import ReviewService
from ..services.review_ingestion import ReviewIngestionService
from ..services.review_summary import ReviewSummaryService
from ..services.sentiment import SentimentAnalysisService
from ..services.settings import SettingsService
from ..services.source_review_import import SourceReviewImportService


def get_db_session() -> Generator[Session, None, None]:
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()


def get_current_user(
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    session: Session = Depends(get_db_session),
) -> User:
    if x_user_id is None:
        raise AppError(
            code="AUTHENTICATION_REQUIRED",
            message="Authentication is required for this endpoint.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        user_id = UUID(x_user_id)
    except ValueError as exc:
        raise AppError(
            code="INVALID_AUTHENTICATED_USER",
            message="Authenticated user id is invalid.",
            status_code=status.HTTP_401_UNAUTHORIZED,
            details={"header": "X-User-Id"},
        ) from exc

    user = UserRepository(session).get_by_id(user_id)
    if user is None:
        raise AppError(
            code="AUTHENTICATED_USER_NOT_FOUND",
            message="Authenticated user not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return user


def get_review_service(
    session: Session = Depends(get_db_session),
) -> ReviewService:
    return ReviewService(
        review_repository=ReviewRepository(session),
        business_repository=BusinessRepository(session),
    )


def get_auth_service(
    session: Session = Depends(get_db_session),
) -> AuthService:
    return AuthService(business_repository=BusinessRepository(session))


def get_authorization_service(
    session: Session = Depends(get_db_session),
) -> AuthorizationService:
    return AuthorizationService(
        business_repository=BusinessRepository(session),
        review_repository=ReviewRepository(session),
        generated_content_repository=GeneratedContentRepository(session),
        agent_run_repository=AgentRunRepository(session),
    )


def get_review_ingestion_service(
    session: Session = Depends(get_db_session),
) -> ReviewIngestionService:
    review_service = ReviewService(
        review_repository=ReviewRepository(session),
        business_repository=BusinessRepository(session),
    )
    return ReviewIngestionService(
        review_service=review_service,
        agent_run_repository=AgentRunRepository(session),
    )


def get_source_review_import_service(
    session: Session = Depends(get_db_session),
) -> SourceReviewImportService:
    review_service = ReviewService(
        review_repository=ReviewRepository(session),
        business_repository=BusinessRepository(session),
    )
    return SourceReviewImportService(
        review_service=review_service,
        google_provider=get_google_review_provider(),
        facebook_provider=get_facebook_review_provider(),
    )


def get_review_summary_service(
    session: Session = Depends(get_db_session),
) -> ReviewSummaryService:
    return ReviewSummaryService(
        review_repository=ReviewRepository(session),
        business_repository=BusinessRepository(session),
        sentiment_result_repository=SentimentResultRepository(session),
        intelligence_provider=get_review_intelligence_provider(),
        agent_run_repository=AgentRunRepository(session),
    )


def get_sentiment_analysis_service(
    session: Session = Depends(get_db_session),
) -> SentimentAnalysisService:
    return SentimentAnalysisService(
        provider=get_sentiment_provider(),
        review_repository=ReviewRepository(session),
        sentiment_result_repository=SentimentResultRepository(session),
        agent_run_repository=AgentRunRepository(session),
    )


def get_content_generation_service(
    session: Session = Depends(get_db_session),
) -> ContentGenerationService:
    return ContentGenerationService(
        provider=get_content_provider(),
        business_repository=BusinessRepository(session),
        review_repository=ReviewRepository(session),
        generated_content_repository=GeneratedContentRepository(session),
        agent_run_repository=AgentRunRepository(session),
    )


def get_settings_service(
    session: Session = Depends(get_db_session),
) -> SettingsService:
    return SettingsService(user_repository=UserRepository(session))


def get_orchestrator_agent(
    session: Session = Depends(get_db_session),
) -> OrchestratorAgent:
    review_service = ReviewService(
        review_repository=ReviewRepository(session),
        business_repository=BusinessRepository(session),
    )
    agent_run_repository = AgentRunRepository(session)
    return OrchestratorAgent(
        review_ingestion_service=ReviewIngestionService(
            review_service=review_service,
            agent_run_repository=agent_run_repository,
        ),
        sentiment_analysis_service=SentimentAnalysisService(
            provider=get_sentiment_provider(),
            review_repository=ReviewRepository(session),
            sentiment_result_repository=SentimentResultRepository(session),
            agent_run_repository=agent_run_repository,
        ),
        content_generation_service=ContentGenerationService(
            provider=get_content_provider(),
            business_repository=BusinessRepository(session),
            review_repository=ReviewRepository(session),
            generated_content_repository=GeneratedContentRepository(session),
            agent_run_repository=agent_run_repository,
        ),
        review_summary_service=ReviewSummaryService(
            review_repository=ReviewRepository(session),
            business_repository=BusinessRepository(session),
            sentiment_result_repository=SentimentResultRepository(session),
            intelligence_provider=get_review_intelligence_provider(),
            agent_run_repository=agent_run_repository,
        ),
        agent_run_repository=agent_run_repository,
    )
