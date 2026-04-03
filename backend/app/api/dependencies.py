from collections.abc import Callable, Generator

from uuid import UUID

from fastapi import Depends, Form, Header, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from ..agents.orchestrator import OrchestratorAgent
from ..core.db import get_session_factory
from ..core.config import get_settings
from ..core.exceptions import AppError
from ..repositories.agent_run import AgentRunRepository
from ..repositories.business import BusinessRepository
from ..repositories.generated_content import GeneratedContentRepository
from ..repositories.review import ReviewRepository
from ..repositories.sales_record import SalesRecordRepository
from ..repositories.sentiment_result import SentimentResultRepository
from ..repositories.user import UserRepository
from ..models.user import User
from ..services.auth import AuthService
from ..services.authorization import AuthorizationService
from ..services.content import ContentGenerationService
from ..services.dashboard import DashboardService
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
from ..services.review_upload import ReviewUploadImportService
from ..services.sales import SalesService
from ..services.sentiment import SentimentAnalysisService
from ..services.settings import SettingsService
from ..services.source_review_import import SourceReviewImportService
from ..services.token_verifier import SupabaseTokenVerifier
from ..schemas.review import ReviewUploadImportRequest


def get_db_session() -> Generator[Session, None, None]:
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()


def get_token_verifier() -> SupabaseTokenVerifier:
    return SupabaseTokenVerifier(get_settings())


def get_token_verifier_factory() -> Callable[[], SupabaseTokenVerifier]:
    return get_token_verifier


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
    return AuthService(
        business_repository=BusinessRepository(session),
        user_repository=UserRepository(session),
    )


def get_current_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
    auth_service: AuthService = Depends(get_auth_service),
    token_verifier_factory: Callable[[], SupabaseTokenVerifier] = Depends(
        get_token_verifier_factory
    ),
) -> User:
    if authorization is None:
        raise AppError(
            code="AUTHENTICATION_REQUIRED",
            message="Authentication is required for this endpoint.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise AppError(
            code="AUTHENTICATION_FAILED",
            message="Authorization header must use the Bearer scheme.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    identity = token_verifier_factory().verify_access_token(token.strip())
    return auth_service.get_or_create_user_for_identity(identity)


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


def get_review_upload_import_service(
    session: Session = Depends(get_db_session),
) -> ReviewUploadImportService:
    review_service = ReviewService(
        review_repository=ReviewRepository(session),
        business_repository=BusinessRepository(session),
    )
    return ReviewUploadImportService(
        review_ingestion_service=ReviewIngestionService(
            review_service=review_service,
            agent_run_repository=AgentRunRepository(session),
        )
    )


def parse_review_upload_import_request(
    business_id: UUID = Form(...),
    source: str = Form(...),
    review_source_id: UUID | None = Form(default=None),
) -> ReviewUploadImportRequest:
    try:
        return ReviewUploadImportRequest.model_validate(
            {
                "business_id": business_id,
                "source": source,
                "review_source_id": review_source_id,
            }
        )
    except ValidationError as exc:
        raise AppError(
            code="VALIDATION_ERROR",
            message="Invalid request payload",
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            details=exc.errors(),
        ) from exc


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


def get_dashboard_service(
    session: Session = Depends(get_db_session),
) -> DashboardService:
    return DashboardService(
        review_repository=ReviewRepository(session),
        sales_record_repository=SalesRecordRepository(session),
        sentiment_result_repository=SentimentResultRepository(session),
    )


def get_sales_service(
    session: Session = Depends(get_db_session),
) -> SalesService:
    return SalesService(
        business_repository=BusinessRepository(session),
        sales_record_repository=SalesRecordRepository(session),
    )


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
