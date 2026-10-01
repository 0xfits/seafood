# P6 · BATCH5 · MISSING-TABLES —「缺表族」双口径清单 + 每面可达性 + A/B/C 影响面（不选）

> 单号 = **B5-MT** · 角色 = **Kong（实现方 · 本单只读取证、只列选项、不选边、不裁决）** · 日期 = 2026-10-01 CST
> run tag = **p6b5mt-20261001T112357Z** · 产物 = `backend-ts/.p4-artifacts/p6b5mt-20261001T112357Z/`
> 探针 = `backend-ts/scripts/p4z-b5mt-01-probe.ts`（**只读** · HTTP 驱动 `neon()` · 零 DDL/DML · 零写请求）
> 前置（**只参考、读数全部本轮重取**）= `docs/audit/p5-missing-tables-triage.md`（P5-TRIAGE）· `docs/audit/p5-fix-login.md`（B5-FIX-LOGIN）
> 性质：**不改码 / 不建表 / 不部署 / 不改库 / 不发写请求**。骨架先行落盘，逐段回填。

---

## §0 结论摘要

1. **缺表族 = 7 名，本轮双口径现取复核一致**：`asset` / `task` / `task_progress` / `prize` / `prize_item` / `shard` / `shard_transfer`。
   - 库侧 `to_regclass` **逐名 7/7 = NULL**（带引号与裸名两路同值，`results.json:candidate_to_regclass`）；
   - 迁移面词法 22 名 **7 名一个都不在其中**（`results.json:lexical_to_regclass`：22/22 命中，缺 0）。
   - **【与 p5 的差异】p5 未做「全代码面 ∖ 全库面」的差分**，只给 7 名固定清单。本轮做了**全量差分**（口径见 §1.3）：代码面 distinct 真表引用 **30 名**，差集**恰为这 7 名**，**无第 8 名**。⇒ 7 名清单**成立**（首次由差分证明，非转抄）。
2. **今天仍可达的缺表触达面 = 1 条路由**：`POST /api/task-progress/claim/:jID`（`src/index.ts:692`），它同时触 `asset`（`:716` / `:727`）与 `task_progress`（`:726`）⇒ 撞 `42P01` ⇒ 被 catch（`:738`）吞成 **`500` 'Failed to claim reward'**（`src/index.ts:740`）。
   其余 6 表的触达面（写侧多为 410 死面 / 读侧为内存桩）**今日 0 触达**（逐条见 §2.3）。
3. **`/api/auth/verify` 的 `asset` 触达已闭合**（现取确认）：`src/index.ts:412` = `getUserAsset(uID) ‖ emptyAsset(uID)`，**:402–430 内无 `upsertAsset`**（`grep -rn upsertAsset src/index.ts` ⇒ **仅剩 `:716`/`:727` 两处调用**，另 `:407`/`:553` 为注释文本）⇒ B5-FIX-LOGIN 生效，**登录主路径不再撞缺表**。**但代码里的缺表引用点（25 处 SQL 位置）一处未删**。
4. **25 处 SQL 引用点**（`FROM/INTO/UPDATE/JOIN` 后接这 7 名）落在 **database.ts 23 个函数**内；其中 **仅 3 个函数有活调用方**（`upsertAsset` / `claimTaskProgress` / + `getUserShardBalance` 仅被死函数调），**其余 20 个函数经「名字全仓出现次数 = 1（=定义体自身）」现取证明为零调用方死代码**（§2.2 表）。
5. **冻结册对 B（补建表）是否决级**：`data-layer.spec:219`（DL26）逐字「`asset`/`task`/`task_progress`/`prize`/`prize_item`/`shard`/`shard_transfer`/`chest*` **不得**出现在任何新迁移、新代码、新路由里（**含只读引用**）」+ `:332`（DL40）「**不得**为了『让它 200』而建同名的旧表」+ `:168`/`:169`「**不存在，且永不创建**」⇒ **B 与册正面冲突（3 条独立条文，2 条为本册裁定）**。
6. **批 5 若不含新迁移 ⇒ 重置键三处（文件数 20 / `VERSION_ORDER` 20 / 期望 `row_count='20'`）无需变动** —— 本轮**现取四路对拍一致**（§4）。**`p3y-01-post-apply-verify.ts:37` 仍是落后 3 版的死副本**（只到 `0017`）。
7. **本单不选边**：A/B/C 的影响面逐项列于 §3，证据齐，裁决位留空。

---

## §1 缺表族真清单（双口径 · 现取）

### §1.1 口径定义（三条命令，读数可 `grep` 复核）

| 口径 | 命令（逐字可复算） | 说明 |
|---|---|---|
| ① 迁移面词法扫 | `grep -niE "create table\|rename to\|drop table" backend-ts/migrations/*.sql` | 不引 `information_schema`，纯文件词法 |
| ② 库侧真值 | `information_schema.tables @public` + 逐名 `to_regclass('public."<名>"')` / `to_regclass('public.<名>')` | 探针 `p4z-b5mt-01-probe.ts`（`neon()` HTTP 驱动） |
| ③ 代码面引用 | `grep -rhoiE "(from\|into\|update\|join\|delete from)[[:space:]]+((public\|app\|main)\.)?\"?[a-z_][a-z0-9_]*\"?" src/*.ts` ⇒ 去噪后 distinct | 只取 `FROM/INTO/UPDATE/JOIN/DELETE FROM` 的**直接对象位**；CTE 别名/字符串按 §5.2 自曝剔除 |
| **④ 差集** | **③ ∖ ②** | **= 缺表族** |

### §1.2 口径①+②：迁移面真表全集 vs 库内真表全集

**口径①（词法）**：`migrations/*.sql` = **20 个文件**（`0001`–`0017` + `0019` + `0020` + `0021`，**`0018` 缺**，`results.json:migration_files_count=20`）。
`CREATE TABLE` 语句 **22 条** + `0006_user_to_users.sql:75 ALTER TABLE public."user" RENAME TO users` ⇒ **最终真表 22 名**：

```
currency · account · ledger_entry · ledger_owner（0001）
users（0002 建 "user" → 0006:75 RENAME 出）· referral · commission_policy（0007）
job（0013）· job_application · job_submission（0014）· listing · listing_order（0015）
market_order · market_trade（0016）· app_config · admin_role · admin_permission
admin_role_permission · admin_user_role · currency_status_log（0017）
content_translation · translation_cache（0021）
```
> 逐条落点：`0001_ledger_core.sql:13/41/55/96` · `0002_user_identity.sql:11` · `0007:48/84` · `0013_job.sql:79` · `0014:79/115` · `0015:115/153` · `0016:112/159` · `0017:69/93/103/112/123/139` · `0021:71/122`。
> `0019` / `0020` **不建任何表**（词法扫零命中）；`0020` 名为 `ledger_post_event_hold_family_drop_listing_deposit`（改函数 + 删列，非建表）。

**口径②（库侧 · 本轮实测 `information_schema`）**：`public` 对象 = **24** = **23 BASE TABLE + 1 VIEW**。
- 23 BASE TABLE = 上列 22 + **`schema_migration`**（重建/回放引导表，不来自 `migrations/**`）；
- 1 VIEW = **`candle_view`**（来源已现取：`migrations/0016_market.sql:195` 逐字「`public.candle_view` —— K 线**视图**」）。
- **22 名声明的表 22/22 全部命中**（`lexical_missing_from_db = []`），**含保留字族 `users`**（`to_regclass('public."users"')` = `users`；1 处引号/裸名两路一致）。

### §1.3 口径③：代码面真表引用（现取 30 名，去噪后）

`market_order`(15) · `job_application`(14) · `admin_user_role`(11) · `users`(10) · `listing`(10) · `ledger_entry`(10) · `job`(10) · `currency`(10) · `referral`(9) · **`task_progress`(8)** · `job_submission`(8) · `account`(8) · `content_translation`(7) · **`prize_item`(6)** · `admin_role_permission`(6) · `admin_role`(6) · `commission_policy`(5) · `listing_order`(4) · **`task`(3)** · **`prize`(3)** · `market_trade`(3) · **`asset`(3→真值 2)** · `translation_cache`(2) · **`shard`(2)** · `app_config`(2) · **`shard_transfer`(1)** · `schema_migration`(1) · `currency_status_log`(1) · `admin_permission`(1)

> 噪声剔除口径（自曝见 §5.2）：CTE 别名（`ev`/`ins`/`cur`/`target`/`apply`/`upd`/`gate`/`usr`/`j`/`l`/`t`/`keyhit`/`candidates`/`existing`/`anc`/`gate`/`sub` 等）、`unnest`/`generate_series`/`lateral`/`set`/`values`（SQL 语法位）、以及英文文本误命中。
> `asset` 的**词法命中 3 = SQL 真值 2**（992/1007）；第 3 处 `database.ts:1000` 是字符串 `'Failed to update asset'` 被 `update\s+asset` 正则命中 ⇒ **手剔**。

### §1.4 差集 ④ = **缺表族精确清单**（7 名 · 带全部被引用处 `文件:行号`）

| # | 缺表 | 库侧 `to_regclass`（引号/裸名） | 代码面 SQL 引用点（`文件:行号`） | 处数 |
|--:|---|---|---|--:|
| 1 | **`asset`** | `NULL` / `NULL` | `database.ts:992`（`UPDATE asset AS a`）· `:1007`（`INSERT INTO asset AS a`） | **2** |
| 2 | **`task`** | `NULL` / `NULL` | `database.ts:3030`（`INSERT INTO task`）· `:3078`（`UPDATE task`）· `:3108`（`DELETE FROM task`） | **3** |
| 3 | **`task_progress`** | `NULL` / `NULL` | `database.ts:854` · `:1271` · `:1339` · `:1352` · `:1376` · `:1389` · `:1401` · `:2403` | **8** |
| 4 | **`prize`** | `NULL` / `NULL` | `database.ts:2846` · `:2939` · `:3008` | **3** |
| 5 | **`prize_item`** | `NULL` / `NULL` | `database.ts:2761` · `:2774` · `:2970` · `:3671` · `:3693`（`:2777` 同语句 CTE 内二次引用） | **6**（含 `:2777` = 7 处位置） |
| 6 | **`shard`** | `NULL` / `NULL` | `database.ts:2987` · `:3137` | **2** |
| 7 | **`shard_transfer`** | `NULL` / `NULL` | `database.ts:3153` | **1** |
| | **合计** | 7/7 不存在 | | **25** |

**双口径子项 · 裸名 vs 带引号**：7 名**全为全小写、非保留字**，`to_regclass('public."x"')` 与 `to_regclass('public.x')` **逐名同值**（探针打印「引号/裸名不一致」计数 = **0**）⇒ **无口径漂移**；代码侧同样**从不加引号**引用这 7 名。
**双口径子项 · 保留字**：`user` 为保留字 —— 库内 `user` **不存在**（`users` 才是真表，来自 `0006`）；代码面**无 `FROM user` 裸引用**（`grep -rnE "(from|into|update|join)\s+user\b" src/*.ts` 的 2 行 = 英文文案 `Failed to update user login time` / `Failed to update user`，**非表名**）⇒ 无「保留字裸名撞表」问题。
**代码 vs 库 双口径结论**：**差集非空且恰好 7 名，与立案清单一致；无新增第 8 名，无遗漏。**

---

## §2 每条缺表引用的「面」与被吞成什么

### §2.1 引用点 → 函数 → 调用方（现取调用图）

| 引用点 | 所在函数（定义行区间） | 该函数的调用方（`文件:行号`） | 活/死 |
|---|---|---|---|
| `asset:992/:1007` | `upsertAsset`（`database.ts:986–1018`） | **活**：`index.ts:716`、`index.ts:727`（claim 路由）<br>**死**：`database.ts:1026`（`initializeAllAssets`）·`:3345`（`matchMarketOrder`）·`:3435`/`:3440`（`placeOrder`）·`:3526`（`cancelOrder`） | **活 2 / 死 5** |
| `task_progress:1401` | `claimTaskProgress`（`:1398–1430`） | **活**：`index.ts:726`（claim 路由） | **活 1** |
| `task_progress:1352` | `createTaskProgress`（`:1349–1363`） | `:1370`（`ensureTaskProgressForUserTask` ⇒ **零调用方**） | 死 |
| `task_progress:1339` | `findTaskProgressByUserAndTask`（`:1335–1348`） | `:1365`（同上 ⇒ 死） | 死 |
| `task_progress:854` | `getTaskParticipantCounts`（`:847–864`） | **无任何调用方**（全仓名字出现 = 1） | 死 |
| `task_progress:1271` | `countTaskParticipants`（`:1267–1276`） | `:3096`（`updateTask`）·`:3101`（`deleteTask`）—— 二者自身零调用方 | 死 |
| `task_progress:1376` / `:1389` / `:2403` | `submitTaskProgressInfo` / `markTaskProgressChecked` / `rejectPendingTaskProgress` | **均无任何调用方** | 死 |
| `task:3030/:3078/:3108` | `createTask` / `updateTask` / `deleteTask` | **均无任何调用方** | 死 |
| `prize:2846` / `:2939` / `:3008` | `createBrand` / `updateBrand` / `deleteBrand` | **均无任何调用方** | 死 |
| `prize_item:2761` / `:2774`(`:2777`) | `createPrizeInventoryRows` / `trimAvailablePrizeInventory` | `:2800` / `:2802`（均在 `syncPrizeInventory` 内） | 死 |
| `prize_item:2970` | `deleteBrand`（`syncPrizeInventory` 同名族） | 无 | 死 |
| `prize_item:3671` / `:3693` | `redeemPrizeItemFromShards`（`:3662–3707`） | **无任何调用方**（原 `/api/shard/redeem` 现已 410） | 死 |
| `shard:2987` | `deleteBrand` | 无 | 死 |
| `shard:3137` | `createShardLedgerEntry`（`:3130–3141`） | `:3344`(`matchMarketOrder`) ·`:3446`(`placeOrder`) ·`:3530`(`cancelOrder`) ·`:3635`(`openFreeShardChest`) ·`:3683`(`redeemPrizeItemFromShards`) —— **5 个调用方全为死函数** | 死 |
| `shard_transfer:3153` | `recordShardTransfer`（`:3142–3185`） | `:3357` ·`:3447` ·`:3531` ·`:3636` ·`:3684`（同上 5 个死函数） | 死 |

**「零调用方」的现取判据（可复算）**：`for n in …; do grep -rhoE "\b$n\b" src/*.ts | wc -l; done` ⇒ 下列名字**全仓计数 = 1（仅定义体自身）**：
`createTask=1 · updateTask=1 · deleteTask=1 · createBrand=1 · updateBrand=1 · deleteBrand=1 · placeOrder=1 · cancelAllOrders=1 · openFreeShardChest=1 · redeemPrizeItemFromShards=1 · submitTaskProgressInfo=1 · markTaskProgressChecked=1 · rejectPendingTaskProgress=1 · ensureTaskProgressForUserTask=1 · getTaskParticipantCounts=1 · initializeAllAssets=1`
（`cancelOrder=2` / `matchMarketOrder=2` / `syncPrizeInventory=3` 的额外命中均为**死函数内部的自身调用**：`matchMarketOrder`@`:3488`、`syncPrizeInventory`@`:2886`/`:2961`。）

### §2.2 落在哪条**已注册路由**上（现取注册点计数 = **67**）

`grep -cE "app\.(get|post|put|patch|delete)\(" src/index.ts` ⇒ **67**（与立案预期一致）。
注册点 → 缺表触达的映射（**逐条 `文件:行号`**）：

| 注册点 | 路径 | 触达的缺表 | 前置闸 | 若被访问会返什么 |
|---|---|---|---|---|
| `src/index.ts:402` | `POST /api/auth/verify` | **无（已闭合）** | 无鉴权闸（登录口径）；但需有效 `challenge_token`（`:403` 起校验） | `400`（缺参）/ **`401`**（`:373` 同族 catch）/ `200`（成功，`points` 取 `account` 或空态 0） |
| **`src/index.ts:692`** | **`POST /api/task-progress/claim/:jID`** | **`asset`（`:716`/`:727`）· `task_progress`（`:726`）** | `requireActor`（`:693`）⇒ 无/坏 Bearer = **`401`**；另 `403` 非本人（`:708`） | 触表前快路径：`400 Invalid jID`（`:698`）→ `404`（`:704`，`getTaskProgress` 读 `job_application`）→ `403`（`:708`）→ `400`（`:712` 未审核）；**一旦落到 `:716`/`:726`/`:727` ⇒ `42P01` ⇒ catch(`:738`) ⇒ `500 'Failed to claim reward'`（`:740`）** |
| `src/index.ts:617` / `:631` / `:650` | `GET /api/task-progress` · `GET /api/task-progress/:jID` · `POST /api/task-progress/:identifier/submit` | **无** | `requireActor`（`:618` / `:651`；`:631` **无鉴权闸**） | `200`（读源已切 `job_application`：`database.ts:1290`/`:1319`）；submit 走 `job-service` ⇒ 零缺表命中 |
| `src/index.ts:744` / `:759` | `GET /api/shard` · `GET /api/shard/transfer` | **无（内存桩）** | `requireActor`（`:745` / `:760`） | **`200` + `data: []` + 顶层 `deprecated: true`**（`:752` / `:767`）；实现 = `database.ts:3116–3121` / `:3186–3191` `return []`（**恒空桩，不触表**） |
| `src/index.ts:774` / `:780` | `POST /api/shard/redeem` · `POST /api/chest/:bID/open` | **无** | **无**（`sendGone` 直返，`_req` 未用） | **`410` + R107 形状**（`LEGACY_REWARD_WRITE_SUNSET`，`index.ts:1074`） |
| `src/index.ts:1076` / `:1080` / `:1084` | `POST /api/admin/task/{create,update,delete}` | **无** | **无**（撤了 `requireAdmin`，逐字理由见 `:1090`） | **`410`**（`ADMIN_TASK_SUNSET`，`:1071`） |
| `src/index.ts:1088` / `:1095` / `:1102` | `POST /api/admin/prize/{create,update,delete}` | **无** | **无**（同族撤前置） | **`410`**（`ADMIN_PRIZE_SUNSET`，`:1073`） |
| `src/index.ts:1230` | `POST /api/admin/assets/init` | **无** | **无** | **`410`**（`ADMIN_ASSETS_INIT_SUNSET`） |
| `src/index.ts:786` / `:808` / `:839` / `:862` | `GET /api/order` · `POST /api/order` · `DELETE /api/order` · `DELETE /api/order/:oID` | **无** | `requireActor`（`:787`/`:809`/`:840`/`:863`） | market 家族**已整体改接** `market_post_event`（`market-service.ts:300`/`:358`/`:562`）⇒ `placeOrder`/`cancelOrder`/`cancelAllOrders` **不在任何活路由上**（其 `upsertAsset`/`createShardLedgerEntry` 调用点 = 死代码，§2.1） |
| `src/index.ts:436` / `:448` / `:460` / `:487` / `:603` / `:546` / `:562` | 商品/任务读口 | **无** | `:436`/`:448`/`:460`/`:487` 无鉴权（公开 + 缓存，`setPublicCache`）；`:603`/`:546`/`:562` 部分需 actor | `200`；读源已换 `job`（`database.ts:1208`/`:1237`）· `listing`（`:1119`）· `listing_order`（`:1177`/`:1192`） |

### §2.3 后台 / 定时路径

`vercel.json` 的 `crons` = **仅 1 条**：`{"path": "/api/translate/backfill", "schedule": "0 18 * * *"}`。
该链 = `src/index.ts:1730`（`POST /api/translate/backfill`）+ `translate-service.ts` ⇒ **对 7 张缺表零引用**（本轮 `src/*.ts` 全量扫，命中仅在 `database.ts` 与 `index.ts` 注释）⇒ **定时面无缺表触达**。

### §2.4 「哪些面今天仍可达」——三种可达性

| 可达性 | 面 | 前置闸 |
|---|---|---|
| **① 今天可达且撞缺表** | **`POST /api/task-progress/claim/:jID`**（`:692`） | `requireActor`（Bearer）→ 且需 `jID` 对应的 `job_application` 行**已审核**（`:711`）；=> 落到 `:716`/`:726`/`:727` 即 `42P01` ⇒ **`500`** |
| **② 今天可达但不撞缺表** | `GET /api/shard`（`:744`）· `GET /api/shard/transfer`（`:759`）· `GET /api/task-progress*`（`:617`/`:631`/`:650`）· market 家族（`:786`–`:901`）· 商品/任务读口（`:436`–`:494`/`:603`）· 定时 `translate/backfill` | `requireActor`（部分）/ 无；无 feature flag 机制（全仓 `grep` 未见 flag 门） |
| **③ 今天可达但一律 410（缺表写侧的死面）** | `admin/task/*`（`:1076`/`:1080`/`:1084`）· `admin/prize/*`（`:1088`/`:1095`/`:1102`）· `shard/redeem`（`:774`）· `chest/:bID/open`（`:780`）· `admin/assets/init`（`:1230`） | **无** —— 逐字撤了鉴权前置（理由：不得把「已下线」伪装成「未授权」，`:1090`/`:1097`/`:1104`） |

### §2.5 现场实测（**HTTP 级 = `NOT_MEASURED`**）

按 §5.7 ⑦，`NOT_MEASURED` 不填 0/空，故在此写明**实测尝试的原始读数**（本轮真实发出，非推定）：

| 尝试 | 目标 | 读数 |
|---|---|---|
| 线上部署 GET | `https://seafood-ggnoamqqh-alwaysfit.vercel.app/api/shard`（+ `/api/shard/transfer` + `/api/task/all`） | **`HTTP/2 302`** + body 逐字 `Protected by Vercel Authentication`（Vercel 部署级 SSO 拦在应用之前 ⇒ 探不到应用状态码） |
| 备选域 GET | `https://www.yunduojihua.com/api/task/all` · `/api/health` | `HTTP 200` 但返回**电影站 HTML** ⇒ **该域不是本仓应用** |
| 本机实例 | `lsof -nP -iTCP -sTCP:LISTEN` | **本仓应用无监听端口**（3000 无进程；`curl 127.0.0.1:3000/health` = 无响应） |

⇒ **HTTP 级「被访问会返什么」= `NOT_MEASURED`**（原因三条：① 部署被 Vercel SSO 前置拦截；② 无本地常驻实例，且本单**禁启常驻 server**；③ 唯一撞缺表的活面是 **POST 写请求**，本单**禁发写请求**）。
**已实测替代表**：库级二元真值（`to_regclass` ⇒ 7/7 NULL）+ 路由层状态码**源码逐字**（`index.ts:740` `sendError(res, 500, …)`）。

---

## §3 处置选项 A / B / C 逐项影响面（**只列证据 · 不选边**）

> 三个选项族并列，不排序、不推荐。**每条都附「需否迁移」与「需否前端配套」两栏**。

### §3.1 选项 A —— **sunset**（移除/下线死代码路径，写口返 `410`）

**A-1 逐文件改动面（现取行号）**

| 文件 | 需动的位置 | 说明 |
|---|---|---|
| `backend-ts/src/index.ts` | `:692–742`（claim 路由） | 三选一：① 删注册点（67 → 66）；② 摘 `:716`/`:726`/`:727` 三行 + 改返 `410`/`200` 空态；③ 仅摘三行让状态机部分保留 |
| `backend-ts/src/index.ts` | `:744`/`:759`（shard 两读口） | **可不改**（已是 K：`200` 空 + `deprecated:true`） |
| `backend-ts/src/database.ts` | **25 个引用点的 23 个宿主函数体**（§2.1 表逐条）——其中 **20 个已零调用方**，可整函数删：`getTaskParticipantCounts`(847–864)、`countTaskParticipants`(1267–1276)、`findTaskProgressByUserAndTask`(1335–1348)、`createTaskProgress`(1349–1363)、`ensureTaskProgressForUserTask`(1364–1372)、`submitTaskProgressInfo`(1373–1385)、`markTaskProgressChecked`(1386–1397)、`claimTaskProgress`(1398–1430)、`rejectPendingTaskProgress`(2400–2412)、`createPrizeInventoryRows`(2754–2766)、`trimAvailablePrizeInventory`(2767–2785)、`syncPrizeInventory`(2786–2805)、`createBrand`(2806–2894)、`updateBrand`(2895–2964)、`deleteBrand`(2965–3013)、`createTask`(3014–3063)、`updateTask`(3064–3099)、`deleteTask`(3100–3115)、`createShardLedgerEntry`(3130–3141)、`recordShardTransfer`(3142–3185)、`openFreeShardChest`(3612–3661)、`redeemPrizeItemFromShards`(3662–3707)、`initializeAllAssets`(1019–1050)、`placeOrder`(3405–3496)、`cancelOrder`(3497–3558)、`cancelAllOrders`(3559–3573)、`matchMarketOrder`(3322–3383) | 删函数是**可选**（不删也能达成「不触缺表」，因它们已零调用方） |
| `backend-ts/src/database.ts` | `:986–1018 upsertAsset` | **删它必须同时改 `index.ts:716`/`:727`**（唯一活调用方）；`:1026` 亦随之删 |
| `backend-ts/src/database.ts` | 保留 `emptyAsset`(976–985) · `getUserAsset`(958–975) · `AssetRecord` 类型 | 活路由（`index.ts:412`/`:554`/`:555`/`:580`）依赖 |

**A-2 对活路由的影响**
- 唯一语义待裁面 = **claim 的「奖励发放」去哪**：`asset` 与 `task_progress` 是同一奖励回路的两半，砍写侧后 `points` 无载体 ⇒ `user_points_total`（`index.ts:720`/`:736`）口径悬空。**这是 A 的唯一真缺口**（与 `p5` §3#1 同结论，本轮独立复现：`upsertAsset` 的唯一活调用方就是 claim）。
- 其余 43 个活面（67 − 410 的 12 − claim 1 − shard 2 − …）**零影响**（因缺表引用全在死函数内，§2.1）。

**A-3 需否迁移**：**否**（零 DDL、零 DML；`migrations/**` 不动）。
**A-4 需否前端配套**：**是** —— `POST /api/task-progress/claim/*` 有在册前端调用点；**但本单未复测前端行号**（p5 §1.3 记 `ClaimRewardModal.jsx:49` / `RewardPage.jsx:154`，本轮**记为 `NOT_MEASURED`，不转抄**）。

### §3.2 选项 B —— **补建表**（建 `asset`/`task`/`task_progress`/`prize`/`prize_item`/`shard`/`shard_transfer`）

**B-1 与冻结册的正面冲突（逐条引册 · 本轮现取行号）**

| # | 册 | `文件:行号` | 逐字（摘） | 与 B 的关系 |
|--:|---|---|---|---|
| 1 | `data-layer.spec.md` | **`:219`**（**DL26**【本册裁定】） | 「**旧表名一律不得复活**：`asset`/`task`/`task_progress`/`prize`/`prize_item`/`shard`/`shard_transfer`/`chest*` **不得**出现在任何新迁移、新代码、新路由里（**含只读引用**）」 | **正面否决**（7 名逐字点名；「新迁移」= B 的落点） |
| 2 | `data-layer.spec.md` | **`:332`**（**DL40**【本册裁定】） | 「审计的 6 条 `table_missing` 路由…**不得**为了『让它 200』而建同名的旧表」 | **正面否决**（B 的动机逐字被点名） |
| 3 | `data-layer.spec.md` | **`:168`** | `asset`「**不存在，且永不创建**（只有 `ALTER TABLE IF EXISTS`）」· 处置 = 无（**整体废弃**）· 余额改由 `account`/`ledger_entry` 派生 | **正面否决** |
| 4 | `data-layer.spec.md` | **`:169`** | `task`「**不存在，且永不创建**」· 替代 = `job`（**0013**）· 「重新建模，**不复用旧表名**」 | **正面否决** |
| 5 | `ledger.spec.md` | **`:819`/`:821`** §13.1 | §13.1 标题「用保留 uid，**不用独立账户表**」+「若给平台另开一张…**就会出现第二套账**」 | **间接否决**（`asset` 即第二套余额载体） |
| 6 | `migrations/0016_market.sql` | **`:9`/`:10`/`:39`** | 文件头逐字「持仓/转让**不建新表**（DL69）」「K 线用视图」 | **正面否决**（`shard`/`shard_transfer` 的落点） |
| 7 | `route-layer.spec.md` | **`:1323`** | 「D1' 的**实现**（`503` 归一 + 只读观测面）与**审计留痕**（`admin_audit_log`，§4.10）**同归批 6** ⇒ **本批不得实现、不得建表**」 | **批 5 边界禁令** |
| 8 | `route-layer.spec.md` | **`:188`/`:192`/`:194`/`:199`/`:200`** | `task/:tID`→`job` · `user/asset/:uID`→`account`（纯读，**删 `upsertAsset` 副作用**）· `prize-item`→`listing_order`（**保留·正式化**）· `shard`/`shard/transfer` = **【弃用→空态】无对应表** | **逐面均已裁定「不靠这张表」** ⇒ B 建表后**没有任何注册面会去读它** |

**B-2 「会不会把已废弃的旧模型重新拉回线上」**
- **会，且是三处**：① 建 `asset` ⇒ 与 `account` 形成第二套余额口径（违 §13.1）；② 建 `task_progress` ⇒ 旧「任务进度 + 领奖」模型与已上线的 `job`/`job_application`/`job_submission`（`0013`/`0014`）**并存**；③ 建 `shard`/`shard_transfer` ⇒ 碎片模型回归，而 `0016_market.sql:10` 已裁「持仓/转让不建新表」。
- **但注意（对 B 有利的一面，据实列出）**：**建表本身不会让任何活路由变绿** —— 因为 §3.2-1 的第 8 行显示 67 个注册面里**已无一面依赖这 7 表的下游语义**（读口全换源；写口全 410；claim 是唯一例外，但它建表后也只是「能跑通的旧语义」）。⇒ B 的作用面 **= 只救 claim 一条路由**（+ 复活 20 个死函数的可运行性）。

**B-3 需否迁移**：**是**（新增 DDL ⇒ 触发 §4 的 5 处同步）。
**B-4 需否前端配套**：**是**（否则建表只服务一条 claim 路由）。

### §3.3 选项 C —— **fail-loud**（保留路由但改返 `503`/`410` + 机读 `reason`）

**C-1 改什么**

| 位置 | 现状 | C 的改法（选项） |
|---|---|---|
| `src/index.ts:738–741`（claim 的 catch） | 无条件 `500` | 按错误类别分流：`42P01` / 传输类（`code === null`）⇒ **`503` + 机读 `reason`**；其余 `500` |
| `src/index.ts:402–430`（verify 的 catch `:373` 同族） | `401` | 同上分流（登录主路径**已不撞** `42P01`，但传输类仍被吞成 `401` ⇒ 方向性误导仍在） |
| 分类器 | 现只用于 `resolveActor`（`src/index.ts:155 unwrapInfraCause` + `:241`）；**claim / verify 的 catch 不走它** | 复用既有分类器，**不新造码** |
| 机读 `reason` | 项目级 `reason` 口径已在册（`route-layer.spec` v1.0 头注逐字：D1'' 「不得依赖 DB `DETAIL`/`constraint`；API 一律用项目级 `reason`」） | 新增 reason 值需与册对齐 |

**C-2 影响面**
- 只改**路由层 catch**，**不触 `database.ts`**、**不建表**、**不删死代码** ⇒ 25 个缺表引用点**原样保留**（缺表问题在 C 下**不消失，只是被正确报出**）。
- 与批 5 边界的关系：`route-layer.spec:1323` 逐字把 **D1' 的 `503` 归一归批 6** ⇒ **C 若在批 5 做，直接越册**。
- 前端影响：`401`→`503` 会改变前端错误分支走向（登录面「凭据无效」文案 vs 「服务不可用」文案）；claim 面 `500`→`503` 同理。
**C-3 需否迁移**：**否**。**C-4 需否前端配套**：**是（文案/错误分支）**。

---

## §4 迁移 / 重置键连带影响（**现取验证**）

### §4.1 「本批不新增迁移」⇒ 重置键**无需变动**（四路对拍，现取）

| # | 真源 | 现取读数 | 命令 / 来源 |
|--:|---|---|---|
| 1 | 磁盘迁移文件数 | **20**（`0001`–`0017` + `0019` + `0020` + `0021`，**`0018` 缺**） | 探针 `readdirSync(migrations).filter(.sql)` ⇒ `results.json:migration_files_count=20` |
| 2 | 库内 `schema_migration` 行数 | **20**，版本集合 = 文件前缀**逐条一致**，末版 = **`0021`** | `SELECT version FROM public.schema_migration ORDER BY version` ⇒ `results.json:schema_migration_rows` |
| 3 | `p3x-00-rebuild-replay.ts` 的 `VERSION_ORDER` | **20 项**（`scripts/p3x-00-rebuild-replay.ts:57–61` = `'0001'…'0017','0019','0020','0021'`）⇒ 与 1/2 **一致**（`:843 summary.version_order_ok` 判据成立） | `grep -n VERSION_ORDER scripts/p3x-00-rebuild-replay.ts` |
| 4 | 同脚本 `schema_migration.row_count` 期望硬编码 | **`'20'`**（`scripts/p3x-00-rebuild-replay.ts:626 add('schema_migration.row_count','20', …)`）⇒ 与 2 的**实读 20 一致** | 同上 |

⇒ **结论：若本批只做 A（sunset）或 C（fail-loud），不新增迁移，则上述四路全部无需变动** —— 本轮已现取验证一致（**不是转抄**）。
补充：`scripts/migrate.ts:33–35` 用 `readdirSync(MIGRATIONS_DIR).filter(.sql).sort()` **自动纳入** ⇒ 迁移运行器侧**无枚举清单可改**。

### §4.2 若方案**需要**新迁移 ⇒ 必须同步的 5 处（精确清单）

| # | 处（`文件:行号`） | 需改什么 | 不改的后果 | 备注 |
|--:|---|---|---|---|
| 1 | `backend-ts/migrations/0022_<name>.sql`（**新建**） | 新迁移文件本体 | 无迁移可跑 | 文件即真源 |
| 2 | `backend-ts/scripts/p3x-00-rebuild-replay.ts:57–61` | `VERSION_ORDER` 追加 `'0022'` | `:843 summary.version_order_ok` ⇒ **false**（重建回放判负） | 现取 20 项 |
| 3 | `backend-ts/scripts/p3x-00-rebuild-replay.ts:626` | 期望 `'20'` → `'21'` | V 组 `schema_migration.row_count` **判负**（实读 21 ≠ 期望 20） | 硬编码期望值 |
| 4 | `backend-ts/scripts/p3x-00-rebuild-replay.ts:62–66` | **条件项**：若新迁移**建表** ⇒ `TABLES_ZERO_EXPECTED` / `M0017_TABLES` 需登记新表；不建表则**不动** | 新表未被「零行期望」覆盖（漏检，非判负） | 现取：`TABLES_ZERO_EXPECTED` = 10 表 · `M0017_TABLES` = 6 表 |
| 5 | `backend-ts/scripts/p3y-01-post-apply-verify.ts:37` | **死副本**：`VERSION_ORDER = ['0001'…'0017']`（**仅 17 项，已落后 `0019`/`0020`/`0021` 三版**）；需补齐至全量 | 该脚本的 apply 后验面**永久只覆 0001–0017**（今日已是这样） | **本轮现取确认为死副本**；是否复活由裁决定 |

> 附：`0018` 版本号空洞**无影响**（磁盘与库内**都没有** `0018`），不是待补洞。

---

## §5 `NOT_MEASURED` · 探针自曝 · 写集自检

### §5.1 产物（本单写集内）

| 类型 | 路径 |
|---|---|
| 报告 | `docs/audit/p6-batch5-missing-tables.md`（本件 · 骨架先落盘后回填） |
| 探针（只读 · HTTP 驱动 `neon()`） | `backend-ts/scripts/p4z-b5mt-01-probe.ts` |
| 读数 | `backend-ts/.p4-artifacts/p6b5mt-20261001T112357Z/results.json` · `steps.log` |
| stdout 原始 | `backend-ts/.p4-artifacts/p6b5mt-20261001T112357Z-probe.stdout.txt` |

**可复算命令**（退出码取自命令本身、非管道之后）：
```
# 探针（只读）
node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
  /Users/kevin/bistro/seafood/backend-ts/scripts/p4z-b5mt-01-probe.ts \
  /Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/p6b5mt-20261001T112357Z   # EXIT=0
# 代码面差集（口径③）
grep -rhoiE "(from|into|update|join|delete from)[[:space:]]+((public|app|main)\.)?\"?[a-z_][a-z0-9_]*\"?" src/*.ts | tr 'A-Z' 'a-z' | tr -d '"' | sort | uniq -c
# 注册点计数（=67）
grep -cE "app\.(get|post|put|patch|delete)\(" src/index.ts
# 零调用方判据
for n in createTask placeOrder openFreeShardChest initializeAllAssets; do grep -rhoE "\b$n\b" src/*.ts | wc -l; done
```

### §5.2 探针自曝（口径瑕疵 / 假阳性 / 未测项 · **逐条自复现**）

① **探针自伤一轮（§5.7 ⑧ 先怀疑自己的探针）**：首轮 `account."uID"` ⇒ `NeonDbError code:'42703' message:'column a.uID does not exist'`（`-probe.stdout.txt` 第 4 行，`EXIT=1`）。**库内真列名 = `uid`**（`results.json:cols_account = [uid, cid, balance, frozen, version, time_created, time_updated]`）。修正为**运行期取列名 + 硬闸**后 `EXIT=0`。⇒ 「`uID` 是代码层命名、`uid` 是 DB 列名」这层映射不复现就会误报（承 P5 §6.2① 同族）。
② **代码面正则假阳性 1 处**：`database.ts:1000` 的字符串 `'Failed to update asset'` 被 `update\s+asset` 命中 ⇒ **`asset` 的 SQL 引用点 = 2（992/1007），非 3**。已在 §1.3/§1.4 手剔。
③ **`TAB:user` 2 处非表名**：`database.ts:937` / `index.ts:1063` = 英文文案（`Failed to update user login time` / `Failed to update user`）。
④ **CTE 别名噪声**：`ev`(25)·`ins`(14)·`cur`(13)·`target`(6)·`apply`(5)·`upd`(4)·`lateral`(4)·`guarded`(4)·`gate`/`keyhit`/`candidates`/`selected_task(s)`… 均**非表**，口径③已剔除，报告表内不列。
⑤ **保留字双路**：7 名全小写非保留字 ⇒ 引号/裸名 `to_regclass` 逐名同值；`users`（唯一保留字族相关名，0006 RENAME 而来）亦双路一致。**探针全程加引号**（`public."users"` / `public.account` 视情况）。
⑥ **`neon()` 命中分支已打印**（§5.7 ⑨）：`results.json:hit_branch = "sql(text,params)"`（即 `sql.query` / `sql.unsafe` 均不可用 ⇒ 走 `sql(text, params)` 调用位）。
⑦ **「缺表」标签的复现方式（诚实说明）**：本轮**未**再捕获 `42P01` —— 缺表状态由 `to_regclass` **二元真值直读**（7/7 `NULL`）确定，比「故意查询缺表再捕异常」**更安全且等价**。P5 §6.2② 已复现过 `42P01` 本身（探针解析期失败），本轮**不重复制造**。
⑧ **「零调用方 / 恒空 / 410」标签均已自复现**：零调用方 = 全仓名字计数（§2.1）；恒空 = 直读桩函数体 `return []`（`database.ts:3116–3121`/`:3186–3191`）；410 = 直读 `sendGone` 调用（`index.ts:1077`/`:1092` 等）。
⑨ **本单零写动作**：未发任何写请求（HTTP 尝试全为 `GET`）；未执行 DDL/DML；未 `npm install`；未 `git add/commit/push`；未 `vercel`；未 `pkill`/`killall`；未启停任何服务；**未读/未打印 `.env.local` 的值**（仅判存在 = `true`，`results.json:boot`）。
⑩ **出站网络**：本轮产生 **5 次只读出站 `GET`**（3 次 Vercel 部署 + 2 次 `yunduojihua.com`），**零副作用**（未提交表单/未带凭据）。

### §5.3 `NOT_MEASURED`（**禁填 0 / 空**）

| 编号 | 未测项 | 为何未测 |
|---|---|---|
| N1 | 14 个可达面（§2.2）的 **HTTP 级状态码 + 响应体** | 部署被 **Vercel Authentication 302** 前置拦截（原始读数见 §2.5）；无本地常驻实例且本单**禁启 server** |
| N2 | `POST /api/task-progress/claim/:jID` 撞 `42P01` 后的 **真实 `500` 响应体** | 唯一撞缺表的面是**写请求**，本单**禁发写请求**；`500` = 由 `src/index.ts:740` 源码逐字推定，非实测 |
| N3 | 前端活调用点**行号**（claim 面） | 本单未扫 `frontend/**`（避免转抄 P5 读数）；P5 §1.3 记 `ClaimRewardModal.jsx:49`/`RewardPage.jsx:154` **本轮未复核** |
| N4 | 「前端 3 个活调用点是否仍存在」 | 同上（未扫 `frontend/**`） |
| N5 | 生产库 与 本探针连的库 **是否同一库** | 需比对 `DATABASE_URL` 值 ⇒ **红线禁读** ⇒ 无法判定 |
| N6 | `route-layer.spec` §4.11（缺表族正文）的**当前行区间** | 本轮只现取了册头注与端点表的行号（`:188`/`:192`/`:194`/`:199`/`:200`/`:1323` 等），**未定位 §4.11 正文** |
| N7 | `GET /api/shard` 等读口的 `deprecated:true` 字段是否在**线上 bundle** 也生效 | 同 N1（部署拦截） |
| N8 | `M0017_TABLES` / `TABLES_ZERO_EXPECTED` 之外的**第 5 处**是否需要同步 | §4.2-#4 已是条件项；是否存在**第 6 处**未穷举（只按现取到的枚举点列 5 处） |

### §5.4 写集自检（硬边界）

**本单只写 4 处**：本报告 · `backend-ts/scripts/p4z-b5mt-01-probe.ts` · `backend-ts/.p4-artifacts/p6b5mt-20261001T112357Z/**` · 同目录 `-probe.stdout.txt`。
**未写/未改**：`src/**`（零编辑）· `migrations/**` · `frontend/**` · `vercel.json` · 任何 spec · `docs/seafood.master-plan.md` · `.env*` · 既有 `docs/audit/**`（含 `p5-*.md` 只读引用）。

### §5.5 与 P5 取证的差异（**现取复核，必报**）

| 项 | P5（2026-09-30） | 本轮现取（2026-10-01） | 判定 |
|---|---|---|---|
| `users` 行数 | 24 | **35** | 漂移（+11） |
| `account` 行数 / `cid=1` 行 | 25 / 16 | **25 / 16** | 一致 |
| 无 `cid=1` account 行的用户 | 12 / 24 = 50% | **23 / 35** | 漂移（分母与分子均变） |
| `POST /api/auth/verify` 注册行 | `:354`（P5 引）→ 实际 `:358`（写点） | **`:402`**（写点早已不写：`:412` = `getUserAsset ‖ emptyAsset`） | **P5 §0-2 的缺口已由 B5-FIX-LOGIN 闭合**（本轮代码现取复核） |
| claim 路由注册行 | `:635` | **`:692`** | 漂移（+57） |
| 注册点计数 | 65（`p5-fix-login` 记）/ 67（立案） | **67** | 与立案一致；`p5-fix-login` 的 65 为其口径 |
| 缺表族差分证明 | **未做**（固定清单） | **已做**（代码 30 名 ∖ 库 23 表 = 恰 7 名，无第 8 名） | **本轮新增证据** |
| 册行号 `data-layer.spec` | 引 `:166`/`:217` | 现取 **`:168`/`:169`/`:219`/`:332`** | **P5 行号已漂移**；本报告一律用现取行号 |
| 册行号 `route-layer.spec:1151/1154/1158` | P5 引「prize-item 非 sunset / shard 空态」 | 现取该三行 = **`LD0xx` 键表内容（不符）**；对应条文现取在 **`:57`/`:194`/`:199`/`:200`/`:513`/`:562`** | **P5 的 route-layer 行号已整体失效**；本报告改用现取行号 |
| `.p4-artifacts` 库侧真表数 | 未报 | **23 BASE TABLE + 1 VIEW** | **本轮新增证据** |
