from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.dependencies import get_current_user, get_current_admin
from app.schemas import BaseResponse, Task as TaskSchema
from app.models.task import Task

router = APIRouter(prefix="/task", tags=["任务"])

@router.get("/all", response_model=BaseResponse)
async def get_all_tasks(
    skip: int = 0,
    limit: int = 100,
    is_open: bool = None,
    db: Session = Depends(get_db)
):
    """获取所有任务列表"""
    query = db.query(Task)
    
    if is_open is not None:
        query = query.filter(Task.is_open == is_open)
    
    tasks = query.offset(skip).limit(limit).all()
    
    return {
        "success": True,
        "data": tasks
    }

@router.get("/{tID}", response_model=BaseResponse)
async def get_task(
    tID: int,
    db: Session = Depends(get_db)
):
    """获取任务详情"""
    task = db.query(Task).filter(Task.tID == tID).first()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="任务不存在"
        )
    
    return {
        "success": True,
        "data": task
    }
