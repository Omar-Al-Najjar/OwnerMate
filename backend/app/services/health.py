from pathlib import Path

from ..core.config import get_settings
from ..core.db import check_database_connection
from ..schemas.common import HealthPayload, ReadinessDependency, ReadinessPayload


class HealthService:
    @staticmethod
    def get_health_status() -> HealthPayload:
        settings = get_settings()
        return HealthPayload(
            status="ok",
            environment=settings.app_env,
            version=settings.app_version,
        )

    @staticmethod
    def get_readiness_status() -> ReadinessPayload:
        settings = get_settings()
        backend_root = Path(__file__).resolve().parents[2]
        db_reachable = False
        database_error: str | None = None
        if settings.database_url:
            db_reachable, database_error = check_database_connection()

        checks = [
            ReadinessDependency(
                name="database_url",
                status="configured" if settings.database_url else "not_configured",
                configured=bool(settings.database_url),
            ),
            ReadinessDependency(
                name="database_connection",
                status=(
                    "reachable"
                    if db_reachable
                    else "unreachable"
                    if settings.database_url
                    else "not_configured"
                ),
                configured=db_reachable,
                details={"error": database_error} if database_error else None,
            ),
            ReadinessDependency(
                name="auth_boundary",
                status="configured",
                configured=True,
                details={
                    "mode": "x_user_id_header",
                    "session_verification": "temporary_backend_header_boundary",
                },
            ),
            ReadinessDependency(
                name="supabase_url",
                status="configured" if settings.supabase_url else "not_configured",
                configured=bool(settings.supabase_url),
                required=False,
            ),
            ReadinessDependency(
                name="supabase_service_role_key",
                status=(
                    "configured"
                    if settings.supabase_service_role_key
                    else "not_configured"
                ),
                configured=bool(settings.supabase_service_role_key),
                required=False,
            ),
            ReadinessDependency(
                name="migration_config",
                status=(
                    "configured"
                    if (backend_root / "alembic.ini").exists()
                    and (backend_root / "migrations" / "env.py").exists()
                    else "missing"
                ),
                configured=(
                    (backend_root / "alembic.ini").exists()
                    and (backend_root / "migrations" / "env.py").exists()
                ),
            ),
        ]
        overall_status = (
            "ready" if all(check.configured for check in checks if check.required) else "not_ready"
        )
        return ReadinessPayload(
            status=overall_status,
            environment=settings.app_env,
            version=settings.app_version,
            checks=checks,
        )
