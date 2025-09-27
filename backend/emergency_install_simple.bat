@echo off
chcp 65001 >nul

cls
echo ========================================================
echo                  紧急安装脚本（免编译）
========================================================
echo 此脚本提供不需要编译的安装方案，解决所有编译相关问题。
echo ========================================================
echo.

:: 步骤1：检查Python安装
:check_python
echo 步骤1：检查Python安装...
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 错误：未找到Python！
    echo 请先安装Python，然后再运行此脚本。
    echo 安装时请务必勾选"Add Python to PATH"选项。
    pause
    exit /b 1
)

echo.

:: 步骤2：创建并激活虚拟环境
echo 步骤2：创建并激活虚拟环境...
python -m venv venv
call venv\Scripts\activate.bat

if %ERRORLEVEL% neq 0 (
    echo 错误：激活虚拟环境失败！
    pause
    exit /b 1
)

echo.

:: 步骤3：更新pip
echo 步骤3：更新pip...
python -m pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple

echo.

:: 步骤4：使用SQLite替代PostgreSQL（完全不需要编译）
echo 步骤4：使用SQLite数据库替代PostgreSQL...
echo 创建SQLite版本的.env文件...

:: 检查是否已有.env文件
if exist ".env" (
    echo 警告：.env文件已存在！将创建.env.sqlite作为参考。
    echo SQLALCHEMY_DATABASE_URL=sqlite:///./jinli.db > .env.sqlite
    echo 请手动将.env文件中的数据库URL替换为SQLite版本。
) else (
    echo 正在创建.env文件，使用SQLite数据库...
    echo SQLALCHEMY_DATABASE_URL=sqlite:///./jinli.db > .env
    echo SECRET_KEY=your-secret-key-here >> .env
    echo ALGORITHM=HS256 >> .env
    echo ACCESS_TOKEN_EXPIRE_MINUTES=30 >> .env
)

echo.

:: 步骤5：创建SQLite版本的database.py文件
echo 步骤5：创建SQLite版本的数据库配置文件...

:: 备份原database.py文件
if exist "database.py" (
    rename database.py database.py.bak
)

:: 创建SQLite版本的database.py
( echo #!/usr/bin/env python3
  echo # -*- coding: utf-8 -*- 
  echo """
  echo 数据库配置文件（SQLite版本）
  echo 此文件使用SQLite数据库，完全不需要编译任何组件
  echo """
  echo from sqlalchemy import create_engine
  echo from sqlalchemy.ext.declarative import declarative_base
  echo from sqlalchemy.orm import sessionmaker
  echo import os
  echo from dotenv import load_dotenv
  echo 
  echo # 加载环境变量
  echo load_dotenv()
  echo 
  echo # 获取数据库URL - 使用SQLite
  echo SQLALCHEMY_DATABASE_URL = os.getenv("SQLALCHEMY_DATABASE_URL", "sqlite:///./jinli.db")
  echo 
  echo # 创建数据库引擎 - SQLite需要特殊配置
  echo engine = create_engine(
  echo     SQLALCHEMY_DATABASE_URL,
  echo     connect_args={"check_same_thread": False}  # SQLite需要此参数
  echo )
  echo 
  echo # 创建数据库会话工厂
  echo SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
  echo 
  echo # 创建基础模型类
  echo Base = declarative_base()
  echo 
  echo # 依赖：获取数据库会话
  echo def get_db():
  echo     """获取数据库会话的依赖函数"""
  echo     db = SessionLocal()
  echo     try:
  echo         yield db
  echo     finally:
  echo         db.close()
  echo 
  echo # 数据库连接测试
  echo def test_db_connection():
  echo     """测试数据库连接是否正常"""
  echo     try:
  echo         db = SessionLocal()
  echo         # 执行简单查询测试连接
  echo         db.execute("SELECT 1")
  echo         print("数据库连接成功！")
  echo         return True
  echo     except Exception as e:
  echo         print(f"数据库连接失败: {e}")
  echo         return False
  echo     finally:
  echo         db.close()
  echo 
  echo # 初始化数据库表
  echo def init_db():
  echo     """初始化数据库表"""
  echo     try:
  echo         # 创建所有表
  echo         Base.metadata.create_all(bind=engine)
  echo         print("数据库表创建成功！")
  echo         return True
  echo     except Exception as e:
  echo         print(f"数据库表创建失败: {e}")
  echo         return False
  echo 
  echo # 如果直接运行此文件，测试数据库连接
  echo if __name__ == "__main__":
  echo     test_db_connection()
) > database.py

echo 成功：已创建SQLite版本的database.py文件

echo.

:: 步骤6：安装项目依赖（跳过PostgreSQL相关）
echo 步骤6：安装项目依赖...
pip install fastapi uvicorn sqlalchemy python-dotenv pydantic jose python-multipart -i https://pypi.tuna.tsinghua.edu.cn/simple

echo.

:: 步骤7：初始化数据库
echo 步骤7：初始化SQLite数据库...
python db_init_sqlite.py

if %ERRORLEVEL% neq 0 (
    echo 错误：数据库初始化失败！
    echo 请检查错误信息并尝试手动运行：python db_init_sqlite.py
    pause
    exit /b 1
) else (
    echo 成功：SQLite数据库初始化完成！
)

echo.

:: 完成
echo ========================================================
echo 安装完成！您的Jinli项目已成功设置为使用SQLite数据库。
echo 此配置完全不需要编译任何组件，适合快速测试和开发。
echo.
echo 启动项目方法：
echo 1. 确保虚拟环境已激活
  echo 2. 运行命令：uvicorn main:app --reload
  echo 3. 在浏览器中访问：http://127.0.0.1:8000
  echo ========================================================
pause