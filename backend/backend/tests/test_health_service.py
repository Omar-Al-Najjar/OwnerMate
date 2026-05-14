from __future__ import annotations

import unittest
from unittest.mock import patch

from backend.app.schemas.common import ReadinessPayload
from backend.app.services.health import HealthService


class HealthServiceTests(unittest.TestCase):
    def test_readiness_reports_not_ready_without_required_backend_config(self) -> None:
        with patch("backend.app.services.health.get_settings") as mock_settings:
            mock_settings.return_value.app_env = "development"
            mock_settings.return_value.app_version = "0.1.0"
            mock_settings.return_value.database_url = None
            mock_settings.return_value.supabase_url = None
            mock_settings.return_value.supabase_service_role_key = None

            readiness = HealthService.get_readiness_status()

        self.assertIsInstance(readiness, ReadinessPayload)
        self.assertEqual(readiness.status, "not_ready")
        self.assertEqual(readiness.environment, "development")
        self.assertTrue(any(check.name == "database_url" for check in readiness.checks))

    def test_readiness_reports_database_reachability(self) -> None:
        with patch("backend.app.services.health.get_settings") as mock_settings:
            with patch("backend.app.services.health.check_database_connection") as mock_check:
                mock_settings.return_value.app_env = "production"
                mock_settings.return_value.app_version = "0.1.0"
                mock_settings.return_value.database_url = "postgresql://db"
                mock_settings.return_value.supabase_url = "https://example.supabase.co"
                mock_settings.return_value.supabase_service_role_key = "secret"
                mock_check.return_value = (True, None)

                readiness = HealthService.get_readiness_status()

        self.assertEqual(readiness.status, "ready")
        database_connection = next(
            check for check in readiness.checks if check.name == "database_connection"
        )
        self.assertEqual(database_connection.status, "reachable")
        self.assertTrue(database_connection.configured)

    def test_readiness_sanitizes_database_error_details(self) -> None:
        with patch("backend.app.services.health.get_settings") as mock_settings:
            with patch("backend.app.services.health.check_database_connection") as mock_check:
                mock_settings.return_value.app_env = "production"
                mock_settings.return_value.app_version = "0.1.0"
                mock_settings.return_value.database_url = "postgresql://user:secret@db/internal"
                mock_settings.return_value.supabase_url = None
                mock_settings.return_value.supabase_service_role_key = None
                mock_check.return_value = (False, "password authentication failed for user")

                readiness = HealthService.get_readiness_status()

        database_connection = next(
            check for check in readiness.checks if check.name == "database_connection"
        )
        self.assertEqual(database_connection.status, "unreachable")
        self.assertEqual(
            database_connection.details,
            {"error": "Database connection check failed."},
        )


if __name__ == "__main__":
    unittest.main()
