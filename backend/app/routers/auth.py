from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import jwt

from app.database import get_db
from app.config import settings
from app.schemas import BaseResponse, LoginResponse
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["认证"])

def create_access_token(data: dict, expires_delta: timedelta = None):
    """创建 JWT Token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

@router.post("/login", response_model=BaseResponse)
async def login(
    evm_address: str,
    signature: str,
    db: Session = Depends(get_db)
):
    """
    EVM钱包登录
    
    - **evm_address**: EVM 钱包地址
    - **signature**: 签名消息
    """
    # 查找或创建用户
    user = db.query(User).filter(User.EVM == evm_address.lower()).first()
    
    if not user:
        # 创建新用户
        user = User(
            EVM=evm_address.lower(),
            is_admin=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # 更新最后登录时间
    user.time_login_last = datetime.utcnow()
    db.commit()
    
    # 创建 JWT Token
    access_token = create_access_token(
        data={"sub": str(user.uID), "evm": user.EVM}
    )
    
    return {
        "success": True,
        "data": {
            "uID": user.uID,
            "EVM": user.EVM,
            "access_token": access_token,
            "token_type": "bearer"
        }
    }
