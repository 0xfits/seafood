# P3 第一步 · 摘除运行时懒 DDL（ensureSupportSchema）与 9 张空表回收

- **执行**：Kong（实现者）
- **run**：`20260928-084547` · 2026-09-28 08:45–08:52 CST
- **仓库**：`/Users/kevin/bistro/seafood`，后端 `backend-ts/`（TypeScript + Neon PostgreSQL 18.6）
- **文档骨架先落、后回填**：本文件在改码前先建（章节固定），所有读数在动手后回填；机读读数见 `backend-ts/.p3s1-artifacts/p3s1-20260928-084547.json`
- **未 commit / 未 push**（按约定由 Zang 执行）

## 0. 开工锚点

| 项 | 值 |
|---|---|
| `git log --oneline -1`（开工） | `dbccd89 fix(router): 拆显式语言壳，修中文子页被可选语言段吞掉` |
| `git status --porcelain`（开工） | `?? docs/audit/`、`?? docs/qa/45c27d8-lang-path.md`、`?? docs/qa/lang-prefix-normalize.md`、`?? docs/qa/lang-shell-regression.md` |
| 收工时的 HEAD（旁证） | `415db62 master-plan v0.34: 5.29 P3 数据层重写立项 + 路由审计结论落位` —— **另一会话**在我作业期间提交的，非本单产物 |
| 本次改动面 | `M backend-ts/src/database.ts`（**302 行删除、0 行新增**），其余为新增的探针脚本与读数文件 |

## 1. 静态定位（定义 + 全部调用点）

`grep -rn 'ensureSupportSchema' backend-ts/src/`：

- **定义**：`backend-ts/src/database.ts:269`（`const ensureSupportSchema = async () => {`，IIFE + 记忆化 promise）
- **调用点：34 处**（上下文给的是「12 处」，实测 34 处，且覆盖 **34 个互不重复**的服务方法 ⇒ 12 是截断清单，本单以实测为准）
- **连带孤儿符号**：`database.ts:57 let supportSchemaPromise: Promise<void> | null = null;` —— 只被定义体内部引用，随定义一起删

### 1.1 调用点 → 服务方法（行号为改前行号）

| 行 | 方法 | 读/写 | | 行 | 方法 | 读/写 |
|---|---|---|---|---|---|---|
| 1011 | `getNextUserId` | 读 | | 2404 | `listShardHoldingsByUser` | 读 |
| 1142 | `getUserById` | 读 | | 2432 | `getUserShardBalance` | 读 |
| 1155 | `getUserByEvm` | 读 | | 2444 | `createShardLedgerEntry` | 写 |
| 1169 | `createUserByEvm` | 写 | | 2465 | `recordShardTransfer` | 写 |
| 1192 | `findOrCreateUserByEvm` | 写 | | 2500 | `listShardTransfersByUser` | 读 |
| 1208 | `updateUserProfile` | 写 | | 2523 | `getMarketOrderById` | 读 |
| 1819 | `listPersistedPermissionGroups` | 读 | | 2541 | `updateMarketOrderFill` | 写 |
| 1898 | `savePermissionGroup` | 写 | | 2564 | `findMatchingOrder` | 读 |
| 1965 | `deletePermissionGroup` | 写 | | 2621 | `createMarketTrade` | 写 |
| 1995 | `getSystemSettings` | 读 | | 2718 | `listOrdersByUser` | 读 |
| 2008 | `saveSystemSettings` | 写 | | 2746 | `placeOrder` | 写 |
| 2033 | `updateUserAdminStatus` | 写 | | 2838 | `cancelOrder` | 写 |
| 2102 | `createBrand` | 写 | | 2911 | `listOrderBook` | 读 |
| 2195 | `updateBrand` | 写 | | 2934 | `listTradesByBrand` | 读 |
| 2251 | `deleteBrand` | 写 | | 2956 | `openFreeShardChest` | 写 |
| 2309 | `createTask` | 写 | | 3001 | `redeemPrizeItemFromShards` | 写 |
| 2363 | `updateTask` | 写 | | | | |
| 2389 | `deleteTask` | 写 | | | | |

**其中 12 个是纯读方法**（首列表格带「读」者 + `listOrderBook`/`listTradesByBrand`）—— 这正是「读请求产生写副作用」的直接病灶：读路径上挂了一个 `CREATE TABLE`。

### 1.2 调用点 → 路由（只读取自 `docs/audit/p3-route-inventory.json`，未改动该文件）

上述 34 个方法的 `service_methods` 与 inventory 中 **39 条路由**相交。代表性映射（读路由）：

- `GET /api/market/:bID/orderbook` → `listOrderBook`
- `GET /api/market/:bID/trades` → `listTradesByBrand`
- `GET /api/home`、`GET /api/user`、`GET /api/admin/me` → `getUserById` / `getUserByEvm` / `listPersistedPermissionGroups`
- `GET /api/shard` → `listShardHoldingsByUser`；`GET /api/shard/transfer` → `listShardTransfersByUser`
- `GET /api/order` → `listOrdersByUser`；`GET /api/admin/settings` → `getSystemSettings`

写路由（POST/DELETE）映射见机读读数同一 run 的 `call_sites_by_method`。

## 2. 摘除（改码）

**只改一个文件**：`backend-ts/src/database.ts`，净变化 **−302 / +0**：

1. 删除定义体 `269–534`（连尾部空行 535 一并删，不留空档）；
2. 删除孤儿变量 `:57 let supportSchemaPromise`；
3. 删除 **全部 34 处** `await ensureSupportSchema();` 调用行。

**没有留任何残渣**（仓内 AGENTS.md 禁死代码）：

| 检查 | 结果 |
|---|---|
| `ensureSupportSchema` 在 `src/` 中出现次数 | **0** |
| `supportSchemaPromise` 在 `src/` 中出现次数 | **0** |
| 是否留 no-op 空函数 | 否 |
| 是否留注释掉的死代码 | 否 |
| 是否产出空方法体（删调用后方法变空） | **0 个**（逐个核对 `{` 后紧跟 `}` 的模式：无命中） |
| 新增 TODO/FIXME/no-op 标记 | 0 |
| `npx tsc --noEmit -p tsconfig.json` | **exit 0** |

**刻意不做的事**：没有给任何读方法加兜底/建表补偿。调用点后面的查询该失败就失败 —— 只如实登记状态（§4）。`ensureLegacyTableNames`（`database.ts:240`，另有 4 处调用 `:1320/:1471/:1500/:1740`）**超出本单范围，原样保留**，仅登记。

## 3. 重载与 DROP

### 3.1 重载（唯一合法方式）

- `grep -n seafood /Users/kevin/bistro/ctrl/index.js` ⇒ `seafood-api`（`port: 5788`, `cwd: backend-ts`）
- `curl -X POST http://127.0.0.1:5555/api/restart -H 'Content-Type: application/json' -d '{"sid":"seafood-api"}'` ⇒ 面板子路由、零停机
- **pid：45770 → 57706（面板回报）/ 57720（5788 实际 LISTEN）**
- 顺带确认：`GET /health` → 200，`db_version=PostgreSQL 18.6`，`schema_version=0012`
- 未做、且被禁：`pm2 restart bistro-ctrl`、`--update-env`、`pkill -f`、`killall`、前端 5787 启停 —— **全部未执行**

### 3.2 DROP 前的必过闸：逐张断言 0 行

改码 + 重载生效**之后**才查（顺序不可颠倒）：

| 表 | 行数 | 表 | 行数 |
|---|---|---|---|
| `app_config` | 0 | `market_order` | 0 |
| `permission_group` | 0 | `market_trade` | 0 |
| `prize` | 0 | `shard` | 0 |
| `prize_item` | 0 | `shard_transfer` | 0 |
| `task_progress` | 0 | | |

**9 张全 0 行，非空清单为空 ⇒ 闸门通过**（脚本内置硬闸：任一张非 0 立即 abort、exit 3、不执行 DROP）。DROP 用 `DROP TABLE IF EXISTS "<t>"`，**不加 CASCADE**（有依赖对象就报错，绝不静默连带删除）。DROP 零错误。

顺带一条取证：这 9 张表**只带了 pkey 索引**，懒 DDL 里那些 `ALTER TABLE`/`CREATE INDEX` 段落**从来没跑到** —— 函数在 `UPDATE "users" SET "uID"` （真列 `uid`，引号大写 ⇒ 列不存在）处即抛错，与「永远完不完的自愈」判断一致。

## 4. 验证「读不再写」（本单核心交付）

重载后，对**同一批 9 条 GET** 打了两轮（`DROP` 之前打了改前基线一轮）；**只发 GET**：

| 路由 | 改前 | DROP 后① | DROP 后② |
|---|---|---|---|
| `GET /api/market/1/orderbook` | 500 | 500 | 500 |
| `GET /api/market/1/trades` | 500 | 500 | 500 |
| `GET /api/prize/all` | 500 | 500 | 500 |
| `GET /api/task/all` | 500 | 500 | 500 |
| `GET /api/task/1` | 500 | 500 | 500 |
| `GET /api/prize/1` | 500 | 500 | 500 |
| `GET /api/user/asset/1` | 500 | 500 | 500 |
| `GET /api/home` | 500 | 500 | 500 |
| `GET /api/task-progress/1` | 500 | 500 | 500 |
| **直方图** | `{500:9}` | `{500:9}` | `{500:9}` |

传输层 0 错误、0 重试（本窗口**未**出现已知 TLS 抖动）。

**这些 500 不影响本单验收**：根因是 `"uID"`/`"EVM"` 大写引号列名模型 vs 真列 `uid`/`evm`，属 **P3 数据层重写（D18）**范围；本单只负责「读不再写」。

### 三条断言（真值）

| # | 断言 | 读数 | 真值 |
|---|---|---|---|
| ① | 表数**前后不变且 == 8**，9 张懒表在 GET 后**未重现** | 打 GET 前 8 → 打完 8；表集 == `account, commission_policy, currency, ledger_entry, ledger_owner, referral, schema_migration, users`；`lazy_tables_present = []` | **TRUE** |
| ② | `grep -rc ensureSupportSchema backend-ts/src/` == 0 | 8 个文件计数全 0，合计 0；`grep -rl` 命中文件数 0 | **TRUE** |
| ③ | `schema_version` 仍 `0012`、`schema_migration` 仍 12 行 | `0012` / 12 行；`users` 411 行未变 | **TRUE** |

改前/改后表清单与计数：**17 → 8**（索引 33 → 24，差额即 9 张表的 pkey）。库已回到 **== `0012` 迁移的干净状态**。

## 5. 交付物与边界

**产物**

- 本文 `docs/audit/p3-step1-ddl-removal.md`
- 机读读数 `backend-ts/.p3s1-artifacts/p3s1-20260928-084547.json`（run-tagged，未覆盖任何既有文件）
  - 分轮读数：`p3s1-drop-*.json`、`p3s1-getmatrix-pre/post/post2-20260928-084547.json`
- 探针脚本（新增，复用仓内 p*-探针惯例）：`backend-ts/scripts/p3s1-00-db-state.ts`、`p3s1-01-get-matrix.ts`、`p3s1-02-drop-lazy-tables.ts`

**未碰**：`frontend/**`、`migrations/**`、`docs/ledger.spec.md`、`docs/commission.spec.md`、`docs/seafood.master-plan.md`、`docs/audit/p3-route-inventory.*`（只读引用）

**明确未验证 / 留给后续**

1. 写路由（POST/DELETE）未打 —— 本单只授权 GET。
2. `GET /api/user/asset/1` 的 `asset` 表仍不存在（`table_missing`），属 P3 数据层重写。
3. `ensureLegacyTableNames` 仍在（会做 `gift→prize_item` / `journey→task_progress` 的条件 RENAME）—— 本单未动未验，仅登记，交 P3 决定去留。
4. 被摘掉懒 DDL 的服务方法路径**仍 500** —— 只证明了「读不再写」，**未**证明这些路由可用（D18 范围）。
5. 未 commit / 未 push。
6. 旁证：作业期间另一会话把 HEAD 推到 `415db62`（未影响本单差集）。
