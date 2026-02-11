from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# 基础响应模型
class BaseResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    
    class Config:
        from_attributes = True

# 错误响应
class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    error: Optional[str] = None

# 分页信息
class Pagination(BaseModel):
    total: int
    skip: int
    limit: int
