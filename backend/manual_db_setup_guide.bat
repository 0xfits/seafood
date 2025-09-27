@echo off

:: 设置中文显示
chcp 65001 >nul

cls
echo ========================================================
echo               Jinli 项目数据库手动配置指南
echo ========================================================
echo.
echo 本脚本将引导您手动配置PostgreSQL数据库，并初始化Jinli项目的数据库。
echo.
pause

:: 步骤1：确认PostgreSQL服务正在运行
echo.
echo 步骤1：检查PostgreSQL服务状态
echo --------------------------------------------------------
net start | findstr "postgresql"
if %ERRORLEVEL% neq 0 (
    echo 错误：PostgreSQL服务未运行！
    echo 请先启动PostgreSQL服务，然后再继续。
    echo 可以通过Windows服务管理器（services.msc）启动服务。
    pause
    exit /b 1
) else (
    echo PostgreSQL服务正在运行。
)
pause

:: 步骤2：创建数据库和用户
echo.
echo 步骤2：创建数据库和用户
 echo --------------------------------------------------------
echo 请按照以下步骤操作：
echo 1. 找到PostgreSQL的安装目录，通常位于C:\Program Files\PostgreSQL\18\bin
echo 2. 在该目录下打开命令提示符（以管理员身份运行）
echo 3. 运行以下命令登录到PostgreSQL：
echo    psql -U postgres
echo    （注意：postgres是超级用户，可能需要输入密码）
echo 4. 在psql提示符下，运行以下命令：
echo    CREATE DATABASE jinli;
echo    \q
echo 5. 确保您的.env文件中的密码与postgres用户的实际密码匹配
    echo    SQLALCHEMY_DATABASE_URL=postgresql://postgres:password@localhost/jinli

echo.
echo 完成后按任意键继续...
pause

:: 步骤3：安装Python依赖
echo.
echo 步骤3：安装Python依赖
echo --------------------------------------------------------
echo 请按照以下步骤操作：
echo 1. 打开命令提示符（cmd）
echo 2. 导航到d:\Jinli\jinli.club\backend目录
echo    cd /d d:\Jinli\jinli.club\backend
echo 3. 创建Python虚拟环境：
echo    python -m venv venv
echo 4. 激活虚拟环境：
echo    venv\Scripts\activate.bat
echo 5. 更新pip：
echo    python -m pip install --upgrade pip
echo 6. 安装依赖：
echo    pip install -r requirements.txt
echo 7. 如果psycopg2-binary安装失败，尝试：
echo    pip install psycopg2-binary --only-binary :all:
echo 8. 或者使用国内镜像源：
echo    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

echo.
echo 完成后按任意键继续...
pause

:: 步骤4：初始化数据库
echo.
echo 步骤4：初始化数据库
echo --------------------------------------------------------
echo 请按照以下步骤操作：
echo 1. 确保虚拟环境已激活（venv\Scripts\activate.bat）
echo 2. 运行数据库初始化脚本：
echo    python db_init.py
echo 3. 如果出现错误，请检查.env文件中的数据库连接信息是否正确
echo    SQLALCHEMY_DATABASE_URL=postgresql://user:password@localhost/jinli

echo.
echo 完成后按任意键继续...
pause

echo ========================================================
echo 数据库配置和初始化过程已完成！
echo 如果遇到问题，请查看错误信息并参考上述步骤进行排查。
echo ========================================================
pause