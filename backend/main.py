from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from datetime import datetime, timedelta
import uvicorn
from typing import Annotated, Optional
import os
from dotenv import load_dotenv

# 导入数据库模块
from database import get_db, engine, SessionLocal, Base

# 导入模型
from models import User, Task, Gift, TaskList, GiftList, CalendarEvent

# 导入路由器
from routers.auth import router as auth_router
from routers.tasks import router as tasks_router
from routers.gifts import router as gifts_router
from routers.calendar import router as calendar_router

# 加载环境变量
load_dotenv()

# 配置
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# 创建应用实例
app = FastAPI(
    title="Jinli Club API",
    description="API for Jinli Club community platform",
    version="1.0.0"
)

# 添加CORS中间件
origins = [
    "http://localhost:3000",  # React开发服务器
    "http://localhost:8000",  # FastAPI服务器
    # 生产环境的URL应该在这里添加
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OAuth2配置
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

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

# 健康检查端点
@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}

# 根端点
@app.get("/", tags=["Root"])
async def root():
    return {"message": "Welcome to Jinli Club API"}

# 注册路由器
app.include_router(auth_router)
app.include_router(tasks_router)
app.include_router(gifts_router)
app.include_router(calendar_router)

# 启动服务器（仅在直接运行此文件时）
if __name__ == "__main__":
    # 从环境变量获取服务器配置
    server_host = os.getenv("SERVER_HOST", "0.0.0.0")
    server_port = int(os.getenv("SERVER_PORT", "8000"))
    
    uvicorn.run(app, host=server_host, port=server_port)