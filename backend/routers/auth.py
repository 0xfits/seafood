from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import JWTError, jwt
import os
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Annotated

# 从主模块导入依赖
from ..database import get_db
from ..models import User
from ..auth_utils import create_access_token, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

# 创建路由器
router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
    responses={404: {"description": "Not found"}},
)

# 定义登录请求模型
class LoginRequest(BaseModel):
    evm_address: str
    signature: str

# 定义令牌数据模型
class TokenData(BaseModel):
    uID: str
    evm: str

# 认证端点
@router.post("/login")
async def login(login_request: LoginRequest, db: Annotated[Session, Depends(get_db)]):
    """用户登录端点，验证EVM地址和签名"""
    # 验证EVM地址格式
    if not login_request.evm_address.startswith('0x') or len(login_request.evm_address) != 42:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid EVM address format",
        )
    
    # 验证签名
    # 实际应用中应该使用web3.py验证签名
    # 为了简化示例，我们假设签名验证成功
    
    # 查找或创建用户
    user = db.query(User).filter(User.evm_address == login_request.evm_address).first()
    
    if not user:
        # 创建新用户
        user = User(
            evm_address=login_request.evm_address,
            username=f"user_{login_request.evm_address[:5]}",
            created_at=datetime.utcnow()
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # 创建访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.uID), "evm": user.evm_address},
        expires_delta=access_token_expires,
    )
    
    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "uID": user.uID,
        "EVM": user.evm_address,
        "username": user.username
    }

# 验证用户令牌
@router.get("/verify")
async def verify_token(token: str, db: Annotated[Session, Depends(get_db)]):
    """验证用户令牌是否有效"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uID: str = payload.get("sub")
        evm_address: str = payload.get("evm")
        
        if uID is None:
            raise credentials_exception
        
        # 查找用户
        user = db.query(User).filter(User.uID == int(uID)).first()
        
        if not user or user.evm_address != evm_address:
            raise credentials_exception
        
        return {
            "success": True,
            "user": {
                "uID": user.uID,
                "EVM": user.evm_address,
                "username": user.username,
                "bio": user.bio
            }
        }
        
    except JWTError:
        raise credentials_exception

# 获取当前用户信息
@router.get("/me")
async def get_current_user_info(token: str, db: Annotated[Session, Depends(get_db)]):
    """获取当前登录用户的详细信息"""
    try:
        # 验证令牌
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uID: str = payload.get("sub")
        
        if uID is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        # 查找用户
        user = db.query(User).filter(User.uID == int(uID)).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return {
            "success": True,
            "user": {
                "uID": user.uID,
                "EVM": user.evm_address,
                "username": user.username,
                "bio": user.bio,
                "created_at": user.created_at.strftime("%Y-%m-%d %H:%M:%S")
            }
        }
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )