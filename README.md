# Jinli Club

当前仓库是 React 前端 + TypeScript/Express 后端，数据库使用 Neon PostgreSQL。

旧的 Python/FastAPI/SQLite 实现已经迁移完成，不再是当前运行时。本文档只描述现在这套代码。

## 项目结构

```text
jinli/
├── backend-ts/          # TypeScript 后端
│   ├── src/
│   │   ├── auth.ts
│   │   ├── database.ts
│   │   └── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── vercel.json
├── frontend/            # Vite + React 前端
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
└── vercel.json          # 根部署配置
```

## 当前技术栈

- 前端：React + Vite + React Router + Tailwind 风格组件
- 后端：Express + TypeScript
- 数据库：Neon PostgreSQL
- 部署：Vercel
- 登录：EVM 钱包签名

## 当前数据库主表

核心业务表：

- `user`
- `asset`
- `task`
- `task_progress`
- `prize`
- `prize_item`
- `shard`
- `shard_transfer`
- `market_order`
- `market_trade`

支撑表：

- `app_config`
- `permission_group`
- `chest`
- `user_chest_stats`
- `shard_order`
- `shard_trade`

说明：

- 旧的 `brand` 表已经废弃，数据已迁入 `prize`
- 旧的 `task_type` 表不再使用
- 当前后端会在启动/首次访问时补齐缺失列，并做少量幂等数据回填

## 本地开发

### 1. 后端

```bash
cd backend-ts
npm install
```

配置环境变量：

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
```

开发启动：

```bash
npm run dev
```

构建：

```bash
npm run build
```

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

构建：

```bash
npm run build
```

## 认证流程

当前登录流程是：

1. `POST /api/auth/challenge`
2. 钱包对 challenge 签名
3. `POST /api/auth/verify`

兼容说明：

- `POST /api/auth/login` 仍然转发到签名验证流程
- `POST /api/auth/register` 已废弃

## 主要 API

公开接口：

- `GET /api/task/all`
- `GET /api/task/:tID`
- `GET /api/prize/all`
- `GET /api/prize/:bID`

鉴权接口：

- `GET /api/user`
- `GET /api/prize-item`
- `GET /api/task-progress`
- `GET /api/user/asset/:uID`

管理接口：

- `POST /api/admin/task/create`
- `POST /api/admin/task/update`
- `POST /api/admin/task/delete`
- `POST /api/admin/prize/create`
- `POST /api/admin/prize/update`
- `POST /api/admin/prize/delete`

## 迁移说明

从旧实现迁移后，当前运行时只保留两类迁移保障：

- 启动时自动把历史表 `gift`、`journey` 迁移为正式表 `prize_item`、`task_progress`
- 输出字段兼容
  - 某些前端仍会消费历史字段别名，后端会在返回层做兼容映射

已经不再保留的内容：

- `/api/brand/all`、`/api/gift`、`/api/journey` 等历史路由别名
- Python/FastAPI 运行入口
- SQLite 数据文件与运维命令
- `brand` / `task_type` 老表读取逻辑

## 维护原则

- 新代码以 PostgreSQL 正式字段为准
- 优先修正真实数据，不使用虚拟/兜底数据
- 兼容层只保留必要的迁移保障
- 新增功能默认落在 `prize`、`task`、`market_*` 等正式结构上
