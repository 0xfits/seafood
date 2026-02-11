# Jinli Club 项目重构计划

## 项目概述

将现有单体架构重构为标准 FastAPI + React 前后端分离架构，使用 OpenAPI 3.1 规范作为契约，迁移到 PostgreSQL 数据库，并部署到 Vercel。

---

## 架构目标

```
┌─────────────────────────────────────────────────────────┐
│                    用户访问层                             │
│  www.jinlibenli.com (Vercel - React SPA)                 │
│  api.jinlibenli.com (Vercel - FastAPI)                   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   数据库层 (Supabase)                    │
│  PostgreSQL + PostgREST (可选)                           │
└─────────────────────────────────────────────────────────┘
```

---

## 阶段 1：OpenAPI 3.1 规范定义

### 目标
创建完整的 API 契约文件 `openapi.yaml`，定义所有端点、请求/响应模型、认证方式。

### 文件位置
`openapi.yaml` (项目根目录)

### 内容结构

```yaml
openapi: 3.1.0
info:
  title: Jinli Club API
  version: 1.0.0
  description: 基于 EVM 钱包登录的社区平台 API

servers:
  - url: https://api.jinlibenli.com
    description: 生产环境
  - url: http://localhost:8000
    description: 本地开发

# 认证方式
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT Token，从登录接口获取

# 通用 Schema
schemas:
  # 基础响应包装
  BaseResponse:
    type: object
    required: [success]
    properties:
      success:
        type: boolean
      message:
        type: string
      data:
        type: object

  # 错误响应
  ErrorResponse:
    type: object
    required: [success, message]
    properties:
      success:
        type: boolean
        example: false
      message:
        type: string
      error:
        type: string

  # 用户模型
  User:
    type: object
    properties:
      uID:
        type: integer
      EVM:
        type: string
      bio:
        type: string
      is_admin:
        type: boolean
      time_reg:
        type: string
        format: date-time
      time_login_last:
        type: string
        format: date-time

  # 资产模型
  Asset:
    type: object
    properties:
      aID:
        type: integer
      uID:
        type: integer
      points:
        type: integer
      lucks:
        type: integer
      time_updated:
        type: string
        format: date-time

  # 任务模型
  Task:
    type: object
    properties:
      tID:
        type: integer
      title:
        type: string
      note:
        type: string
      refcode:
        type: string
      link0:
        type: string
      linkB:
        type: string
      points:
        type: integer
      type:
        type: integer
      is_open:
        type: boolean
      time_start:
        type: string
        format: date-time
      time_end:
        type: string
        format: date-time

  # 任务参与记录 (Journey)
  Journey:
    type: object
    properties:
      jID:
        type: integer
      tID:
        type: integer
      uID:
        type: integer
      info_input:
        type: string
      info_lang:
        type: string
      time_created:
        type: string
        format: date-time
      time_submitted:
        type: string
        format: date-time
      time_checked:
        type: string
        format: date-time
      time_claimed:
        type: string
        format: date-time
      points_claimed:
        type: integer

  # 品牌模型
  Brand:
    type: object
    properties:
      bID:
        type: integer
      symbol:
        type: string
      name:
        type: string
      description:
        type: string
      url_image:
        type: string
      points:
        type: integer
      gift_limit:
        type: integer
      time_start:
        type: string
        format: date-time
      time_end:
        type: string
        format: date-time

  # 礼品模型
  Gift:
    type: object
    properties:
      gID:
        type: integer
      bID:
        type: integer
      uID:
        type: integer
      time_created:
        type: string
        format: date-time
      time_claimed:
        type: string
        format: date-time
      time_actived:
        type: string
        format: date-time

  # 宝箱模型
  Chest:
    type: object
    properties:
      cID:
        type: integer
      uID:
        type: integer
      tirer:
        type: integer
      vol_points:
        type: integer
      time_created:
        type: string
        format: date-time
      time_claimed:
        type: string
        format: date-time
      time_bind:
        type: string
        format: date-time

# API 路径
paths:
  # ========== 认证 ==========
  /api/auth/login:
    post:
      summary: EVM钱包登录
      description: 使用钱包地址和签名进行登录，返回 JWT Token
      tags: [认证]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [evm_address, signature]
              properties:
                evm_address:
                  type: string
                  description: EVM 钱包地址
                  example: "0x59f9f640d15ebb053c94a816232cf8ce91b209b0"
                signature:
                  type: string
                  description: 签名消息
      responses:
        '200':
          description: 登录成功
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/BaseResponse'
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          uID:
                            type: integer
                          EVM:
                            type: string
                          access_token:
                            type: string
                          token_type:
                            type: string
                            example: bearer
        '401':
          description: 认证失败
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  # ========== 用户 ==========
  /api/user:
    get:
      summary: 获取当前用户信息
      description: 需要 JWT 认证
      tags: [用户]
      security:
        - bearerAuth: []
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/BaseResponse'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/User'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /api/user/all:
    get:
      summary: 获取所有用户列表（管理员）
      tags: [用户]
      security:
        - bearerAuth: []
      parameters:
        - name: skip
          in: query
          schema:
            type: integer
            default: 0
        - name: limit
          in: query
          schema:
            type: integer
            default: 100
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/BaseResponse'
                  - type: object
                    properties:
                      data:
                        type: array
                        items:
                          $ref: '#/components/schemas/User'
        '403':
          description: 无权访问

  # ========== 任务 ==========
  /api/task/all:
    get:
      summary: 获取所有任务列表
      tags: [任务]
      parameters:
        - name: skip
          in: query
          schema:
            type: integer
            default: 0
        - name: limit
          in: query
          schema:
            type: integer
            default: 100
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/BaseResponse'
                  - type: object
                    properties:
                      data:
                        type: array
                        items:
                          $ref: '#/components/schemas/Task'

  # ========== 任务参与 (Journey) ==========
  /api/journey:
    get:
      summary: 获取用户的任务参与列表
      tags: [任务参与]
      security:
        - bearerAuth: []
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/BaseResponse'
                  - type: object
                    properties:
                      data:
                        type: array
                        items:
                          $ref: '#/components/schemas/Journey'

  /api/journey/{jID}/submit:
    post:
      summary: 提交任务完成信息
      description: 用户填写任务完成信息后提交，等待管理员审核
      tags: [任务参与]
      security:
        - bearerAuth: []
      parameters:
        - name: jID
          in: path
          required: true
          schema:
            type: integer
          description: 任务参与记录ID
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [info_input]
              properties:
                info_input:
                  type: string
                  description: 用户提交的完成信息
      responses:
        '200':
          description: 提交成功
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/BaseResponse'
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          jID:
                            type: integer
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          description: 无权提交此任务
        '404':
          description: 任务不存在

  /api/journey/{jID}/verify:
    post:
      summary: 审核通过任务（管理员）
      description: 管理员审核用户提交的任务，通过后发放积分
      tags: [任务参与, 管理员]
      security:
        - bearerAuth: []
      parameters:
        - name: jID
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: 审核成功
        '403':
          description: 需要管理员权限

  /api/journey/{jID}/reject:
    post:
      summary: 拒绝任务（管理员）
      tags: [任务参与, 管理员]
      security:
        - bearerAuth: []
      parameters:
        - name: jID
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: 拒绝成功

  # ========== 礼品 ==========
  /api/gift/all:
    get:
      summary: 获取所有礼品列表
      tags: [礼品]
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/BaseResponse'
                  - type: object
                    properties:
                      data:
                        type: array
                        items:
                          $ref: '#/components/schemas/Gift'

  /api/gift/claim:
    post:
      summary: 领取礼品
      tags: [礼品]
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [gID]
              properties:
                gID:
                  type: integer
      responses:
        '200':
          description: 领取成功

  # ========== 品牌 ==========
  /api/brand/all:
    get:
      summary: 获取所有品牌列表
      tags: [品牌]
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/BaseResponse'
                  - type: object
                    properties:
                      data:
                        type: array
                        items:
                          $ref: '#/components/schemas/Brand'

  # ========== 宝箱 ==========
  /api/chest:
    get:
      summary: 获取用户的宝箱
      tags: [宝箱]
      security:
        - bearerAuth: []
      responses:
        '200':
          description: 成功

  /api/chest/claim:
    post:
      summary: 领取宝箱
      tags: [宝箱]
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [cID]
              properties:
                cID:
                  type: integer
      responses:
        '200':
          description: 领取成功

# 通用响应
tags:
  - name: 认证
    description: 登录相关接口
  - name: 用户
    description: 用户信息管理
  - name: 任务
    description: 任务管理
  - name: 任务参与
    description: 用户任务参与记录
  - name: 礼品
    description: 礼品系统
  - name: 品牌
    description: 品牌管理
  - name: 宝箱
    description: 宝箱系统
  - name: 管理员
    description: 需要管理员权限的接口
```

### 验证方式
- 使用 Swagger Editor (https://editor.swagger.io/) 验证 YAML 语法
- 确保所有端点、模型、认证方式都定义完整

### 预计耗时
2-3 小时

---

## 阶段 2：后端重构

### 目标
将现有 `backend/` 重构为标准 FastAPI 项目结构

### 新文件结构

```
backend/
├── alembic/                    # 数据库迁移（自动生成）
│   ├── versions/
│   ├── env.py
│   └── script.py.mako
├── app/                        # 主应用目录
│   ├── __init__.py
│   ├── main.py                # FastAPI 入口
│   ├── config.py              # 配置管理
│   ├── database.py            # 数据库连接
│   ├── dependencies.py        # 依赖注入
│   ├── models/                # SQLAlchemy ORM 模型
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── journey.py
│   │   ├── task.py
│   │   ├── gift.py
│   │   ├── brand.py
│   │   ├── chest.py
│   │   └── asset.py
│   ├── schemas/               # Pydantic 模型
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── journey.py
│   │   ├── task.py
│   │   └── common.py
│   ├── routers/               # API 路由
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── journeys.py
│   │   ├── tasks.py
│   │   ├── gifts.py
│   │   ├── brands.py
│   │   ├── chests.py
│   │   └── admin.py
│   ├── services/              # 业务逻辑层
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── journey_service.py
│   │   └── user_service.py
│   └── utils/                 # 工具函数
│       ├── __init__.py
│       ├── jwt.py
│       └── web3.py
├── tests/                      # 测试目录
│   ├── __init__.py
│   └── test_api.py
├── alembic.ini                 # 迁移配置
├── requirements.txt            # 依赖
└── vercel.json                 # Vercel 部署配置
```

### 核心文件内容

#### 1. app/main.py
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base
from app.routers import auth, users, journeys, tasks, gifts, brands, chests, admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时创建表
    Base.metadata.create_all(bind=engine)
    yield
    # 关闭时清理

app = FastAPI(
    title="Jinli Club API",
    version="1.0.0",
    description="基于 EVM 钱包登录的社区平台 API",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(journeys.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(gifts.router, prefix="/api")
app.include_router(brands.router, prefix="/api")
app.include_router(chests.router, prefix="/api")
app.include_router(admin.router, prefix="/api")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

#### 2. app/config.py
```python
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # 应用配置
    APP_NAME: str = "Jinli Club API"
    DEBUG: bool = False
    
    # 数据库
    DATABASE_URL: str = "postgresql://user:password@localhost/jinli"
    
    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 天
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "https://www.jinlibenli.com",
        "https://jinlibenli.com",
        "http://localhost:3000",
        "http://localhost:5173"
    ]
    
    # Web3
    WEB3_PROVIDER: str = "https://bsc-dataseed.binance.org/"
    
    class Config:
        env_file = ".env"

settings = Settings()
```

#### 3. app/database.py
```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

#### 4. app/models/user.py
```python
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    uID = Column(Integer, primary_key=True, index=True)
    EVM = Column(String(42), unique=True, index=True, nullable=False)
    bio = Column(Text)
    is_admin = Column(Boolean, default=False)
    time_reg = Column(DateTime(timezone=True), server_default=func.now())
    time_login_last = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 关系
    journeys = relationship("Journey", back_populates="user")
    asset = relationship("Asset", back_populates="user", uselist=False)
```

#### 5. app/schemas/auth.py
```python
from pydantic import BaseModel

class LoginRequest(BaseModel):
    evm_address: str
    signature: str

class LoginResponse(BaseModel):
    uID: int
    EVM: str
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    uID: int | None = None
    evm: str | None = None
```

#### 6. app/routers/journeys.py
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.journey import JourneySubmitRequest, JourneyResponse
from app.models.user import User
from app.services.journey_service import JourneyService

router = APIRouter(prefix="/journey", tags=["任务参与"])

@router.post("/{jID}/submit", response_model=JourneyResponse)
async def submit_journey(
    jID: int,
    data: JourneySubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    提交任务完成信息
    
    - **jID**: 任务参与记录ID
    - **info_input**: 用户提交的完成信息
    """
    service = JourneyService(db)
    try:
        result = service.submit(jID, current_user.uID, data.info_input)
        return {
            "success": True,
            "data": {"jID": result.jID}
        }
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("", response_model=List[JourneyResponse])
async def get_user_journeys(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取用户的任务参与列表"""
    service = JourneyService(db)
    journeys = service.get_by_user(current_user.uID)
    return journeys
```

#### 7. app/dependencies.py
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.config import settings
from app.database import get_db
from app.models.user import User

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    获取当前登录用户
    """
    token = credentials.credentials
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        uID: int = payload.get("sub")
        if uID is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的认证令牌",
                headers={"WWW-Authenticate": "Bearer"}
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证令牌",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    user = db.query(User).filter(User.uID == uID).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在"
        )
    
    return user

def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    获取当前管理员用户
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限"
        )
    return current_user
```

#### 8. requirements.txt
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0
sqlalchemy==2.0.23
alembic==1.12.1
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
web3==6.11.0
httpx==0.25.2
pytest==7.4.3
pytest-asyncio==0.21.1
```

### 预计耗时
8-10 小时

---

## 阶段 3：前端类型生成

### 目标
使用 OpenAPI 规范自动生成前端 TypeScript 类型

### 步骤

1. **安装工具**
```bash
cd frontend
npm install -D openapi-typescript orval
```

2. **生成类型**
```bash
# 方案 A: 使用 openapi-typescript（仅类型）
npx openapi-typescript ../openapi.yaml -o src/api/types.ts

# 方案 B: 使用 orval（类型 + API 客户端 + React Query Hooks）
# 创建 orval.config.js
```

3. **orval.config.js**
```javascript
module.exports = {
  jinli: {
    input: {
      target: '../openapi.yaml',
    },
    output: {
      target: './src/api/generated.ts',
      client: 'react-query',
      override: {
        mutator: {
          path: './src/api/custom-instance.ts',
          name: 'customInstance',
        },
      },
    },
  },
};
```

4. **自定义请求实例**
```typescript
// src/api/custom-instance.ts
import Axios, { AxiosRequestConfig } from 'axios';

export const customInstance = <T>(
  config: AxiosRequestConfig
): Promise<T> => {
  const token = localStorage.getItem('user') 
    ? JSON.parse(localStorage.getItem('user')!).token 
    : '';
  
  const axiosInstance = Axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'https://api.jinlibenli.com',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
  
  return axiosInstance(config).then(({ data }) => data);
};
```

### 生成内容
```typescript
// 自动生成的代码示例
export const useSubmitJourneyMutation = (
  options?: UseMutationOptions<
    SubmitJourneyResponse,
    AxiosError,
    SubmitJourneyBody
  >
) => {
  return useMutation(
    (data: SubmitJourneyBody) => customInstance<SubmitJourneyResponse>({
      url: `/journey/${data.jID}/submit`,
      method: 'POST',
      data,
    }),
    options
  );
};
```

### 预计耗时
2-3 小时

---

## 阶段 4：PostgreSQL 迁移

### 目标
从 SQLite 迁移到 PostgreSQL (Supabase)

### 步骤

1. **创建 Supabase 项目**
   - 访问 https://supabase.com
   - 创建免费项目
   - 获取数据库连接字符串

2. **导出 SQLite 数据**
```bash
cd backend
sqlite3 jinli.db ".dump" > backup.sql
```

3. **修改配置**
```python
# .env
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
```

4. **创建迁移脚本**
```bash
# 初始化 Alembic
alembic init alembic

# 创建初始迁移
alembic revision --autogenerate -m "Initial migration"

# 应用迁移
alembic upgrade head
```

5. **导入数据**
```bash
# 使用 psql 或 Supabase Dashboard 导入 backup.sql
```

### 预计耗时
3-4 小时

---

## 阶段 5：部署配置

### 目标
部署到 Vercel 并使用子域名

### 前端部署

1. **Vercel 配置**
```json
// frontend/vercel.json
{
  "version": 2,
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        }
      ]
    }
  ]
}
```

2. **环境变量**
```bash
# Vercel Dashboard - Frontend Project
REACT_APP_API_URL=https://api.jinlibenli.com
```

### 后端部署

1. **Vercel 配置**
```json
// backend/vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "app/main.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app/main.py"
    }
  ]
}
```

2. **环境变量**
```bash
# Vercel Dashboard - Backend Project
DATABASE_URL=postgresql://...
SECRET_KEY=production-secret-key
```

### 域名配置

1. **购买/配置域名**
   - 在域名服务商添加 DNS 记录

2. **Vercel 自定义域名**
```
# Frontend Project
domain: www.jinlibenli.com

# Backend Project
domain: api.jinlibenli.com
```

### 预计耗时
2-3 小时

---

## 实施检查清单

### 开发前准备
- [ ] 备份当前代码 (`git checkout -b main-backup`)
- [ ] 创建新分支 (`git checkout -b refactor/openapi-rewrite`)
- [ ] 确认数据库迁移方案
- [ ] 准备 Supabase 账号

### 开发阶段
- [ ] 阶段 1: OpenAPI 规范
- [ ] 阶段 2: 后端重构
- [ ] 阶段 3: 前端类型生成
- [ ] 阶段 4: PostgreSQL 迁移
- [ ] 阶段 5: 部署配置

### 测试阶段
- [ ] 本地完整功能测试
- [ ] API 文档验证
- [ ] 前端类型检查
- [ ] 部署环境测试

### 上线阶段
- [ ] 代码审查
- [ ] 生产环境部署
- [ ] 域名配置
- [ ] SSL 证书配置
- [ ] 监控配置

---

## 风险评估

| 风险 | 可能性 | 影响 | 应对措施 |
|------|--------|------|----------|
| 数据迁移失败 | 中 | 高 | 完整备份，分步迁移，保留回滚方案 |
| API 不兼容 | 中 | 高 | 详细测试，保留旧版本兼容性检查 |
| 部署配置错误 | 低 | 中 | 先在 staging 环境测试 |
| 性能下降 | 低 | 中 | PostgreSQL 优化，连接池配置 |
| 第三方服务故障 | 低 | 中 | Supabase SLA，备用方案 |

---

## 成功标准

1. ✅ 所有 API 正常工作
2. ✅ 自动生成 Swagger 文档
3. ✅ 前端类型安全
4. ✅ 数据完整迁移
5. ✅ 生产环境稳定运行
6. ✅ 自定义域名生效

---

## 下一步行动

1. **确认计划**: 审查此计划文档
2. **准备环境**: 创建 Supabase 项目
3. **开始执行**: 按阶段逐步实施
4. **持续沟通**: 每个阶段完成后汇报进展

---

*计划创建时间: 2026-02-11*
*预计总耗时: 18-24 小时*
