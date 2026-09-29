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

> **B1-a 回填（本片口径，重派单 run tag `b1a-20260929T135443`）** —— `curl --max-time 20`、无 `Authorization` 头、status 取自 `%{http_code}`（不取自管道）。原始读数：`backend-ts/.p4-artifacts/b1a-20260929T135443/pre/get-status.txt`（改动前）、`.../post/get-status.txt`（改动后；重启由面板 `POST /api/restart {"sid":"seafood-api"}` 完成，重启前旧 pid 84578 → 重启后新 pid 2095，`/health` 200 才开测）。

| 端点 | 改动前 | 改动后 | 说明 |
|---|---|---|---|
| `/api/home` | 500 | 500 | 根因非 `asset`：`listTasks`→`task`/`task_progress`、`listPrizes`→`prize`/`prize_item`/`shard`/`shard_transfer` 全为 `42P01` ⇒ **属第 2/3 片**（详见 §6） |
| `/api/prize/all` | 500 | 500 | 同上（`listPrizes`=`listBrands`→`prize` 等）⇒ **属第 2/3 片** |
| `/api/task/all` | 500 | 500 | 同上（`listTasks`→`task`/`task_progress`）⇒ **属第 2/3 片** |
| `/api/user` | 401 | 401 | 无 Authorization ⇒ 401（非 500）；其 `asset` 读侧（`buildUserPayload`，index.ts:162-168）本就是 `.catch(()=>null)` 纯读，本片未改语义 |
| `/api/user/asset/:uID`（uID=1） | 500 | **200** | **本片修复**：`getUserAsset` 改读 `account`（cid=1）+ 移除 `upsertAsset` 隐式写回退（纯读） |
| `/` | 200 | 200 | 回归（重启前后均 200） |
| `/health` | 200 | 200 | 回归 + 重启 READY 探活判据 |

响应体抽查（`post/asset-1-body.json`）：`{"success":true,"message":"OK","data":{"index_id":0,"uID":1,"points":0,"lucks":0,"time_update":0}}` —— **键集完整（空态零值）**。

> **B1-b 回填（本片口径，run tag `b1b-20260929T143421`）** —— 本片测的 10 路径（无 `Authorization`，`%{http_code}`）改动前/后：`/api/task/all` 500→**200**（空态 `[]`）、`/api/task/1` 500→**200**（21 键空态 `emptyTask`）、`/api/task-progress/1` 500→**404**（原 miss 语义保留，非 500）、`/api/task-progress` 401→401、`/api/tasklist/pending-verification` 401→401、`/api/tasklist/pending-verification/count` 401→401（三条均需鉴权、非 500）、`/api/home` 500→**500（仍 500：`listPrizes`→`prize`/`prize_item`/`shard`/`shard_transfer` 42P01，属第 3 片）**、`/` 200→200、`/health` 200→200、`/api/user/asset/1` 200→200（B1-a 无回归）。原始读数：`backend-ts/.p4-artifacts/b1b-20260929T143421/{pre,post}/get-status.txt`、响应体 `post/bodies/*.json`（重启由面板 `POST /api/restart {"sid":"seafood-api"}` 完成，新 pid 52171，`/health` 200 后开测）。

## 2. A 类 8 名在 `src/**` 归零证明（双口径）

> **STATUS: 待回填（§2）**

> **B1-a 备注**：§2 不属本片范围（`asset` 读侧换表），未做、未回填。本片仅产出 `src/database.ts` 的 SQL 关系名清单：`post/sql-relations.txt`（grep 口径 `FROM asset|FROM account|FROM task|FROM prize|FROM shard|FROM task_progress|FROM "users"`）。

## 3. 字段集合契约（零依赖内存夹具，不写库）

> **STATUS: 待回填（§3）**

> **B1-a 回填（本片口径）** —— 零依赖内存夹具 `backend-ts/scripts/p4z-03-keys.ts`（mapper 是纯函数，**无任何 DB 访问**）：把 10 组相同合成行分别喂给**改动前** mapper（`git show HEAD:backend-ts/src/database.ts` 快照 `pre/database.HEAD.ts`）与**改动后** mapper（工作树快照 `post/database.NEW.ts`），逐 key 比对（只比 key 集，不比值）。
>
> **结果：`all_key_sets_equal: true`，10/10 例 key 集完全相等**（`asset:empty_row`、`asset:legacy_asset_row`、`asset:account_row`、`asset:no_keys_at_all`、`user:empty_row`、`task:empty_row`、`task:full_row`、`brand:empty_row`、`brand:full_row+counts`、`brand:full_row_no_counts`）。读数：`post/fixture-keys.json`、`post/fixture-stdout.txt`（`FIXTURE_EXIT=0`）。
> 自曝：`post/database.NEW.ts` 因本片新增 `import { SYSTEM_CURRENCY_CID } from './ledger'`，在快照目录内相对导入无法解析，故配 stub `post/ledger.ts`（仅导出该常量，不加载真实 ledger/Pool）；该常量不参与 mapper key 计算，见 §8 自曝。

> **B1-b 回填（本片口径）** —— 夹具 `backend-ts/scripts/p4z-04-keys-b1b.ts`（**新建**，零依赖、零 DB 访问）：HEAD 快照（`b1b-…/contract/database.HEAD.ts`，`git show HEAD` + 末尾 export 行）vs 工作树快照（`contract/database.NEW.ts` + 末尾 export 行；`./ledger` 用 stub `contract/ledger.ts`）。**结果：`all_key_sets_equal: true`，9/9 例 key 集完全相等**（`FIXTURE_EXIT=0`）：`task:empty_row`、`task:old_task_row`、`task:new_job_row`、`task:new_job_row_minimal`（TaskRecord 21 键）；`task_progress:empty_row`、`task_progress:old_row`、`task_progress:new_synth_row`（TaskProgressRecord 9 键）；`pending_verification:old_enriched`、`pending_verification:new_enriched`（11 键）。读数：`backend-ts/.p4-artifacts/b1b-20260929T143421/post/fixture-keys.json`、`post/fixture-stdout.txt`。

## 4. GET 零写库证明（逐表计数前后）

> **STATUS: 待回填（§4）**

> **B1-a 回填（本片口径）** —— 逐表计数：`neon()` HTTP，`SELECT count(*)::int FROM "<rel>"` 对 `pg_class` 全部 public relation（relkind r/v/m/p）逐表跑（`scripts/p4z-02-counts.ts`）。**GET 扫荡前**取 `pre/counts.json`，**GET 扫荡后**取 `post/counts.json`，逐表比对落 `post/zero-write-compare.json`。
>
> **22/22 表逐值相同（`identical: true`，`diffs: {}`）**。代表值：`account=4`、`currency=1`、`commission_policy=1`、`ledger_owner=4`、`schema_migration=17`、`users=0`、其余业务表=0。
> 本片改动后 GET 路径（`/api/home`、`/api/user`、`/api/user/asset/:uID`）代码内已无任何 `INSERT/UPDATE/DELETE`（`git diff` 全文：`post/code-diff.patch`）；`upsertAsset` 的写 SQL 未动（属第 2/3 片）。

> **B1-b 回填（本片口径）** —— 同一脚本 `p4z-02-counts.ts`（未改）前后各跑一次：`backend-ts/.p4-artifacts/b1b-20260929T143421/pre/counts.json` → `post/counts.json`，逐表比对 `post/zero-write-compare.json` ⇒ **22/22 表逐值相同（`identical: true`，`diffs: {}`）**。代表值（前后相同）：`account=4`、`currency=1`、`commission_policy=1`、`ledger_owner=4`、`schema_migration=17`、`users=0`、`job=0`、`job_application=0`、`job_submission=0`，其余业务表=0。覆盖区间：pre 计数 → 改动前扫荡 → 代码改动 → 面板重启 → 改动后扫荡 → post 计数；本片 GET 路径无任何写入型 SQL。

## 5. 逐字段映射表（旧列 → 新列）

> **STATUS: 待回填（§5）**

> **B1-a 回填（本片口径）** —— `asset`（表不存在，42P01）→ `account`（存在，4 行）：

| 旧（`asset`） | 新（`account`） | 说明 |
|---|---|---|
| `WHERE a."uID" = $uID` | `WHERE a."uid" = $uID AND a."cid" = 1` | cid 常量取 `src/ledger.ts:140 SYSTEM_CURRENCY_CID = 1n`（本片以 `Number(SYSTEM_CURRENCY_CID)` 传参，避免 BigInt 进 neon HTTP 参数序列化） |
| `"uID"` → 键 `uID` | `"uid"` → 键 `uID` | `normalizeAsset` 加回退键 `getValue(row,'uID','uid')` |
| `points` → 键 `points` | `balance` → 键 `points` | `getValue(row,'points','balance')` |
| `lucks` → 键 `lucks` | **无对应列** | 空态恒 0 |
| `index_id` → 键 `index_id` | **无对应列** | 空态恒 0 |
| `time_updated` → 键 `time_update` | `time_updated`（同名） | `toTimestamp(...)`，epoch 秒 |
| `AssetRecord` 键集（`index_id/uID/points/lucks/time_update`） | **不变** | 见 §3 夹具比对 |
| 表内无行/无 account 行 | `DatabaseService.emptyAsset(uID)` | 空态资产（0 值 + 完整键集），纯读、不写库 |

实测（`post/getUserAsset-live.json`，经 `DatabaseService.getUserAsset` 真读路径）：`account` 实际行 uid = `-1,-2,-3,0`（均 cid=1、balance=0，见 `post/account-rows.json`）；`getUserAsset(0)` → `{index_id:0,uID:0,points:0,lucks:0,time_update:1790644527}`（`time_update` 非零 ⇒ 数据确来自 `account.time_updated`）；uid 1–4/99 → `null`。

> **B1-b 回填（本片口径）** —— `task`→`job`、`task_progress`→`job_application`+`job_submission` 的全量逐字段映射表（旧列→新列→响应键，含空态默认与「无对应列不编值」决策：`time_claimed`→恒 NULL、`points_claimed`→恒 0、`note`←`description`、`points`←`reward`、`tID`←`job_id`、`jID`←`application_id`、`info_input`←`deliverable`、`time_checked`←`reviewed_at`、pending 谓词→`review_status='pending'`）见本文件 `## B1-b ·` 节 **B-b5**。

## 6. 「范围外」清单（写端点 = 批 2 / 批 3）

> **STATUS: 待回填（§6）**

> **B1-a 回填（本片口径）** —— 以下各项**点名 + 归属**，本片未改（依据：`post/counts.json` 的 `existence_dual_caliber` + `quoted_count_probe`，三口径一致 `pg_class_n=0 / to_regclass=false / information_schema_n=0`）：

| 项 | 现状 | 归属 |
|---|---|---|
| `listTasks`/`getTask` → `task`(database.ts:1186,1214)、`task_progress`(1194,1222) | `42P01 relation "task"/"task_progress" does not exist` ⇒ `/api/task/all`、`/api/home` 500 | **第 2/3 片（task 换表）** |
| `listPrizes`/`listBrands` → `prize`(1036,1453)、`prize_item`(1053,…)、`shard`(1061,…)、`shard_transfer`(1069,…) | `42P01` ⇒ `/api/prize/all`、`/api/home` 500 | **第 2/3 片（prize/shard 换表）** |
| `upsertAsset` 写侧（`UPDATE asset`(940)/`INSERT asset`(955)） | `asset` 表不存在 ⇒ 写端点仍抛错 | **第 2/3 片（写侧）** |
| `POST /api/auth/verify`（index.ts:240）、`POST /api/task-progress/claim`（index.ts:528,539） | 仍调 `upsertAsset`（隐式写） | **第 2/3 片** |
| `initializeAllAssets`(967)、`adjustPoints`(985)、`getStatistics` 的 asset 聚合(1407-1428) | 依赖 `asset` 表 | **第 2/3 片** |
| `permission_group` 读 | 本片未触及 | **第 2/3 片** |
| `shard*` 读侧（market/shard 交易） | 本片未触及 | **第 2/3 片** |

## 7. `tsc --noEmit` 退出码

> **STATUS: 待回填（§7）**

> **B1-a 回填（本片口径）** —— `cd backend-ts && npx tsc --noEmit > .p4-artifacts/tsc-b1a.log 2>&1; echo "TSC_EXIT=$?"` ⇒ **`TSC_EXIT=0`**，log 为空（`.p4-artifacts/tsc-b1a.log`，0 字节）。退出码直接取自该命令（不经管道）。

> **B1-b 回填（本片口径）** —— `cd backend-ts && node_modules/.bin/tsc --noEmit > .p4-artifacts/b1b-20260929T143421/post/tsc-b1b.log 2>&1; echo "TSC_EXIT=$?"` ⇒ **`TSC_EXIT=0`**，log 0 字节（`.p4-artifacts/b1b-20260929T143421/post/tsc-b1b.log`）。退出码直接取自该命令（不经管道）。

## 8. NOT_MEASURED 清单 + 探针自曝

> **STATUS: 待回填（§8）**

> **B1-a 回填（本片口径）**：

**NOT_MEASURED（未测清单，禁止当 0/空）**：

| # | 项 | 原因 |
|---|---|---|
| 1 | 带 `Authorization` 的 `/api/home`（actor 分支 asset 读侧，index.ts:394） | 无有效会话令牌，未造；该分支已改纯读但**未实测** |
| 2 | `/api/user` 带 Authorization（`buildUserPayload` 的 points 值） | 同上（无令牌）；仅实测无令牌 401 |
| 3 | `/api/user/asset/:uID` 对 uid=0 的真实 account 行返回 | GET 扫荡口径只测了 uID=1（空态）；uid=0 的真读路径仅经 `getUserAsset` 脚本直测（`post/getUserAsset-live.json`），未走 HTTP 端点 |
| 4 | 非零 balance 时的 `points` 数值/精度换算 | 库为 seed 基线，`account.balance` 全 0，无从取非零样本 |
| 5 | `upsertAsset` 写侧行为（`asset` 表） | 表不存在，属第 2/3 片；本片未触碰其写 SQL |
| 6 | POST 端点（auth/verify、task-progress/claim） | 非本片范围且会写库，本片禁写 ⇒ 未触发 |
| 7 | 三个 500 端点在 task/prize 换表后的最终 status | 属第 2/3 片，本片无法收敛 |

**探针自曝**：

1. 「`asset`/`task`/`prize`/… 不存在」是**三口径**结论（`pg_class` 计数、`to_regclass`、`information_schema.tables`，见 `post/counts.json` 的 `existence_dual_caliber`），不是单口径；且 `42P01` 由带引号 `FROM "<t>"` 直查复现（`quoted_count_probe`）。而 `probe.json`（p4z-01）的 `relations` 列表只用了 `pg_class` **单口径**。
2. `scripts/p4z-02-counts.ts`、`scripts/p4z-03-keys.ts` 为本片**新建**；`p4z-01-probe.ts` 未改动。计数探针同一脚本前后各跑一次，口径完全一致。
3. fixture 的 `post/database.NEW.ts` 依赖 stub `post/ledger.ts`（仅 `SYSTEM_CURRENCY_CID = 1n`），故 fixture **不覆盖** ledger 运行时；本片对 `src/ledger.ts`、`src/ledger-errors.ts` 零改动（`git status` 佐证，见 `post/code-diff.patch` 末尾）。
4. fixture 只比 **key 集**，不比值；值语义（§8-4）未测。
5. 重启走面板单服务路由（`POST /api/restart {"sid":"seafood-api"}`，handler 读取于 `~/bistro/ctrl/index.js:870-877`，payload 字段现取确认仅 `sid`）；未用 `pkill`/`killall`，未动其它 sid。

> **B1-b 回填（本片口径）** —— NOT_MEASURED 10 项 + 探针自曝 7 条见本文件 `## B1-b ·` 节 **B-b7**。要点：非空数据下 `review_status='pending'` 谓词未经验证（库空表）；`time_claimed`/`points_claimed` 为「不编值」映射决策；写侧 task/task_progress SQL 全部属批 2/3 未触碰；计数脚本原样复用（`p4z-02`）、夹具快照 export 行 + ledger stub 自曝；`/api/task/:tID` 404→200(空态) 为派单要求的明示语义变更；`/api/home` 仍 500 属第 3 片（本片点名未越界）。

## B1-a · 系统币读侧换表（asset→account）

> 本节 = 重派单（第 1/3 片）正文。run tag **`b1a-20260929T135443`**，落盘 2026-09-29T14:09+0800，工作树基线 `a8e958b`。

### 0. 口径

| 项 | 值 |
|---|---|
| run tag | `b1a-20260929T135443`（`backend-ts/.p4-artifacts/.b1a-run`） |
| 产物目录 | `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b1a-20260929T135443/{pre,post}` |
| 服务重启 | 面板 `POST /api/restart`（仅 `sid=seafood-api`），重启后 `/health` 200 才开测 |
| 库查询 | `neon()` HTTP（`scripts/p4z-02-counts.ts`、`node -e` 只读查询）；未用 `Client`(ws) |
| GET 扫荡 | `curl --max-time 20`、无 Authorization、`%{http_code}` |
| 禁写遵守 | 无任何写入型 SQL；未 `git add/commit/push`；未动 migrations/ledger/commission/frontend/既有 artifacts |

### 1. 代码改动（最小）

`backend-ts/src/database.ts`（+`backend-ts/src/index.ts`）：

1. `normalizeAsset`：`uID`/`points` 加回退键 `uid`/`balance`（`asset` 列名在前，`account` 列名在后 ⇒ 旧口径行为不变）。**键集不变**。
2. `getUserAsset`：`FROM asset AS a WHERE a."uID" = $uID` → `FROM account AS a WHERE a."uid" = $uID AND a."cid" = $1`（$1 = `Number(SYSTEM_CURRENCY_CID)`，常量唯一来源仍是 `src/ledger.ts:140`）。仍是 try/catch → null 的纯读。
3. 新增 `DatabaseService.emptyAsset(uID)`：空态资产（0 值 + 完整键集），供 GET 纯读回退。
4. `src/index.ts:371`（`/api/user/asset/:uID`）：删除 `|| upsertAsset(uID, 0)` 隐式写回退 → `getUserAsset(uID)` 纯读，miss 时回 `emptyAsset(uID)`（仍 200 + 完整键集）。
5. `src/index.ts:392-397`（`/api/home` actor 分支）：同样删 `|| upsertAsset(...)` → 纯读。

`upsertAsset` 自身的写 SQL **未动**；`listTasks`/`getTask`/`listPrizes`/`listBrands` **未动**（属第 2/3 片）。完整 diff：`post/code-diff.patch`。

### 2. 结论（一句话）

**`asset` 读侧已全部改走 `account`（cid=1）且 GET 零写库**：`/api/user/asset/:uID` 500→200；`/api/home`、`/api/prize/all`、`/api/task/all` 仍 500，**根因不是 `asset`，而是 `task`/`task_progress`/`prize`/`prize_item`/`shard`/`shard_transfer` 全部 42P01 —— 属第 2/3 片**（证据：§1、§6、`post/counts.json`）。

### 3. 产物清单（run-tagged，绝对路径前缀 `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b1a-20260929T135443/`）

| 文件 | 内容 |
|---|---|
| `pre/get-status.txt` | 改动前 7 路径 status |
| `pre/counts.json` | 改动前逐表计数 + 存在性三口径 + 42P01 复现 |
| `pre/database.HEAD.ts` | `git show HEAD:backend-ts/src/database.ts` 快照（+ 末尾 export 行） |
| `pre/doc-original.md` | 本审计文档骨架的原样副本（追加前的备份，供 diff 验证「只追加」） |
| `post/get-status.txt` | 改动后 7 路径 status |
| `post/counts.json` | 改动后逐表计数（同口径） |
| `post/zero-write-compare.json` | 前/后逐表比对（22/22 相同） |
| `post/fixture-keys.json`、`post/fixture-stdout.txt` | key 契约夹具读数（10/10 EQ） |
| `post/database.NEW.ts`、`post/ledger.ts` | 改动后快照 + stub |
| `post/getUserAsset-live.json` | `getUserAsset` 真读路径直测 |
| `post/account-rows.json` | `account` 4 行实况 |
| `post/asset-1-body.json` | `/api/user/asset/1` 响应体 |
| `post/sql-relations.txt` | `src/database.ts` SQL 关系名行号清单 |
| `post/code-diff.patch` | 本片 `git diff` + `git status --porcelain` |
| `../tsc-b1a.log` | `tsc --noEmit` 输出（空）+ shell 读数 `TSC_EXIT=0` |

新增脚本：`backend-ts/scripts/p4z-02-counts.ts`（只读计数/存在性）、`backend-ts/scripts/p4z-03-keys.ts`（key 契约夹具）。`p4z-01-probe.ts` 未改。

## B1-b · 招工读侧换表（task→job，task_progress→job_application+job_submission）

> 本节 = 批 1 第 2/3 片正文。run tag **`b1b-20260929T143421`**（`backend-ts/.p4-artifacts/.b1b-run`），落盘 2026-09-29T14:34+0800，工作树基线 = B1-a 验收后（HEAD 仍 `a8e958b`；开工时 `pre/git-status.txt` 既有改动仅 B1-a 所留）。**只追加、未改动上方任何既有文字**（佐证：`pre/doc-original.md` 快照 + `post/doc-only-additions.diff`）。

### B-b0. 口径

| 项 | 值 |
|---|---|
| run tag | `b1b-20260929T143421`（`backend-ts/.p4-artifacts/.b1b-run`） |
| 产物目录 | `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b1b-20260929T143421/{pre,post,contract}` |
| 基线 | HEAD `a8e958b`；开工时工作树 `pre/git-status.txt`：`src/**` 仅有 B1-a 的未提交改动（`database.ts`/`index.ts` 各 M），另为 untracked 的 artifacts/scripts/本报告 |
| 库查询 | 复用 B1-a `scripts/p4z-02-counts.ts`（**未改**），`neon()` HTTP、只读 SELECT/目录读；未用 `Client`(ws) |
| GET 扫荡 | 逐端点 `curl --max-time 20`、无 `Authorization`，status 取 `%{http_code}`（不经管道）；扫荡两轮（改动前旧代码 / 面板重启后新代码） |
| 服务重启 | 面板 `POST /api/restart {"sid":"seafood-api"}`（handler 现取：`~/bistro/ctrl/index.js:870-877`，body 仅 `sid`，stopService→startOne）；响应 `{"ok":true,"state":"running","pid":52171}`，`/health` 200（2s）后才开测；未用 `pkill`/`killall`，未动其它 sid |
| schema 真值 | `backend-ts/.p4-artifacts/p4b1-20260929T134838/pre/probe.json`（`columns.job/job_application/job_submission/users` + constraints CHECK 枚举 + `row_counts`）；未重测、未猜列名 |
| 禁写遵守 | 零写入型 SQL；未 `git add/commit/push`；未动 migrations/`ledger.ts`/`ledger-errors.ts`/`commission.ts`/frontend/既有脚本/既有 artifacts；只新增 `scripts/p4z-04-keys-b1b.ts` 与本片产物 |

### B-b1. 代码改动（最小）

`backend-ts/src/database.ts`（6 个读函数 SQL 换表 + mapper 回退键 + `emptyTask`）：

1. `listTasks`：CTE `FROM task AS t`→`FROM job AS t`、`FROM task_progress AS j`→`FROM job_application AS j`，键 `t."tID"`→`t.job_id`；参与者计数 = `COUNT(1)` of `job_application` GROUP BY `job_id`。
2. `getTask`：同上（单行；`WHERE t.job_id = ${tID}`，替换旧 BTRIM 字符串强转）。
3. `getTaskProgress`：`SELECT j.* FROM task_progress` → `job_application a LEFT JOIN LATERAL (最新一条 job_submission，`ORDER BY s0.submission_id DESC LIMIT 1`) ON TRUE`，输出列以别名合成旧单表形状（`application_id AS "jID"`、`deliverable AS info_input`、`reviewed_at AS time_checked` …）。
4. `listTaskProgressByUser`：同 3，`WHERE a.worker_uid = ${uID}`、`ORDER BY a.application_id DESC`。
5. `listPendingVerification`：同 3 + `JOIN "users" u ON u.uid = a.worker_uid`；谓词 `s.deliverable <> '' AND s.review_status = 'pending' AND u.is_admin = false`（旧 `info_input<>'' AND time_checked='' AND time_claimed='' AND is_admin=false` 的等价换算，枚举真值 = probe.json `job_submission_review_status_enum` CHECK：pending/approved/rejected）；排序 `COALESCE(s.time_created, a.time_created) DESC NULLS LAST, a.application_id DESC`。enrich 段（`getTask`+`getUserById` → `task`/`user` 键）**未动**。
6. `countPendingVerification`：同 5 的 FROM/WHERE + `COUNT(1)::int`。
7. `normalizeTask`：加回退键 `tID←job_id`、`note←description`、`points←reward`（旧列名在前 ⇒ 旧行为不变；`time_created`/`time_updated` 沿用既有读取）。**键集不变**。
8. 新增 `DatabaseService.emptyTask(tID)`：`{ ...normalizeTask({}, 0), tID }` —— 完整 21 键 TaskRecord 空态（类比 B1-a `emptyAsset`），纯内存零写库。

`backend-ts/src/index.ts`（唯一 hunk，`/api/task/:tID`）：miss 分支由 `404 'Task not found'` 改为 `sendSuccess(res, task || DatabaseService.emptyTask(tID))` ⇒ **空态 200**（派单必验读数要求 `/api/task/1` ⇒ 200 空态；此为**明示的语义变更**）。其余端点零改动（`/api/task-progress*`、`/api/tasklist/*`、`/api/home` 未触碰）。

`git diff --stat`（vs HEAD，含 B1-a 未提交改动）：`2 files changed, 126 insertions(+), 57 deletions(-)`；本片自身边界以以上逐条清单 + `pre/git-status.txt` 为准。完整 diff：`post/code-diff.patch`。

### B-b2. 必验读数（curl 逐端点，改动前/后）

原始读数：`pre/get-status.txt`（旧代码服务，重启前）/ `post/get-status.txt`（新代码服务 pid 52171）：

| 端点 | 改动前 | 改动后 | 说明 |
|---|---|---|---|
| `/api/task/all` | 500 | **200** | 空态：`{"success":true,"data":[]}`（`post/bodies/_api_task_all.json`） |
| `/api/task/1` | 500 | **200** | 空态：miss → `emptyTask(1)`，**21 键全量**（`post/bodies/_api_task_1.json`：tID=1、points=0、is_open=true、participants_count=0、title_en/hk/vn、note_en/hk/vn 齐） |
| `/api/task-progress/1` | 500 | **404** | 不得 500 ✓；语义 = **保留该路由原 miss 语义**（`getTaskProgress` null → 404 "Task progress not found"，体见 `post/bodies/_api_task-progress_1.json`） |
| `/api/task-progress` | 401 | **401** | 需鉴权、非 500 ✓（`requireActor` 先于 handler） |
| `/api/tasklist/pending-verification` | 401 | **401** | 需鉴权 ✓（`requireAdmin(req,res,'review_tasks')`） |
| `/api/tasklist/pending-verification/count` | 401 | **401** | 同上 ✓ |
| `/api/home` | 500 | **500（按派单要求仍 500）** | 根因**不在本片**：`Promise.all` 中 `listPrizes`（database.ts）→ `prize`/`prize_item`/`shard`/`shard_transfer` 仍 42P01 —— **逐条点名：`listPrizes`/`listBrands` 属第 3 片（prize/shard 换表），本片未触碰**；`/api/home` 的 `listTasks` 部分已由本片修好 |
| `/` | 200 | **200** | 回归 ✓ |
| `/health` | 200 | **200** | 回归 + 重启 READY 判据 ✓ |
| `/api/user/asset/1` | 200 | **200** | B1-a 无回归 ✓（键集不变：`index_id/uID/points/lucks/time_update`） |

### B-b3. 字段 key 契约（零依赖内存夹具）

夹具 `backend-ts/scripts/p4z-04-keys-b1b.ts`（**新建**，无任何 DB 访问/写库）：同一组合成行喂改动前 mapper（`contract/database.HEAD.ts` = `git show HEAD:backend-ts/src/database.ts` + 末尾 export 行）与改动后 mapper（`contract/database.NEW.ts` = 工作树快照 + 末尾 export 行；`./ledger` 以 `contract/ledger.ts` stub `SYSTEM_CURRENCY_CID=1n` 解析），逐 key 比对（只比 key 集，不比值）。

**结果：`all_key_sets_equal: true`，9/9 例 key 集完全相等**（读数：`post/fixture-keys.json`、`post/fixture-stdout.txt`，`FIXTURE_EXIT=0`）：

- `task:empty_row` / `task:old_task_row`（旧 task 列）/ `task:new_job_row`（job 列 + participants_count）/ `task:new_job_row_minimal` ⇒ `TaskRecord` 21 键恒等；
- `task_progress:empty_row` / `task_progress:old_row`（旧 task_progress 列）/ `task_progress:new_synth_row`（新 SQL 合成别名）⇒ `TaskProgressRecord` 9 键恒等；
- `pending_verification:old_enriched` / `pending_verification:new_enriched` ⇒ 11 键恒等（+`task`/`user`）。

### B-b4. 零写库证明（逐表计数前后）

同一脚本 `p4z-02-counts.ts`（未改）前后各跑一次（`neon()` HTTP，`SELECT count(*)::int FROM "<rel>"` 对 pg_class 全部 public relation，带引号）：扫荡前 `pre/counts.json`、扫荡后 `post/counts.json`，逐表比对 `post/zero-write-compare.json` ⇒ **22/22 表逐值相同（`identical: true`，`diffs: {}`）**。代表值（前后相同）：`account=4`、`currency=1`、`commission_policy=1`、`ledger_owner=4`、`schema_migration=17`、`users=0`、`job=0`、`job_application=0`、`job_submission=0`，其余业务表=0。覆盖区间：pre 计数 → 改动前扫荡 → 代码改动 → 面板重启 → 改动后扫荡 → post 计数；本片 GET 路径无任何写入型 SQL。

### B-b5. 逐字段映射表（旧列 → 新列）

**① `task` → `job`（listTasks / getTask / normalizeTask）**：

| 旧（`task`，42P01） | 新（`job`，probe.json columns.job） | 说明 |
|---|---|---|
| `FROM task AS t` / `ORDER BY t."tID"` | `FROM job AS t` / `ORDER BY t.job_id` | 表名换；`job_id` 原生 bigint（去 BTRIM 强转） |
| `t."tID"` → 键 `tID` | `t.job_id` → 键 `tID` | `getValue(row,'tID','job_id')` |
| `points` → 键 `points` | `reward` → 键 `points` | `getValue(row,'points','reward')` |
| `title` → 键 `title` | `title`（同名） | 不变 |
| `note` → 键 `note` | `description` → 键 `note` | `getValue(row,'note','description')` |
| `participants_count`（= task_progress 计数） | `COUNT(1)` of `job_application` GROUP BY `job_id` | 参与者 ≡ 申请者 |
| 键 `time_created`/`time_updated` | `job.time_created`/`job.time_updated` | 同名直接命中 |
| `refcode/link0/linkA/linkB/type/time_start/time_end/title_en…/note_en…` | **job 无对应列** | 空态默认 `''`/`0`（不编值） |
| `is_open` → 键 `is_open` | 无列 → `true` | 与旧 mapper 对缺列行为一致 |

**② `task_progress` → `job_application` + `job_submission`（getTaskProgress / listTaskProgressByUser / listPendingVerification / countPendingVerification / normalizeTaskProgress）**：

| 旧（`task_progress`，42P01） | 新（合成） | 说明 |
|---|---|---|
| `j."jID"` → 键 `jID` | `a.application_id AS "jID"` | 进度行 ≡ 申请行（`UNIQUE(job_id,worker_uid)` + `job_application_pk`） |
| `j."tID"` → 键 `tID` | `a.job_id AS "tID"` | |
| `j."uID"` → 键 `uID` | `a.worker_uid AS "uID"` | |
| `j.info_input` → 键 `info_input` | `s.deliverable AS info_input` | LATERAL 取该申请**最新一条** submission（`ORDER BY s0.submission_id DESC LIMIT 1`；无 submission ⇒ NULL） |
| `j.time_created` → 键 `time_created` | `a.time_created` | |
| `j.time_submitted` → 键 `time_submitted` | `s.time_created AS time_submitted` | 交付物创建 ≡ 提交时刻 |
| `j.time_checked` → 键 `time_checked` | `s.reviewed_at AS time_checked` | review 完成时刻（nullable） |
| `j.time_claimed` → 键 `time_claimed` | `NULL::timestamptz AS time_claimed` | **新 schema 无「领取时刻」列** —— 不编值、恒 NULL，键保留；领取语义归 job 结算（`settle_txid`/`time_updated`），属写侧 |
| `j.points_claimed` → 键 `points_claimed` | `0::int AS points_claimed` | 无对应列；取旧 create 默认 0，不编值 |
| pending 谓词 `info_input<>'' AND time_checked='' AND time_claimed=''` | `s.deliverable<>'' AND s.review_status='pending'` | 枚举真值：`job_submission_review_status_enum` CHECK（pending/approved/rejected）；`'pending'` ⟺ 未核查 |
| `AND u.is_admin = false`（旧 users 列字符串强转） | `u.is_admin = false`（原生 boolean） | `JOIN "users" u ON u.uid = a.worker_uid`（真表名带引号，§5.7①） |
| `ORDER BY time_submitted/time_created DESC NULLS LAST, "jID" DESC` | `ORDER BY COALESCE(s.time_created, a.time_created) DESC NULLS LAST, a.application_id DESC` | 语义对应 |

### B-b6. `tsc --noEmit`

`cd backend-ts && node_modules/.bin/tsc --noEmit > .p4-artifacts/b1b-20260929T143421/post/tsc-b1b.log 2>&1; echo "TSC_EXIT=$?"` ⇒ **`TSC_EXIT=0`**，log 0 字节（`post/tsc-b1b.log`）。退出码直接取自该命令（不经管道）。

### B-b7. NOT_MEASURED + 探针自曝

**NOT_MEASURED（未测清单，禁止当 0/空）**：

| # | 项 | 原因 |
|---|---|---|
| 1 | 非空数据下 `review_status='pending'` 谓词的正确性（approved/rejected 被正确排除） | 库为 seed 基线 `job_submission=0` 行；枚举值是 schema 真值（CHECK 约束），谓词逻辑未经真数据验证 |
| 2 | `time_claimed` 恒 NULL 的值语义 | 新 schema 无领取时刻列，映射决策而非实测 |
| 3 | `points_claimed` 恒 0 的值语义 | 同上（取旧 create 默认） |
| 4 | `/api/task/:tID` 命中真实 job 行（reward→points 真值、participants_count>0） | `job=0` 行 |
| 5 | `/api/task-progress`、`/api/task-progress/:jID` 带 Authorization 的非空读 | 表空且无有效会话令牌，未造 |
| 6 | 非 admin 带 Authorization 打 `/api/tasklist/pending-verification(/count)` 的分支 | 无令牌；无 Authorization 401 已实测 |
| 7 | `listPendingVerification` enrich 的 task/user 非空分支 | 依赖真数据 |
| 8 | LATERAL 多 submission 时「取最新一条」的运行时行为 | 无数据可测（0 行） |
| 9 | 带 Authorization 的 `/api/home`（actor 分支） | 无令牌（B1-a §8 同项延续） |
| 10 | 写侧全部 task/task_progress SQL（INSERT/UPDATE/DELETE，见 `post/sql-relations.txt`）+ `countTaskParticipants` + `getTaskParticipantCounts` | 批 2/3 范围，本片未触碰 |

**探针自曝**：

1. 计数/夹具脚本：`p4z-02-counts.ts` 为 B1-a 既有脚本**原样复用**（未改）；`p4z-04-keys-b1b.ts` 为本片新建。`p4z-02` 的 PROBE/`quoted_count_probe` 段仍指旧表名（asset/task/…，B1-a 口径），本片「job 三表存在且空」读数来自其全量 `pg_class` `row_counts`（job/job_application/job_submission 各 0 行），非其 PROBE 段。
2. 夹具快照 `database.HEAD.ts`/`database.NEW.ts` 末尾各追加一行 `export { normalizeTask, normalizeTaskProgress };`、`./ledger` 用 stub（仅 `SYSTEM_CURRENCY_CID=1n`）——仅服务夹具加载；本片对 `src/ledger.ts`/`src/ledger-errors.ts` 零改动。夹具只比 key 集不比值。
3. `/api/task/:tID` 404→200(空态) 是**语义变更**（派单必验读数要求 200 空态；对照 B1-a `emptyAsset` 先例），已在 B-b1 明示。
4. `/api/home` 仍 500 属**预期**：`listPrizes`→`prize`/`prize_item`/`shard`/`shard_transfer` 42P01，**第 3 片范围**，本片未触碰。
5. pre-sweep 打在旧代码服务（重启前）、post-sweep 打在新代码（面板单服务重启，pid 52171，`/health` 200 后才开测）；重启本身不计入库写（22/22 计数相同已覆盖该区间）。
6. `post/code-diff.patch` 的 `git diff` 相对 HEAD（= B1-a 未提交改动 + 本片改动合并）；本片自身边界以 B-b1 逐条清单 + `pre/git-status.txt` 为准。
7. `getTaskParticipantCounts`（database.ts:812，含 task_progress 查询）在 src 内 **0 调用者**（双口径：模式 `getTaskParticipantCounts` 全 src 仅命中定义行；且该函数自带 try/catch 回退零计数，即便被触达也不会 500）。本片未改（死代码，清理属后续批次）。

### B-b8. 产物清单

run-tagged，绝对路径前缀 `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b1b-20260929T143421/`：

| 文件 | 内容 |
|---|---|
| `pre/git-status.txt` | 开工时工作树基线（`src/**` 仅 B1-a 改动） |
| `pre/doc-original.md` | 报告追加前快照（「只追加」验证基准） |
| `pre/get-status.txt` | 改动前 10 路径 status（旧代码服务） |
| `pre/counts.json` | 扫荡前逐表计数（22 关系） |
| `contract/database.HEAD.ts` | `git show HEAD:backend-ts/src/database.ts` + 末尾 export 行 |
| `contract/database.NEW.ts` | 改动后工作树 database.ts 快照 + 末尾 export 行 |
| `contract/ledger.ts` | 夹具 stub（`SYSTEM_CURRENCY_CID = 1n`） |
| `post/get-status.txt` | 改动后 10 路径 status（新代码服务） |
| `post/bodies/*.json` | 10 端点响应体（task_all 空数组、task_1 21 键空态、task-progress_1 404 体、asset_1 回归体等） |
| `post/counts.json` | 扫荡后逐表计数（同口径） |
| `post/zero-write-compare.json` | 前/后逐表比对（22/22 相同） |
| `post/fixture-keys.json`、`post/fixture-stdout.txt` | key 契约读数（9/9 EQ，`FIXTURE_EXIT=0`） |
| `post/tsc-b1b.log` | `tsc --noEmit` 输出（0 字节；`TSC_EXIT=0` 见 B-b6） |
| `post/sql-relations.txt` | 换表后关系名分布（读侧/写侧/死代码 逐行归类） |
| `post/code-diff.patch` | `git diff`（vs HEAD，含 B1-a）+ `git status --porcelain` |
| `post/doc-only-additions.diff` | 本报告 vs `pre/doc-original.md`（仅追加行证明） |

新增脚本：`backend-ts/scripts/p4z-04-keys-b1b.ts`（key 契约夹具）。`p4z-01-probe.ts`、`p4z-02-counts.ts`、`p4z-03-keys.ts` 未改。

## 声明

> **STATUS: 待回填**

---

*骸架落盘：2026-09-29T13:48:38+0800。逐节回填。*
