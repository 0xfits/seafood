from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# 用户基础信息
class UserBase(BaseModel):
    EVM: str
    bio: Optional[str] = None
    is_admin: bool = False

# 创建用户（内部使用）
class UserCreate(UserBase):
    pass

# 用户响应
class User(UserBase):
    uID: int
    time_reg: datetime
    time_login_last: datetime
    
    class Config:
        from_attributes = True

# 用户资产
class Asset(BaseModel):
    aID: int
    uID: int
    points: int = 0
    lucks: int = 0
    time_updated: datetime
    
    class Config:
        from_attributes = True

# 用户登录响应
class LoginResponse(BaseModel):
    uID: int
    EVM: str
    access_token: str
    token_type: str = "bearer"

# Token 数据
class TokenData(BaseModel):
    uID: Optional[int] = None
    evm: Optional[str] = None
