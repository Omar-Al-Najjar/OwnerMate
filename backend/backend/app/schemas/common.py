from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

PayloadT = TypeVar("PayloadT")


class SuccessResponse(BaseModel, Generic[PayloadT]):
    success: bool = True
    data: PayloadT
    meta: dict[str, Any] | None = None


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Any | None = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail


class HealthPayload(BaseModel):
    status: str
    service: str = "backend"
    environment: str
    version: str


class ReadinessDependency(BaseModel):
    name: str
    status: str
    required: bool = True
    configured: bool = Field(default=False)
    details: Any | None = None


class ReadinessPayload(BaseModel):
    status: str
    service: str = "backend"
    environment: str
    version: str
    checks: list[ReadinessDependency]
