@echo off
chcp 65001 >nul

cls
echo ========================================================
echo                  修复psycopg2安装问题
========================================================
echo 这个脚本将帮助您解决psycopg2-binary安装失败的问题。
echo ========================================================
echo.

:: 检查是否已激活虚拟环境
if not defined VIRTUAL_ENV (
    echo 警告：虚拟环境未激活！
    echo 请先激活虚拟环境，然后再运行此脚本。
    echo 激活命令：venv\Scripts\activate.bat
    pause
    exit /b 1
) else (
    echo 成功：虚拟环境已激活
)
echo.

:: 方法1：使用psycopg2cffi作为替代
echo 方法1：安装psycopg2cffi作为psycopg2的替代方案...
pip install psycopg2cffi psycopg2cffi-compat -i https://pypi.tuna.tsinghua.edu.cn/simple

if %ERRORLEVEL% neq 0 (
    echo 错误：psycopg2cffi安装失败！
    echo. && echo 尝试方法2...
) else (
    echo 成功：psycopg2cffi安装完成！
    echo 请修改您的代码，使用psycopg2cffi替代psycopg2。
    echo 或者在代码开头添加：import psycopg2cffi.compat; psycopg2cffi.compat.register()
    echo. && echo 继续安装其他依赖...
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple --no-deps
    goto success
)

:: 方法2：尝试安装预编译的psycopg2-binary
echo 方法2：尝试安装特定版本的预编译psycopg2-binary...
pip install psycopg2-binary==2.9.6 --only-binary :all: -i https://pypi.tuna.tsinghua.edu.cn/simple

if %ERRORLEVEL% neq 0 (
    echo 错误：预编译的psycopg2-binary安装失败！
    echo. && echo 尝试方法3...
) else (
    echo 成功：预编译的psycopg2-binary安装完成！
    echo. && echo 继续安装其他依赖...
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    goto success
)

:: 方法3：提示安装Visual C++ Build Tools
echo 方法3：需要安装Visual C++ Build Tools...
echo 请下载并安装Visual C++ Build Tools，然后再次尝试安装psycopg2-binary。
echo 下载地址：https://visualstudio.microsoft.com/visual-cpp-build-tools/
echo 安装时请选择"使用C++的桌面开发"工作负载。
echo.
echo 安装完成后，您可以再次尝试：
echo pip install psycopg2-binary -i https://pypi.tuna.tsinghua.edu.cn/simple
pause
exit /b 1

:success
echo.
echo ========================================================
echo 成功：psycopg2问题已解决！
echo 您现在可以继续初始化数据库并启动项目。
echo ========================================================
pause