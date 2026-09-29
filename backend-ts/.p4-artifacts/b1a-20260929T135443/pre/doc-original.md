# P4-B1 · GET 止血（批 1 / Kong）

- **run tag**: `p4b1-20260929T134838`（重派单；前单在 ~1m45s 被基础设施中断，实测零触碰，本单从头做）
- **作者角色**: Kong
- **仓库**: `/Users/kevin/bistro/seafood`（`backend-ts` = TS + Express + `@neondatabase/serverless` 0.6.1）
- **本单性质**: **批次 1 止血** —— 让现有 GET 端点不再 500（首屏可渲染）。**不删路径、不改写端点语义、不改库、不改 migrations、不改前端。**
- **上游事实来源**: `docs/audit/p4-route-inventory.md`（P4-0，296 行，已定案，直接引用）
- **代码版本**: 工作树 `a8e958b`（开工时 `git status --porcelain` 为空 ⇒ 干净）

## 0. 口径与元信息（caliber）

| 项 | 值 |
|---|---|
| run tag | `p4b1-20260929T134838` |
| 落盘日期 | 2026-09-29（CST, UTC+08:00） |
| 服务 | `seafood-api`（端口 5788，cwd `backend-ts`） |
| 库 | Neon PostgreSQL 18.6，`public` schema，`/health` 自报 `schema_version=0017` |
| 库查询口径 | `neon()` **HTTP 驱动**，只读 `SELECT` / 目录读；**未用 `Client`(ws)** |
| GET 扫荡口径 | 逐个 `curl --max-time 20`，**无 Authorization 头**；`status` 取自 curl `%{http_code}`（不取自管道） |
| 关系名双口径 | 裸名（`FROM task`）+ 带引号（`FROM "task"`）；保留字断言必加引号 |
| 变量名/英文串/CTE 别名 | **不算**「SQL 关系名命中」（见 §2 剔除口径） |

---

## 1. GET 端点逐端点 status（改动前 / 改动后）

> **STATUS: 待回填（§1）**

## 2. A 类 8 名在 `src/**` 归零证明（双口径）

> **STATUS: 待回填（§2）**

## 3. 字段集合契约（零依赖内存夹具，不写库）

> **STATUS: 待回填（§3）**

## 4. GET 零写库证明（逐表计数前后）

> **STATUS: 待回填（§4）**

## 5. 逐字段映射表（旧列 → 新列）

> **STATUS: 待回填（§5）**

## 6. 「范围外」清单（写端点 = 批 2 / 批 3）

> **STATUS: 待回填（§6）**

## 7. `tsc --noEmit` 退出码

> **STATUS: 待回填（§7）**

## 8. NOT_MEASURED 清单 + 探针自曝

> **STATUS: 待回填（§8）**

## 声明

> **STATUS: 待回填**

---

*骸架落盘：2026-09-29T13:48:38+0800。逐节回填。*
