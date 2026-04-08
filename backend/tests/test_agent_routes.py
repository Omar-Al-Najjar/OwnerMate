from __future__ import annotations

from datetime import datetime, timezone
import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.api.dependencies import (
    get_authorization_service,
    get_current_user,
    get_orchestrator_agent,
)
from backend.app.core.exceptions import AppError
from backend.app.main import app
from backend.app.models.user import User


class FakeOrchestratorAgent:
    def __init__(self) -> None:
        self.last_route_request = None
        self.last_run = None
        self.last_run_id = None

    def route(self, request):
        self.last_route_request = request
        return {
            "task_type": request.task,
            "status": "supported",
            "agent_name": "content_generation",
            "service_name": "ContentGenerationService",
        }

    def run(self, task, payload):
        self.last_run = {"task": task, "payload": payload}
        return {
            "task_type": task,
            "status": "success",
            "data": {"ok": True},
            "meta": {"agent": "content_generation", "agent_run_id": str(uuid4())},
        }

    def get_run(self, run_id):
        self.last_run_id = run_id
        now = datetime.now(timezone.utc)
        return {
            "id": run_id,
            "business_id": uuid4(),
            "agent_name": "review_ingestion",
            "task_type": "import_reviews",
            "status": "success",
            "input_reference": {"review_count": 2},
            "output_reference": {"imported_count": 1},
            "error_message": None,
            "started_at": now,
            "finished_at": now,
            "created_at": now,
        }


class FakeAuthorizationService:
    def authorize_agent_task(self, user, task, payload) -> None:
        return None

    def ensure_agent_run_access(self, user, run_id) -> None:
        return None


class AgentRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fake_orchestrator = FakeOrchestratorAgent()
        self.user = User(id=uuid4(), email="owner@example.com", role="owner")
        app.dependency_overrides[get_orchestrator_agent] = lambda: self.fake_orchestrator
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_authorization_service] = (
            lambda: FakeAuthorizationService()
        )
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_route_agent_task_returns_success_envelope(self) -> None:
        response = self.client.post(
            "/agents/route",
            json={
                "task": "generate_reply",
                "payload": {
                    "business_id": str(uuid4()),
                    "review_id": str(uuid4()),
                    "language": "en",
                },
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["task_type"], "generate_reply")

    def test_run_agent_task_returns_typed_result(self) -> None:
        response = self.client.post(
            "/agents/run",
            json={
                "task": "generate_marketing_copy",
                "payload": {
                    "business_id": str(uuid4()),
                    "language": "en",
                },
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["status"], "success")
        self.assertEqual(body["data"]["meta"]["agent"], "content_generation")

    def test_get_agent_run_returns_success_envelope(self) -> None:
        run_id = str(uuid4())

        response = self.client.get(f"/agents/runs/{run_id}")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["id"], run_id)

    def test_unsupported_task_returns_structured_error(self) -> None:
        class UnsupportedTaskOrchestrator(FakeOrchestratorAgent):
            def run(self, task, payload):
                raise AppError(
                    code="UNSUPPORTED_TASK",
                    message="Task type is not supported.",
                    status_code=400,
                    details={"task": task},
                )

        app.dependency_overrides[get_orchestrator_agent] = UnsupportedTaskOrchestrator

        response = self.client.post(
            "/agents/run",
            json={"task": "forecast_reviews", "payload": {}},
        )

        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"]["code"], "UNSUPPORTED_TASK")


if __name__ == "__main__":
    unittest.main()
