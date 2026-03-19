from uuid import UUID

from fastapi import APIRouter, Depends

from ...agents.orchestrator import OrchestratorAgent
from ...core.responses import success_response
from ...models.user import User
from ...schemas.agent import AgentRouteRequest, AgentRunRequest
from ...schemas.common import SuccessResponse
from ...services.authorization import AuthorizationService
from ..dependencies import (
    get_authorization_service,
    get_current_user,
    get_orchestrator_agent,
)

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/route", response_model=SuccessResponse)
async def route_agent_task(
    payload: AgentRouteRequest,
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    orchestrator: OrchestratorAgent = Depends(get_orchestrator_agent),
):
    route_result = orchestrator.route(payload)
    authorization.authorize_agent_task(current_user, payload.task, payload.payload)
    return success_response(route_result)


@router.post("/run", response_model=SuccessResponse)
async def run_agent_task(
    payload: AgentRunRequest,
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    orchestrator: OrchestratorAgent = Depends(get_orchestrator_agent),
):
    orchestrator.route(
        AgentRouteRequest(
            task=payload.task,
            payload=payload.payload,
        )
    )
    authorization.authorize_agent_task(current_user, payload.task, payload.payload)
    return success_response(orchestrator.run(payload.task, payload.payload))


@router.get("/runs/{run_id}", response_model=SuccessResponse)
async def get_agent_run(
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    authorization: AuthorizationService = Depends(get_authorization_service),
    orchestrator: OrchestratorAgent = Depends(get_orchestrator_agent),
):
    authorization.ensure_agent_run_access(current_user, run_id)
    return success_response(orchestrator.get_run(run_id))
