#!/usr/bin/env python3
# -*- coding: utf-8 -*- 
"""
数据库配置文件（SQLite版本）
此文件使用SQLite数据库，完全不需要编译任何组件
"""
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
from typing import Optional

# 加载环境变量（固定加载backend目录下的.env）
BASE_DIR = os.path.dirname(__file__)
load_dotenv(os.path.join(BASE_DIR, ".env"))

# 获取数据库URL - 默认使用SQLite（可被环境变量覆盖为 Postgres/MySQL 等）
SQLALCHEMY_DATABASE_URL = os.getenv("SQLALCHEMY_DATABASE_URL", "sqlite:///./jinli.db")

# 检查是否运行在 Vercel
IS_VERCEL = os.environ.get("VERCEL", "0") == "1"

# 规范化SQLite文件路径
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    # 如果是常见的相对路径写法，则进行转换
    if SQLALCHEMY_DATABASE_URL in ("sqlite:///./jinli.db", "sqlite:///jinli.db"):
        if IS_VERCEL:
            # Vercel 下使用 /tmp 目录
            db_file = "/tmp/jinli.db"
            # 如果 /tmp/jinli.db 不存在，从当前目录拷贝过去
            if not os.path.exists(db_file):
                import shutil
                original_db = os.path.join(BASE_DIR, "jinli.db")
                if os.path.exists(original_db):
                    shutil.copy2(original_db, db_file)
        else:
            # 本地使用 backend 绝对路径
            db_file = os.path.join(BASE_DIR, "jinli.db")
        
        SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_file}"

# 根据不同数据库类型配置连接池参数，避免 QueuePool 溢出
_url = make_url(SQLALCHEMY_DATABASE_URL)
_dialect = _url.drivername.split(":")[0] if _url and _url.drivername else "sqlite"

# 连接池可调参数（可通过环境变量覆盖）
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))           # 默认 10（SQLAlchemy 默认 5）
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))     # 默认 20（SQLAlchemy 默认 10）
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "60"))     # 默认 60s（SQLAlchemy 默认 30s）
DB_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))   # 默认 30 分钟

engine_kwargs = {
    "pool_pre_ping": True,  # 防止因数据库空闲关闭导致的失效连接
}

if _dialect.startswith("sqlite"):
    # SQLite 特殊配置：禁用线程检查；使用 NullPool 避免线程间复用同一连接
    engine_kwargs.update({
        "connect_args": {"check_same_thread": False},
        "poolclass": NullPool,
    })
else:
    # 关系型数据库（Postgres/MySQL 等）使用 QueuePool，并适当增大池大小与溢出上限
    engine_kwargs.update({
        "pool_size": DB_POOL_SIZE,
        "max_overflow": DB_MAX_OVERFLOW,
        "pool_timeout": DB_POOL_TIMEOUT,
        "pool_recycle": DB_POOL_RECYCLE,
        # 可选：后进先出以减少连接创建抖动（SQLAlchemy 2.0 支持）
        "pool_use_lifo": True,
    })

# 创建数据库引擎
engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)

# 创建数据库会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基础模型类
Base = declarative_base()

# ORM 模型定义
from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime

class UserAsset(Base):
    """用户资产模型"""
    __tablename__ = "user_asset"
    
    index_id = Column(Integer, primary_key=True, autoincrement=True)
    uID = Column(Integer, nullable=False, unique=True)
    points = Column(Integer, default=0)
    time_update = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<UserAsset(uID={self.uID}, points={self.points})>"

# 依赖：获取数据库会话
def get_db():
    """获取数据库会话的依赖函数"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 提供一个基础类以符合重命名要求
class Foundation:
    """基础设施封装类：提供数据库相关引用"""
    engine = engine
    SessionLocal = SessionLocal
    Base = Base

    @staticmethod
    def get_db():
        return get_db()

    @staticmethod
    def text(sql: str):
        from sqlalchemy import text as _text
        return _text(sql)

    @staticmethod
    def exec(db, sql, params: dict = None):
        return db.execute(sql, params or {})

    @staticmethod
    def fetch_one(db, sql, params: dict = None):
        return Foundation.exec(db, sql, params).mappings().first()

    @staticmethod
    def fetch_all(db, sql, params: dict = None):
        return Foundation.exec(db, sql, params).mappings().all()

    @staticmethod
    def get_env(key: str, default: Optional[str] = None) -> Optional[str]:
        import os
        return os.getenv(key, default)

    # ===== Calendar data source helpers =====
    @staticmethod
    def get_calendar_sources() -> list:
        """
        返回日历数据源URL列表。
        优先从环境变量 `CALENDAR_SOURCES` 读取（逗号分隔），
        若未配置则使用内置的三个默认来源（用户提供）。

        注意：Google Calendar 的网页地址会转换为公开 ICS 源。
        """
        import urllib.parse as _up

        default_sources = [
            # 共享群组日历（Google Calendar 链接，需转换为 ICS）
            "https://calendar.google.com/calendar/u/0?cid=MWNhYmZkZjlkOGFiMzg3ZDdlNzQyNzU0ZDk3NDNlOWQzNzZkMTdhMTY1YWM0MGU1ZWE4YTM2MjFlZTE0Y2M2YkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t",
            # Google group calendar（同样需转换为 ICS）
            "https://calendar.google.com/calendar/u/0/r?cid=c_863bdad15dd57aa6ffd664c533f432cbbe5f70b5a69d7cfa8826e19de42ee70b@group.calendar.google.com",
            # 直接的 ICS 源：区块链会议截止日期
            "https://blockchain-deadlines.github.io/blockchain-deadlines.ics",
        ]

        env_val = os.getenv("CALENDAR_SOURCES", "")
        raw_sources = [s.strip() for s in env_val.split(",") if s.strip()] or default_sources

        def _to_ics(url: str) -> str:
            # 将 Google Calendar 的 cid 网页地址转换为公开 ICS 路径
            try:
                if "calendar.google.com" in url and "cid=" in url:
                    parsed = _up.urlparse(url)
                    qs = _up.parse_qs(parsed.query)
                    cid = None
                    # 支持 cid 或 r?cid=... 两种形式
                    for key in ("cid",):
                        if key in qs and len(qs[key]) > 0:
                            cid = qs[key][0]
                            break
                    if cid:
                        return f"https://calendar.google.com/calendar/ical/{cid}/public/basic.ics"
                return url
            except Exception:
                return url

        normalized = [_to_ics(u) for u in raw_sources]
        return normalized

# 数据库连接测试
def test_db_connection():
    """测试数据库连接是否正常"""
    try:
        db = SessionLocal()
        # 执行简单查询测试连接
        db.execute("SELECT 1")
        print("数据库连接成功！")
        return True
    except Exception as e:
        print(f"数据库连接失败: {e}")
        return False
    finally:
        db.close()

# 初始化数据库表
def init_db():
    """初始化数据库表"""
    try:
        # 创建所有表
        Base.metadata.create_all(bind=engine)
        print("数据库表创建成功！")
        return True
    except Exception as e:
        print(f"数据库表创建失败: {e}")
        return False

# 如果直接运行此文件，测试数据库连接
if __name__ == "__main__":
    test_db_connection()
