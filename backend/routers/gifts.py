from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Annotated, List
from pydantic import BaseModel

# 从主模块导入依赖
from ..database import get_db
from ..models import Gift, GiftList, User
from ..main import get_current_user, get_current_admin

# 创建路由器
router = APIRouter(
    prefix="/api/gifts",
    tags=["Gifts"],
    responses={404: {"description": "Not found"}},
)

# 定义礼品响应模型
class GiftResponse(BaseModel):
    gift_id: int
    gift_name: str
    gift_description: str
    gift_points: int
    gift_image_url: str
    stock: int
    created_at: str
    updated_at: str
    claimed_count: int

    class Config:
        from_attributes = True

# 定义礼品领取记录响应模型
class GiftListResponse(BaseModel):
    glistID: int
    uID: int
    gift_id: int
    status: str
    claimed_at: str
    gift: GiftResponse

    class Config:
        from_attributes = True

# 获取所有礼品
@router.get("/all", response_model=List[GiftResponse])
async def get_all_gifts(
    db: Annotated[Session, Depends(get_db)],
    skip: int = 0,
    limit: int = 100
):
    """获取所有可用礼品列表"""
    gifts = db.query(Gift).offset(skip).limit(limit).all()
    
    # 计算每个礼品的领取次数
    result = []
    for gift in gifts:
        claimed_count = db.query(GiftList).filter(GiftList.gift_id == gift.gift_id).count()
        
        # 创建礼品响应对象
        gift_response = GiftResponse(
            gift_id=gift.gift_id,
            gift_name=gift.gift_name,
            gift_description=gift.gift_description,
            gift_points=gift.gift_points,
            gift_image_url=gift.gift_image_url,
            stock=gift.stock,
            created_at=gift.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            updated_at=gift.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            claimed_count=claimed_count
        )
        result.append(gift_response)
    
    return result

# 获取单个礼品详情
@router.get("/{gift_id}", response_model=GiftResponse)
async def get_gift_detail(
    gift_id: int,
    db: Annotated[Session, Depends(get_db)]
):
    """获取单个礼品的详细信息"""
    gift = db.query(Gift).filter(Gift.gift_id == gift_id).first()
    
    if not gift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift not found"
        )
    
    # 计算领取次数
    claimed_count = db.query(GiftList).filter(GiftList.gift_id == gift.gift_id).count()
    
    return GiftResponse(
        gift_id=gift.gift_id,
        gift_name=gift.gift_name,
        gift_description=gift.gift_description,
        gift_points=gift.gift_points,
        gift_image_url=gift.gift_image_url,
        stock=gift.stock,
        created_at=gift.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        updated_at=gift.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
        claimed_count=claimed_count
    )

# 领取礼品
@router.post("/claim/{gift_id}")
async def claim_gift(
    gift_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)]
):
    """用户领取礼品"""
    # 检查礼品是否存在
    gift = db.query(Gift).filter(Gift.gift_id == gift_id).first()
    
    if not gift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift not found"
        )
    
    # 检查礼品库存
    if gift.stock <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gift is out of stock"
        )
    
    # 检查用户是否已领取过此礼品
    existing_gift_list = db.query(GiftList).filter(
        GiftList.uID == int(current_user["uID"]),
        GiftList.gift_id == gift_id
    ).first()
    
    if existing_gift_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already claimed this gift"
        )
    
    # 检查用户积分是否足够
    # 这里应该有实际的积分检查逻辑
    user_points = 1000  # 示例积分
    
    if user_points < gift.gift_points:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not enough points to claim this gift"
        )
    
    # 创建礼品领取记录
    new_gift_list = GiftList(
        uID=int(current_user["uID"]),
        gift_id=gift_id,
        status="claimed",
        claimed_at=datetime.utcnow()
    )
    
    # 减少礼品库存
    gift.stock -= 1
    gift.updated_at = datetime.utcnow()
    
    # 扣除用户积分
    # 这里应该有实际的积分扣除逻辑
    
    db.add(new_gift_list)
    db.commit()
    db.refresh(new_gift_list)
    
    return {
        "success": True,
        "message": "Gift claimed successfully",
        "glistID": new_gift_list.glistID,
        "gift_name": gift.gift_name
    }

# 获取用户的礼品领取记录
@router.get("/user", response_model=List[GiftListResponse])
async def get_user_gifts(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    status: str = None
):
    """获取当前用户的所有礼品领取记录"""
    query = db.query(GiftList).filter(GiftList.uID == int(current_user["uID"]))
    
    # 如果指定了状态，过滤记录
    if status:
        query = query.filter(GiftList.status == status)
    
    gift_lists = query.all()
    
    result = []
    for gift_list in gift_lists:
        # 获取礼品详情
        gift = db.query(Gift).filter(Gift.gift_id == gift_list.gift_id).first()
        if not gift:
            continue
        
        # 计算领取次数
        claimed_count = db.query(GiftList).filter(GiftList.gift_id == gift.gift_id).count()
        
        # 创建礼品响应对象
        gift_response = GiftResponse(
            gift_id=gift.gift_id,
            gift_name=gift.gift_name,
            gift_description=gift.gift_description,
            gift_points=gift.gift_points,
            gift_image_url=gift.gift_image_url,
            stock=gift.stock,
            created_at=gift.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            updated_at=gift.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            claimed_count=claimed_count
        )
        
        # 创建礼品领取记录响应对象
        gift_list_response = GiftListResponse(
            glistID=gift_list.glistID,
            uID=gift_list.uID,
            gift_id=gift_list.gift_id,
            status=gift_list.status,
            claimed_at=gift_list.claimed_at.strftime("%Y-%m-%d %H:%M:%S"),
            gift=gift_response
        )
        
        result.append(gift_list_response)
    
    return result

# 管理员更新礼品信息
@router.put("/{gift_id}")
async def update_gift(
    gift_id: int,
    gift_name: str = None,
    gift_description: str = None,
    gift_points: int = None,
    gift_image_url: str = None,
    stock: int = None,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[dict, Depends(get_current_admin)]
):
    """管理员更新礼品信息"""
    # 检查礼品是否存在
    gift = db.query(Gift).filter(Gift.gift_id == gift_id).first()
    
    if not gift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift not found"
        )
    
    # 更新礼品信息
    if gift_name is not None:
        gift.gift_name = gift_name
    if gift_description is not None:
        gift.gift_description = gift_description
    if gift_points is not None:
        gift.gift_points = gift_points
    if gift_image_url is not None:
        gift.gift_image_url = gift_image_url
    if stock is not None:
        gift.stock = stock
    
    gift.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(gift)
    
    return {
        "success": True,
        "message": "Gift updated successfully",
        "gift_id": gift.gift_id
    }

# 管理员添加新礼品
@router.post("/")
async def add_gift(
    gift_name: str,
    gift_description: str,
    gift_points: int,
    gift_image_url: str,
    stock: int,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[dict, Depends(get_current_admin)]
):
    """管理员添加新礼品"""
    # 创建新礼品
    new_gift = Gift(
        gift_name=gift_name,
        gift_description=gift_description,
        gift_points=gift_points,
        gift_image_url=gift_image_url,
        stock=stock,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(new_gift)
    db.commit()
    db.refresh(new_gift)
    
    return {
        "success": True,
        "message": "Gift added successfully",
        "gift_id": new_gift.gift_id
    }

# 管理员删除礼品
@router.delete("/{gift_id}")
async def delete_gift(
    gift_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[dict, Depends(get_current_admin)]
):
    """管理员删除礼品"""
    # 检查礼品是否存在
    gift = db.query(Gift).filter(Gift.gift_id == gift_id).first()
    
    if not gift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift not found"
        )
    
    # 删除礼品
    db.delete(gift)
    db.commit()
    
    return {
        "success": True,
        "message": "Gift deleted successfully"
    }

# 获取礼品领取统计
@router.get("/stats", tags=["Admin"])
async def get_gift_stats(
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[dict, Depends(get_current_admin)]
):
    """获取礼品领取统计信息（管理员专用）"""
    # 获取所有礼品
    gifts = db.query(Gift).all()
    
    # 计算每个礼品的领取次数
    stats = []
    for gift in gifts:
        claimed_count = db.query(GiftList).filter(GiftList.gift_id == gift.gift_id).count()
        remaining_stock = gift.stock
        
        stats.append({
            "gift_id": gift.gift_id,
            "gift_name": gift.gift_name,
            "claimed_count": claimed_count,
            "remaining_stock": remaining_stock,
            "total_available": gift.stock + claimed_count
        })
    
    return {
        "success": True,
        "stats": stats
    }