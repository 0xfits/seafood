from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose.exceptions import JWTError
from jose import jwt
from datetime import datetime, timedelta
import uvicorn
from typing import Annotated, Optional
import os
from dotenv import load_dotenv

# 导入数据库模块
from .database import get_db, engine, SessionLocal, Base
from .models import User, Task, Gift, TaskList, GiftList, CalendarEvent
from .routers.auth import router as auth_router
from .routers.tasks import router as tasks_router
from .routers.gifts import router as gifts_router
from .routers.calendar import router as calendar_router
from .auth_utils import create_access_token, get_current_user, get_current_admin, oauth2_scheme

# 加载环境变量
load_dotenv()

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