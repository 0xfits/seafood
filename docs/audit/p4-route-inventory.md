# P4-0 · 路由层现状清单（ROUTE-INVENTORY）

- **run tag**: `P4-0 / 2026-09-29T13:1x+0800`（落盘时间见文末）
- **作者角色**: Kong（只读侦察）
- **仓库**: `/Users/kevin/bistro/seafood`（`backend-ts` = TS + Express + `@neondatabase/serverless`）
- **本单性质**: 纯只读侦察 + 切分方案。**不写代码、不改库、不改配置。**
- **对照真值**：`migrations/0001..0017`（已 DROP+重放基线，`/health` 自报 `schema_version=0017`）


## 0. 元信息与口径（caliber）

| 项 | 值 |
|---|---|
| run tag | `P4-0` |
| 落盘日期 | 2026-09-29（CST, UTC+08:00） |
| 代码版本 | 工作树当前态（未 commit、未改动；本单只读） |
| 服务 | `seafood-api`（端口 5788，cwd `backend-ts`）；前端 `seafood`（Vite 5787） |
| 库 | Neon PostgreSQL 18.6，`public` schema；`/health` 自报 `schema_version=0017` |
| 端点锚口径 | 对 `backend-ts/src/index.ts` 用正则 `^\s*app\.(get\|post\|put\|delete\|patch)\(\s*['\"]…` 匹配（= 每个 `app.<verb>(` 注册点计 1 个端点） |
| 关系名双口径 | 裸名（不加引号，如 `users`）+ 带引号（`"users"`）**两种都跑**。SQL 关系名按 `FROM/JOIN/INTO/UPDATE/USING/DELETE FROM` 后的标识符抽取，含可选 `public.` schema 前缀 |
| 对照真值 | ① `migrations/0001..0017` 声明对象；② 只读查询 `pg_class`（`public` schema 实际存在的 35 个关系） |
| 路径 | 全部绝对路径 |

**遗留对象命名踩坑（本库实锤）**：本库用户表真名是 **`users`**（0002 建 `"user"` → 0006 `ALTER TABLE public."user" RENAME TO users`，见 `migrations/0006_user_to_users.sql:75/127`）。SQL 里写裸名 `user` 会被解析为 `current_user` 而**静默不报错**；因此凡对保留字/带引号对象做断言必须加引号。本报告第 2 节的关系集合已按双口径给出。

---

## 1. 端点全量清单（口径：`app.<verb>(` 注册点）

**总数 51**：`GET` 25 / `POST` 24 / `DELETE` 2（无 PUT / PATCH）。处理函数均为 `index.ts` 内的**内联匿名箭头函数**（无具名 handler），故「处理函数名」列以**锚行号 + 内联**标注；「调用的 service 函数」列列出该 handler 体内实际调用的 `DatabaseService.*` / `auth.ts` / `db.ts` 导出符号（口径：对每个 handler 体做符号匹配，见 `backend-ts/.p4-artifacts/endpoint-index.tsv`）。

| # | 行号 | METHOD | path | 处理函数 | 调用的 src 函数 |
|--:|--:|---|---|---|---|
| 1 | 175 | GET | `/` | 内联 175 | —（纯内存） |
| 2 | 195 | GET | `/health` | 内联 195 | `db.ts:healthCheck` |
| 3 | 212 | GET | `/api/test/data` | 内联 212 | —（纯内存） |
| 4 | 223 | POST | `/api/auth/register` | 内联 223 | —（固定发 410） |
| 5 | 227 | POST | `/api/auth/challenge` | 内联 227 | `auth.ts:startWalletAuthChallenge` |
| 6 | 236 | POST | `/api/auth/verify` | 内联 236 | `auth.ts:consumeWalletAuthChallenge`,`createSessionToken`;`DS:findOrCreateUserByEvm,getUserAsset,upsertAsset` |
| 7 | 259 | POST | `/api/auth/login` | 内联 259 | 内部 `req.url` 改写 → `app._router.handle` 转发到 `/api/auth/verify` |
| 8 | 264 | GET | `/api/prize/all` | 内联 264 | `DS:listPrizes` |
| 9 | 276 | GET | `/api/task/all` | 内联 276 | `DS:listTasks` |
| 10 | 288 | GET | `/api/task/:tID` | 内联 288 | `DS:getTask` |
| 11 | 308 | GET | `/api/prize/:bID` | 内联 308 | `DS:getPrizeById` |
| 12 | 328 | GET | `/api/user` | 内联 328 | `requireActor`;`DS:getUserById/getUserByEvm,resolveAdminAccess,getUserAsset` |
| 13 | 341 | POST | `/api/user/profile` | 内联 341 | `requireActor`;`DS:updateUserProfile,getUserAsset` |
| 14 | 364 | GET | `/api/user/asset/:uID` | 内联 364 | `DS:getUserAsset,upsertAsset` |
| 15 | 379 | GET | `/api/home` | 内联 379 | `DS:listTasks,listPrizes,listClaimedPrizeIdsByUser,getUserAsset,upsertAsset` |
| 16 | 419 | GET | `/api/prize-item` | 内联 419 | `requireActor`;`DS:listPrizeItemsByUser` |
| 17 | 433 | GET | `/api/task-progress` | 内联 433 | `requireActor`;`DS:listTaskProgressByUser` |
| 18 | 447 | GET | `/api/task-progress/:jID` | 内联 447 | `DS:getTaskProgress` |
| 19 | 466 | POST | `/api/task-progress/:identifier/submit` | 内联 466 | `requireActor`;`DS:getTaskProgress,getTask,ensureTaskProgressForUserTask,submitTaskProgressInfo` |
| 20 | 504 | POST | `/api/task-progress/claim/:jID` | 内联 504 | `requireActor`;`DS:getTaskProgress,getUserAsset,upsertAsset,getTask,claimTaskProgress` |
| 21 | 556 | GET | `/api/shard` | 内联 556 | `requireActor`;`DS:listShardHoldingsByUser` |
| 22 | 570 | GET | `/api/shard/transfer` | 内联 570 | `requireActor`;`DS:listShardTransfersByUser` |
| 23 | 584 | POST | `/api/shard/redeem` | 内联 584 | `requireActor`;`DS:redeemPrizeItemFromShards` |
| 24 | 602 | POST | `/api/chest/:bID/open` | 内联 602 | `requireActor`;`DS:openFreeShardChest` |
| 25 | 620 | GET | `/api/order` | 内联 620 | `requireActor`;`DS:listOrdersByUser` |
| 26 | 634 | POST | `/api/order` | 内联 634 | `requireActor`;`DS:placeOrder` |
| 27 | 653 | DELETE | `/api/order` | 内联 653 | `requireActor`;`DS:cancelAllOrders` |
| 28 | 666 | DELETE | `/api/order/:oID` | 内联 666 | `requireActor`;`DS:cancelOrder` |
| 29 | 684 | GET | `/api/market/:bID/orderbook` | 内联 684 | `DS:listOrderBook` |
| 30 | 699 | GET | `/api/market/:bID/trades` | 内联 699 | `DS:listTradesByBrand` |
| 31 | 715 | GET | `/api/admin/me` | 内联 715 | `requireActor` |
| 32 | 721 | GET | `/api/admin/settings` | 内联 721 | `requireAdmin`;`DS:getSystemSettings` |
| 33 | 734 | POST | `/api/admin/settings` | 内联 734 | `requireAdmin`;`DS:saveSystemSettings` |
| 34 | 747 | POST | `/api/admin/settings/reset` | 内联 747 | `requireAdmin`;`DS:resetSystemSettings` |
| 35 | 760 | GET | `/api/admin/permissions` | 内联 760 | `requireAdmin`;`DS:listPermissionGroups,getAllUsers` |
| 36 | 776 | POST | `/api/admin/permissions/save` | 内联 776 | `requireAdmin`;`DS:savePermissionGroup` |
| 37 | 797 | POST | `/api/admin/permissions/delete` | 内联 797 | `requireAdmin`;`DS:deletePermissionGroup` |
| 38 | 818 | POST | `/api/admin/user/update` | 内联 818 | `requireAdmin`;`DS:updateUserAdminStatus` |
| 39 | 839 | POST | `/api/admin/task/create` | 内联 839 | `requireAdmin`;`DS:createTask` |
| 40 | 852 | POST | `/api/admin/task/update` | 内联 852 | `requireAdmin`;`DS:updateTask` |
| 41 | 873 | POST | `/api/admin/task/delete` | 内联 873 | `requireAdmin`;`DS:deleteTask` |
| 42 | 891 | POST | `/api/admin/prize/create` | 内联 891 | `requireAdmin`;`DS:createBrand` |
| 43 | 904 | POST | `/api/admin/prize/update` | 内联 904 | `requireAdmin`;`DS:updateBrand` |
| 44 | 925 | POST | `/api/admin/prize/delete` | 内联 925 | `requireAdmin`;`DS:deleteBrand` |
| 45 | 943 | GET | `/api/user/all` | 内联 943 | `requireAdmin`;`DS:getAllUsers` |
| 46 | 957 | GET | `/api/user/stats` | 内联 957 | `requireAdmin`;`DS:getUserStats` |
| 47 | 970 | GET | `/api/tasklist/pending-verification/count` | 内联 970 | `requireAdmin`;`DS:countPendingVerification` |
| 48 | 983 | GET | `/api/tasklist/pending-verification` | 内联 983 | `requireAdmin`;`DS:listPendingVerification` |
| 49 | 997 | POST | `/api/tasklist/:jID/verify` | 内联 997 | `requireAdmin`;`DS:getTaskProgress,getUserById,markTaskProgressChecked,getTask,rejectPendingTaskProgress` |
| 50 | 1053 | POST | `/api/admin/assets/init` | 内联 1053 | `DS:initializeAllAssets`（**注意：此端点无 requireAdmin 守卫**） |
| 51 | 1063 | POST | `/api/admin/points/adjust` | 内联 1063 | `requireAdmin`;`DS:adjustPoints` |

> 备注：`index.ts` 仅 import `./auth`、`./database`、`./db`（`src/index.ts:4-17`）。**`src/ledger.ts` 与 `src/commission.ts` 未被任何路由引用**（0 引用，见第 5 节双口径结论）。

---

## 2. 每端点触碰的关系名（双口径）+ 越界判定

**口径**：对每个 handler 调用的 `DatabaseService` 方法（含其调用的下层方法，如 `listPrizes→getBrandById`、`cancelAllOrders→listOrdersByUser/cancelOrder`）之 SQL 体内的关系引用做并集；**裸名口径**与**带引号口径**均已跑（`"users"` 会以裸名口径漏掉，故关系集合取二者并集）。完整逐端点机器可读表见 `backend-ts/.p4-artifacts/endpoint-relations-FIXED.tsv`。

**对照真值 A（库内实际存在的 `public` 关系，只读 `pg_class`）**：35 个 = 21 张表（`relkind='r'`）+ 1 视图（`v` `candle_view`）+ 13 序列（`S`）。21 张表：
`account, admin_permission, admin_role, admin_role_permission, admin_user_role, app_config, commission_policy, currency, currency_status_log, job, job_application, job_submission, ledger_entry, ledger_owner, listing, listing_order, market_order, market_trade, referral, schema_migration, users`（另 `candle_view` 视图）。
> `schema_migration`（单数）由 `scripts/migrate.ts` 建，`db.ts:252` 读它取 schema_version；**不在任何 migration 文件内**。

**对照真值 B（`migrations/0001..0017` 声明对象，见 `.p4-artifacts/declared-objects.txt`）**：20 张表 + `candle_view`。含 `0002` 的 `"user"`（后被 `0006` 改名 `users`）。

**引用到「非真值关系名」的集合（双口径并集，共 16 名）**，按影响**分两类**：

- **A. 真·基表 8 个（引用即 `42P01`，必须迁移）**：`asset, permission_group, prize, prize_item, shard, shard_transfer, task, task_progress` —— 在真值集合 A/B 中均不存在，且只读探针 `SELECT count(*)` 已逐一实锤 `42P01`（`backend-ts/.p4-artifacts/db-relations.json`）。
- **B. `WITH` 子句派生的 CTE 别名 8 个（无害，非 relation，不产生 `42P01`）**：`selected_prize, selected_prizes, selected_task, selected_tasks, shard_counts, transfer_counts, gift_counts, participant_counts` —— SQL 内联派生表别名，实证见 `database.ts:1018/1024/1041/1049`、`1168/1174/1196/1202`、`1435/1441/1458/1466`（`backend-ts/.p4-artifacts/cte-alias-check.txt`）。

> `user` 是伪阳性：源自 `database.ts:898` 英文串 `'Failed to update user login time'` 里的 `update user`，非 SQL 关系，已剔除。

| 行号 | METHOD | path | 命中 schema（在 0001..0017） | 引用到的非真值名（**加粗=A 类 42P01** / 未加粗=B 类 CTE 无害） |
|--:|---|---|---|---|
| 175 | GET | `/` | — | — |
| 195 | GET | `/health` | — | — |
| 212 | GET | `/api/test/data` | — | — |
| 223 | POST | `/api/auth/register` | — | — |
| 227 | POST | `/api/auth/challenge` | — | — |
| 236 | POST | `/api/auth/verify` | users | **asset** |
| 259 | POST | `/api/auth/login` | — | — |
| 264 | GET | `/api/prize/all` | — | gift_counts, **prize**, **prize_item**, selected_prize, **shard**, shard_counts, **shard_transfer**, transfer_counts |
| 276 | GET | `/api/task/all` | — | participant_counts, selected_tasks, **task**, **task_progress** |
| 288 | GET | `/api/task/:tID` | — | participant_counts, selected_task, **task**, **task_progress** |
| 308 | GET | `/api/prize/:bID` | — | gift_counts, **prize**, **prize_item**, selected_prize, **shard**, shard_counts, **shard_transfer**, transfer_counts |
| 328 | GET | `/api/user` | — | — |
| 341 | POST | `/api/user/profile` | users | — |
| 364 | GET | `/api/user/asset/:uID` | — | **asset** |
| 379 | GET | `/api/home` | — | **asset**, gift_counts, participant_counts, **prize**, **prize_item**, selected_prize, selected_tasks, **shard**, shard_counts, **shard_transfer**, **task**, **task_progress**, transfer_counts |
| 419 | GET | `/api/prize-item` | — | **prize_item** |
| 433 | GET | `/api/task-progress` | — | **task_progress** |
| 447 | GET | `/api/task-progress/:jID` | — | **task_progress** |
| 466 | POST | `/api/task-progress/:identifier/submit` | — | participant_counts, selected_task, **task**, **task_progress** |
| 504 | POST | `/api/task-progress/claim/:jID` | — | **asset**, participant_counts, selected_task, **task**, **task_progress** |
| 556 | GET | `/api/shard` | — | **shard** |
| 570 | GET | `/api/shard/transfer` | — | **shard_transfer** |
| 584 | POST | `/api/shard/redeem` | — | **prize_item** |
| 602 | POST | `/api/chest/:bID/open` | — | **shard**, **shard_transfer** |
| 620 | GET | `/api/order` | market_order | — |
| 634 | POST | `/api/order` | market_order | — |
| 653 | DELETE | `/api/order` | market_order | — |
| 666 | DELETE | `/api/order/:oID` | market_order | — |
| 684 | GET | `/api/market/:bID/orderbook` | market_order | — |
| 699 | GET | `/api/market/:bID/trades` | market_trade | — |
| 715 | GET | `/api/admin/me` | — | — |
| 721 | GET | `/api/admin/settings` | app_config | — |
| 734 | POST | `/api/admin/settings` | app_config | — |
| 747 | POST | `/api/admin/settings/reset` | app_config | — |
| 760 | GET | `/api/admin/permissions` | users | **permission_group** |
| 776 | POST | `/api/admin/permissions/save` | — | **permission_group** |
| 797 | POST | `/api/admin/permissions/delete` | — | **permission_group** |
| 818 | POST | `/api/admin/user/update` | users | — |
| 839 | POST | `/api/admin/task/create` | — | **task** |
| 852 | POST | `/api/admin/task/update` | — | **task** |
| 873 | POST | `/api/admin/task/delete` | — | **task** |
| 891 | POST | `/api/admin/prize/create` | — | **prize**, **prize_item** |
| 904 | POST | `/api/admin/prize/update` | — | **prize**, **prize_item** |
| 925 | POST | `/api/admin/prize/delete` | market_order,market_trade | **prize**, **prize_item**, **shard** |
| 943 | GET | `/api/user/all` | users | — |
| 957 | GET | `/api/user/stats` | users | **asset** |
| 970 | GET | `/api/tasklist/pending-verification/count` | users | **task_progress** |
| 983 | GET | `/api/tasklist/pending-verification` | users | **task_progress** |
| 997 | POST | `/api/tasklist/:jID/verify` | users | participant_counts, selected_task, **task**, **task_progress** |
| 1053 | POST | `/api/admin/assets/init` | users | **asset** |
| 1063 | POST | `/api/admin/points/adjust` | — | **asset** |

**解读**：**51 个端点中 31 个**至少引用一个 **A 类真·基表**（口径：端点关系并集 ∩ A 类 ≠ ∅）⇒ 这些端点在数据落库后必然 `500`，除非改用新 schema。B 类 CTE 别名不构成故障（它们被同一查询内联替换）。当前**只有** `market_order` / `market_trade` / `app_config` / `users` 四类新 schema 关系被路由引用（`users` 走的是**旧字段名 `uID/EVM/bio/is_admin`**，字段能否对上 `users` 真实列 = §6 `NOT_MEASURED`）。其余新表（`job` / `job_application` / `job_submission` / `listing` / `listing_order` / `admin_role*` / `currency_status_log`）**0 路由引用**。

---

## 3. 现状探活（只读 HTTP GET）

**口径**：对 25 个 `GET` 端点各发 1 次 `curl`（`--max-time 20`，无 Authorization 头），记录 `status` + 响应体前 200 字符；`POST`/`DELETE`（26 个）**只登记不调用**。原始读数见 `backend-ts/.p4-artifacts/http-get-sweep.txt`。`/health` 单独记录。

| # | METHOD | path | status | 响应体前 200 字符 |
|--:|---|---|--:|---|
| GET / | 200 | `{"success":true,"message":"Backend ready","data":{"status":"ok","message":"Seafood TypeScript Backend","timestamp":"2026-09-29T05:11:57.465Z","endpoints":{"health":"/health","authChallenge":"/api/auth` |
| GET /health | 200 | `{"ok":true,"db_version":"PostgreSQL 18.6 (6569466) on aarch64-unknown-linux-gnu, compiled by gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, 64-bit","schema_version":"0017","time":"2026-09-29T05:11:58.60` |
| GET /api/test/data | 200 | `{"success":true,"message":"OK","data":{"status":"ok","message":"TypeScript backend is running","timestamp":"2026-09-29T05:11:58.618Z"}}` |
| GET /api/prize/all | 500 | `{"success":false,"message":"Failed to load prizes","error":"Failed to load prizes"}` |
| GET /api/task/all | 500 | `{"success":false,"message":"Failed to load tasks","error":"Failed to load tasks"}` |
| GET /api/task/1 | 500 | `{"success":false,"message":"Failed to load task","error":"Failed to load task"}` |
| GET /api/prize/1 | 500 | `{"success":false,"message":"Failed to load prize","error":"Failed to load prize"}` |
| GET /api/user | 401 | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| GET /api/user/asset/1 | 500 | `{"success":false,"message":"Internal server error","error":"Internal server error"}` |
| GET /api/home | 500 | `{"success":false,"message":"Failed to load home payload","error":"Failed to load home payload"}` |
| GET /api/prize-item | 401 | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| GET /api/task-progress | 401 | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| GET /api/task-progress/1 | 500 | `{"success":false,"message":"Failed to load task progress","error":"Failed to load task progress"}` |
| GET /api/shard | 401 | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| GET /api/shard/transfer | 401 | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| GET /api/order | 401 | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| GET /api/market/1/orderbook | 500 | `{"success":false,"message":"Failed to load order book","error":"Failed to load order book"}` |
| GET /api/market/1/trades | 500 | `{"success":false,"message":"Failed to load market trades","error":"Failed to load market trades"}` |
| GET /api/admin/me | 401 | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| GET /api/admin/settings | 401 | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| GET /api/admin/permissions | 401 | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| GET /api/user/all | 401 | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| GET /api/user/stats | 401 | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| GET /api/tasklist/pending-verification/count | 401 | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| GET /api/tasklist/pending-verification | 401 | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |

**汇总**：`200` × 3（`/`、`/health`、`/api/test/data`）；`500` × 9（`/api/prize/all`、`/api/task/all`、`/api/task/1`、`/api/prize/1`、`/api/user/asset/1`、`/api/home`、`/api/task-progress/1`、`/api/market/1/orderbook`、`/api/market/1/trades`）；`401` × 13（需 Authorization，未带 token ⇒ 未触库）。**实测到的 500 全部是越界关系触发**（如 `/api/home → listTasks → relation "task" 不存在`）。`/health` = `200`，`db_version=PostgreSQL 18.6`，`schema_version=0017`。

**未测（NOT_MEASURED）**：26 个 `POST`/`DELETE` 端点一律未调用（含 `/api/auth/verify`、`/api/order`(POST/DELETE)、`/api/admin/*` 全部写端点）。⇒ 其**运行期** status 为 `NOT_MEASURED`；本报告对其只有**静态**（代码/关系）结论。
**旁注（诚实披露）**：`GET /api/user/asset/:uID`（364 行）名义是 GET，但体内 `getUserAsset || upsertAsset` 含**潜在写回退**；本次调用因 `getUserAsset` 先抛 `42P01`（relation `asset` 不存在）而短路，**未发生任何写**（表 `asset` 根本不存在）。此点属「GET 含潜在写路径」，已记录。

---

## 4. 遗留 → 新 schema 映射表

**数据来源**：新表列名取自只读 `information_schema.columns`（见 `backend-ts/.p4-artifacts/new-table-columns.txt`）；新表建表位置取自 `migrations/0013..0017`。

### 4.1 真·基表（引用即 42P01，需迁移）

| 旧关系 | 承载业务（原功能） | 建议新关系 | 置信度 | 依据（建表文件:行 / 字段对比） |
|---|---|---|---|---|
| `task` | 平台悬赏任务（有 `points` 奖励、`tID` 主键） | `job`（招工） | **确定** | `0013_job.sql:79 CREATE TABLE public.job`；列 `job_id, employer_uid, worker_uid, cid, reward, title, description, status, escrow_txid, settle_txid`。`task.tID↔job.job_id`、`task.points↔job.reward`（用户需求：招工信息对应一定数值平台积分） |
| `task_progress` | 用户对某任务的进度（`uID,tID,info_input,time_checked,time_claimed`） | `job_application` + `job_submission` | **推断**（拆表） | `0014_job_flow.sql:79 job_application(application_id, job_id, worker_uid, status)` + `:115 job_submission(submission_id, job_id, worker_uid, deliverable, review_status, reviewed_by, reviewed_at, review_memo)`。旧单表被拆为「申请状态」+「提交物」+「审核」三段 |
| `prize` | 平台发行的品牌奖品（`bID, price, 时长/库存`） | `listing`（商品） | **推断**（语义漂移） | `0015_listing.sql:115 listing(listing_id, seller_uid, cid, price, stock, title, description, media_urls, status)`。旧 prize 无 seller（平台发行），新 listing 有 `seller_uid`（用户标价售出）⇒ 语义部分重合 |
| `prize_item` | 用户已持有的奖品实例（`uID,bID,status`） | `listing_order` | **推断** | `0015_listing.sql:153 listing_order(order_id, listing_id, buyer_uid, seller_uid, cid, price, quantity, status, pay_txid)`。旧 prize_item ≈ 新购买/持有记录 |
| `shard` | 用户持有的「品牌碎片」持仓（`uID,bID,volume`） | **无对应**（持仓侧） | **无对应** | 碎片概念被「积分交易所」取代：持仓由账本 `account(uid,cid,balance,frozen)`（`0001_ledger_core.sql:41`）承载；「自定义积分」由 `currency`（`0001:13`）承载。基表 `shard` 不再需要（详见 4.3） |
| `shard_transfer` | 碎片转让/发放流水（`bID, volume, reason='free_chest'`） | `market_trade`（部分） | **推断（部分）** | `0016_market.sql:159 market_trade(trade_id, base_cid, quote_cid, price, amount, buy_order_id, sell_order_id, taker_uid, fee)`。「平台免费发碎片(reason=free_chest)」这半语义**无对应**（新模型无「平台免费发积分」） |
| `asset` | 用户积分余额（`uID, points`） | `account`（cid=系统币 `$`） | **推断**（写路径须走账本） | `0001_ledger_core.sql:41 account(uid, cid, balance, frozen, version)`；`$`=cid 1（`ledger.ts:140 SYSTEM_CURRENCY_CID=1n`）。`asset.points ↔ account.balance WHERE cid=1`；**读**可直映射，**写**必须走 `ledger_post_event`（`0004:437`） |
| `permission_group` | 扁平「权限组 + 成员」（`id,name,permissions[],user_ids[]`） | `admin_role` + `admin_role_permission` + `admin_user_role` | **推断** | `0017_platform_config.sql:93 admin_role` / `:112 admin_role_permission` / `:123 admin_user_role`。旧扁平结构被拆为 role/permission 关联三表 |

### 4.2 CTE 别名（**不是** relation，不产生 42P01，已被同一查询内联替换）

`selected_prize`、`selected_prizes`、`shard_counts`、`transfer_counts`、`gift_counts`、`participant_counts`、`selected_task`、`selected_tasks` —— 全部是 SQL `WITH … AS (…)` 派生表别名（实证：`database.ts:1018` `WITH selected_prizes AS (`、`:1029` `gift_counts AS (`、`:1048` `shard_counts AS (`、`:1059` `transfer_counts AS (`；同型见 `listTasks`/`getTask`，见 `.p4-artifacts/cte-alias-check.txt`）。**「无对应」**：它们随宿主查询一起被新查询取代，无需迁移为表。

### 4.3 硬边界提醒（不硬凑）

`shard` 的「持仓」语义在新模型里**没有一张一一对应的表**——不要为了「凑映射」新建 `shard` 表；正确做法是让持仓体现在 `account`（系统币）+ `currency`（自定义积分）上，由账本事件驱动。这属 §5 第③档「需要新能力」。

---

## 5. 切分建议

### 5.1 四档分类

**① 立刻能修（纯改名 / 换表 / 纯下线）**
- `/api/auth/register`(223)、`/api/auth/login`(259)：纯下线（410 已废 / 黑式转发）。
- 下线组：`/api/shard`(556)、`/api/shard/transfer`(570)、`/api/shard/redeem`(584)、`/api/chest/:bID/open`(602)、`/api/prize-item`(419) —— 端点删除即可（见 5.3）。
- `/api/user`(328) 与 `/api/home`(379) 的 `points` **读**：`getUserAsset`(918) 改查 `account`（cid=1）——纯换表读。

**② 需要新写查询（新 schema 已有表但字段映射需设计）**
- 招工读：`listTasks`(1165)/`getTask`(1193) → `job`；端点 `/api/task/all`(276)、`/api/task/:tID`(288)、`/api/admin/task/{create,update,delete}`(839/852/873)。
- 进度/审核读：`listTaskProgressByUser`(1245)/`getTaskProgress`(1233)/`listPendingVerification`(1334) → `job_application`+`job_submission`；端点 `/api/task-progress*`(433/447/466/504)、`/api/tasklist/*`(970/983/997)。
- 商品读：`listBrands`(1015)/`getBrandById`(1432)/`listPrizes`(1502) → `listing`(+`listing_order`)；端点 `/api/prize/all`(264)、`/api/prize/:bID`(308)、`/api/admin/prize/*`(891/904/925)。
- 交易所读：`listOrderBook`(2578)/`listTradesByBrand`(2600)/`listOrdersByUser`(2388) 的**列名**（`bID/volume` → `base_cid/quote_cid/amount`）重写；端点 `/api/order`(620)、`/api/market/*`(684/699)。
- 权限：`listPermissionGroups`(1537)/`savePermissionGroup`(1582)/`deletePermissionGroup`(1654) → `admin_role*`；端点 `/api/admin/permissions*`(760/776/797)。
- 设置：`getSystemSettings`(1683)/`saveSystemSettings`(1695) 对照 `app_config` 键名核对；端点 `/api/admin/settings*`(721/734/747)。

**③ 需要新能力（账本事件 / 返佣 / 保证金 / 上市，须走 `ledger_post_event`、`job_post_event`、`listing_post_event`、`market_post_event` 等编排）**
- 任何**余额变动**：`/api/task-progress/claim/:jID`(504，发奖)、`/api/admin/points/adjust`(1063)、`/api/admin/assets/init`(1053)、`/api/auth/verify`(236 首次发币)。现在这些走 `upsertAsset`(934)/`adjustPoints`(985) 直改 `asset` —— 新架构必须改为账本事件。
- **邀请返佣（10 级）**：`src/commission.ts` 的 `getReferralChain`(291)/`planJobSettlement`(607)/`buildSettleEvent`(698) + `referral_bind`(`0007:241`)。**当前 0 路由引用**。
- **上市保证金 / 成交平台费**：`currency`(`0001:13`)/`CURRENCY_TRANSITIONS`(`ledger.ts:614`)/`market_post_event`(`0016:393`)。**0 路由引用**。
- **商品下单支付**：`listing_post_event`(`0015:449`)。**0 路由引用**（`listing`/`listing_order` 两个口径在 `src/` 均 0 命中）。

**④ 建议直接下线（jinli 遗留且新需求不要）**
- 碎片/宝箱四件套：`/api/shard`(556)、`/api/shard/transfer`(570)、`/api/shard/redeem`(584)、`/api/chest/:bID/open`(602)。
- `/api/prize-item`(419)、`/api/auth/register`(223)、`/api/auth/login`(259)。
- 对应 `database.ts` 死代码：`listShardHoldingsByUser`(2083)、`listShardTransfersByUser`(2175)、`openFreeShardChest`(2615)、`redeemPrizeItemFromShards`(2665)、`createShardLedgerEntry`(2121)、`recordShardTransfer`(2133)。

### 5.2 关键前置事实（影响切分）
- `src/index.ts` 只 import `./auth`、`./database`、`./db`（`index.ts:4-17`）⇒ **`src/ledger.ts`、`src/commission.ts` 与全部新业务表（job/listing/market/admin_*）目前 0 路由引用**（双口径：裸名 + 带引号，`index.ts` 内 `ledger|commission|job|listing|market_order|market_trade` 皆 0 命中）。第③档本质是「把 P1/P2 账本内核与新表接到路由」。
- `market_order`/`market_trade` 虽在 `database.ts` 被引用（9/3 处），但其**列名仍是旧模型**（`bID/volume/volume_total/volume_filled`），与新表列（`base_cid/quote_cid/amount/amount_filled`）**不匹配** ⇒ 即使表存在，写路径仍会报列错（42703），非 42P01。

### 5.3 建议的三批实施顺序

| 批次 | 内容 | 理由 | 风险 |
|---|---|---|---|
| **批 1 · 止血** | 下线④档 7 个端点；`asset` 读侧改 `account`（`/api/user`、`/api/home`） | 以最小改动让首屏/home 不再 500；删掉与新需求冲突的碎片 API | **前端**`frontend/` 若仍调 `/api/shard*`、`/api/prize-item` 会 404 → 须同步前端（本单未盘前端，`NOT_MEASURED`） |
| **批 2 · 业务读+写** | 招工(job/job_application/job_submission)、商品(listing/listing_order)、权限(admin_role*)、设置(app_config) 全链路的查询重写 | 新 schema 表已就绪，纯代码映射；恢复核心 CRUD | 字段映射设计错误 ⇒ 静默语义错（如 cid 选择）；需与 `users` 实际列核对 |
| **批 3 · 账本接线** | 所有余额变动改走 `ledger_post_event`；接入 `commission.ts` 返佣；上市保证金/平台费/成交费 | 涉及资金守恒与触发器，必须在数据落库前完成 | 最高风险：账本不变量（Σ=0、幂等、重放）；需 P1/P2 套件回归（**本单禁止跑**） |

---

## 6. NOT_MEASURED 清单 + 探针自曝

### 6.1 NOT_MEASURED（未测项，禁填 0/空数组）
- **26 个 POST/DELETE 端点的运行期 HTTP status** = `NOT_MEASURED`（只登记不调用）。本报告对其仅有**静态**（代码/关系）结论，**不是实测**。
- **`users` 表真实列名 vs `database.ts` 期望字段**（`uID/EVM/bio/is_admin`）：字段级**未核对** = `NOT_MEASURED`。
- **`market_order`/`market_trade` 新列名与 `database.ts:placeOrder`(2409) 旧列名的逐字段 diff**：仅做到表名级 = `NOT_MEASURED`。
- **前端 `frontend/` 对各端点的实际调用**：未盘 = `NOT_MEASURED`。
- **新表触发器/约束对新写路径的实际拦截行为**：未测 = `NOT_MEASURED`。

### 6.2 探针自曝（本轮探针的口径缺陷与更正）
1. `schema_version` 首轮用了错表名 `schema_migrations`（复数）⇒ 返回 `NO_TABLE`；`db.ts:252` 真名是 `schema_migration`（单数）。正确值改取自 `/health` = `0017`。
2. 首轮行数探针中 `prize`/`prize_item` 因 TLS 瞬时断连返回 `Client network socket disconnected…`（**非** 42P01）；复跑后得 `42P01`，已更正。
3. 首轮「裸名口径」正则**不匹配带引号标识符**，把 `users`（`"users"`）漏报为 0；加带引号口径后命中 9 处（均在 `database.ts`）。
4. 关系抽取正则会把**英文串/CTE 别名**误判为关系名：`user`（源自 `database.ts:898` 字符串 `'Failed to update user login time'` 中的 `update user`）、`selected_prizes`/`shard_counts` 等（`WITH` 子句别名）——已人工剔除/更正，见 §2 更正与 §4.2。

---

## 声明：本单未改任何代码/库

本单为**纯只读侦察**：未新增/修改/删除 `backend-ts/src/**` 任何文件，未改 `migrations/**`，未改任何配置；对库**零写**（全程仅 `SELECT` 与 `pg_class`/`information_schema` 目录读）；未对任何 `POST/PUT/PATCH/DELETE` 端点发请求；未重启/停任何服务；未 `git add/commit/push`；未 `npm install`；未用 `pkill -f`/`killall`；未跑任何写库套件。新增文件仅：本报告 + `backend-ts/.p4-artifacts/**` + `backend-ts/scripts/p4y-db-probe.ts`（只读探针）。

---

*落盘完成：2026-09-29T13:25:27+0800。本报告含 8 段（§0 元信息/口径、§1 端点清单 51、§2 关系双口径+越界、§3 探活、§4 映射、§5 切分、§6 NOT_MEASURED、声明）。*
