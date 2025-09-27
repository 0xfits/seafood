from datetime import datetime, timedelta
from typing import Optional
import os
from dotenv import load_dotenv
from jose.exceptions import JWTError
from jose import jwt
from fastapi import HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from typing import Annotated

# 加载环境变量
load_dotenv()

# 认证配置
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# OAuth2配置
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# 创建访问令牌
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# 依赖：验证令牌
def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]):
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
        # 创建TokenData对象
        token_data = {
            "uID": uID,
            "evm": evm_address
        }
    except JWTError:
        raise credentials_exception
    # 这里应该从数据库获取用户信息
    # 为了简化示例，我们直接返回令牌数据
    return token_data

# 验证管理员身份
def get_current_admin(current_user: Annotated[dict, Depends(get_current_user)]):
    # 从环境变量获取管理员EVM地址列表
    admin_evm_addresses_str = os.getenv("ADMIN_EVM_ADDRESSES", "")
    admin_evm_addresses = [addr.strip() for addr in admin_evm_addresses_str.split(",") if addr.strip()]
    
    # 检查当前用户的EVM地址是否在管理员列表中
    if current_user.get("evm") not in admin_evm_addresses:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    return current_user