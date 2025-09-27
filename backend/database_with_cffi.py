#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库配置文件（支持psycopg2cffi替代）

如果您无法安装psycopg2-binary，可以使用此文件替代database.py
此文件会尝试使用psycopg2cffi作为替代方案
"""

# 尝试导入psycopg2cffi作为psycopg2的替代
try:
    import psycopg2cffi.compat
    psycopg2cffi.compat.register()
    print("成功：psycopg2cffi已注册为psycopg2的替代")
except ImportError:
    print("警告：未找到psycopg2cffi，请确保已安装psycopg2-binary或psycopg2cffi")

# 导入SQLAlchemy模块
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 获取数据库URL
SQLALCHEMY_DATABASE_URL = os.getenv("SQLALCHEMY_DATABASE_URL", "postgresql://user:password@localhost/jinli")

# 创建数据库引擎
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 创建数据库会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基础模型类
Base = declarative_base()

# 依赖：获取数据库会话
def get_db():
    """获取数据库会话的依赖函数"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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