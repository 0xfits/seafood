# P4 · A1-CAP 后台调分单笔上限 + 审计留痕缺口核查 — 报告

> 角色 = Kong（实现方）· 单号 = A1-CAP · 定值人 = **Kevin 2026-09-30（Zang 裁定）** ·
> 依据 = 派单「A1 后台调分单笔上限 = 100000 `$`」+ 上单 `p4-num1-floors-and-cap.md §3` 的备查落法（逐字沿用）。
> **骸架先行**（§5.7 ⑤）：本文件先落标题 + `NOT_MEASURED` 占位，随后**逐段立即回写**实测读数。

## 0 元信息（run tag / 产物 / 口径）

| 项 | 值 |
|---|---|
| 生效 run（本文所有读数出处） | `a1cap-20260930T210204`（recon 13:02 UTC / **pre** 13:2x / **post** 13:26 UTC） |
| 产物目录（绝对路径） | `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/a1cap-20260930T210204/`（`recon/recon.json`、`pre/a1cap-01-e2e.pre.json`、`post/a1cap-01-e2e.post.json`、`post/tsc-noEmit.log`） |
| token 口径 | `backend-ts/.env.local` 的 `SECRET_KEY`（`sha256` 前 12 = `b1ec01afb2eb`）经生产签名器 `src/auth.createSessionToken`；产物**只记 token 12 位指纹**，**不落 token/密钥本体** |
| 夹具幂等键 | `cli:a1cap-<tag>-*`（本单只用于 C1/C2 下限回归；A1 路由**无幂等键**，见 `route-layer.spec.md §1.8:51` 待改接） |
| 服务 | `seafood-api` · 端口 5788 · 重启**只走面板** `POST :5555/api/restart {sid:"seafood-api"}`（实测 `{ok:true,state:"running",pid:68625}`，3 s 后 `/health` 200） |
| 铸币 | **`mints_in_this_run: 0`**（本单零铸币；`mint` 分录数 pre = post = 5） |
| 夹具 actor | admin = `uid 1`（`users.is_admin=true`，现取 DB）· 非 admin = `uid 12`；A1 目标 uid = **4**（cid=1 有 `account` 行者，余额 4） |

## 1 改动（单点校验位）

文件 = **`backend-ts/src/index.ts`（唯一改动文件；`database.ts` 未动）**；`git diff --numstat` = **25 增 / 0 删**，无其他文件被本单触碰。

| 项 | 改前 | 改后 |
|---|---|---|
| 路由 | `:1175` `app.post('/api/admin/points/adjust')` | **`:1182`**（注释块 + 常量插入致下移 7 行） |
| 单笔上限常量 | **无** | **`ADMIN_POINTS_ADJUST_MAX_PER_CALL = 100000` @ `:1180`**（**单点常量**，值在 `index.ts` 内只出现 1 次；grep `ADMIN_POINTS_ADJUST_MAX_PER_CALL` = 3 命中 = 1 声明 + 2 消费） |
| 上限校验 | **无**（`amount` 仅 `parseInteger(req.body?.amount, Number.NaN)`） | `:1205-1211` `if (amount > ADMIN_POINTS_ADJUST_MAX_PER_CALL)` ⇒ **`400` + `LEDGER_AMOUNT_INVALID` + `details.reason = OVER_MAX_SINGLE_AMOUNT`** |
| ≤0 校验 | **无**（`0` / 负值均可穿透到服务层，见 §2 改前读数） | `:1196-1202` `if (amount <= 0)` ⇒ `400` + `LEDGER_AMOUNT_INVALID` + `reason = NOT_A_POSITIVE_INTEGER` |
| 权限闸 | `requireAdmin(req, res)`（无更细权限键） | **同左、未动**（`requireAdmin` 前置，金额校验在其后 ⇒ **不得**因新增校验绕过权限闸） |
| 响应形状 | 新校验未存在 | 走**既有** `ledgerErrorBody()`（`src/job-service.ts:21`）R107 形状（`error.{code,message,i18n_key,details}`） |

**码 / reason 逐一现取核实（零新造）**：`LEDGER_AMOUNT_INVALID` 真源 = `src/ledger-errors.ts:49`（status 400，input 类）；
reason `OVER_MAX_SINGLE_AMOUNT` 真源 = `src/currency-service.ts:125`（既用于币种面「单笔超上限」）；reason `NOT_A_POSITIVE_INTEGER` 真源 = `src/currency-service.ts:122`
（sibling 校验器对 `≤0` 的既有取值）⇒ **未新增错误码、未新增 reason 名**。
`≤0` 的备选码 `LEDGER_AMOUNT_NOT_POSITIVE`（`ledger-errors.ts:50`，400）**已登记但未采用**：为与同族单点校验器（`currency-service.ts:120-127`）保持**同一形状**，取 `LEDGER_AMOUNT_INVALID` + `reason`。此取舍请 Zang 复核（§6 待裁②）。

**常量注释逐字含口径**：`P4-A1-CAP（**Kevin 2026-09-30 定值**，Zang 裁定）` / 「单笔 ≤ 100000…**单点校验位**」/「**日累计上限留后续（批 6）**」/「**不得**改成从 `app_config` 读（那属批 6）」。

## 2 边界与回归逐例读数（pre = 改前 / post = 改后，均同 run 同夹具）

口径：`status` 直接取 HTTP；`code`/`reason` 取 `error.code` / `error.details.reason`；每条附响应体 `sha256` 前 12（`resp_fp12`）。

| # | 用例 | 请求 | **改前** | **改后** | 判定 |
|---|---|---|---|---|---|
| T01 | cap **边界内** `100000` | admin, uID=4 | `404` `msg="积分调整失败"` | **`404`** `msg="积分调整失败"`（fp `615c244bd52b`，与改前**逐位相同**） | ⚠️ **未达「200」——BLOCKED（见下方 ②）** |
| T02 | cap **超限** `100001` | admin, uID=4 | `404`「积分调整失败」 | **`400` `LEDGER_AMOUNT_INVALID` + `reason=OVER_MAX_SINGLE_AMOUNT`** | ✅ |
| T03 | 零值 `0` | admin, uID=4 | `404`「积分调整失败」 | **`400`** `LEDGER_AMOUNT_INVALID` + `reason=NOT_A_POSITIVE_INTEGER` | ✅ |
| T04 | 负值 `-5` | admin, uID=4 | `404`「积分调整失败」 | **`400`** `LEDGER_AMOUNT_INVALID` + `reason=NOT_A_POSITIVE_INTEGER` | ✅ |
| T05 | **非 admin** | uid 12 | `403` `AUTH_FORBIDDEN`/`NOT_ADMIN` | `403` `AUTH_FORBIDDEN`/`NOT_ADMIN`（fp 未变） | ✅ 权限闸未被绕过 |
| T06 | 无 token | — | `401` `AUTH_UNAUTHORIZED` | `401` `AUTH_UNAUTHORIZED` | ✅ |
| T07 | 缺 `reason` | admin | `400`「参数不完整」 | `400`「参数不完整」（fp 未变） | ✅ 既有面未回归 |
| T08 | 小额 `100` → 库内无该 uid 行 | admin, uID=987654321 | `404`「用户资产记录不存在」 | `404`「用户资产记录不存在」 | ✅ cap 内**确会**落到服务层（区分「被校验挡住」与「服务层挡住」） |
| T09 | 浮点 `1e21`（超 safe-int） | admin | `404`「积分调整失败」 | **`400` + `OVER_MAX_SINGLE_AMOUNT`** | ✅ |
| T10 | 非 admin + 超限 | uid 12 | `403` `NOT_ADMIN` | `403` `NOT_ADMIN` | ✅ **权限闸先于金额校验** |

### ① 上限边界两例（派单指定）
`100001 → 400 + OVER_MAX_SINGLE_AMOUNT`（✅ 实测）；`100000 → 404`（**非 200**，成因见下）。

### ② `200` 面 **BLOCKED**：`asset` 表不存在（**既有缺陷，非本单引入**）
- 现取（`recon/recon.json`）：`information_schema.tables` 全 `public` 仅 **22 表**，**无 `asset`**（`asset_table_exists=false`）；
- 机制：`index.ts:1188` → `database.ts:940 adjustPoints` → `database.ts:889 upsertAsset` 执行 `UPDATE asset … / INSERT INTO asset …`
  ⇒ `42P01 relation "asset" does not exist` ⇒ 被 `adjustPoints` 的 `catch` 吞成 `{success:false,'积分调整失败'}` ⇒ 路由回 **`404`**；
  而 `getUserAsset`（`database.ts:861`）读的是 `account` 表（`database.ts:860` 注释逐字：「原 `asset` 表不存在」）⇒ **读写两张表**的遗留不一致。
- 结论：**A1 的「成功路径」在现库上不可达**（改前改后同为 `404`，fp 逐位相同 ⇒ 本单未改变该行为）。要达到派单期望的 `200 + 账本分录`，
  需要按 `route-layer.spec.md §1.8:51`（【保留·改接】）把该路由改接 `ledger_post_event(op='mint'|'burn')`（仅 `$`、`ops:` 键）——
  那是 **A1 改接专项**（涉及 `ledger` 接线 + 幂等键 + kind 白名单），**超出本单写集与最小改动口径**，故**只登记不改**（§6 待裁①）。

### ③ 金额守恒读数（`account` / `ledger_entry`，pre→post，**同一次 post 跑**）
| 读数 | pre | post | Δ |
|---|---|---|---|
| `Σtotal`（= `Σ(balance+frozen)`） | `2020100` | `2020100` | **0** |
| `Σbalance` | `2009617` | `2009617` | **0** |
| `Σfrozen` | `10483` | `10483` | **0** |
| `ledger_entry` 行数 | 241 | 241 | **0** |
| 逐 kind 计数变动 | — | — | **无**（16 个 kind 全等） |
| 目标账户两侧读数（`account` uid=4, cid=1） | `balance=4, frozen=0` | `balance=4, frozen=0` | **0 / 0** |

**口径纠正（重要）**：ΔΣ = 0 **不是**「纯转移」的证据，而是「**该路由完全不接账本**」的结果（`adjustPoints` 只尝试写 `asset` 表，且该表不存在 ⇒ 全程零账本写入）。
⇒「账本分录正确」这一期望 **不成立/不适用**；登记为 A1 改接缺口（§6 待裁①），**不填 0 冒充合规**。

## 3 审计留痕缺口核查（只查不造）

**现取**（`recon/recon.json`，`information_schema`）：

| 核查项 | 实测结论 |
|---|---|
| `public` 全表（22） | `account, admin_permission, admin_role, admin_role_permission, admin_user_role, app_config, candle_view, commission_policy, currency, currency_status_log, job, job_application, job_submission, ledger_entry, ledger_owner, listing, listing_order, market_order, market_trade, referral, schema_migration, users` |
| 名称含 `audit`/`log`/`history`/`journal` 者 | **恰 1 张 = `currency_status_log`**（**无**通用「后台操作 / 管理动作」审计表） |
| `currency_status_log` 真名 / 列（真源 `migrations/0017_platform_config.sql:139-150`） | 7 列：`log_id`(bigint identity PK)、`cid`(NOT NULL, **FK currency(cid)**)、`from_status`(NOT NULL)、`to_status`(NOT NULL)、`actor_uid`(NOT NULL, FK users(uid))、`memo`(text)、`time_created`(timestamptz NOT NULL DEFAULT now())；**append-only**（UPDATE/DELETE 触发即 RAISE，禁物理删除） |
| 代码侧写入者 | **仅** `src/database.ts:1441`（`INSERT INTO public.currency_status_log`，币种状态迁移专用；注释 DL73/DL157②） |
| `ledger_entry`（账本分录）能否充当资金审计 | 是**资金面**的 append-only 留痕真源（241 行；kind 闭合集 16 类），但 **A1 路由根本不写账本**（§2③）⇒ 对 A1 而言留痕 = **零** |
| A1 现留痕 | **仅** `database.ts:955` `console.log('[API] 积分调整结果: …')`（**进程日志、无 actor、无持久化、不可查询**） |

**「能最小改动写入一行」的评估 = 不能**（判据可复核）：`currency_status_log.cid` 是 **NOT NULL + FK currency(cid)**、`from_status`/`to_status` **NOT NULL**，
其语义是「币种生命周期状态迁移」；调分既非币种、也无状态迁移 ⇒ 强制写入必须**编造** `cid`/`from_status`/`to_status` 值 = **篡改审计语义**，
且该表 append-only 触发器使误写**不可删改**。⇒ **不写**，按派单要求登记为**批 6 迁移项**（§6 表名/列建议）。

## 4 回归（`tsc` / 注册点 / `410` / C1-C2 下限 / health）

| 回归项 | 读数（口径） |
|---|---|
| `tsc --noEmit` | **exit 0**，输出 **0 行**（`post/tsc-noEmit.log`；退出码直接取自动 `$?`，**未经管道**） |
| 注册点 | **65**（`grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts`，改前 = 改后 = 65）⇒ **未新增/删除对外路径** |
| 已落 `410` 面 | **6/6 仍 `410`**：`/api/auth/register`(410)、`/api/shard/redeem`(410)、`/api/chest/1/open`(410)、`/api/admin/prize/create|update|delete`(410×3)（`resp.code` 为 `LEDGER_REF_NOT_FOUND`，`/api/auth/register` 体形状不同故 `code=null`，状态位一致） |
| `C1` 建币费下限定值 | 源码现取 `CURRENCY_CREATE_FEE_FLOOR = 10000`；实测 `fee:9999` ⇒ **`400` `LEDGER_AMOUNT_NOT_POSITIVE` + `reason=BELOW_SERVER_FLOOR`**（被拒 ⇒ 零落库） |
| `C2` 上市费/保证金下限定值 | 源码现取 `CURRENCY_LIST_FEE_FLOOR = 10000` / `CURRENCY_LIST_DEPOSIT_FLOOR = 50000`；实测 `listing_fee:9999, deposit_amount:49999` ⇒ **`400` + `BELOW_SERVER_FLOOR`** |
| `/health` | **200**（重启后现取；`schema_version=0020`，`PostgreSQL 18.6`） |
| `/api/home` | **200**（pre 与 post 各一轮） |
| 重启方式 | 面板 `POST :5555/api/restart {sid:"seafood-api"}`（**未用** `pkill -f`/`killall`；**未**用 `git add/commit/push`） |

## 5 逐项 `NOT_MEASURED` 清单（禁填 0/空）

| # | 未测项 | 原因 / 现状（非零非空） |
|---|---|---|
| N1 | **A1 成功路径 `200` + 账本分录**（派单 ④ 的「账本分录正确」） | **不可达**：`asset` 表不存在 ⇒ 恒 `404`（§2②）；要测需先完成 A1 改接 `ledger_post_event`（批 6/专项） |
| N2 | **日累计上限** | 派单明示「留后续（批 6）」⇒ 本单**未实现、未测**；代码注释已登记 |
| N3 | **审计留痕的实际落库行** | 库内**无**通用操作审计表（§3）；`currency_status_log` 语义不匹配 ⇒ 本单**未写任何审计行**（也未造表） |
| N4 | **服务端日志逐条归因**（`console.log` 是否真打出、内容为何） | **本仓不落 access/服务端日志到文件**（无日志文件可查）⇒ 无法从服务端侧取证；仅能读源码行 `database.ts:955` |
| N5 | 400 响应体的 `i18n_key` 字面值与前端渲染 | 本单只取 `status`/`code`/`details.reason`/`message`；`i18n_key` 未逐字记录（形状由 `job-service.ts:30` 决定 = `ledger.err.<code>`） |
| N6 | 非 `$`（cid≠1）目标账户的调分 | 现实现经 `getUserAsset` 硬编码 `cid = SYSTEM_CURRENCY_CID(1)`（`database.ts:861-870`）⇒ cid≠1 面**无从构造**；未测 |
| N7 | 并发同请求 / 幂等键面 | A1 路由**无幂等键**（`route-layer.spec.md §1.8:51` 待改接）⇒ 无幂等面可测 |
| N8 | `asset` 表缺失的成因（何时被哪次迁移删除） | **未追**（只实测「现不存在」）；可复核线索 = `database.ts:860` 注释、`docs/audit/p3-step1*-ddl-removal.md` |

### 探针自曝（§5.7 ④：读数异常先怀疑自己的探针）
1. **首跑 admin 发现全 `401`**（`pre` 首跑，13:03 UTC）：根因 = **我的探针**把 `Authorization` 写成裸 token（**漏 `Bearer ` 前缀**）；
   经 `actor_probe` 逐 uid 回执定位（uid 1/10/970201/2/970001 全 `401 AUTH_UNAUTHORIZED`，而库内 `is_admin=true` 者为 1/10/970201）
   ⇒ 修 `headers.Authorization = 'Bearer ' + token` 后全部拿到真回执。**非服务缺陷**，该轮读数**已作废、未入本文**（本 run 落盘的 `pre/*.json` 为修正后重跑）。
2. **一次 pre 跑 `exit 2`**：`NeonDbError: Error connecting to database: fetch failed`（远端 Neon 间歇抖动，脚本自带 5 次重试仍耗尽）⇒ 重跑即过；
   **未触发**「驱动 `ErrorEvent` 未捕获致服务自退」的既有 A 档债务（服务全程 `/health` 200，重启仅因本单改动）。
3. **一次 terminal 调用 300 s 超时**：首版探针逐个 uid 扫 `/api/admin/me`（30 uid × 2 HTTP + Neon 重试）⇒ 改为 **DB 驱动发现**（`users.is_admin`）+ 探针 uid 收窄至 2 个。
4. **T01 无断言**（`expect=null`，脚本不判 PASS/FAIL）：**不得**据此把 `100000` 当「通过」——本文按 §2② 记为 **BLOCKED（未达 200）**。
5. 本报告所有「实测」读数均可在产物 JSON 内 `grep` 到支撑字段（`results[].status/code/reason/resp_fp12`、`delta`、`regression`、`actor_probe`）。

## 6 待裁 / 批 6 迁移项

| # | 项 | 内容 | 归属 |
|---|---|---|---|
| ① | **A1 改接账本（阻塞 200 面）** | 按 `route-layer.spec.md §1.8:51` 把 `POST /api/admin/points/adjust` 改接 `ledger_post_event(op='mint'\|'burn')`（仅 `$`/cid=1、`ops:` 前缀幂等键、必填原因码）；现状 `asset` 表不存在 ⇒ 成功路径恒 `404`（§2②） | **批 6 / A1 专项**（须新单授权，改动远超本单写集） |
| ② | **`≤0` 拒的语义后果（请 Zang 复核）** | 现实现「可负 = 扣分」，改接目标态里负值 ⇒ `burn`；本单按派单「≤0 也拒」落地 ⇒ **扣分路径当前不可用**。若需保留扣分，应改为**有符号校验**（`\|amount\| ≤ 100000` + 方向映射 `mint`/`burn`） | **待裁**（本单已按派单执行） |
| ③ | **审计表（批 6 迁移项）** | 建议新表 **`admin_audit_log`**：`log_id`(bigint identity PK)、`actor_uid`(bigint NOT NULL, FK users(uid))、`action`(text NOT NULL，如 `points_adjust`)、`target_type`(text NOT NULL，如 `account`)、`target_id`(bigint NOT NULL)、`cid`(bigint, FK currency(cid))、`amount`(bigint，有符号)、`reason`(text NOT NULL)、`request_fp`(text，幂等键 sha256 指纹)、`result`(text NOT NULL，`ok`/`rejected`)、`error_code`(text)、`ref_id`(text)、`time_created`(timestamptz NOT NULL DEFAULT now())；**append-only 触发器 + 禁 DELETE**（手法照 `currency_status_log`：`migrations/0017_platform_config.sql:139-153`）。域内待裁：若 A1 改接账本后 `ledger_entry` 已足够承担资金审计，本表可**只记非资金类管理动作** | **批 6（配置/合规面）** |
| ④ | **`app_config` 化** | 本单上限为**代码单点常量**；「从平台配置取数 + 日累计上限」= 批 6（派单已定） | **批 6** |

## 7 §5.7 硬口径自检

| # | 口径 | 自检 |
|---|---|---|
| ① | 带引号对象断言加引号 | 是（§2 表格中 `msg`/`code`/`reason` 均加引号，且与产物 JSON 逐字一致） |
| ② | 退出码不得取自管道之后 | 是（`tsc`、探针均 `cmd > log 2>&1; echo $?`，未接管道） |
| ③ | 本机无 `timeout` | 是（未使用；仅用 `--max-time`/`AbortSignal.timeout`） |
| ④ | 读数异常先怀疑自己的探针 | 是（§5 自曝①，`Bearer` 前缀缺陷由 `actor_probe` 定位） |
| ⑤ | 先骸架后回填 | 是（`docs/audit/p4-a1cap-points-cap.md` 首落 `NOT_MEASURED` 骸架，再逐段回写） |
| ⑥ | 产物 run-tagged + 绝对路径 | 是（`.p4-artifacts/a1cap-20260930T210204/**`，§0 给绝对路径） |
| ⑦ | 报数带口径 | 是（每条读数附命令 / 字段名 / run tag） |
| ⑧ | 写「实测」必须能 `grep` 到支撑读数 | 是（字段名已在 §5-5 列明） |
| ⑨ | `NOT_MEASURED` 禁填 0/空 | 是（§5 八项均有非零非空原因） |
