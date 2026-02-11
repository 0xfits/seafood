from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.dependencies import get_current_user, get_current_admin
from app.schemas import BaseResponse, Brand as BrandSchema, Gift as GiftSchema, GiftClaimRequest
from app.models.brand import Brand
from app.models.gift import Gift
from app.models.asset import Asset

router = APIRouter(tags=["品牌/礼品"])

# 品牌相关
@router.get("/brand/all", response_model=BaseResponse)
async def get_all_brands(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """获取所有品牌列表"""
    brands = db.query(Brand).offset(skip).limit(limit).all()
    
    return {
        "success": True,
        "data": brands
    }

@router.get("/brand/{bID}", response_model=BaseResponse)
async def get_brand(
    bID: int,
    db: Session = Depends(get_db)
):
    """获取品牌详情"""
    brand = db.query(Brand).filter(Brand.bID == bID).first()
    
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="品牌不存在"
        )
    
    return {
        "success": True,
        "data": brand
    }

# 礼品相关
@router.get("/gift/all", response_model=BaseResponse)
async def get_all_gifts(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """获取所有礼品列表"""
    gifts = db.query(Gift).offset(skip).limit(limit).all()
    
    return {
        "success": True,
        "data": gifts
    }

@router.post("/gift/claim", response_model=BaseResponse)
async def claim_gift(
    data: GiftClaimRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """领取礼品"""
    gift = db.query(Gift).filter(
        Gift.gID == data.gID,
        Gift.uID == None
    ).first()
    
    if not gift:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="礼品不存在或已被领取"
        )
    
    # 更新礼品归属
    gift.uID = current_user.uID
    from datetime import datetime
    gift.time_claimed = datetime.utcnow()
    db.commit()
    
    return {
        "success": True,
        "message": "领取成功"
    }
