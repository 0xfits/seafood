# 导出所有 schemas
from app.schemas.common import BaseResponse, ErrorResponse, Pagination
from app.schemas.user import User, UserCreate, Asset, LoginResponse, TokenData
from app.schemas.task import Task, TaskCreate
from app.schemas.journey import Journey, JourneySubmitRequest, JourneySubmitResponse, JourneyVerifyRequest
from app.schemas.brand import Brand, Gift, GiftClaimRequest, Chest, ChestClaimRequest

__all__ = [
    # Common
    "BaseResponse",
    "ErrorResponse", 
    "Pagination",
    # User
    "User",
    "UserCreate",
    "Asset",
    "LoginResponse",
    "TokenData",
    # Task
    "Task",
    "TaskCreate",
    # Journey
    "Journey",
    "JourneySubmitRequest",
    "JourneySubmitResponse",
    "JourneyVerifyRequest",
    # Brand/Gift/Chest
    "Brand",
    "Gift",
    "GiftClaimRequest",
    "Chest",
    "ChestClaimRequest",
]
