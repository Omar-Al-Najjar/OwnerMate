from __future__ import annotations

from datetime import date, datetime, timezone
import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.api.dependencies import (
    get_authorization_service,
    get_current_user,
    get_sales_service,
)
from backend.app.core.exceptions import AppError
from backend.app.main import app
from backend.app.models.user import User
from backend.app.schemas.sales import SalesRecordRead


class FakeSalesService:
    def __init__(self) -> None:
        self.business_id = uuid4()
        self.last_payload = None
        now = datetime.now(timezone.utc)
        self.record = SalesRecordRead(
            id=uuid4(),
            business_id=self.business_id,
            record_date=date(2026, 4, 3),
            revenue=3200,
            orders=145,
            refund_count=3,
            refund_value=90,
            channel_revenue={
                "walk_in": 900,
                "delivery_app": 1400,
                "instagram_dm": 300,
                "whatsapp": 600,
            },
            products=[],
            created_at=now,
            updated_at=now,
        )

    def list_records(self, business_id):
        if business_id != self.business_id:
            raise AssertionError("Unexpected business id.")
        return [self.record]

    def create_or_update_record(self, payload):
        self.last_payload = payload
        return self.record.model_copy(
            update={
                "business_id": payload.business_id,
                "record_date": payload.record_date,
                "revenue": payload.revenue,
                "orders": payload.orders,
                "refund_count": payload.refund_count,
                "refund_value": payload.refund_value,
                "channel_revenue": payload.channel_revenue,
                "products": payload.products,
            }
        )


class FakeAuthorizationService:
    def ensure_business_access(self, user, business_id):
        del user, business_id
        return None


class RejectingAuthorizationService:
    def ensure_business_access(self, user, business_id):
        del user, business_id
        raise AppError(
            code="FORBIDDEN",
            message="You do not have access to this business.",
            status_code=403,
        )


class SalesRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.user = User(id=uuid4(), email="owner@example.com", role="owner")
        self.fake_service = FakeSalesService()
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_sales_service] = lambda: self.fake_service
        app.dependency_overrides[get_authorization_service] = (
            lambda: FakeAuthorizationService()
        )
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_list_sales_records_returns_success_envelope(self) -> None:
        response = self.client.get(f"/sales/{self.fake_service.business_id}")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"][0]["revenue"], 3200)

    def test_create_sales_record_returns_success_envelope(self) -> None:
        response = self.client.post(
            "/sales/records",
            json={
                "business_id": str(self.fake_service.business_id),
                "record_date": "2026-04-03",
                "revenue": 4100,
                "orders": 160,
                "refund_count": 2,
                "refund_value": 40,
                "channel_revenue": {
                    "walk_in": 1000,
                    "delivery_app": 1800,
                    "instagram_dm": 400,
                    "whatsapp": 900,
                },
                "products": [],
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["orders"], 160)
        self.assertEqual(self.fake_service.last_payload.revenue, 4100)

    def test_sales_routes_reject_forbidden_business_scope(self) -> None:
        app.dependency_overrides[get_authorization_service] = (
            lambda: RejectingAuthorizationService()
        )

        response = self.client.get(f"/sales/{self.fake_service.business_id}")

        self.assertEqual(response.status_code, 403)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"]["code"], "FORBIDDEN")


if __name__ == "__main__":
    unittest.main()
