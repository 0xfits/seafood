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
import time

# 导入数据库模块
from .foundation import get_db, engine, SessionLocal, Base
# 已切换到统一 API，禁用旧的 routers 下的路由以避免与新结构冲突
from .boundary import router as unified_router

# 加载环境变量（固定加载backend目录下的.env）
BASE_DIR = os.path.dirname(__file__)
load_dotenv(os.path.join(BASE_DIR, ".env"))

# 设置服务器时区（如果配置了）
server_timezone = os.getenv("SERVER_TIMEZONE") or os.getenv("TZ")
if server_timezone:
    # 设定 POSIX TZ 环境变量，尽量在所有使用本地时间的地方保持一致
    os.environ["TZ"] = server_timezone
    try:
        time.tzset()
    except Exception:
        # Windows 等平台可能不支持 tzset，忽略即可
        pass

# 创建应用实例
app = FastAPI(
    title="Jinli Club API",
    description="API for Jinli Club community platform",
    version="1.0.0"
)

# 添加CORS中间件
origins = [
    "http://localhost:3000",   # React/Vite 开发服务器（localhost）
    "http://127.0.0.1:3000",   # React/Vite 开发服务器（环回地址）
    "http://localhost:3001",   # React/Vite 开发服务器备用端口（localhost）
    "http://127.0.0.1:3001",   # React/Vite 开发服务器备用端口（环回地址）
    "http://localhost:8000",   # FastAPI 服务器
    "http://localhost:8001",   # 静态管理页（admin.html）本地预览端口（localhost）
    "http://127.0.0.1:8001",   # 静态管理页（admin.html）本地预览端口（环回地址）
    "https://jinli.club",      # 生产环境
    "https://www.jinli.club",  # 生产环境
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def _ensure_schema_on_startup():
    try:
        from sqlalchemy import text
        from .foundation import SessionLocal
        db = SessionLocal()
        try:
            def ensure_table_columns(table: str, columns: list):
                info_sql = text(f"PRAGMA table_info({table})")
                cols = db.execute(info_sql).mappings().all()
                names = {c.get("name") for c in cols}
                for col in columns:
                    if col not in names:
                        db.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} TEXT"))
                db.commit()
            ensure_table_columns("brand", [
                "name_en","name_hk","name_vn",
                "description_en","description_hk","description_vn",
            ])
            ensure_table_columns("task", [
                "title_en","title_hk","title_vn",
                "note_en","note_hk","note_vn",
            ])
            info_sql = text("PRAGMA table_info(journey)")
            cols = db.execute(info_sql).mappings().all()
            names = {c.get("name") for c in cols}
            if "info_lang" not in names:
                db.execute(text("ALTER TABLE journey ADD COLUMN info_lang TEXT"))
                db.commit()
        finally:
            db.close()
    except Exception:
        # 启动迁移失败不阻塞应用启动
        pass

# 健康检查端点
@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}

# 根端点
@app.get("/", tags=["Root"])
async def root():
    return {"message": "Welcome to Jinli Club API"}

# 注册路由器
# 统一端点：common API（包含认证与任务相关端点）
app.include_router(unified_router)

# 启动服务器（仅在直接运行此文件时）
if __name__ == "__main__":
    # 从环境变量获取服务器配置
    server_host = os.getenv("SERVER_HOST", "0.0.0.0")
    server_port = int(os.getenv("SERVER_PORT", "8000"))
    
    uvicorn.run(app, host=server_host, port=server_port)