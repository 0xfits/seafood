from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# 任务参与记录
class Journey(BaseModel):
    jID: int
    tID: int
    uID: int
    info_input: Optional[str] = None
    info_lang: Optional[str] = None
    time_created: datetime
    time_submitted: Optional[datetime] = None
    time_checked: Optional[datetime] = None
    time_claimed: Optional[datetime] = None
    points_claimed: int = 0
    
    class Config:
        from_attributes = True

# 提交任务请求
class JourneySubmitRequest(BaseModel):
    info_input: str

# 提交任务响应
class JourneySubmitResponse(BaseModel):
    jID: int

# 审核请求（管理员）
class JourneyVerifyRequest(BaseModel):
    approved: bool = True
    reject_reason: Optional[str] = None
