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

:: 创建虚拟环境
if not exist "venv" (
    echo 创建Python虚拟环境...
    python -m venv venv
    if %ERRORLEVEL% neq 0 (
        echo 创建虚拟环境失败。
        echo 错误代码: %ERRORLEVEL%
        pause
        exit /b 1
    )
)

:: 激活虚拟环境
echo 激活虚拟环境...
call venv\Scripts\activate.bat
if %ERRORLEVEL% neq 0 (
    echo 激活虚拟环境失败。
    echo 错误代码: %ERRORLEVEL%
    echo 请检查venv\Scripts\activate.bat文件是否存在。
    pause
    exit /b 1
)

:: 更新pip
python -m pip install --upgrade pip
if %ERRORLEVEL% neq 0 (
    echo 更新pip失败，但尝试继续安装依赖...
)

:: 检查requirements.txt文件是否存在
if not exist "requirements.txt" (
    echo requirements.txt文件不存在！
    pause
    exit /b 1
)

:: 显示requirements.txt内容，确认文件格式正确
echo 检查requirements.txt文件内容...
type requirements.txt

:: 尝试安装依赖
echo 开始安装依赖...
:: 先单独安装psycopg2-binary，这是常见的问题源
echo 安装psycopg2-binary...
pip install psycopg2-binary==2.9.6
if %ERRORLEVEL% neq 0 (
    echo 安装psycopg2-binary失败。这可能是因为缺少Visual C++ Build Tools或PostgreSQL开发库。
    echo 解决方案1：安装Visual C++ Build Tools
    echo 下载地址：https://visualstudio.microsoft.com/visual-cpp-build-tools/
    echo 解决方案2：尝试安装psycopg2的纯Python版本
    echo pip install psycopg2-binary --only-binary :all:
    echo.    echo 注意：.env文件已更新为使用postgres用户而非user用户
    echo        SQLALCHEMY_DATABASE_URL=postgresql://postgres:password@localhost/jinli
    pause
    exit /b 1
)

:: 安装其他依赖
echo 安装剩余依赖...
pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo 安装依赖失败。详细错误信息如上所示。
    echo 可能的解决方案：
    echo 1. 确保有足够的网络连接
    echo 2. 尝试使用国内镜像源：pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    echo 3. 检查是否有特定依赖包版本冲突
    pause
    exit /b 1
)

echo 依赖安装成功！
pause