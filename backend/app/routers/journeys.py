from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app.dependencies import get_current_user, get_current_admin
from app.schemas import (
    BaseResponse, 
    Journey as JourneySchema,
    JourneySubmitRequest,
    JourneySubmitResponse
)
from app.models.journey import Journey
from app.models.task import Task
from app.models.user import User
from app.models.asset import Asset

router = APIRouter(prefix="/journey", tags=["任务参与"])

@router.get("", response_model=BaseResponse)
async def get_user_journeys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取用户的任务参与列表"""
    journeys = db.query(Journey).filter(Journey.uID == current_user.uID).all()
    
    return {
        "success": True,
        "data": journeys
    }

@router.post("/{jID}/submit", response_model=BaseResponse)
async def submit_journey(
    jID: int,
    data: JourneySubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    提交任务完成信息
    
    - **jID**: 任务参与记录ID
    - **info_input**: 用户提交的完成信息
    """
    # 查找或创建 journey 记录
    journey = db.query(Journey).filter(
        Journey.jID == jID,
        Journey.uID == current_user.uID
    ).first()
    
    if not journey:
        # 如果没有找到，尝试用 jID 作为 tID 查找
        journey = db.query(Journey).filter(
            Journey.tID == jID,
            Journey.uID == current_user.uID
        ).first()
        
        if not journey:
            # 创建新的参与记录
            task = db.query(Task).filter(Task.tID == jID).first()
            if not task:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="任务不存在"
                )
            
            journey = Journey(
                tID=jID,
                uID=current_user.uID,
                time_created=datetime.utcnow()
            )
            db.add(journey)
            db.commit()
            db.refresh(journey)
    
    # 更新任务信息
    journey.info_input = data.info_input
    journey.time_submitted = datetime.utcnow()
    db.commit()
    db.refresh(journey)
    
    return {
        "success": True,
        "data": {"jID": journey.jID}
    }

@router.post("/{jID}/verify", response_model=BaseResponse)
async def verify_journey(
    jID: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    审核通过任务（管理员）
    
    - 发放积分给用户
    """
    journey = db.query(Journey).filter(Journey.jID == jID).first()
    if not journey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="记录不存在"
        )
    
    # 获取任务信息
    task = db.query(Task).filter(Task.tID == journey.tID).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="任务不存在"
        )
    
    # 更新审核状态
    journey.time_checked = datetime.utcnow()
    journey.points_claimed = task.points
    db.commit()
    
    # 发放积分给用户
    asset = db.query(Asset).filter(Asset.uID == journey.uID).first()
    if asset:
        asset.points += task.points
    else:
        # 创建资产记录
        asset = Asset(uID=journey.uID, points=task.points, lucks=0)
        db.add(asset)
    
    db.commit()
    
    return {
        "success": True,
        "data": {"points_added": task.points}
    }

@router.get("/pending-verification", response_model=BaseResponse)
async def get_pending_verification(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """获取待审核的任务列表（管理员）"""
    journeys = db.query(Journey).filter(
        Journey.time_submitted != None,
        Journey.time_checked == None
    ).all()
    
    return {
        "success": True,
        "data": journeys
    }
