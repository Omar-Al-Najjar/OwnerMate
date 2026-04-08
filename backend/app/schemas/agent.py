from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AgentTaskResult(BaseModel):
    task_type: str
    status: Literal["success", "failed", "not_implemented"]
    data: dict[str, Any]
    meta: dict[str, Any]


SupportedAgentTask = Literal[
    "import_reviews",
    "analyze_review",
    "analyze_review_batch",
    "generate_reply",
    "generate_marketing_copy",
    "get_review_summary",
]


class AgentRouteRequest(BaseModel):
    task: str
    payload: dict[str, Any] = Field(default_factory=dict)

    @field_validator("task")
    @classmethod
    def normalize_task(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Task must not be empty.")
        return normalized


class AgentRunRequest(BaseModel):
    task: str
    payload: dict[str, Any] = Field(default_factory=dict)

    @field_validator("task")
    @classmethod
    def normalize_task(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Task must not be empty.")
        return normalized


class AgentRouteResult(BaseModel):
    task_type: str
    status: Literal["supported"]
    agent_name: str
    service_name: str


class AgentRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    agent_name: str
    task_type: str
    status: str
    input_reference: dict[str, Any] | None
    output_reference: dict[str, Any] | None
    error_message: str | None
    started_at: datetime
    finished_at: datetime | None
    created_at: datetime
