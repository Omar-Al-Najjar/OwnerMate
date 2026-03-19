from fastapi import APIRouter

from .routes.auth import router as auth_router
from .routes.content import router as content_router
from .routes.agents import router as agent_router
from .routes.health import router as health_router
from .routes.reviews import router as review_router
from .routes.settings import router as settings_router
from .routes.sentiment import router as sentiment_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(auth_router)
api_router.include_router(agent_router)
api_router.include_router(content_router)
api_router.include_router(review_router)
api_router.include_router(settings_router)
api_router.include_router(sentiment_router)
