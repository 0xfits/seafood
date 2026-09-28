# P3 入口先遣 · 全量路由审计（只读）

> 生成时间：2026-09-28 08:19:27 CST（本地） · 仓库 HEAD：`45c27d8 fix(i18n): 语言前缀规范化，修连续切语言产生的双重前缀空白页`
> 机读清单：`docs/audit/p3-route-inventory.json`（同批次产出，数字与本文件一致）

**一句话结论**：`backend-ts/src/index.ts` 注册的 **55** 个条目（51 条 method 路由 + 3 个全局中间件 + 1 个 404 兜底）
全部是从 `jinli` 拷来的**旧业务面**；其中 **46 条（column_missing 40 + table_missing 6）在新库上必死**，
只有 **7 条 ok**（3 个中间件 + `/` + `/health` + `/api/test/data` + `POST /api/auth/challenge`）。
**P1/P2 已闭环的账本内核（`ledger_entry` / `ledger_post_event` / 十级返佣）没有暴露任何 HTTP 路由**——
招工 / 商品 / 积分交易所 / 邀请返佣四柱目前**一个可用入口都没有**。

---

## 0. 审计基线（只读）

* 仓库 HEAD（开工时）：`45c27d8 fix(i18n): 语言前缀规范化，修连续切语言产生的双重前缀空白页`
* 仓库 HEAD（收尾时）：`073c683 master-plan v0.33: 5.28 P3 立项与拆解（P1/P2 已闭环）` —— 审计期间 HEAD **前进了一个提交**，
  但 `git diff 45c27d8..HEAD --stat` 只有 `docs/seafood.master-plan.md`（+16 行）；
  `backend-ts/src/index.ts` 与 `backend-ts/src/database.ts` 的 blob 哈希在两个 HEAD 上完全一致
  （`d004f4c2…` / `79135787…`），**本审计的静态结论对两者都成立**。非本单所做的提交。
* 审计对象：`backend-ts/src/index.ts`、`backend-ts/src/database.ts`、`backend-ts/src/db.ts`、`backend-ts/src/auth.ts`
* **只读约束**：all DB access used a read-only session (PGOPTIONS=-c default_transaction_read_only=on) and SELECT/EXPLAIN only; all HTTP was GET only
* 未改任何代码、未写任何 DB 行、未跑迁移、未 POST/PUT/PATCH/DELETE、未 commit、未启停 5787/5788
* 连接稳定性：the known transient "Client network socket disconnected before secure TLS connection was established" flap did NOT occur during this audit window (0 retries)
  （HTTP 50 次请求 / 重试 0 次；DB 6 批只读查询 / 重试 0 次）

### 0.1 真库快照（审计开始时，`information_schema` / `pg_proc` 只读核对）

存在的表（共 8 张，全部来自 0001–0012 迁移）：

```
account, commission_policy, currency, ledger_entry, ledger_owner, referral, schema_migration, users
```

* `users` 行数：**411**（非空库）
* `users` 实际列：`bio`, `evm`, `is_admin`, `time_login_last`, `time_reg`, `uid`  ← **全部小写**
* `public` 函数：33 个（`ledger_*` / `referral_*` / `commission_*`）

### 0.2 审计过程中 DB 状态发生了改变（必须登记）

探测 `GET /api/market/:bID/orderbook` 时，应用**自己**调用了 `ensureSupportSchema()`，该函数包含 9 条
`CREATE TABLE IF NOT EXISTS`，于是**在 GET 请求里执行了 DDL**（我发出的仍然只是 GET）：

```
基线（探测前）: account,commission_policy,currency,ledger_entry,ledger_owner,referral,schema_migration,users

探测后        : account,app_config,commission_policy,currency,ledger_entry,ledger_owner,market_order,market_trade,permission_group,prize,prize_item,referral,schema_migration,shard,shard_transfer,task_progress,users
```

* 被懒创建的 9 张表：`app_config`, `market_order`, `market_trade`, `permission_group`, `prize`, `prize_item`, `shard`, `shard_transfer`, `task_progress`
* **未**被创建的遗留表：`asset`、`task` —— 它们只有 `ALTER TABLE IF EXISTS`（不是 CREATE），所以永远缺失
* `ensureLegacyTableNames()` 还尝试过两次改名，在新库上都是**空操作**（源表不存在）：`gift` → `prize_item`、`journey` → `task_progress`
* 上述 9 张表 Zang 可自行决定是否 `DROP`（本单只读，未做任何清理）

---

## 1. verdict 分布

| verdict | 数量 | 含义 |
|---|---|---|
| `ok` | 7 | 路径上没有任何缺失 DB 对象 |
| `column_missing` | 40 | 表存在但引用的**列**不存在（引号标识符按精确大小写比较） |
| `table_missing` | 6 | 路径触达真库不存在的**表**，且路径上无任何东西创建它 |
| `function_missing` | 0 | 调用了签名不存在的 DB 函数（本轮 0 命中，见 §6 说明） |
| `legacy_unmapped` | 2 | 不触达任何 DB 对象，且是退役/纯遗留入口，无新产品对应模块 |
| **合计** | **55** | 51 method 路由 + 3 全局中间件 + 1 兜底 |

判负优先级（按**执行顺序的首次致命失败**）：

1. 路径上 `await ensureSupportSchema()` → `column_missing`（根因见 §2-R1）
2. 路径触达已存在表但缺列 → `column_missing`
3. 路径触达真库不存在的表 → `table_missing`
4. 缺函数 → `function_missing`
5. 都不缺 → `ok`（无 DB 对象的退役入口记 `legacy_unmapped`）

> 每条路由的完整表格/列清单在 JSON 里；本文件只展开 verdict 与证据。

### 1.1 按新产品四柱归类（提案，见 §5）

| 归类 | 路由数 |
|---|---|
| ①招工 | 12 |
| 后台管理 | 12 |
| ③积分交易所 | 10 |
| ②商品 | 6 |
| 平台基础 | 5 |
| 平台基础（身份） | 3 |
| 平台基础（账户） | 3 |
| 平台运维 | 1 |
| 与新产品无关 | 1 |
| 邀请返佣/身份 | 1 |
| ①招工+②商品 | 1 |

---

## 2. 根因（4 条，全部有只读/实测证据）

### R1（最致命）`users` 列名大小写不匹配 → 40 条路由 column_missing

迁移 `0002_user_identity.sql` 建的是**小写**列 `uid` / `evm`；拷来的查询层写的是**带引号的大写驼峰** `"uID"` / `"EVM"`。
带引号 = 精确大小写，所以每一条 `FROM "users"` 的语句都直接报错：

```sql
-- 只读复现（psql，default_transaction_read_only=on）
SELECT u.* FROM "users" AS u
  WHERE COALESCE(NULLIF(BTRIM(u."uID"), '')::int, 0) = 1 LIMIT 1;
-- ERROR:  column u.uID does not exist

SELECT count(*) FROM "users" AS u WHERE LOWER(COALESCE(u."EVM", '')) = 'x';
-- ERROR:  column u.EVM does not exist
```

后果：**411 个已存在的用户记录一条都读不出来**；`resolveActor()` 内部 try/catch 吞掉异常后返回 `null`，
所以所有需要登录的路由对外**统一表现为 401**（把真实故障伪装成“未登录”，见 §4.2 实测）。

### R2 `ensureSupportSchema()` 自身永远失败 → 让 34 条路由连"自愈"都做不到

`backend-ts/src/database.ts:269` 的 `ensureSupportSchema()` 在末尾执行一段 users 回填：

```sql
UPDATE "users" AS u SET "uID" = (base.max_uid + missing.rn)::text ...
```

`users` 没有 `"uID"` 列（同 R1），于是**必抛**。只读 `EXPLAIN` 复现：

```
ERROR:  column "uID" of relation "users" does not exist
```

它的 9 条 `CREATE TABLE` 在抛错**之前**已经执行完（这就是 §0.2 那 9 张表出现的原因），
但函数整体 reject → `supportSchemaPromise` 被重置为 `null` → **每次都重跑、每次都失败**。
所以即便表已被懒创建，`GET /api/market/:bID/orderbook` 仍然 500（实测，见 §4.3）。

### R3 11 张遗留表缺失，其中 `asset` / `task` 永远缺

| 缺失表 | 触达它的路由数 | 能否被懒创建 |
|---|---|---|
| `permission_group` | 35 | 是（ensureSupportSchema） |
| `prize_item` | 16 | 是（ensureSupportSchema） |
| `prize` | 15 | 是（ensureSupportSchema） |
| `shard` | 15 | 是（ensureSupportSchema） |
| `shard_transfer` | 14 | 是（ensureSupportSchema） |
| `asset` | 13 | **否（永不创建）** |
| `task_progress` | 12 | 是（ensureSupportSchema） |
| `task` | 10 | **否（永不创建）** |
| `market_order` | 6 | 是（ensureSupportSchema） |
| `market_trade` | 3 | 是（ensureSupportSchema） |
| `app_config` | 3 | 是（ensureSupportSchema） |

`asset` 缺席正是已知 P0 缺口 `GET /api/user/asset/:uID` → 500 的原因（§4.1 自证）。
`task` 缺席意味着**招工柱**在旧面上完全无法工作。

### R4 懒创建出来的表与查询层的"文本模型"不兼容（类型/取值层面的第二层错）

`ensureSupportSchema()` 把 `"bID"` / `"uID"` / `"jID"` 建成 `integer`/`bigint`，
但拷来的查询层把它们当**字符串**用（`BTRIM(COALESCE(g."bID", ''))`）。表建出来后仍然报错：

```
SELECT COALESCE(NULLIF(BTRIM(COALESCE(g."bID", '')), '')::bigint, 0) FROM prize_item AS g;
-- ERROR:  invalid input syntax for type integer: ""
```

所以**即便有人手工把遗留表建齐，这些路由也不会好**——除非把列类型改回 text 或把查询层的 text 语义去掉。
这条是"修表缺失"之外必须一起设计的事。

### R5 不应有的副作用（本单只报告，未触发）

* `GET /api/market/:bID/{orderbook,trades}`：公开无认证的 GET 会**执行 DDL**（§0.2 实证）。
* `GET /api/user/asset/:uID`：契约上不是只读——`upsertAsset()` 会 `INSERT INTO asset`，**任何未认证访客只要 asset 表存在就能给任意 uID 建一行**（本轮因表缺失而未发生）。
* `POST /api/admin/assets/init`（`index.ts:1053`）**没有 `requireAdmin` 守卫**，是未认证的写入口。 另外 `getAllUsers()` 的 try/catch 会吞掉 users 列错误并返回 `[]`，于是它对外返回 `200 {"total":0,"initialized":0}`
  并宣称成功（静默降级）。
* `GET /api/user/all`、`GET /api/user/stats` 同样会因 `getAllUsers()` 吞异常而"看起来成功"（静默降级），
  但前置于它们的 `requireAdmin → resolveAdminAccess` 会先走到 `ensureSupportSchema()`，实际仍是 401/500。

---

## 3. 全量路由总表

列说明：`tables` 中带 `*` 表示该表在真库**不存在**；`live` 是实测 HTTP 状态码。

| # | method | path | handler（合成名） | line | 触达的表（*=缺失） | verdict | 其他失败类 | live |
|---|---|---|---|---|---|---|---|---|
| 1 | `USE` | `<global middleware: helmet>` | `global_middleware_helmet` | 22 | — | `ok` | — | 未探测 |
| 2 | `USE` | `<global middleware: cors>` | `global_middleware_cors` | 23 | — | `ok` | — | 未探测 |
| 3 | `USE` | `<global middleware: express.json>` | `global_middleware_express.json` | 24 | — | `ok` | — | 未探测 |
| 4 | `GET` | `/` | `root_banner` | 175 | — | `ok` | — | 200 |
| 5 | `GET` | `/health` | `get_health` | 195 | schema_migration | `ok` | — | 200, 200 |
| 6 | `GET` | `/api/test/data` | `get_test_data` | 212 | — | `legacy_unmapped` | — | 200 |
| 7 | `POST` | `/api/auth/register` | `post_auth_register` | 223 | — | `legacy_unmapped` | — | 未探测 |
| 8 | `POST` | `/api/auth/challenge` | `post_auth_challenge` | 227 | — | `ok` | — | 未探测 |
| 9 | `POST` | `/api/auth/verify` | `post_auth_verify` | 236 | asset*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 10 | `POST` | `/api/auth/login` | `post_auth_login` | 259 | asset*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 11 | `GET` | `/api/prize/all` | `get_prize_all` | 264 | prize*, prize_item*, shard*, shard_transfer* | `table_missing` | table_missing | 500, 500, 500 |
| 12 | `GET` | `/api/task/all` | `get_task_all` | 276 | task*, task_progress* | `table_missing` | table_missing | 500, 500, 500 |
| 13 | `GET` | `/api/task/:tID` | `get_task_tid` | 288 | task*, task_progress* | `table_missing` | table_missing | 500, 500, 500 |
| 14 | `GET` | `/api/prize/:bID` | `get_prize_bid` | 308 | prize*, prize_item*, shard*, shard_transfer* | `table_missing` | table_missing | 500, 500, 500 |
| 15 | `GET` | `/api/user` | `get_user` | 328 | asset*, permission_group*, users | `column_missing` | table_missing,column_missing | 401 |
| 16 | `POST` | `/api/user/profile` | `post_user_profile` | 341 | asset*, permission_group*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 17 | `GET` | `/api/user/asset/:uID` | `get_user_asset_uid` | 364 | asset* | `table_missing` | table_missing | 500, 500, 500 |
| 18 | `GET` | `/api/home` | `get_home` | 379 | asset*, permission_group*, prize*, prize_item*, shard*, shard_transfer*, task*, task_progress*, users | `column_missing` | table_missing,column_missing | 500, 500, 500, 500 |
| 19 | `GET` | `/api/prize-item` | `get_prize_item` | 419 | permission_group*, prize_item*, users | `column_missing` | table_missing,column_missing | 401 |
| 20 | `GET` | `/api/task-progress` | `get_task_progress` | 433 | permission_group*, task_progress*, users | `column_missing` | table_missing,column_missing | 401 |
| 21 | `GET` | `/api/task-progress/:jID` | `get_task_progress_jid` | 447 | task_progress* | `table_missing` | table_missing | 500, 500, 500 |
| 22 | `POST` | `/api/task-progress/:identifier/submit` | `post_task_progress_identifier_submit` | 466 | permission_group*, task*, task_progress*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 23 | `POST` | `/api/task-progress/claim/:jID` | `post_task_progress_claim_jid` | 504 | asset*, permission_group*, task*, task_progress*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 24 | `GET` | `/api/shard` | `get_shard` | 556 | permission_group*, prize*, prize_item*, shard*, shard_transfer*, users | `column_missing` | table_missing,column_missing | 401 |
| 25 | `GET` | `/api/shard/transfer` | `get_shard_transfer` | 570 | permission_group*, prize*, prize_item*, shard*, shard_transfer*, users | `column_missing` | table_missing,column_missing | 401 |
| 26 | `POST` | `/api/shard/redeem` | `post_shard_redeem` | 584 | permission_group*, prize*, prize_item*, shard*, shard_transfer*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 27 | `POST` | `/api/chest/:bID/open` | `post_chest_bid_open` | 602 | permission_group*, prize*, prize_item*, shard*, shard_transfer*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 28 | `GET` | `/api/order` | `get_order` | 620 | market_order*, permission_group*, prize*, prize_item*, shard*, shard_transfer*, users | `column_missing` | table_missing,column_missing | 401 |
| 29 | `POST` | `/api/order` | `post_order` | 634 | asset*, market_order*, market_trade*, permission_group*, prize*, prize_item*, shard*, shard_transfer*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 30 | `DELETE` | `/api/order` | `delete_order` | 653 | asset*, market_order*, permission_group*, prize*, prize_item*, shard*, shard_transfer*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 31 | `DELETE` | `/api/order/:oID` | `delete_order_oid` | 666 | asset*, market_order*, permission_group*, prize*, prize_item*, shard*, shard_transfer*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 32 | `GET` | `/api/market/:bID/orderbook` | `get_market_bid_orderbook` | 684 | market_order* | `column_missing` | table_missing | 500, 500, 500 |
| 33 | `GET` | `/api/market/:bID/trades` | `get_market_bid_trades` | 699 | market_trade*, prize*, prize_item*, shard*, shard_transfer* | `column_missing` | table_missing | 500, 500, 500 |
| 34 | `GET` | `/api/admin/me` | `get_admin_me` | 715 | permission_group*, users | `column_missing` | table_missing,column_missing | 401 |
| 35 | `GET` | `/api/admin/settings` | `get_admin_settings` | 721 | app_config*, permission_group*, users | `column_missing` | table_missing,column_missing | 401 |
| 36 | `POST` | `/api/admin/settings` | `post_admin_settings` | 734 | app_config*, permission_group*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 37 | `POST` | `/api/admin/settings/reset` | `post_admin_settings_reset` | 747 | app_config*, permission_group*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 38 | `GET` | `/api/admin/permissions` | `get_admin_permissions` | 760 | permission_group*, users | `column_missing` | table_missing,column_missing | 401 |
| 39 | `POST` | `/api/admin/permissions/save` | `post_admin_permissions_save` | 776 | permission_group*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 40 | `POST` | `/api/admin/permissions/delete` | `post_admin_permissions_delete` | 797 | permission_group*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 41 | `POST` | `/api/admin/user/update` | `post_admin_user_update` | 818 | permission_group*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 42 | `POST` | `/api/admin/task/create` | `post_admin_task_create` | 839 | permission_group*, task*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 43 | `POST` | `/api/admin/task/update` | `post_admin_task_update` | 852 | permission_group*, task*, task_progress*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 44 | `POST` | `/api/admin/task/delete` | `post_admin_task_delete` | 873 | permission_group*, task*, task_progress*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 45 | `POST` | `/api/admin/prize/create` | `post_admin_prize_create` | 891 | permission_group*, prize*, prize_item*, shard*, shard_transfer*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 46 | `POST` | `/api/admin/prize/update` | `post_admin_prize_update` | 904 | permission_group*, prize*, prize_item*, shard*, shard_transfer*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 47 | `POST` | `/api/admin/prize/delete` | `post_admin_prize_delete` | 925 | market_order*, market_trade*, permission_group*, prize*, prize_item*, shard*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 48 | `GET` | `/api/user/all` | `get_user_all` | 943 | permission_group*, users | `column_missing` | table_missing,column_missing | 401 |
| 49 | `GET` | `/api/user/stats` | `get_user_stats` | 957 | asset*, permission_group*, users | `column_missing` | table_missing,column_missing | 401 |
| 50 | `GET` | `/api/tasklist/pending-verification/count` | `get_tasklist_pending_verification_count` | 970 | permission_group*, task_progress*, users | `column_missing` | table_missing,column_missing | 401 |
| 51 | `GET` | `/api/tasklist/pending-verification` | `get_tasklist_pending_verification` | 983 | permission_group*, task*, task_progress*, users | `column_missing` | table_missing,column_missing | 401 |
| 52 | `POST` | `/api/tasklist/:jID/verify` | `post_tasklist_jid_verify` | 997 | permission_group*, task*, task_progress*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 53 | `POST` | `/api/admin/assets/init` | `post_admin_assets_init` | 1053 | asset*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 54 | `POST` | `/api/admin/points/adjust` | `post_admin_points_adjust` | 1063 | asset*, permission_group*, users | `column_missing` | table_missing,column_missing | 未探测 |
| 55 | `USE` | `<catch-all 404 fallback>` | `catch-all_404_fallback` | 1093 | — | `ok` | — | 未探测 |

> `handler` 列：`index.ts` 里**所有处理函数都是匿名内联箭头**（无具名函数），
> 因此该列是按路由语义合成的名字，便于引用；真正的定位符是 `line`（`backend-ts/src/index.ts:<line>`）。

---

## 4. 实测证据（只读）

### 4.1 判负自证：已知缺口必须被独立重新发现

| 项 | 结果 |
|---|---|
| 目标路由 | `GET /api/user/asset/:uID`（`index.ts:364`） |
| 本审计的静态判定 | `table_missing`，`tables[asset].exists = false` |
| 实测（phase A，uID=1） | **HTTP 500** `{"success":false,"message":"Internal server error"}` |
| 实测（phase C，重复 2 次） | **HTTP 500** ×2（非瞬时抖动） |
| 对照：非法参数 uID=0 | HTTP 400 `Invalid user ID`（证明路由本身活着，是 DB 层死的） |

结论：**PASS**。该缺口是被本审计用独立路径（枚举 → 静态追踪 → 真库核对 → 实测）重新发现的，不是照抄结论。

### 4.2 失败面清单（A 阶段，24 条已实访路径的真实响应）

| method | path | 状态 | 响应体（截断） |
|---|---|---|---|
| `GET` | `/` | **200** | `{"success":true,"message":"Backend ready","data":{"status":"ok","message":"Seafood TypeScr` |
| `GET` | `/health` | **200** | `{"ok":true,"db_version":"PostgreSQL 18.6 (6569466) on aarch64-unknown-linux-gnu, compiled ` |
| `GET` | `/api/test/data` | **200** | `{"success":true,"message":"OK","data":{"status":"ok","message":"TypeScript backend is runn` |
| `GET` | `/api/prize/all` | **500** | `{"success":false,"message":"Failed to load prizes","error":"Failed to load prizes"}` |
| `GET` | `/api/task/all` | **500** | `{"success":false,"message":"Failed to load tasks","error":"Failed to load tasks"}` |
| `GET` | `/api/task/1` | **500** | `{"success":false,"message":"Failed to load task","error":"Failed to load task"}` |
| `GET` | `/api/prize/1` | **500** | `{"success":false,"message":"Failed to load prize","error":"Failed to load prize"}` |
| `GET` | `/api/user` | **401** | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| `GET` | `/api/user/asset/1` | **500** | `{"success":false,"message":"Internal server error","error":"Internal server error"}` |
| `GET` | `/api/home` | **500** | `{"success":false,"message":"Failed to load home payload","error":"Failed to load home payl` |
| `GET` | `/api/home` | **500** | `{"success":false,"message":"Failed to load home payload","error":"Failed to load home payl` |
| `GET` | `/api/prize-item` | **401** | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| `GET` | `/api/task-progress` | **401** | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| `GET` | `/api/task-progress/1` | **500** | `{"success":false,"message":"Failed to load task progress","error":"Failed to load task pro` |
| `GET` | `/api/shard` | **401** | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| `GET` | `/api/shard/transfer` | **401** | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| `GET` | `/api/order` | **401** | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| `GET` | `/api/admin/me` | **401** | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| `GET` | `/api/admin/settings` | **401** | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| `GET` | `/api/admin/permissions` | **401** | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| `GET` | `/api/user/all` | **401** | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| `GET` | `/api/user/stats` | **401** | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| `GET` | `/api/tasklist/pending-verification/count` | **401** | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |
| `GET` | `/api/tasklist/pending-verification` | **401** | `{"success":false,"message":"Unauthorized","error":"Unauthorized"}` |

状态码分布（A+B+C 全部实测请求，含 phase C 的重复探测）：`200`×4、`401`×13、`500`×28

### 4.3 关键对照实验：懒 DDL 之后仍然 500

| 路由 | 探测前（phase B） | 懒 DDL 之后（phase C，重复 2 次） | 说明 |
|---|---|---|---|
| `GET /api/market/1/orderbook` | 500 | 500, 500 | 表已建出但仍 500 → 根因是 R1/R2，不是单纯的缺表 |
| `GET /api/market/1/trades` | 500 | 500, 500 | 表已建出但仍 500 → 根因是 R1/R2，不是单纯的缺表 |

`:5788` 上仍然 200 的只有：`/`、`/health`、`/api/test/data`（三者都不碰遗留表）。

### 4.4 401 的真相（不是"登出"，是 DB 层崩了）

以下 13 条 GET 在无凭据时返回 401：`/api/user`、`/api/prize-item`、`/api/task-progress`、`/api/shard`、`/api/shard/transfer`、`/api/order`、`/api/admin/me`、`/api/admin/settings`、`/api/admin/permissions`、`/api/user/all`、`/api/user/stats`、`/api/tasklist/pending-verification/count`、`/api/tasklist/pending-verification`。

它们并不是"未登录"这么简单：`resolveActor()` 的 `verifySessionToken` 通过后会去查 `"users"."uID"`，
命中 R1 抛错 → 被 try/catch 吞掉 → `return null` → 401。**即使拿着合法 token 也永远登不进去**。
本审计**刻意不伪造 token**：这些 GET 路径（如 `/api/user`、`/api/home`）内部会调用 `upsertAsset()` 等写操作，
伪造会话就会引入 DB 写，违反本单只读约束。

---

## 5. 旧模块 → 新模块 映射提案（**提案，Zang 终审**）

### 5.1 四柱归类 + 逐路由提案

| method | path | 旧模块 | 提案归类 | 提案（旧→新） |
|---|---|---|---|---|
| `USE` | `<global middleware: helmet>` | 无（框架中间件 helmet/cors/json） | 平台基础 | 保留（无业务语义） |
| `USE` | `<global middleware: cors>` | 无（框架中间件 helmet/cors/json） | 平台基础 | 保留（无业务语义） |
| `USE` | `<global middleware: express.json>` | 无（框架中间件 helmet/cors/json） | 平台基础 | 保留（无业务语义） |
| `GET` | `/` | 无（旧站根路由） | 平台基础 | 保留；改为新站清单/版本探针 |
| `GET` | `/health` | 无（运维探针） | 平台运维 | 保留；schema_version 应指向新迁移链 0001–0012 |
| `GET` | `/api/test/data` | 无（开发桩） | 与新产品无关 | 删除（legacy_unmapped） |
| `POST` | `/api/auth/register` | 旧邮箱注册（已 410） | 邀请返佣/身份 | 删除；注册并入钱包签名 + 邀请绑定 referral_bind |
| `POST` | `/api/auth/challenge` | 旧钱包签名挑战 | 平台基础（身份） | 保留，重写为对新 users(uid,evm) 列读写 |
| `POST` | `/api/auth/verify` | 旧钱包登录 + asset 初始化 | 平台基础（身份） | 重写：users upsert + 余额改由 ledger_entry 派生（废弃 asset 表） |
| `POST` | `/api/auth/login` | 旧登录别名（内部转发 verify） | 平台基础（身份） | 同 verify；建议保留别名但共用新实现 |
| `GET` | `/api/prize/all` | prize/Brand（旧 reward） | ②商品 | 新 commodity（用户用 $ 标价） |
| `GET` | `/api/task/all` | task（旧任务/招工） | ①招工 | 新任务表（招工单）；或复用 task 表重命名 job |
| `GET` | `/api/task/:tID` | task（旧任务/招工） | ①招工 | 新任务表（招工单）；或复用 task 表重命名 job |
| `GET` | `/api/prize/:bID` | prize/Brand（旧 reward） | ②商品 | 新 commodity（用户用 $ 标价） |
| `GET` | `/api/user` | 旧用户详情（含 asset.points） | 平台基础（账户） | 重写：points 由账本聚合 |
| `POST` | `/api/user/profile` | 旧资料补全 | 平台基础（账户） | 重写为写 users.bio（列名大小写修复） |
| `GET` | `/api/user/asset/:uID` | 旧资产（asset 表） | 平台基础（账户） | 废弃 asset 表；改 /api/user/points（账本派生） |
| `GET` | `/api/home` | 旧首页聚合（task+prize+asset） | ①招工+②商品 | 重写：招工列表 + 商品列表 + 我的积分 |
| `GET` | `/api/prize-item` | prize_item（旧领取物） | ②商品 | 商品持有/交付记录 |
| `GET` | `/api/task-progress` | journey/task_progress（旧任务进度） | ①招工 | 招工报名/提交/审核流水 |
| `GET` | `/api/task-progress/:jID` | journey/task_progress（旧任务进度） | ①招工 | 招工报名/提交/审核流水 |
| `POST` | `/api/task-progress/:identifier/submit` | journey/task_progress（旧任务进度） | ①招工 | 招工报名/提交/审核流水 |
| `POST` | `/api/task-progress/claim/:jID` | journey/task_progress（旧任务进度） | ①招工 | 招工报名/提交/审核流水 |
| `GET` | `/api/shard` | shard/shard_transfer（旧碎片） | ③积分交易所 | 交易所持仓/转让；dashJ 作为可流通积分单位之一（cid），碎片改为 currency.cid 维度 |
| `GET` | `/api/shard/transfer` | shard/shard_transfer（旧碎片） | ③积分交易所 | 交易所持仓/转让；dashJ 作为可流通积分单位之一（cid），碎片改为 currency.cid 维度 |
| `POST` | `/api/shard/redeem` | shard/shard_transfer（旧碎片） | ③积分交易所 | 交易所持仓/转让；dashJ 作为可流通积分单位之一（cid），碎片改为 currency.cid 维度 |
| `POST` | `/api/chest/:bID/open` | shard/shard_transfer（旧碎片） | ③积分交易所 | 交易所持仓/转让；dashJ 作为可流通积分单位之一（cid），碎片改为 currency.cid 维度 |
| `GET` | `/api/order` | market_order/market_trade（旧碎片交易） | ③积分交易所 | 挂单/撮合迁到账本双分录（ledger_post_event 冻结/划转） |
| `POST` | `/api/order` | market_order/market_trade（旧碎片交易） | ③积分交易所 | 挂单/撮合迁到账本双分录（ledger_post_event 冻结/划转） |
| `DELETE` | `/api/order` | market_order/market_trade（旧碎片交易） | ③积分交易所 | 挂单/撮合迁到账本双分录（ledger_post_event 冻结/划转） |
| `DELETE` | `/api/order/:oID` | market_order/market_trade（旧碎片交易） | ③积分交易所 | 挂单/撮合迁到账本双分录（ledger_post_event 冻结/划转） |
| `GET` | `/api/market/:bID/orderbook` | market_order/market_trade（旧碎片交易） | ③积分交易所 | 挂单/撮合迁到账本双分录（ledger_post_event 冻结/划转） |
| `GET` | `/api/market/:bID/trades` | market_order/market_trade（旧碎片交易） | ③积分交易所 | 挂单/撮合迁到账本双分录（ledger_post_event 冻结/划转） |
| `GET` | `/api/admin/me` | permission_group 权限 | 后台管理 | 保留（平台运维） |
| `GET` | `/api/admin/settings` | app_config 平台设置 | 后台管理 | 保留（平台运维） |
| `POST` | `/api/admin/settings` | app_config 平台设置 | 后台管理 | 保留（平台运维） |
| `POST` | `/api/admin/settings/reset` | app_config 平台设置 | 后台管理 | 保留（平台运维） |
| `GET` | `/api/admin/permissions` | permission_group 权限 | 后台管理 | 保留（平台运维） |
| `POST` | `/api/admin/permissions/save` | permission_group 权限 | 后台管理 | 保留（平台运维） |
| `POST` | `/api/admin/permissions/delete` | permission_group 权限 | 后台管理 | 保留（平台运维） |
| `POST` | `/api/admin/user/update` | permission_group 权限 | 后台管理 | 保留（平台运维） |
| `POST` | `/api/admin/task/create` | admin task CRUD（管理员发布任务） | ①招工 | 下线（管理员不再发 task）；保留审核能力 |
| `POST` | `/api/admin/task/update` | admin task CRUD（管理员发布任务） | ①招工 | 下线（管理员不再发 task）；保留审核能力 |
| `POST` | `/api/admin/task/delete` | admin task CRUD（管理员发布任务） | ①招工 | 下线（管理员不再发 task）；保留审核能力 |
| `POST` | `/api/admin/prize/create` | prize/Brand（旧 reward） | ②商品 | 新 commodity（用户用 $ 标价） |
| `POST` | `/api/admin/prize/update` | prize/Brand（旧 reward） | ②商品 | 新 commodity（用户用 $ 标价） |
| `POST` | `/api/admin/prize/delete` | prize/Brand（旧 reward） | ②商品 | 新 commodity（用户用 $ 标价） |
| `GET` | `/api/user/all` | 旧用户列表 | 后台管理 | 重写为只读运维视图（users 新列） |
| `GET` | `/api/user/stats` | 旧用户统计 | 后台管理 | 重写（账本口径统计） |
| `GET` | `/api/tasklist/pending-verification/count` | tasklist 审核队列 | ①招工 | 招工提交审核队列（管理员改为审核方，不再是发布方） |
| `GET` | `/api/tasklist/pending-verification` | tasklist 审核队列 | ①招工 | 招工提交审核队列（管理员改为审核方，不再是发布方） |
| `POST` | `/api/tasklist/:jID/verify` | tasklist 审核动作（管理员审核） | ①招工 | 招工提交审核（approve/reject）；管理员由发布方改为审核方 |
| `POST` | `/api/admin/assets/init` | asset 积分管理 | 后台管理 | 改为账本调整（ledger_post_event + 幂等键），废弃 asset |
| `POST` | `/api/admin/points/adjust` | asset 积分管理 | 后台管理 | 改为账本调整（ledger_post_event + 幂等键），废弃 asset |
| `USE` | `<catch-all 404 fallback>` | 无（框架 404 兜底） | 平台基础 | 保留 |

### 5.2 提案要点（差异与大动作）

1. **① 招工**：旧 `task` + `journey/task_progress` + `tasklist` 审核队列整体映射为"招工单 + 报名/提交/审核"。
   管理员角色从"发布 task"变为"审核"，与 `docs/seafood.master-plan.md` 的"管理员搭平台 + 提供服务"一致；
   `/api/admin/task/*` 建议**下线**（不再由后台发单）。
2. **② 商品**：旧 `reward/prize`（`prize`/`prize_item`，主键 `bID`）→ 新"商品 + 商品持有/交付"，
   标价从"平台定 points"改为"用户用 `$` 标价"。建议**改名**（prize → commodity）避免把旧语义带过来。
3. **③ 积分交易所**：旧「碎片交易」`shard` / `shard_transfer` / `market_order` / `market_trade` / `chest`
   → 新交易所。**关键落差**：旧撮合直接改 `asset.points`，新交易所必须走 P1 账本双分录
   （`ledger_post_event` 冻结/划转 + 幂等键），`dashJ` 用 `currency.cid` 表达为**可流通积分单位之一**。
4. **④ 邀请返佣**：`referral` / `commission_policy` / `referral_bind` 已在 P2 实现，但**当前 0 条路由触达**。
   提案新增 `GET /api/referral/mine`、`GET /api/referral/earnings`、`POST /api/referral/bind` 等（旧面无对应模块）。
5. **旧 `asset` 表整个废弃**：`/api/user/asset/:uID`、`/api/user`、`/api/admin/points/adjust`、
   `/api/admin/assets/init`、`/api/auth/verify` 里的 `asset.points` 语义，应由**账本聚合**（`ledger_entry`）替代。
6. **平台基础/后台**：`/health`、`/api/auth/challenge`、`/api/admin/settings*`、`/api/admin/permissions*` 建议保留但重写列名与数据源。

### 5.3 当前"零入口"的缺口清单（比死路由更重要的发现）

| 能力 | 现状 | 说明 |
|---|---|---|
| 招工（①） | **无可用入口**（`task` 表不存在 + 全部 task 路由死） | 需要新表 + 新路由 |
| 商品（②） | **无可用入口**（`prize` 仅在懒 DDL 后存在，且查询层类型不兼容） | 需要新模型（`$` 标价） |
| 积分交易所（③） | **无可用入口** | 需要接账本双分录 |
| 邀请返佣（④） | **0 条 HTTP 路由**（机制在 P2 已闭环） | 只需补用户可见面 |
| 账本内核（P1）/ 十级返佣（P2） | **0 条 HTTP 路由** | `ledger_entry`、`ledger_post_event`、`referral_bind`、`commission_policy` 无任何出口 |

---

## 6. 未验证项与边界

1. **带凭据的真实响应未测**：13 条认证/管理员路由只观察到 401。合理解释见 §4.4（伪造 token 会触发写路径），
   如需实测须 Zang 提供测试环境 + 只读账号。
2. **写方法未发任何请求**：25 条 POST/PUT/PATCH/DELETE 仅静态追踪（本单禁止写操作），
   其 verdict 是按同一套 DB 对象/列推导出来的，未实测。
3. **`function_missing` 本轮 0 命中**：拷来的路由层**没有调用任何 `ledger_*` / `referral_*` 函数**；
   被调用的内建函数（`btrim`/`coalesce`/`now`/`to_jsonb`/`generate_series`）在 18.6 上都存在。
   本单不把它记作 0 是"没问题"，而是"**账本内核零 HTTP 面**"这一事实的另一种表述。
4. **SQL 对象抽取是静态 + 正则 + 别名归属**，对每条语句按 `alias.col` 归属列；
   单表语句才归属裸列。核心结论（`users` 的 `uID`/`EVM`、11 张缺表）已用 §2 的只读 SQL/EXPLAIN 独立验证。
5. **懒 DDL 已改变真库**（§0.2）：本单未清理、未 `DROP`；下次审计的基线应以 Zang 处置后的状态为准。
6. **`frontend/` 未审计**：前端调用面（哪些页面依赖哪些路由）不在本单范围。
7. **`docs/audit/*.json` 里的列清单**是"被引用的列"，不等于"应当存在的列"；新模型设计时以 master-plan 为准。

---

## 附录 A · 机读清单字段

`docs/audit/p3-route-inventory.json` = `{ summary, routes[] }`，每条 route：

```jsonc
{
  "method": "GET", "path": "/api/user/asset/:uID",
  "handler": "get_user_asset_uid",            // 合成名（源码是匿名内联箭头）
  "line": 364, "source": "backend-ts/src/index.ts:364",
  "service_methods": ["getUserAsset", "upsertAsset"],   // 传递闭包
  "tables": [{"name":"asset","exists":false,
              "exists_after_lazy_ddl":false,
              "lazily_created_by_ensureSupportSchema":false,
              "columns_used":[ ... ], "columns_missing":[ ... ],
              "reached_via":["getUserAsset","upsertAsset"]}],
  "functions": [{"name":"...","exists":true|false}],
  "verdict": "table_missing",
  "verdict_evidence": "...", "secondary_failure_classes": ["table_missing"],
  "live_probe": {"probed_path":"/api/user/asset/1","results":[{"phase":"A","status":500,...}]},
  "notes": "...", "mapping_proposal": {"legacy_module":"...","proposed_pillar":"...","proposal":"..."}
}
```

严格按本单要求保留的键：`method` / `path` / `handler` / `line` / `tables[]{name,exists,columns_used,columns_missing}` /
`functions[]{name,exists}` / `verdict`；其余为证据与提案字段（附加，不冲突）。

