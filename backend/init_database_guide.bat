:: 设置中文显示
chcp 65001 >nul

:: 检查Python是否已安装
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 未找到Python安装。请先安装Python，然后再运行此脚本。
    echo 您可以从以下链接下载Python安装程序：
    echo https://www.python.org/downloads/
    echo 安装时请勾选"Add Python to PATH"选项。
    pause
    exit /b 1
)

:: 确认Python版本
for /f "tokens=2 delims= " %%v in ('python --version') do (
    set PYTHON_VERSION=%%v
)
echo 检测到Python版本: %PYTHON_VERSION%

:: 创建虚拟环境
echo 创建Python虚拟环境...
python -m venv venv
if %ERRORLEVEL% neq 0 (
    echo 创建虚拟环境失败。
    pause
    exit /b 1
)

:: 激活虚拟环境
echo 激活虚拟环境...
call venv\Scripts\activate.bat
if %ERRORLEVEL% neq 0 (
    echo 激活虚拟环境失败。
    pause
    exit /b 1
)

:: 安装依赖
echo 安装项目依赖...
:: 先更新pip到最新版本
echo 更新pip...
python -m pip install --upgrade pip
if %ERRORLEVEL% neq 0 (
    echo 更新pip失败，但尝试继续安装依赖...
)

:: 先单独安装psycopg2-binary，这是常见的问题源
echo 安装psycopg2-binary（PostgreSQL驱动）...
pip install psycopg2-binary==2.9.6
if %ERRORLEVEL% neq 0 (
    echo 安装psycopg2-binary失败。这可能是因为缺少Visual C++ Build Tools。
    echo 尝试使用纯Python版本的安装方式...
    pip install psycopg2-binary --only-binary :all:
    if %ERRORLEVEL% neq 0 (
        echo psycopg2-binary安装仍然失败。请尝试以下解决方案：
        echo 1. 安装Visual C++ Build Tools
        echo    下载地址：https://visualstudio.microsoft.com/visual-cpp-build-tools/
        echo 2. 使用国内镜像源：pip install psycopg2-binary -i https://pypi.tuna.tsinghua.edu.cn/simple
        pause
        exit /b 1
    )
)

:: 安装其他依赖
echo 安装剩余依赖...
pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo 安装剩余依赖失败。尝试使用国内镜像源...
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    if %ERRORLEVEL% neq 0 (
        echo 依赖安装失败。请检查网络连接或手动安装requirements.txt中的包。
        pause
        exit /b 1
    )
)

:: 初始化数据库
echo 初始化数据库...
python db_init.py
if %ERRORLEVEL% neq 0 (
    echo 数据库初始化失败。请检查PostgreSQL服务是否正常运行，以及.env文件中的数据库配置是否正确。
    echo    SQLALCHEMY_DATABASE_URL=postgresql://postgres:password@localhost/jinli
    pause
    exit /b 1
)

echo 数据库初始化完成！
pause