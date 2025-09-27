@echo off
:: 设置中文显示
chcp 65001 >nul

cls
echo ========================================================
echo                    简化版安装指南
echo ========================================================
echo 本脚本将引导您完成Jinli项目的安装过程。
echo 请按照提示逐步操作。
echo ========================================================
echo.

:: 1. 检查Python安装
:check_python
echo 步骤1：检查Python安装...
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 错误：未找到Python！
    echo 请先安装Python，然后再运行此脚本。
    echo 安装时请务必勾选"Add Python to PATH"选项。
    echo 下载地址：https://www.python.org/downloads/
    pause
    exit /b 1
) else (
    for /f "tokens=2 delims= " %%v in ('python --version') do (
        set PYTHON_VERSION=%%v
    )
    echo 成功：已检测到Python版本 %PYTHON_VERSION%
)
echo.

:: 2. 检查PostgreSQL服务
:check_postgresql
echo 步骤2：检查PostgreSQL服务...
sc query postgresql-x64-16 >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 警告：未找到PostgreSQL 16服务！
    echo 请确保已安装PostgreSQL并启动服务。
    echo 尝试检查其他版本的PostgreSQL服务...
    sc query state= all | findstr /i postgresql
    echo 请确认PostgreSQL服务已运行，然后按任意键继续...
    pause
) else (
    echo 成功：PostgreSQL 16服务正在运行
)
echo.

:: 3. 安装依赖（使用国内镜像源）
:install_dependencies
echo 步骤3：安装项目依赖（使用国内镜像源提高速度）...
echo 创建虚拟环境...
python -m venv venv
call venv\Scripts\activate.bat

if %ERRORLEVEL% neq 0 (
    echo 错误：激活虚拟环境失败！
    pause
    exit /b 1
)

echo 更新pip...
python -m pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple

echo 安装psycopg2-binary（PostgreSQL驱动）...
pip install psycopg2-binary -i https://pypi.tuna.tsinghua.edu.cn/simple

if %ERRORLEVEL% neq 0 (
    echo 错误：psycopg2-binary安装失败！
    echo 请安装Visual C++ Build Tools，或访问以下链接获取帮助：
    echo https://visualstudio.microsoft.com/visual-cpp-build-tools/
    pause
    exit /b 1
)

echo 安装项目依赖...
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

if %ERRORLEVEL% neq 0 (
    echo 错误：依赖安装失败！
    echo 请尝试手动安装requirements.txt中的包。
    pause
    exit /b 1
) else (
    echo 成功：所有依赖安装完成！
)
echo.

:: 4. 检查.env文件
:check_env
echo 步骤4：检查.env文件配置...
if not exist ".env" (
    echo 警告：.env文件不存在！
    echo 请复制.env.example并重命名为.env，然后配置数据库连接信息。
    echo 推荐配置：
    echo SQLALCHEMY_DATABASE_URL=postgresql://postgres:password@localhost/jinli
    pause
    exit /b 1
) else (
    echo 成功：.env文件已存在
    echo 请确保.env文件中的数据库配置正确：
    echo SQLALCHEMY_DATABASE_URL=postgresql://postgres:password@localhost/jinli
    echo （请将password替换为您的PostgreSQL密码）
)
echo 按任意键继续...
pause
echo.

:: 5. 初始化数据库
:init_database
echo 步骤5：初始化数据库...
python db_init.py

if %ERRORLEVEL% neq 0 (
    echo 错误：数据库初始化失败！
    echo 可能的原因：
    echo 1. PostgreSQL服务未运行
    echo 2. .env文件中的数据库配置不正确
    echo 3. PostgreSQL中没有名为jinli的数据库
    echo 请手动创建数据库：createdb -U postgres jinli
    pause
    exit /b 1
) else (
    echo 成功：数据库初始化完成！
)
echo.

:: 完成
:complete
echo ========================================================
echo 安装完成！您的Jinli项目已成功设置。
echo 您可以运行以下命令启动项目：
echo 1. 激活虚拟环境：venv\Scripts\activate.bat
echo 2. 启动后端服务器：uvicorn main:app --reload
echo 3. 在浏览器中访问：http://127.0.0.1:8000
echo ========================================================
pause