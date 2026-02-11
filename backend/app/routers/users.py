from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.dependencies import get_current_user, get_current_admin
from app.schemas import BaseResponse, User as UserSchema, Asset as AssetSchema
from app.models.user import User

router = APIRouter(prefix="/user", tags=["用户"])

@router.get("", response_model=BaseResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取当前用户信息"""
    return {
        "success": True,
        "data": current_user
    }

@router.get("/asset", response_model=BaseResponse)
async def get_user_asset(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取用户资产"""
    if not current_user.asset:
        # 创建默认资产
        from app.models.asset import Asset
        asset = Asset(uID=current_user.uID, points=0, lucks=0)
        db.add(asset)
        db.commit()
        db.refresh(asset)
        current_user.asset = asset
    
    return {
        "success": True,
        "data": current_user.asset
    }

@router.get("/all", response_model=BaseResponse)
async def get_all_users(
    skip: int = 0,
    limit: int = 100,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """获取所有用户列表（管理员）"""
    users = db.query(User).offset(skip).limit(limit).all()
    total = db.query(User).count()
    
    return {
        "success": True,
        "data": users,
        "pagination": {
            "total": total,
            "skip": skip,
            "limit": limit
        }
    }
