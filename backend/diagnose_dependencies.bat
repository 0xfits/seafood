@echo off

:: 设置中文显示
chcp 65001 >nul

cls
echo ========================================================
echo                  依赖安装诊断工具
echo ========================================================
echo.

:: 检查Python安装和版本
echo 检查Python安装情况...
python --version
if %ERRORLEVEL% neq 0 (
    echo 错误：未找到Python。请确保已安装Python并添加到系统PATH。
    echo 安装时请勾选"Add Python to PATH"选项。
    pause
    exit /b 1
)

:: 检查pip版本
echo.
echo 检查pip版本...
python -m pip --version
if %ERRORLEVEL% neq 0 (
    echo 错误：未找到pip。请确保Python安装包含pip。
    pause
    exit /b 1
)

:: 检查requirements.txt文件
echo.
echo 检查requirements.txt文件...
if not exist "requirements.txt" (
    echo 错误：requirements.txt文件不存在！
    echo 当前目录：%CD%
    echo 列出当前目录内容：
    dir
    pause
    exit /b 1
) else (
    echo requirements.txt文件存在。文件内容预览：
    echo ----------------------------------------
    type requirements.txt | findstr /v "#"
    echo ----------------------------------------
)

:: 创建临时虚拟环境用于测试
echo.
echo 创建临时虚拟环境用于测试...
if exist "test_env" rmdir /s /q test_env >nul 2>&1
python -m venv test_env
if %ERRORLEVEL% neq 0 (
    echo 错误：创建临时虚拟环境失败。
    pause
    exit /b 1
)

:: 激活临时虚拟环境
echo 激活临时虚拟环境...
call test_env\Scripts\activate.bat
if %ERRORLEVEL% neq 0 (
    echo 错误：激活临时虚拟环境失败。
    pause
    exit /b 1
)

:: 更新pip
echo.
echo 更新pip到最新版本...
python -m pip install --upgrade pip -v
if %ERRORLEVEL% neq 0 (
    echo 警告：更新pip失败，但尝试继续测试。
)

:: 测试安装各个依赖包
echo.
echo 开始测试安装依赖包...
echo ========================================================

:: 逐个测试安装主要依赖包
set DEPS=fastapi uvicorn sqlalchemy python-dotenv python-jose python-multipart passlib

for %%d in (%DEPS%) do (
    echo.
    echo 测试安装 %%d...
    pip install %%d -v
    if %ERRORLEVEL% neq 0 (
        echo 错误：安装 %%d 失败！详细错误信息如上所示。
        echo 可能的解决方案：
        echo 1. 检查网络连接
        echo 2. 使用国内镜像源：pip install %%d -i https://pypi.tuna.tsinghua.edu.cn/simple
        echo 3. 尝试安装特定版本：pip install %%d==版本号
        goto :cleanup
    )
)

:: 特别测试psycopg2-binary，这是最常见的问题源
echo.
echo 特别测试安装psycopg2-binary（PostgreSQL驱动）...
echo 方法1：安装指定版本
pip install psycopg2-binary==2.9.6 -v
if %ERRORLEVEL% equ 0 (
    echo psycopg2-binary安装成功！
) else (
    echo 方法1失败。尝试方法2：使用--only-binary选项
    pip install psycopg2-binary --only-binary :all: -v
    if %ERRORLEVEL% equ 0 (
        echo psycopg2-binary安装成功！
    ) else (
        echo 方法2失败。尝试方法3：使用国内镜像源
        pip install psycopg2-binary -i https://pypi.tuna.tsinghua.edu.cn/simple -v
        if %ERRORLEVEL% neq 0 (
            echo 错误：psycopg2-binary安装失败！详细错误信息如上所示。
            echo 推荐解决方案：
            echo 1. 安装Visual C++ Build Tools：
            echo    https://visualstudio.microsoft.com/visual-cpp-build-tools/
            echo 2. 或者使用psycopg2的替代方案：pip install psycopg2cffi
            goto :cleanup
        )
    )
)

echo.
echo ========================================================
echo 所有依赖包测试安装成功！
echo 您可以尝试再次运行init_database.bat进行完整的数据库初始化。
echo ========================================================

:cleanup
:: 注意：在Windows的批处理脚本中，退出虚拟环境不需要显式调用deactivate命令，
:: 因为当批处理脚本执行完毕时，环境变量会自动恢复到原始状态。
echo 虚拟环境会在脚本结束时自动退出...

:: 清理临时虚拟环境
echo.
echo 清理临时虚拟环境...
if exist "test_env" rmdir /s /q test_env >nul 2>&1

pause