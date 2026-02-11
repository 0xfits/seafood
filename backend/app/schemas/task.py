from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# 任务基础信息
class TaskBase(BaseModel):
    title: str
    note: Optional[str] = None
    refcode: Optional[str] = None
    link0: Optional[str] = None
    linkB: Optional[str] = None
    points: int = 0
    type: int = 0
    is_open: bool = False

# 创建任务（管理员）
class TaskCreate(TaskBase):
    time_start: Optional[datetime] = None
    time_end: Optional[datetime] = None

# 任务响应
class Task(TaskBase):
    tID: int
    time_created: datetime
    time_updated: Optional[datetime] = None
    title_en: Optional[str] = None
    title_hk: Optional[str] = None
    title_vn: Optional[str] = None
    note_en: Optional[str] = None
    note_hk: Optional[str] = None
    note_vn: Optional[str] = None
    
    class Config:
        from_attributes = True
