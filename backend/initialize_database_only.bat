@echo off

:: 设置中文显示
chcp 65001 >nul

:: 确认Python版本
python --version
if %ERRORLEVEL% neq 0 (
    echo Python未找到，请确保已正确安装Python并添加到系统PATH。
    pause
    exit /b 1
)

:: 激活虚拟环境
echo 激活虚拟环境...
call venv\Scripts\activate.bat
if %ERRORLEVEL% neq 0 (
    echo 激活虚拟环境失败。
    echo 请先运行install_dependencies.bat创建并激活虚拟环境。
    pause
    exit /b 1
)

:: 检查db_init.py文件是否存在
if not exist "db_init.py" (
    echo db_init.py文件不存在！
    pause
    exit /b 1
)

:: 检查.env文件是否存在
if not exist ".env" (
    echo .env文件不存在！
    echo 请先从.env.example创建.env文件并配置正确的数据库连接信息。
    pause
    exit /b 1
)

:: 显示.env中的数据库配置，以便用户确认
echo 检查数据库配置...
findstr "SQLALCHEMY_DATABASE_URL" .env

:: 初始化数据库
echo 开始初始化数据库...
python db_init.py
if %ERRORLEVEL% neq 0 (
    echo 数据库初始化失败。详细错误信息如上所示。
    echo 可能的解决方案：
    echo 1. 确保PostgreSQL服务正在运行
    echo 2. 检查.env文件中的数据库连接信息是否正确
    echo 3. 确认PostgreSQL中存在用户"postgres"，密码与.env文件中配置一致
    echo 4. 确保postgres用户有创建数据库和表的权限
    echo 5. 尝试手动创建数据库：createdb -U postgres jinli
    pause
    exit /b 1
)

echo 数据库初始化成功！
pause