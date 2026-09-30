# P4 · A1-LEDGER-DESIGN — `asset` 缺表类级扫描 + A1 接账本「四册齐核」取证报告

> 单号 = **A1-LEDGER-DESIGN** · 角色 = **Kong（实现方 · 本单只取证）** · 日期 = 2026-09-30 CST
> run tag = **a1ld-20260930T133212Z** · 产物 = `backend-ts/.p4-artifacts/a1ld-20260930T133212Z/`
> 脚本 = `backend-ts/scripts/p4z-a1ld-01-probe.ts`
> **本单性质 = 只取证、不裁决、不改码**：不选边、不推荐落法、不写 `src/**` / `migrations/**` / spec。
> 报告骨架**先行落盘**，随后逐段回填（每节自带上行 `文件:行号` 支撑读数）。

## §0 待判 / 结论摘要

**已实测的硬事实（每条可 `grep` 到支撑读数）**
1. **库内 `public` 共 22 张表**（现取：`results.json:tables`，`live_table_count=22`），**`asset` 不在其中**（`SUSPECT asset => NOT_EXISTS_IN_DB`）。
2. **代码引用 ∖ 迁移建表 = 9 个名字**（`diff_src_minus_migrations`）：`asset` / `task` / `task_progress` / `prize` / `prize_item` / `shard` / `shard_transfer` / `schema_migration` / `profile`。其中 **7 项在库里确实不存在**（同上逐个 `NOT_EXISTS_IN_DB`）、**1 项（`schema_migration`）库里存在**（19 行，只是不由 `migrations/**` 创建）、**1 项（`profile`）是探针假阳性**（命中 = 错误消息文本 `src/index.ts:483`）。
3. **A1 成功路径不可达（与本单前置对齐）**：`src/index.ts:1213` → `src/database.ts:940 adjustPoints` → `:954 upsertAsset` → **写 `asset`**（`:895 UPDATE asset` / `:910 INSERT INTO asset`）⇒ `42P01`，被 `src/index.ts:1214-1216` 吞成 **`404` +「积分调整失败」**。
4. **同类面（本单新发现 · 静态推定，未发写请求）**：`src/database.ts:889 upsertAsset` 的**写侧**还被 **2 条在册活路由**调用 —— `POST /api/task-progress/claim/:jID`（`src/index.ts:633`，写点 `:657` / `:668`）与 `POST /api/auth/verify`（`src/index.ts:352`，写点 `:356`，在 `catch` 内被吞成 `401`，见 §1.3 表尾注）。**HTTP 级实测 = `NOT_MEASURED`**（本单红线禁写）。
5. **A1 接账本的册级口径已齐**：kind = `mint` / `burn`、仅 `$`(`cid=1`)、幂等键 `ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq>`、必填原因码 —— **四册中三册点名、`commission.spec` 两口径零命中**（§2.1）。
6. **张力 5 条**（§2.2，**只列不裁**）：其中 **T5 = 现实现的 `amount > 0` 硬校验（`src/index.ts:1197`）与册内 `burn`（扣分）口径不可共存**（扣分无法表达）为最硬的一条。

**待 Kevin / Zang 裁决项（本单不选边）**：① 落法选项 A/B/C 择一（§3）；② §2.2 五条张力的取舍；③ 「日累计上限」是否属册内要求（四册字面零命中，§2.1 册4 行）。

## §1 类级扫描：「代码引用表名 ∖ 迁移建表」

### §1.1-a 迁移实际建过的表名集合（`migrations/**` 现取，file:line）

**宽式→严格式两口径**（§5.7 ⑤）：`grep -rniE 'create +table' migrations/ | wc -l` = **29 行**（宽式，含注释里被引用的规划文本）；严格式（`CREATE TABLE [IF NOT EXISTS] <name>`，剔除 5 行注释）现取 = **20 处 DDL / 20 个不同表名**。

| 迁移文件:行号 | 表名 |
|---|---|
| `migrations/0001_ledger_core.sql:13` | `currency` |
| `migrations/0001_ledger_core.sql:41` | `account` |
| `migrations/0001_ledger_core.sql:55` | `ledger_entry` |
| `migrations/0001_ledger_core.sql:96` | `ledger_owner` |
| `migrations/0002_user_identity.sql:11` | `"user"`（**后由 0006 改名**） |
| `migrations/0007_referral_and_commission_policy.sql:48` | `referral` |
| `migrations/0007_referral_and_commission_policy.sql:84` | `commission_policy` |
| `migrations/0013_job.sql:79` | `job` |
| `migrations/0014_job_flow.sql:79` | `job_application` |
| `migrations/0014_job_flow.sql:115` | `job_submission` |
| `migrations/0015_listing.sql:115` | `listing` |
| `migrations/0015_listing.sql:153` | `listing_order` |
| `migrations/0016_market.sql:112` | `market_order` |
| `migrations/0016_market.sql:159` | `market_trade` |
| `migrations/0017_platform_config.sql:69` | `app_config` |
| `migrations/0017_platform_config.sql:93` | `admin_role` |
| `migrations/0017_platform_config.sql:103` | `admin_permission` |
| `migrations/0017_platform_config.sql:112` | `admin_role_permission` |
| `migrations/0017_platform_config.sql:123` | `admin_user_role` |
| `migrations/0017_platform_config.sql:139` | `currency_status_log` |

**迁移侧表名全集 = 上表 20 + `users`（非 `CREATE TABLE`，由 `migrations/0006_user_to_users.sql:75` `EXECUTE 'ALTER TABLE public."user" RENAME TO users'` 产生）⇒ 21 个名字。**
另有 `migrations/0016_market.sql:76` 注释记 `CREATE OR REPLACE VIEW`，对应现取库内视图 **`candle_view`**（`results.json:tables`）。
**`asset` 在 `migrations/**` 的命中 = 0**（裸词边界口径，见 §1.4 双口径复核）。
制表口径证据：`backend-ts/.p4-artifacts/a1ld-20260930T133212Z/tables_from_migrations.txt`（25 行 = 20 真名 + 5 行探针残渣，残渣见 §1.4）。

### §1.2-b 代码引用的表名集合（`src/**` 现取，file:line）

口径 = `grep -rniE '(from|into|update|join|delete +from) +(public\.)?"?<name>"?_?\b' src/ --include='*.ts'`（**修正后**正则，首轮瑕疵见 §1.4-①）。**28 行命中，全部为「裸名 / 不带 schema 限定」写法**；证据 = `.p4-artifacts/a1ld-20260930T133212Z/src_table_refs.txt`。

| 文件:行号 | 语句（表名） | 读/写 | 所在函数（现取 `file:line`） |
|---|---|---|---|
| `src/database.ts:757` | `FROM task_progress AS j` | 读 | `getTaskParticipantCounts`（`:750`） |
| `src/database.ts:895` | `UPDATE asset AS a` | **写** | `upsertAsset`（`:889`） |
| `src/database.ts:910` | `INSERT INTO asset AS a (...)` | **写** | `upsertAsset`（`:889`） |
| `src/database.ts:1134` | `FROM task_progress AS j` | 读 | `countTaskParticipants`（`:1130`） |
| `src/database.ts:1202` | `FROM task_progress AS j` | 读 | `findTaskProgressByUserAndTask`（`:1198`） |
| `src/database.ts:1215` | `INSERT INTO task_progress AS j (...)` | **写** | `createTaskProgress`（`:1212`） |
| `src/database.ts:1239` | `UPDATE task_progress AS j` | **写** | `submitTaskProgressInfo`（`:1236`） |
| `src/database.ts:1252` | `UPDATE task_progress AS j` | **写** | `markTaskProgressChecked`（`:1249`） |
| `src/database.ts:1264` | `UPDATE task_progress AS j` | **写** | `claimTaskProgress`（`:1261`） |
| `src/database.ts:2266` | `UPDATE task_progress AS j` | **写** | `rejectPendingTaskProgress`（`:2263`） |
| `src/database.ts:2624` | `INSERT INTO prize_item AS g (...)` | **写** | `createPrizeInventoryRows`（`:2617`） |
| `src/database.ts:2637` | `DELETE FROM prize_item` | **写** | `trimAvailablePrizeInventory`（`:2630`） |
| `src/database.ts:2640` | `FROM prize_item AS g` | 读 | `trimAvailablePrizeInventory`（`:2630`） |
| `src/database.ts:2709` | `INSERT INTO prize AS b (...)` | **写** | `createBrand`（`:2669`） |
| `src/database.ts:2802` | `UPDATE prize AS b` | **写** | `updateBrand`（`:2758`） |
| `src/database.ts:2833` | `FROM prize_item AS g` | 读 | `deleteBrand`（`:2828`） |
| `src/database.ts:2850` | `FROM shard AS s` | 读 | `deleteBrand`（`:2828`） |
| `src/database.ts:2871` | `DELETE FROM prize` | **写** | `deleteBrand`（`:2828`） |
| `src/database.ts:2893` | `INSERT INTO task AS t (...)` | **写** | `createTask`（`:2877`） |
| `src/database.ts:2941` | `UPDATE task AS t` | **写** | `updateTask`（`:2927`） |
| `src/database.ts:2971` | `DELETE FROM task` | **写** | `deleteTask`（`:2963`） |
| `src/database.ts:3000` | `INSERT INTO shard AS s (...)` | **写** | `createShardLedgerEntry`（`:2993`） |
| `src/database.ts:3016` | `INSERT INTO shard_transfer AS st (...)` | **写** | `recordShardTransfer`（`:3005`） |
| `src/database.ts:3534` | `FROM prize_item AS g` | 读 | `redeemPrizeItemFromShards`（`:3525`） |
| `src/database.ts:3556` | `UPDATE prize_item AS g` | **写** | `redeemPrizeItemFromShards`（`:3525`） |
| `src/db.ts:252` | `FROM public.schema_migration` | 读 | 模块级 `getSchemaVersion`（`src/db.ts:252`） |
| `src/index.ts:483` | （命中 = 字符串 `'Failed to update profile'`） | — | **假阳性，非表引用**（§1.4-③） |
| `src/database.ts:903` / `:916` | （命中 = `throw new Error('Failed to update asset')` / `'Failed to create asset'`） | — | **假阳性，非 SQL**（同 §1.4-③ 口径） |

> **零引用双口径**：`migrations/**` 内 `asset` —— 裸词口径 `grep -rniE '\basset\b' migrations/` = **0 行**；带引号/限定口径复核见 §1.4-④。

### §1.3-c 差集（代码引用 ∖ 迁移建表）逐项定性

**差集原始清单（探针现取，`diff_src_minus_migrations`）= 9 项**；剔除 1 个假阳性（`profile`）后 **8 项**，其中 **7 项库内确实不存在**、**1 项（`schema_migration`）库内存在**。

| # | 表名 | 引用点（`文件:行号`） | 读/写 | 触达路由（`src/index.ts:行号`） | 会被吞成什么 | 是否已被 spec 登记（带行号） |
|---|---|---|---|---|---|---|
| 1 | **`asset`** | 写 `database.ts:895` / `:910`（`upsertAsset` `:889`）；读侧**已迁** `database.ts:866` `FROM account AS a`（`:860` 注释逐字「原 `asset` 表不存在」） | **写**（读侧已迁） | ① `POST /api/admin/points/adjust` `index.ts:1182` → `:1213` → `database.ts:940` → `:954`；② `POST /api/auth/verify` `index.ts:352` → `:356`；③ `POST /api/task-progress/claim/:jID` `index.ts:633` → `:657` / `:668` | ① **404**「积分调整失败」（`index.ts:1214-1216`，A1-CAP 单已实测）；② **401**（`index.ts:370-372` catch）；③ **500**（catch 行号未现取 ⇒ §4-N2） | **是** —— `data-layer.spec:166`（「不存在，且永不创建」）·`:186/:187`（列级废弃）·`:291`(#53)·`:292`(#54)·`:316`·`:217`(DL26「含只读引用」)·`:343`(C3③)；`route-layer.spec:176`(行 51「保留·改接」)·`:640`(§4.2 业务事件总表 A1 行)·`:270`；`p4-a1cap-points-cap.md:64/91/115` |
| 2 | **`task_progress`** | 读 `:757`/`:1134`/`:1202`；写 `:1215`/`:1239`/`:1252`/`:1264`/`:2266`（函数见 §1.2-b 表） | 读 3 · **写 5** | 活: `POST /api/task-progress/claim/:jID` `index.ts:633`（`claimTaskProgress`）；`GET/POST /api/task-progress*` `:558`/`:572`/`:591`（经 `getTaskProgress`，**该函数未命中** ⇒ 其读源 = §4-N2）；死: `createTaskProgress`←`:1233`←无调用方 | **500**（claim 面 catch 行号未现取）；sunset 面 410 不再触达 | **是**（点名）—— `data-layer.spec:217` DL26 逐字把 `task_progress` 列入「不得出现在任何新迁移、新代码、新路由里（含只读引用）」；`route-layer.spec` 内**未检索**（§4-N2） |
| 3 | **`task`** | 写 `:2893`/`:2941`/`:2971`（`createTask`:2877 / `updateTask`:2927 / `deleteTask`:2963）；**无 `FROM task` 命中（只写不读）** | **写（无读）** | `POST /api/admin/task/create|update|delete` `index.ts:1017/1021/1025` = **410 sunset**（`sendGone`）⇒ **死写**；`GET /api/task/all`(`:392`→`listTasks`:1067) 与 `GET /api/task/:tID`(`:404`→`getTask`:1095) **不触 `task` 表**（零命中）⇒ 不受影响 | 若复活即 `42P01`；当前面 = 410 | **是** —— `data-layer.spec:217` DL26 点名 `task`；`route-layer.spec` 内未检索（§4-N2） |
| 4 | **`prize`** | 写 `:2709`（`createBrand`:2669）/`:2802`（`updateBrand`:2758）/`DELETE :2871`（`deleteBrand`:2828） | **写** | `POST /api/admin/prize/*` `index.ts:1029/1036/1043` = **410 sunset** ⇒ 死写 | 当前面 = 410；复活即 `42P01` | **是** —— `data-layer.spec:343` C3①「`/api/admin/prize/*` **删除**」+ `:217` DL26 点名 `prize` |
| 5 | **`prize_item`** | 写 `:2624`/`:2637`/`:3556`；读 `:2640`/`:2833`/`:3534` | 读 3 · 写 3 | `syncPrizeInventory`(:2649)←（调用方未回溯 = §4-N2）；`deleteBrand`(:2828, 410 面)；`redeemPrizeItemFromShards`(:3525) ← `POST /api/shard/redeem` `:715` = **410**；`GET /api/prize-item`(`:544`→`listPrizeItemsByUser`:1028) **零命中** ⇒ 不受影响 | 当前面 = 410 / 未回溯 | **是** —— `data-layer.spec:217` DL26 点名 `prize_item`（另 `:166/:186/:187` 同族废弃条） |
| 6 | **`shard`** | 写 `:3000`（`createShardLedgerEntry`:2993）；读 `:2850`（`deleteBrand`） | 读 1 · 写 1 | 读口 `GET /api/shard` `:685` → `listShardHoldingsByUser`(:2979) = **恒空态 200 + `deprecated:true`**（`index.ts:692-693` 逐字「无对应表」）；写口 `/api/shard/redeem` `:715` = **410**、`/api/chest/:bID/open` `:721` = **410**；**写函数的 in-code 调用点** = `database.ts:3207/3220`(matchMarketOrder)、`:3309/3310`(placeOrder)、`:3393/3394`(cancelOrder)、`:3498/3499`(openFreeShardChest)、`:3546/3547`(redeemPrizeItemFromShards) —— **market 家族是否在活路由上可触达 = §4-N3** | 读 = 200 空态（**不是 404**）；写 = 由调用方 catch 决定（**未实测**） | **是** —— `migrations/0016_market.sql:49` 注释逐字「**不建** `shard` / `shard_transfer` / 持仓表 / 成交流水第二真源（DL29 / DL69）」+ `data-layer.spec:217` DL26 点名 |
| 7 | **`shard_transfer`** | 写 `:3016`（`recordShardTransfer`:3005） | **写** | 读口 `GET /api/shard/transfer` `:700` → `listShardTransfersByUser`(:3049) = **恒空态 200 + `deprecated:true`**（`index.ts:707-708`）；写点同 #6 的 5 处 | 读 = 200 空态；写 = 未实测 | **是** —— 同 #6（`0016_market.sql:49` + `data-layer.spec:217` DL26） |
| 8 | **`schema_migration`** | 读 `src/db.ts:252` | 读 | `GET /health`（探测面） | **无异常**：库内**确实存在**（`results.json:186` `rowcount=19`）；仅「不由 `migrations/**` 创建」 | **是** —— `route-layer.spec:57`（「`schema_migration` = **19**（`0018` 无文件、**勿补**）」）；`migrations/0006:33`·`0009:51`·`0010:49`（不改其既有行） |
| — | `profile` | `src/index.ts:483` | — | — | — | **假阳性，已剔除**（§1.4-③） |

> **差集「真项」= 7 个（`asset` / `task` / `task_progress` / `prize` / `prize_item` / `shard` / `shard_transfer`），全部库内不存在**；`schema_migration` 属「迁移外建表」而非缺表；`profile` 属探针误差。

### §1.4 探针自曝（口径瑕疵 / 假阳性 / 未测项）

① **首轮正则自伤（§5.7 ③「先怀疑自己的探针」）**：我最初用 `(from|into|update|join|delete +from) +"?public"?\.?"?(<表名>)"?\b` —— 该式**强制要求字面 `public`**（`"?public"?` 的 `public` 非可选）⇒ 首轮只命中 `src/db.ts:252` 一行，**其余裸名引用全被漏掉**。修正为 `(public\.)?"?<name>"?_?\b` 后得 **28 行**（`src_table_refs.txt`）。
② **建表清单抽取残渣**：`sed -E 's/.*(IF +NOT +EXISTS)? +"?([a-zA-Z0-9_\.]+)"? *$/\2/'` 对 `CREATE TABLE IF NOT EXISTS x` 在 5 个文件上吐出残渣行 `IF`（`0013`/`0014`/`0015`/`0016`/`0017`）⇒ `tables_from_migrations.txt` 25 行 = **20 真名 + 5 残渣**；表名集合已用独立严格式（`search_files` 正则 `create\s+table\s+(if\s+not\s+exists\s+)?"?[a-z_]+` = 25 行命中，其中 5 行为注释）复核为 **20 个真名**。
③ **假阳性 3 处**（均非 SQL）：`src/index.ts:483` `'Failed to update profile'`、`src/database.ts:903` `'Failed to update asset'`、`src/database.ts:916` `'Failed to create asset'`。
④ **零引用双口径已闭合**：`migrations/**` 内 `asset` —— 裸词边界 = **0 行**；带引号/限定 `("asset"|public\."?asset"?)` = **0 命中**（`total_count: 0`）⇒「迁移从不建 `asset`」成立。
⑤ **`neon()` 自适应分支未记录**：脚本按 `sql.query ?? sql(t,p) ?? sql.unsafe` 自适应，但**实际走了哪一支未打印**（§4-N4）。
⑥ **本单未发任何写请求、未执行任何 DDL/DML、未启停服务**；探针全部走 `neon()`（HTTP），**未用 `Client`(ws)**；`SELECT` / `information_schema` / `pg_catalog` 纯读。

## §2 A1（后台调分）接账本「四册齐核」

### §2.1 逐册取证表（kind / 方向 / 平台 uid 白名单 / 上限 · 审计 / 正负号）

**四册现取**：`docs/ledger.spec.md`（2028 行）· `docs/data-layer.spec.md`（1023 行）· `docs/commission.spec.md` · `docs/route-layer.spec.md`（1554 行 / v0.9）。

#### 册1 `docs/ledger.spec.md`（账本内核）

| 问项 | 取证（`文件:行号`） | 结论 |
|---|---|---|
| kind | `:187` 值集含 `'mint','burn','transfer','hold',…`；`:210`「v0.3 值集 = 20 个，与 `0003_kind_close_set_20.sql` 逐字一致」 | `mint` / `burn` 均为合法 kind；**A1 路由名 / 「调分」在本册 = 0 命中**（`grep -nE '调分\|points/adjust\|admin/points'` 无输出）⇒ 本册**不点名 A1**，只提供 kind 语义与保留 uid 表 |
| 方向（mint） | `:343`（逐字）`\| 1 \| mint \| 铸币 \| 系统（无对手方） \| owner 本人 balance +n \| **+n** \| currency \|`；`:827`（`$` 的 `owner_uid` = `0`） | `mint` 的**减方 = 系统（无对手方）**、**增方 = owner 本人**；对 `$` 而言 owner = uid `0`，而「铸币到用户」写在 `:827` 的「去向」格（「`mint` 到用户、平台运维转账」） |
| 方向（burn） | `:344`（逐字）`\| 2 \| burn \| 销毁 \| 本人 balance −n \| 系统（无对手方） \| **−n** \| currency \|`；`:282` R25 | `burn` 减方 = 持有人本人；**只有持有人本人可发起；`$` 的 `burn` 仅平台可发起** |
| 授权 | `:250`（「谁可 `mint`」：`$` = **仅平台**（后端受信任路径 / 管理员角色，`uid = 0` 主体））· `:280` R23（`owner_uid` 相等 **或** `owner_uid = 0` 且调用方是平台受信任路径）· `:281` R24（`supply_cap` 校验） | 管理员（平台受信任路径）铸 `$` = 册内允许 |
| 平台 uid | `:823` §13.2「保留 uid 区间（**写死，不可分配**）」· `:827` `0` = 平台主体 / `$` 的 `owner_uid` / 铸币源（资金来源 `mint`）· `:828` `−1` = 手续费归集（`trade_fee` + `listing_fee` + `currency_create_fee` + `listing_deposit`）· `:829` `−2` = 佣金池（`job_fee` 入 / `commission` 出）· `:830` `−3` = 罚没（`hold_forfeit`）· `:831` `−4…−99` 预留 · `:832` `−100` 及以下禁用 | **`mint`/`burn` 均不列 `−1`/`−2`/`−3` 的任何一栏**；`−1` 只收 4 个 fee kind、`−2` 只 `job_fee`/`commission`、`−3` 只 `hold_forfeit` |
| 白名单落点 | `src/ledger.ts:535-555`（`PLATFORM_KIND_WHITELIST`，R101）：`:536` `'0'` credit `['mint','transfer','reversal']` / debit `['transfer','burn','reversal']`；`:550` `'-1'` credit `['trade_fee','listing_fee','currency_create_fee','job_fee','listing_deposit']` / **debit `[]`**；`:551` `'-2'`；`:554` `'-3'`。断言函数 `:557-567`（违反 ⇒ `LEDGER_RESERVED_UID`，`:560-565`）。**DB 侧同构函数现取存在**：`ledger_assert_platform_mutation(p_uid bigint, p_kind text, p_dir text)`（`results.json:195-197`，`src_len=1250`，`prosrc ILIKE '%''mint''%'` = `true`，`results.json:205-209`） | `mint` 只出现在 **uid `0` 的 credit** 白名单；`−1` 的 debit **恒空** ⇒ 「从任何账户向 `−1` 转出」在 `−1` 侧被判非法（张力 T1/T2，§2.2） |
| 上限 / 审计 | `grep -nE '日累计\|累计上限\|审计留痕\|reason_code\|必填原因' docs/ledger.spec.md` = **0 命中**（实测）；`审计` 字面 = **19 处**（逐条相关性未核 ⇒ §4-N5） | 本册**无 A1 专项上限/审计条**（字面口径）；其余 19 处 `审计` 的适用性 = `NOT_MEASURED` |
| 正负号 | `:101`（净增发 = `mint` 增 / `burn` 减）· `:343/:344`（`+n` / `−n`）· `:373` R41（`Σdelta = 0`，**唯一例外** = 含 `mint`/`burn` 的事件）· `:374` R42（禁单边分录，`mint`/`burn` 例外） | 加分 = `mint`（`+n`）、扣分 = `burn`（`−n`）；两者都是「单边分录的合法例外」 |
| 与「消耗入 `−1`」的关系 | `:836`（§13.2 逐字：「上市保证金是**消耗**：在上市事务内直接从创建者 `balance` 扣、转入平台手续费归集账户 `uid = −1`（kind `listing_deposit`）」）· `:821`（§13.1 裁决：**用保留 uid，不用独立账户表** —— 否则「第二套账」使判据 1/3/7 失效） | 调分走 `mint`/`burn`（对手方 = 系统/平台主体），**不经 `−1`** ⇒ 与「建币费/保证金 = 消耗入 `−1`」**不直接冲突**；但见张力 T1（若把扣分实现为 `transfer → −1`） |

#### 册2 `docs/data-layer.spec.md`（数据层）

| 问项 | 取证（`文件:行号`） | 结论 |
|---|---|---|
| kind | `:343` C3 ③（逐字见 §2.3 式引）：**只能 `mint`/`burn`** `$`（`cid=1`）；`:292` #54（「**必须**限定 kind = `mint` / `burn`（`$` 由平台主体发起，R23/R25）」） | kind **= `mint` / `burn`**（本册**点名 A1**，是四册中最明确的一册） |
| 方向 | `:513`（逐事件形态表，逐字）`\| 平台 \| 管理员调分（#54，形态见 C3） \| mint ×1（$：系统 → 目标用户 balance +n） \| currency / cid \| ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq> \| **+n** \|` | `mint ×1`，**系统 → 目标用户**，`+n`；本表**只给 mint 一行，未给 burn 行** |
| 平台 uid | `:343`/`:292`（「**`$` 由平台主体发起**」）· `:531` DL89（`mint` 只允许 ①平台铸 `$`（`owner_uid = 0`，R23）②自建 owner 铸给自己；`burn` 只允许持有人本人，`$` 由平台发起，R25；**四柱日常动作不得用 `mint`/`burn`**） | 平台主体 = R23 的「平台受信任路径」；**本册未指名 `0` / `−1` / `−2` / `−3` 中的哪一个**（`0` 由 ledger.spec `:827` 补足） |
| 幂等键 | `:292`·`:585`·`:547`（键前缀 `ops:` = 后台操作，含调分） | `ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq>` |
| 上限 / 审计 | `:343` C3 ③ = 「**必填原因码**」+「审计台列 **P6**」（`DL146`）；`grep '日累计'`（四册）= **0 命中**；**本册文本未给单笔上限数值** | 审计 = 必填原因码 + P6 审计台；**上限数值不在本册**（现取数值 = `src/index.ts:1180` 100000，Kevin 2026-09-30 定值，见 `p4-a1cap-points-cap.md:37`） |
| 正负号 | `:513` 明写 `+n` | 加分 = `mint`（`+n`） |
| `asset` 表 | `:166`（逐字：「**不存在，且永不创建**（只有 `ALTER TABLE IF EXISTS`）」/ 处置「**废弃**」/「余额改由 `account` / `ledger_entry` 派生」）· `:186`/`:187`（列级废弃）· `:291`(#53) · `:292`(#54) · `:316`（§5.2⑤ 采纳废弃） | `asset` = **永不创建**（对选项 B 是**正面否决**，§3） |
| 旧表名禁令 | `:217` DL26（逐字：「**旧表名一律不得复活**：`asset` / `task` / `task_progress` / `prize` / `prize_item` / `shard` / `shard_transfer` / `chest*` **不得**出现在任何新迁移、新代码、新路由里（**含只读引用**）」；落点 = code review + `grep`）· `:87` DL3（业务表不得持有余额列）· `:153` DL23（读路径绝不产生写副作用） | 直接约束 §1.3 的 7 个缺表项；对选项 B 亦是正面否决 |
| 允许的备选 | `:343` C3 备选栏②（逐字）：「**完全禁止**管理员调分（则 `#54` 也删除）」 | §3 选项 C 的册内依据 |

#### 册3 `docs/commission.spec.md`（十级返佣 · v0.3 · CR1–CR88）

| 问项 | 取证 | 结论 |
|---|---|---|
| 全部问项 | `grep -cE 'mint\|burn' docs/commission.spec.md` = **0**（exit 1）；`grep -nE '调分\|points_adjust\|admin.*mint\|mint.*admin'` = **0 命中** | **本册对 A1 未命中**（kind / 方向 / 上限 / 审计 / 正负号 全零，双口径一致）。仅有的间接线索是**转引**：`src/ledger.ts:538-539` 注释引「`commission.spec` v0.2 裁定 #11 / CR84 / CR85 ④」用于「无邀请人 ⇒ `job_fee` 入 `-1`」，与 A1 无直接关系 |
| 上位口径 | `docs/commission.spec.md:6`（「上位口径 = `docs/ledger.spec.md` **v0.8**（账本内核…）」，`commission.spec` 自记**不新增 `kind`**） | 本册**刻意不涉 A1**；A1 的 kind 口径以册1/册2/册4 为准 |

#### 册4 `docs/route-layer.spec.md`（路由层 · v0.9）

| 问项 | 取证（`文件:行号`） | 结论 |
|---|---|---|
| kind / 方向 / 平台 uid | `:176`（编号 51 端点行，逐字）：「`POST /api/admin/points/adjust` **:1066** \| **【保留·改接】** \| `ledger_post_event(op='mint'\|'burn')`，**仅 `$`(cid=1)**；`ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq>` \| **C3 ③**（`data-layer.spec.md:343`）+ §4.1 #54（`:292`）；**资金 ⇒ 批 3**」 | kind = `mint` / `burn`（作为 `ledger_post_event` 的 `op` 值）；仅 `$` = `cid 1` |
| 方向（表） | `:662`（**§4.3 资金四栏**（节起 `:649`）的 A1 行，逐字）：「`\| **A1 调分** \| 平台（`mint`）或目标用户（`burn`） \| 目标用户（`mint`）或（`burn` ⇒ 无受款方，净减发） \| — \| — \|`」 | **减方 = 平台（mint）/ 目标用户（burn）；增方 = 目标用户（mint）/（burn 无受款方）** |
| 期望码 / 前提 | `:640`（**§4.2 业务事件总表**（表起 `:615`）的 A1 行，逐字要点）：「管理员调分（**保留但锁死**）\| `POST /api/admin/points/adjust`（`:1066`）\| `ledger_post_event(op='mint'\|'burn')` \| `mint` / `burn`（**仅 `$` = cid 1**）\| `target_uid`、`cid=1`、`amount`、**必填原因码** \| `ops:<admin_uid>:…` \| 单语句；**禁止**直接 UPDATE `account`；**`burn` 受 `R25` 限制** \| `403` `AUTH_FORBIDDEN`；`400` **LD021**〔**v0.8 订正：旧写 `LD022`**〕」 | 入参 4 项；**无私钥/无方向参数**（方向由 `op` 表达） |
| 保留 uid 前置闸 | `:840`（LD021 登记行）：「`LD021` = `LEDGER_RESERVED_UID`（`:1050`）→ **400**（`:55`）\| 目标账户无效（**平台/保留 uid 前置闸**）\| 8 \| **在用**（§4.2 J1/M1/A1/P2 + §4.4-6）」；`:850`（`LD031` = `LEDGER_FEE_RATE_INVALID` → 500，在用（500 面）） | `target_uid` 为保留 uid ⇒ `400 LD021` |
| 金额归类 | `:899`（§4.8.1 规则体（节起 `:892`/`:896`）内「A 类闭集」句，逐字）：「§4.2 **A1 `amount`**（**管理员意图额**，受 §6 权限闸 + 必填原因码约束」；`:47`（§0 摘要⑨）：「新增第 **②** 类「授权主体意图额」（客户端可传，**但必须权限校验 + 服务端上限校验（上限标 `TODO: Kevin 定值`）+ 审计留痕**）；逐事件表内 **A1 归入该②类**」 | 上限 = **服务端必做**（数值 `TODO: Kevin 定值`）；审计 = **必做** |
| 注册点 | `:176`/`:640`/`:270` 记 `:1066`；`:270` 第三列另记 `:995`；**本单现取** = `src/index.ts:1182`（`grep -nE "app\.(get\|post\|…)('/api/admin/points/adjust'"`） | **登记与现取不一致**（张力 T4，§2.2） |
| 上限字面 | `grep '日累计'`（四册）= **0 命中** | 「日累计」在四册**无字面依据** |

### §2.2 冲突 · 张力清单（**只列不选边**）

| # | 张力 | 左：`文件:行号` | 右：`文件:行号` | 本单只列 |
|---|---|---|---|---|
| **T1** | **`−1` 的 debit 恒空** ⇒ 「扣分走 `transfer` 到 `−1`」在 `−1` 侧非法（`PLATFORM_DEBIT_FORBIDDEN`）；册内却只允许 `mint`/`burn` | `src/ledger.ts:550`（`'-1': { credit: […], debit: [] }`）+ `:557-565`（断言抛 `LEDGER_RESERVED_UID`） | `data-layer.spec:343`（「只能 `mint`/`burn`」）· `route-layer.spec:640`（同） | 两条合读是**一致**的（扣分本就该用 `burn`）；但**若**实现者把扣分读成「转给平台」⇒ 必撞 `−1` debit 白名单。**不裁** |
| **T2** | **uid `0` 的 debit 白名单不含 `mint`**：`mint` 只被允许在 uid `0` 的 **credit** 侧 | `src/ledger.ts:536`（`'0': { credit: ['mint','transfer','reversal'], debit: ['transfer','burn','reversal'] }`） | `ledger.spec:343`（`mint` 减方 = 「系统（无对手方）」）· `route-layer.spec:662`（A1 `mint` 减方 = 「平台」） | 若实现把「系统/平台」落成 **uid `0` 的 debit 腿** ⇒ 撞 `LD021`（`route-layer.spec:840`）。**三册措辞不一（「系统」vs「平台」）；不裁** |
| **T3** | **`burn`（扣分，正负号方向）与现实现 `amount > 0` 不可共存**：路由**无方向/op 参数**，且 `≤0` 一律 `400` | `route-layer.spec:640`/`:662`（允许 `burn`；方向由 `op` 表达）· `ledger.spec:344`（`burn` = `−n`） | `src/index.ts:1191`（只读 `uID`/`amount`/`reason`）· `:1197-1203`（`amount <= 0` ⇒ `400 NOT_A_POSITIVE_INTEGER`）· `:1213`（只传 `adjustPoints(uID, amount, reason)`，**无 op**） | 现形态下**扣分不可表达**；按册落地须新增方向参数（= 改码）。**不裁** |
| **T4** | **「上限是否必需 / 数值在哪一册」三册不同步** | `data-layer.spec:343`（C3 ③ **未设**单笔上限，只锁 kind/键/原因码） | `route-layer.spec:47`（§4.8 ② 类**要求**服务端上限校验，数值 `TODO: Kevin 定值`）· `src/index.ts:1175-1180`（数值 = **100000**，Kevin 2026-09-30 定值；注释逐字「**日累计上限留后续（批 6）**」）· 四册 `grep '日累计'` = **0 命中** | 「日累计」在册内**无字面依据**；单笔上限的册内归属未冻结。**不裁** |
| **T5** | **审计要求 vs 审计落点缺位** | `data-layer.spec:343`（「审计台列 **P6**」`DL146`）· `route-layer.spec:47`（「+ 审计留痕」） | 现取库内 audit-like 表 = **仅 `currency_status_log`**（`results.json:391-394`）⇒ 审计台本体不存在；A1 现留痕 = `src/database.ts:955` `console.log('[API] 积分调整结果: …')`（进程日志，`p4-a1cap-points-cap.md:91-92`） | 「改接 `ledger_post_event` 即满足审计」**不成立**（须先有落点）。**不裁** |
| **T6** | **选项 B（补建 `asset` 表）与册内三条正面冲突** | `data-layer.spec:166`（「不存在，且**永不创建**」）· `:217` DL26（旧表名不得复活，**含只读引用**） | `ledger.spec:821`（§13.1 裁决：**用保留 uid，不用独立账户表** —— 否则「第二套账」使判据 1/3/7 失效）· `:87` DL3（业务表不得持余额列） | 选 B 需同时给出「与 append-only 账本并存 + 对账判据」的方案；本单**不裁**是否可行 |
| **T7** | **注册点登记漂移** | `route-layer.spec:176`/`:640` 记 `:1066`；`:270` 第三列记 `:995` | 本单现取 = `src/index.ts:1182` | 三读数不一致；**成因未复核（NOT_MEASURED）**，不裁 |

### §2.3 `route-layer.spec` 「§1.8:51」逐字引（或标未命中）

**三口径逐条给结果（不错位）**：
1. **字面行号 `:51` ⇒ 未命中**。现取 `docs/route-layer.spec.md:50` = `## §0 元信息与口径`，**`:51` = 空行**；而 `### 1.8 ★ 已实现·未注册清单…` 实际起于 **`:304`** ⇒ 「§1.8 内第 51 行」= `:354`（**该行内容本单未取**，§4-N6）。故 `§1.8:51` 作为「节内行号」**不成立**。
2. **编号 51 的端点行 ⇒ 命中 = `:176`**，**逐字**（原表 `|` 分隔）：
   > `| 51 | POST /api/admin/points/adjust **:1066** | **【保留·改接】** | ledger_post_event(op='mint'\|'burn')，**仅 `$`(cid=1)**；`ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq>` | **C3 ③**（`data-layer.spec.md:343`）+ §4.1 #54（`:292`）；**资金 ⇒ 批 3** |`
3. **另两处直指该路由的登记行（`§1.8` 之外）**：`:640`（§4.2 业务事件总表 A1 行，逐字见 §2.1 册4）· `:270`（§1.x 映射表：`| POST /api/admin/points/adjust | :1066 | **:995** | p4-b2c-admin-write.md §1.2:66 |`）。
4. **`§1.8` 本体（`:304`）在 v0.9 的状态**（逐字标题）：「`### 1.8 ★ 已实现·未注册清单（v0.5 新增 · **Zang §5.85 裁定① 新纪律**；**★ v0.9 现况 = 清单已清空 / 无遗留**〔依据 = Zang §5.92 / §5.93〕）`」⇒ `:176` 属**端点总表**的「保留·改接」行，**不是** §1.8 的「未注册」条目（两者不同表）。
5. **结论（取证用）**：引用者若想指「该路由改接 `ledger_post_event`」的记载，**真源 = `route-layer.spec:176`**（配套 `:640` / `:662`）；**不存在 `§1.8:51` 这一处记载**（`:51` 是空行）。
6. **补一条可能的正解（列而不裁）**：`:176` 所在的表 = **`§1 端点处置表（51 个注册点 · 逐条）`**（节起 `:113`，标题逐字「## §1 端点处置表（51 个注册点 · 逐条）」）⇒ 被引的「51」**很可能指端点编号 51 而非行号/节内行号**，即「§1 表内编号 51 的那一行」= `:176`。**本单不裁定引用者的原意**，只给三口径的事实位置。

## §3 落法选项（**只列选项 + 前置 / 风险 / 成本；不推荐、不选边**）

> 三个选项**并列**，本单**不排序、不推荐、不选边**。所有「前置」均为「要落地必须先具备的事实」，均已带 `文件:行号`。

### 选项 A —— 改接 `ledger_post_event` + `mint`/`burn` 映射（**册内正典**）

- **前置**：① 幂等键 = `ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq>`（`data-layer.spec:292`/`:585`/`:547`）；② kind 映射 = 加分 `mint` / 扣分 `burn`，**方向需以 `op` 类入参承载**（张力 T3）；③ 平台主体 = `uid 0`（`ledger.spec:827`），且须先解决**uid `0` debit 白名单不含 `mint`**（张力 T2）；④ 仅 `$` = `cid 1`（`route-layer.spec:176`/`:640`）；⑤ **必填原因码**（`data-layer.spec:343`）；⑥ 单笔上限（现取 100000，`src/index.ts:1180`）；⑦ **审计落点**（P6 审计台**尚不存在**，张力 T5）；⑧ `burn` 受 R25 限（`ledger.spec:282`，`$` 的 `burn` 仅平台可发起）；⑨ 入参 4 项 `target_uid`/`cid=1`/`amount`/`reason`（`route-layer.spec:640`）；⑩ DB 入口形状 = `ledger_post_event(payload jsonb)`（`results.json:200-203`），payload 逐字段须对齐该 45580 字节函数体。
- **落点（改码）**：`src/index.ts:1182-1228`（路由）+ `src/database.ts:940-968`（`adjustPoints`）+ 视 T2 结论可能触 `src/ledger.ts:535-567`（白名单/断言）⇒ **属 `src/**`，本单写集禁止**。
- **风险**：T2（`LD021` 平台侧白名单）· T3（无方向参数 ⇒ 扣分不可表达）· T5（审计无落点）· R25（`$` 的 burn 授权分支是否已实现 = 未测）· 幂等键 `seq` 的生成器**未在现取中找到**（未测）· 现取无任何 `points_adjust` kind，落地后 `ledger_entry` 的 kind 集将新增使用面（现取 16 类，`results.json:211-276`）。
- **成本**：改 2~3 个 `src` 文件；若白名单需动 ⇒ 触及**新迁移**（同族先例 `0019_listing_deposit_platform_credit.sql`）；回归可复用 A1-CAP 单已建的 HTTP 探针（`p4-a1cap-points-cap.md`）。

### 选项 B —— 保留 `asset` 表并**补建表迁移**（并说明其与 append-only 账本的并存 / 对账）

- **前置**：① 新迁移建 `asset`（列须满足 `src/database.ts:910` 的写形状：`"uID"`, `points`, `lucks`, `time_updated`，且 `:897` 读 `"time_updated"`）；② **必须同时给出与 append-only 账本的并存/对账方案**（下条 B1/B2/B3 是三选一的候选骨架，**本单不选**）；③ **读侧现状须一并交代** —— `src/database.ts:866` 已改为 `FROM account AS a`、`:860` 注释逐字「原 `asset` 表不存在」⇒ 若只建表不回改读侧，**写侧 `asset` 与读侧 `account` 永久分叉**；④ 语义映射须写清：`asset.points`（旧「一个整数 = 积分」）vs `(uid,cid)` 上的 `balance`/`frozen`（`data-layer.spec:186` 逐字「**语义摧毁**」）。
- **B 的三条并存/对账候选骨架（并列，不选边）**：
  - **B1 账本为唯一写侧真源、`asset` 退化为只读投影**（投影载体可为视图或受控同步）——前置 = 禁止任何直写 `asset`（`data-layer.spec:343` 已禁「直接 UPDATE `account`」，但**未**提 `asset`）；风险 = 投影滞后/双写竞态；对账 = 投影 vs `account` 逐行比对。
  - **B2 `asset` 为可写真源、账本为审计副本** ——前置 = 记账与余额写入同事务；风险 = **与 append-only 正面冲突**（`ledger.spec:821` §13.1「第二套账」禁令 + `:751` 全局守恒判据 `Σ account.balance == Σ delta == Σmint − Σburn`）；对账 = 事件溯源回放比对。
  - **B3 时间点快照对账**（每日/每批对齐，偏差 ≠ 0 即报警）——前置 = 快照表 + 告警面；风险 = 偏差窗口内不可判；成本 = 额外表与调度。
- **风险（选项级）**：与册内**三条正面冲突** —— `data-layer.spec:166`（`asset`「不存在，且**永不创建**」）· `:217` DL26（旧表名「**不得**出现在任何新迁移、新代码、新路由里（**含只读引用**）」）· `ledger.spec:821`（§13.1 用保留 uid、不设第二套账；另 `data-layer.spec:87` DL3 禁业务表持余额列）；且**资金审计仍为零**（A1 现留痕仅 `src/database.ts:955` `console.log`，`p4-a1cap-points-cap.md:91-92`）——选 B 只解 `404`，**不解审计**。
- **成本**：1 个新迁移 + `src/database.ts:861/879/889/940` 一带回改 + 存量用户回填 + 回归；**并且**须先改 3 处规范（`data-layer.spec:166/:217`、`ledger.spec:821` 派生口径）——那属 spec 写单，**不属本单**。

### 选项 C —— 删除该路由（`#54` 一并退役）

- **册内依据（逐字）**：`data-layer.spec:343` C3 备选栏②「**完全禁止**管理员调分（则 `#54` 也删除）」。
- **前置**：Kevin 裁定；`route-layer.spec:176` / `:640` / `:270` 三处登记同步退役（改为 `410` 或删除注册点）；确认前端无调用面（**未测**）。
- **风险**：失去平台调分能力（`$` 的铸币口只剩 C1 建币费路径）；与 `route-layer.spec:47` §4.8 ② 类「已把 A1 归入授权主体意图额」的记录不一致（需同步改）。
- **成本**：最小（1 个注册点 + 3 处 spec 登记）；**无替代口径**。

## §4 探针与产物清单 · `NOT_MEASURED`

### §4.1 产物（本单写集内，未触碰任何 `src/**` / `migrations/**` / spec）
| 类型 | 路径 |
|---|---|
| 报告 | `docs/audit/p4-a1ledger-design.md`（本件） |
| 脚本 | `backend-ts/scripts/p4z-a1ld-01-probe.ts`（只读探针 · 走 `neon()` HTTP） |
| 读数 | `backend-ts/.p4-artifacts/a1ld-20260930T133212Z/results.json`（全量 JSON） |
| 口径证据 | 同目录 `tables_from_migrations.txt`（25 行）· `src_table_refs.txt`（28 行） |

**可复算命令**（逐条现取，退出码取自命令本身、非管道之后）：
```
node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
  scripts/p4z-a1ld-01-probe.ts "$PWD/.p4-artifacts/a1ld-20260930T133212Z"
grep -rniE 'create +table' migrations/ | wc -l          # 宽式 = 29
grep -rniE '\basset\b' migrations/ | wc -l              # 裸词 = 0
grep -cE 'mint|burn' docs/commission.spec.md            # = 0（exit 1）
grep -rnE '日累计' docs/*.spec.md                        # = 0 命中（四册）
grep -nE '^app\.(get|post|put|delete|patch)' src/index.ts | grep admin/points  # = :1182
```
**探针自证**：`results.json:73` `live_table_count=22`；`:121-131` 差集 9 项；`:132-192` 逐项 `NOT_EXISTS_IN_DB`（7 项）/ `EXISTS`（`schema_migration`，`rowcount=19`）；`:193-210` 两个 DB 函数在盘；`:211-276` `ledger_entry` 在用 kind 16 类（`mint:5` 已在用）；`:282-307` 平台账户 `-1`/`-2`/`-3`/`0` 四行**均存在**（`-1` 余额 167280、其余 0）；`:308-379` `currency` 现取 `cid=1 symbol=$ owner_uid=0 supply_cap=NULL`。

### §4.2 `NOT_MEASURED`（**禁填 0 / 空**）
| 编号 | 未测项 | 为何未测 |
|---|---|---|
| N1 | A1 改接后的**成功面**（`200` + 账本分录 + 键集） | 本单禁改码（红线）；无既有读数可转引 |
| N2 | `POST /api/task-progress/claim/:jID` 与 `POST /api/auth/verify` 的 **HTTP 级**结果（§1.3 #1-#2 的 401/500 均属**静态推定**） | 本单禁写请求；catch 的行号亦未逐处现取 |
| N3 | `shard` / `shard_transfer` 写函数（`createShardLedgerEntry`/`recordShardTransfer`，调用点 `database.ts:3207/3220/3309/3310/3393/3394/3498/3499/3546/3547`）在**活 market 路由**上是否可达 | 未逐调用链回溯（只做类级扫描） |
| N4 | 探针里 `neon()` 的 `sql.query ?? sql(...) ?? sql.unsafe` **实际命中分支** | 脚本未打印分支名 |
| N5 | `ledger.spec` 19 处「审计」中是否存在**针对 A1** 的专项条 | 未逐条核（只跑了词面 grep） |
| N6 | `route-layer.spec:354`（§1.8 内第 51 行）内容；以及 `route-layer.spec` 内是否登记 `task`/`task_progress`/`prize*`/`shard*` 旧表 | 未检索/未取该行 |
| N7 | T7 注册点漂移成因（`route-layer.spec:270` 第三列 `:995` 的来源） | 未复核该表列义 |
| N8 | A1 面 `requireAdmin` 实际用的**权限键**（现取只见 `requireAdmin(req, res)`，`src/index.ts:1183`） | 未取内部实现 |
| N9 | 是否存在**另一个库**（线上/预览）含 `asset` 表 | 探针只连 `.env.local` 指向的库 |

### §4.3 写集自检（硬边界）
**本单只写 3 处**：本报告 · `backend-ts/.p4-artifacts/a1ld-20260930T133212Z/**` · `backend-ts/scripts/p4z-a1ld-01-probe.ts`。
**未写/未改**：`src/**`、`migrations/**`、任何 spec、`docs/seafood.master-plan.md`、`frontend/**`、既有 audit/qa 件、`.env.local`。
**未执行**：`git add/commit/push`、任何建表/改表/写入型 SQL、`npm install`、`execute_code`、`pkill -f`/`killall`、启停任何服务。
