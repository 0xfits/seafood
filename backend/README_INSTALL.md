# Jinli项目安装指南

## 安装方法选择

为了解决安装过程中遇到的问题，我们提供了多种安装方式，请根据您的情况选择最适合的方法：

### 方法1：使用简化版批处理脚本（推荐给有PostgreSQL环境的用户）
```bash
# 运行简化版安装脚本
install_jinli_simple.bat
```

### 方法2：手动执行命令（适用于熟悉命令行的用户）
打开命令提示符（cmd），然后逐个执行`install_guide.txt`文件中的命令。
这样可以完全避免批处理文件的编码问题。

### 方法3：使用SQLite替代方案（解决所有编译问题）
如果您在安装psycopg2-binary或psycopg2cffi时遇到编译问题，这是最可靠的解决方案：
```bash
# 运行紧急安装脚本（使用SQLite）
emergency_install_simple.bat
```
这个脚本会自动：
- 创建虚拟环境
- 配置SQLite数据库
- 安装所有依赖
- 初始化数据库
完全不需要任何编译环境！

## 详细安装步骤

### 前提条件
1. 已安装Python 3.7+并添加到系统PATH
2. 已安装PostgreSQL 13+并启动服务
3. 已创建名为`jinli`的PostgreSQL数据库

### 步骤1：创建虚拟环境
```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境（Windows）
venv\Scripts\activate.bat

# 激活虚拟环境（Mac/Linux）
# source venv/bin/activate
```

### 步骤2：更新pip并使用国内镜像源
```bash
python -m pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 步骤3：安装psycopg2-binary（重要！）
```bash
pip install psycopg2-binary -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 步骤4：安装项目依赖
```bash
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 步骤5：配置环境变量文件
1. 复制`.env.example`文件并重命名为`.env`
2. 编辑`.env`文件，配置数据库连接信息：
   ```
   SQLALCHEMY_DATABASE_URL=postgresql://postgres:password@localhost/jinli
   ```
   （请将`password`替换为您的PostgreSQL密码）

### 步骤6：初始化数据库
```bash
python db_init.py
```

### 步骤7：启动项目
```bash
uvicorn main:app --reload
```

启动后，在浏览器中访问：http://127.0.0.1:8000

## 常见问题解决

### 1. Python未找到或版本不兼容
- 请确保已正确安装Python并添加到系统PATH
- 建议安装Python 3.8或更高版本

### 2. psycopg2-binary安装失败
**我们为您提供了完整的解决方案：**

1. **运行专用修复脚本（推荐）**
   ```bash
   # 确保已激活虚拟环境
   venv\Scripts\activate.bat
   
   # 运行修复脚本
   fix_psycopg2_install.bat
   ```
   这个脚本会自动尝试三种解决方案：
   - 安装psycopg2cffi作为替代
   - 安装预编译的psycopg2-binary版本
   - 提示安装Visual C++ Build Tools

2. **手动使用psycopg2cffi替代**
   ```bash
   pip install psycopg2cffi psycopg2cffi-compat -i https://pypi.tuna.tsinghua.edu.cn/simple
   ```
   然后使用我们提供的替代数据库配置文件：
   ```bash
   # 备份原文件
   rename database.py database.py.bak
   
   # 使用支持cffi的版本
   rename database_with_cffi.py database.py
   ```

3. **安装Visual C++ Build Tools**
   下载地址：https://visualstudio.microsoft.com/visual-cpp-build-tools/
   安装时请选择"使用C++的桌面开发"工作负载

### 3. 数据库连接失败
**可能的原因及解决方案：**
- PostgreSQL服务未运行：启动PostgreSQL服务
- 数据库配置不正确：检查`.env`文件中的连接字符串
- 没有名为`jinli`的数据库：手动创建数据库
  ```bash
  createdb -U postgres jinli
  ```

### 4. 依赖安装速度慢或失败
- 使用国内镜像源（已在脚本中配置）
- 检查网络连接
- 尝试多次安装

### 5. SQLITE替代方案说明
如果您选择使用SQLite替代方案，请注意以下几点：

**SQLite与PostgreSQL的主要区别：**
- SQLite是文件型数据库，不需要额外安装数据库服务
- SQLite在高并发场景下性能不如PostgreSQL
- SQLite不支持某些PostgreSQL特定的高级功能

**SQLite版本的优势：**
- 完全不需要任何编译环境
- 安装过程更简单，适合开发和测试环境
- 不依赖外部数据库服务

**如何切换回PostgreSQL：**
1. 备份您的SQLite数据（如果需要）
2. 安装PostgreSQL并创建数据库
3. 恢复`.env.example`文件中的原始配置
4. 使用原始的`database.py`和`db_init.py`文件

## 联系方式
如果您在安装过程中遇到其他问题，请联系项目维护人员获取帮助。

祝您使用愉快！