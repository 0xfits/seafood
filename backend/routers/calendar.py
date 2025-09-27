from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Annotated, List
from pydantic import BaseModel

# 从主模块导入依赖
from ..database import get_db
from ..models import CalendarEvent
from ..auth_utils import get_current_user, get_current_admin

# 创建路由器
router = APIRouter(
    prefix="/api/calendar",
    tags=["Calendar"],
    responses={404: {"description": "Not found"}},
)

# 定义日历事件响应模型
class CalendarEventResponse(BaseModel):
    event_id: int
    title: str
    description: str
    start_time: str
    end_time: str
    location: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True

# 定义创建日历事件请求模型
class CreateEventRequest(BaseModel):
    title: str
    description: str
    start_time: str
    end_time: str
    location: str

# 获取所有日历事件
@router.get("/events", response_model=List[CalendarEventResponse])
async def get_all_events(
    db: Annotated[Session, Depends(get_db)],
    start_date: str = None,
    end_date: str = None,
    skip: int = 0,
    limit: int = 100
):
    """获取所有日历事件列表"""
    query = db.query(CalendarEvent)
    
    # 如果指定了开始日期，过滤事件
    if start_date:
        try:
            start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(CalendarEvent.start_time >= start_datetime)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid start_date format, should be YYYY-MM-DD"
            )
    
    # 如果指定了结束日期，过滤事件
    if end_date:
        try:
            end_datetime = datetime.strptime(end_date, "%Y-%m-%d")
            # 添加一天，确保包含结束日期当天的事件
            end_datetime = end_datetime.replace(hour=23, minute=59, second=59)
            query = query.filter(CalendarEvent.end_time <= end_datetime)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid end_date format, should be YYYY-MM-DD"
            )
    
    # 按开始时间排序
    query = query.order_by(CalendarEvent.start_time)
    
    events = query.offset(skip).limit(limit).all()
    
    return events

# 获取单个日历事件详情
@router.get("/events/{event_id}", response_model=CalendarEventResponse)
async def get_event_detail(
    event_id: int,
    db: Annotated[Session, Depends(get_db)]
):
    """获取单个日历事件的详细信息"""
    event = db.query(CalendarEvent).filter(CalendarEvent.event_id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    return event

# 管理员添加日历事件
@router.post("/events", response_model=CalendarEventResponse)
async def create_event(
    event_data: CreateEventRequest,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[dict, Depends(get_current_admin)]
):
    """管理员添加新的日历事件"""
    # 验证时间格式
    try:
        # 尝试解析开始时间和结束时间
        start_time = datetime.fromisoformat(event_data.start_time)
        end_time = datetime.fromisoformat(event_data.end_time)
        
        # 验证开始时间是否早于结束时间
        if start_time >= end_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Start time must be before end time"
            )
        
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid time format, should be ISO format (YYYY-MM-DDTHH:MM:SS)"
        )
    
    # 创建新的日历事件
    new_event = CalendarEvent(
        title=event_data.title,
        description=event_data.description,
        start_time=event_data.start_time,
        end_time=event_data.end_time,
        location=event_data.location,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    
    return new_event

# 管理员更新日历事件
@router.put("/events/{event_id}", response_model=CalendarEventResponse)
async def update_event(
    event_id: int,
    event_data: CreateEventRequest,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[dict, Depends(get_current_admin)]
):
    """管理员更新日历事件"""
    # 检查事件是否存在
    event = db.query(CalendarEvent).filter(CalendarEvent.event_id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # 验证时间格式
    try:
        # 尝试解析开始时间和结束时间
        start_time = datetime.fromisoformat(event_data.start_time)
        end_time = datetime.fromisoformat(event_data.end_time)
        
        # 验证开始时间是否早于结束时间
        if start_time >= end_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Start time must be before end time"
            )
        
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid time format, should be ISO format (YYYY-MM-DDTHH:MM:SS)"
        )
    
    # 更新事件信息
    event.title = event_data.title
    event.description = event_data.description
    event.start_time = event_data.start_time
    event.end_time = event_data.end_time
    event.location = event_data.location
    event.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(event)
    
    return event

# 管理员删除日历事件
@router.delete("/events/{event_id}")
async def delete_event(
    event_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[dict, Depends(get_current_admin)]
):
    """管理员删除日历事件"""
    # 检查事件是否存在
    event = db.query(CalendarEvent).filter(CalendarEvent.event_id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # 删除事件
    db.delete(event)
    db.commit()
    
    return {
        "success": True,
        "message": "Event deleted successfully"
    }

# 获取近期事件
@router.get("/events/upcoming", response_model=List[CalendarEventResponse])
async def get_upcoming_events(
    db: Annotated[Session, Depends(get_db)],
    days: int = 7,
    limit: int = 10
):
    """获取近期的日历事件"""
    # 计算截止日期
    today = datetime.utcnow().date()
    end_date = today.replace(hour=23, minute=59, second=59) + timedelta(days=days)
    
    # 查询近期事件
    events = db.query(CalendarEvent)
    events = events.filter(CalendarEvent.start_time >= datetime.utcnow())
    events = events.filter(CalendarEvent.start_time <= end_date)
    events = events.order_by(CalendarEvent.start_time)
    events = events.limit(limit)
    events = events.all()
    
    return events