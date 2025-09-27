@echo off
:: 设置编码为UTF-8以支持中文
chcp 65001 >nul

:: 简化版安装脚本 - 确保使用正确的编码格式
cls
echo 开始安装Jinli项目...

echo. && echo 1. 检查Python安装...
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 错误：未找到Python！请先安装Python并添加到PATH。
    pause
    exit /b 1
)

echo. && echo 2. 创建虚拟环境...
python -m venv venv
call venv\Scripts\activate.bat
if %ERRORLEVEL% neq 0 (
    echo 错误：激活虚拟环境失败！
    pause
    exit /b 1
)

echo. && echo 3. 更新pip...
python -m pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple

echo. && echo 4. 安装psycopg2-binary（使用清华大学镜像源）...
pip install psycopg2-binary -i https://pypi.tuna.tsinghua.edu.cn/simple
if %ERRORLEVEL% neq 0 (
    echo 错误：psycopg2-binary安装失败！请安装Visual C++ Build Tools。
    pause
    exit /b 1
)

echo. && echo 5. 安装项目依赖...
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
if %ERRORLEVEL% neq 0 (
    echo 错误：依赖安装失败！
    pause
    exit /b 1
)

echo. && echo 6. 检查.env文件...
if not exist ".env" (
    echo 警告：.env文件不存在！请复制.env.example并重命名为.env，然后配置数据库连接信息。
    echo 推荐配置：SQLALCHEMY_DATABASE_URL=postgresql://postgres:password@localhost/jinli
    pause
    exit /b 1
)

echo. && echo 7. 初始化数据库...
python db_init.py
if %ERRORLEVEL% neq 0 (
    echo 错误：数据库初始化失败！请确保PostgreSQL服务运行且配置正确。
    echo 您可能需要手动创建数据库：createdb -U postgres jinli
    pause
    exit /b 1
)

echo. && echo 安装完成！您的Jinli项目已成功设置。
echo 启动项目方法：
echo 1. 激活虚拟环境：venv\Scripts\activate.bat
echo 2. 启动服务器：uvicorn main:app --reload
echo 3. 访问：http://127.0.0.1:8000

pause