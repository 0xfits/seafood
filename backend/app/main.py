from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base
from app.routers import auth_router, users_router, journeys_router, tasks_router, brands_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时创建数据库表
    Base.metadata.create_all(bind=engine)
    yield
    # 关闭时清理（如果需要）

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="基于 EVM 钱包登录的社区平台 API",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(journeys_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(brands_router, prefix="/api")

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy", "version": settings.VERSION}

@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "Welcome to Jinli Club API",
        "version": settings.VERSION,
        "docs": "/docs"
    }
