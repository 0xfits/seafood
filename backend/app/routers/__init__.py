# 导出所有 routers
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.journeys import router as journeys_router
from app.routers.tasks import router as tasks_router
from app.routers.brands import router as brands_router

__all__ = [
    "auth_router",
    "users_router", 
    "journeys_router",
    "tasks_router",
    "brands_router"
]
