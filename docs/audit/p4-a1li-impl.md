# P4 · A1-LEDGER-IMPL — `POST /api/admin/points/adjust` 改接账本（实现 + 实测）

> 单号 = **A1-LEDGER-IMPL** · 角色 = **Kong（实现方）** · 日期 = **2026-09-30 CST**
> 真源裁定 = **Zang §5.99**（实现口径）+ **`docs/audit/p4-a1ledger-design.md`**（261 行 · 四册齐核取证）
> run tag = **a1li-20260930T1455Z**（另 `a1li-20260930T-pre` = 改前基线 · `a1li-20260930T1340Z` = 首轮改后）
> 产物 = `backend-ts/.p4-artifacts/a1li-20260930T1455Z/**` · 脚本 = `backend-ts/scripts/p4z-a1li-01-e2e.ts`
> **本报告骨架先行落盘，随后逐段回填**（每段自带上行 `文件:行号` 或实测读数）。

## §0 结论摘要

**一句话**：`POST /api/admin/points/adjust` 已从「写**库内不存在**的 `asset` 表（恒 `42P01` → 被吞成 `404`）」**改接账本** ——
**一条** `SELECT ledger_post_event($1::jsonb)`（`op='mint'` / `op='entries'`+单腿 `burn`），**有符号 `amount`**、上限 ±100000、
**幂等键必带且 `ops:` 前缀**；实测 **15/15 用例通过**（改后 2 轮 + 重投轮），**零建表 / 零新码 / 零 `migrations` 变更**。

**逐条落实 Zang §5.99 裁定（明细见 §3）**
1. ✅ 改接 `ledger_post_event` **单语句**（`src/database.ts` `adjustPoints` 现取 = **一条** `sql` 模板；不写 `ledger_entry`/`account`/`ledger_owner`）。
2. ✅ 有符号 `amount`：正 ⇒ `mint` 到目标用户（实测 `+137` ⇒ 余额 `0→137`、Σ(cid=1) `+137`）；负 ⇒ `burn` 从目标用户（实测 `-37` ⇒ 余额 `137→100`、Σ `−37`）；上限按**绝对值** 100000；`0` ⇒ `400 NOT_A_POSITIVE_INTEGER`（沿用）；**目标 uid 不存在 ⇒ 拒（零开户、零分录，`400 LEDGER_RESERVED_UID`）**；`-1` ⇒ 拒（同码）。**零新造码 / 零新造 reason**。
3. ✅ `requireAdmin` 仍在**第一行**（非 admin ⇒ `403 AUTH_FORBIDDEN` / `NOT_ADMIN`；无 token ⇒ `401 AUTH_UNAUTHORIZED`；**非 admin + 超上限 ⇒ 403**（权限闸先于金额闸））。
4. ✅ 幂等面**规范要求键** ⇒ 补 `ops:` 前缀规范形键（`resolveAdminOpsKey` 既有助手，缺键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`）；**同键重投 ⇒ `200` replay、零新增分录**（4 个写用例重投轮实测 `Δledger_entry = 0`、`ΔΣ(cid=1) = 0`）。
5. ✅ 审计留痕：**库内无审计表 ⇒ 只登记不改**（**未建任何表**）；登记「**待批 6**」见 §6。
6. ✅ `asset` 表相关代码（`upsertAsset` / `getUserAsset` 及其余 2 处调用点）**一行未动**（属批 5）；本片只动 A1 这一条路径。

**改前/改后对照（同一探针 · 真 token · 真库 · 真 HTTP）**

| 面 | 改前（`a1li-20260930T-pre`） | 改后（`a1li-20260930T1455Z`） |
|---|---|---|
| `+137` | **`404`**（`asset` 缺表 ⇒ `42P01` 被吞；`code=null`） | **`200`** + `op=mint` + 余额 `+137` + Σ `+137` + `txid=259` |
| `-37` | `400 NOT_A_POSITIVE_INTEGER`（**扣分不可表达**，张力 T3） | **`200`** + `op=burn` + 余额 `−37` + Σ `−37` + `txid=260` |
| `-1`（保留 uid） | `404`（旧实现连码都没有） | `400 LEDGER_RESERVED_UID` |

## §1 leg 形状「现取」依据（**不得凭空发明**）

**结论（现取形状，不是推导）：`mint` 走信封 `op='mint'`；`burn` 走信封 `op='entries'` + 单腿 `kind='burn'`。**

| # | 事实 | 现取（`文件:行号`） |
|---|---|---|
| 1 | 信封 `op` **白名单 = `mint, transfer, hold, hold_release, settle, entries`** —— **其中没有 `burn`** | `backend-ts/migrations/0020_ledger_post_event_hold_family_drop_listing_deposit.sql:156`（逐字 `IF v_op IS NULL OR v_op NOT IN ('mint','transfer','hold','hold_release','settle','entries')`）；`migrations/**` 冻结 ⇒ **`op='burn'` 在本仓不可用** |
| 2 | `op='mint'` 分支的 payload 键与校验序：`uid`（`ledger_uid_arg` ⇒ **保留 uid 拒**）/ `cid` / `amount` 或 `amount_units` / `platform`（`$` 的 `owner_uid=0` ⇒ **必须 `platform=true`**）/ `memo` / `ref_type`+`ref_id`；`v_uid<0` ⇒ `LEDGER_RESERVED_UID`；R24 供给上限；**构造恰 1 条 `mint` 分录** | 同文件 `:267-313`（`platform` 必需：`:286`,`:293-297`；`uid<0` 拒：`:298-301`；R24：`:303-310`；**恰 1 条**：`:312-313`） |
| 3 | `op='entries'` 分支：`entries` 必须非空数组（≤32）；逐条 `uid`（同样走 `ledger_uid_arg`）/`cid`/`kind`（20 闭集）/`delta` **必须字符串**（**可为负**） | 同文件 `:456-481`（`:476-477`、`:480-481`、`:484-488`；负 delta 由 `transfer` 分支同款 `ledger_int_amount` 承载 `:342`） |
| 4 | 事件级配对不变式 `Σdelta = 0` **的例外**：事件含 `mint`/`burn` ⇒ **单腿合法**（`v_has_mb`） | 同文件 `:590`（`IF v_e->>'kind' IN ('mint','burn') THEN v_has_mb := true`）· `:600`（`IF NOT v_has_mb AND …`） |
| 5 | 返回体含 **`accounts`**（事件后余额快照）⇒ 事后余额**可由同一条语句取回**（无需第二次往返） | 同文件 `:939-943`（`'accounts', ledger_accounts_from_entries(v_out)`）；TS 侧解析 `src/ledger.ts:1151-1156` |
| 6 | A1 的**逐事件形态**（册内点名）：`mint ×1`（`$`：系统 → 目标用户 `balance +n`）；**ref = `currency` / `cid`**；净 `+n` | `docs/data-layer.spec.md:513`（§4.0 逐事件形态表 A1 行，逐字） |
| 7 | **既有「已工作」的同形调用**（本片照抄形态，不自创）：C1 `createCurrencyWithFee` 与 C2 `listCurrencyWithDeposit` 均为「**单语句 CTE + `ledger_post_event(jsonb_build_object(...))`**」 | `src/database.ts:1345`（C1）/ `:1447`（C2）；账本唯一写路径 SQL `src/ledger.ts:1007`（`SELECT ledger_post_event($1::jsonb) AS r`） |
| 8 | 幂等键（事件根键）= **`ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq>`**；**创建键 = 「—」** | `docs/route-layer.spec.md:685`（§4.5 幂等键总表「管理员调分」行）；`docs/data-layer.spec.md:585`（§8.3 写路由全表 A1 行） |
| 9 | 后台写**必带键**、无键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`；**传输位置 = `Idempotency-Key` 头**；`ops:` 前缀强制 | `docs/data-layer.spec.md:548`（DL97）· `:695`（DL146②）· `docs/route-layer.spec.md:685` 的 `ops:` 注 + `:176` |
| 10 | 路由层**必须传 `request_fingerprint`**，指纹 = business 字段集合（A1 = `target_uid`/`cid`/`amount`/`reason_code`，**不含派生量**） | `docs/data-layer.spec.md:546`（DL96）· `:585`（A1 行的「指纹 business 字段」列） |
| 11 | 既有键助手（**复用，零新校验码**）：`ops:<admin_uid>:<action>:<business_id>` 规范形 + 前缀/`#`/控制字符/长度校验 | `src/admin-service.ts:45`（`canonicalAdminOpsKey`）· `:51-84`（`resolveAdminOpsKey`）· 同族 4 处落点 `src/index.ts:884/939/969/991` |
| 12 | 目标账户无效的**前置闸**口径：`LD021` = `LEDGER_RESERVED_UID` → `400`；「**目标账户无效（平台/保留 uid 前置闸）**」，且**在用（A1 在列）** | `docs/route-layer.spec.md:840` · `:640`（A1 行 `400 LD021`）· 状态真源 `src/ledger-errors.ts:55`（`LEDGER_RESERVED_UID: { status: 400, message: '目标账户无效' }`） |

> **幂等面判定（派单第 4 条：三款现取 → 规范要求键）**：`docs/route-layer.spec.md:685` 的 A1 行**给了事件根键**（`创建键` 列为「—」），
> `docs/data-layer.spec.md:585` 同款，且 DL97/DL146② 要求**写路由必带键**、键位在 `Idempotency-Key` 头 ⇒ **判定 = 规范要求键** ⇒ 补 `ops:` 前缀规范形键
> （**没有**自造键形：键串逐字对齐 `ops:<admin_uid>:points_adjust:<target_uid>:1:<seq>`，`<cid>` 硬编码 `1` 因 A1 只许 `$`）。
> **申报一处口径差**：`resolveAdminOpsKey` 的 `details.canonical_key` 提示串为 `ops:<admin_uid>:points_adjust:<target_uid>:1`（**不含 `<seq>`**，因 `<seq>` 属调用方）；
> 该字段**只是 400 的提示**、不是校验项（助手只校验前缀/字符集/长度，与同族 4 处后台写口一致）⇒ **未改助手**。

## §2 改动清单（最小改动）

| 文件 | 改动 | 说明 |
|---|---|---|
| `src/database.ts` | `adjustPoints` **重写**（原 `:940-968`：读 `getUserAsset` + `upsertAsset(uID, amount)` 写 `asset`）⇒ 现为**一条** `SELECT`（CTE：`usr` 存在性闸 → `gate` → `ev = ledger_post_event(...)` → 事后余额快照） | 入参签名增 `idempotencyKey` / `requestFingerprint`（由路由层给，DL96/DL97）；**不写 `account`/`ledger_entry`**（R1） |
| `src/index.ts` | ① 新增 `import { createHash } from 'crypto';`（DL96 指纹）；② `app.post('/api/admin/points/adjust')` 路由体重写（原 `:1182-1228`）：保留 `requireAdmin` 首闸 + `ADMIN_POINTS_ADJUST_MAX_PER_CALL` 常量（`:1180`，**值不变**） | 校验位语义由 `amount <= 0` 改 `amount === 0`、上限改 `Math.abs(amount)`；新增：`uID < 0` 前置拒（LD021）、`resolveAdminOpsKey`、指纹、`user_found !== 1` 拒（LD021）、catch 改走 `normalizeLedgerError(unwrapInfraCause(...))`（**去掉**旧「`404 积分调整失败`」吞错） |
| 报告 / 脚本 / 产物 | `docs/audit/p4-a1li-impl.md` · `backend-ts/scripts/p4z-a1li-01-e2e.ts` · `backend-ts/.p4-artifacts/a1li-*/**` | 见 §8 |

**本片一行未动（硬边界）**：`migrations/**`（**未建任何表**）· `src/ledger.ts` · `src/ledger-errors.ts` · `src/commission.ts` · `src/currency-service.ts` · 任何 spec · `docs/seafood.master-plan.md` · `frontend/**` · 既有 audit/qa 件 · `.env.local` · **`asset` 相关代码**（`upsertAsset` `:889` / `getUserAsset` `:861` 及其余 2 处调用点 `/api/auth/verify`、`/api/task-progress/claim` ⇒ 属**批 5**）。

## §3 逐条落实 Zang 硬性裁定 1~6

| # | 裁定 | 落点（现取） | 实测读数 |
|---|---|---|---|
| 1 | **单语句 `ledger_post_event`**；不直写 `ledger_entry`/`account`/`ledger_owner` | `src/database.ts` `adjustPoints` 现取 = **1 个** `sql` 模板（`… SELECT ledger_post_event(${JSON.stringify(envelope)}::jsonb) AS r FROM gate`）；函数体内**无** `INSERT/UPDATE` | 每个写用例 `Δledger_entry = 1`（A01/A02/A03/A04），**逐笔可归因**（txid 259/260/261/262 连续） |
| 2 | **有符号 `amount`**：正 ⇒ `mint` 到目标；负 ⇒ `burn` 从目标；**上限按绝对值** 100000；`0` ⇒ 拒；目标 uid 不存在 ⇒ 拒（不造幽灵账户）；`-1/-2/-3` 不当目标用户；**既有码/reason** | `src/index.ts` 路由：`amount === 0` ⇒ `LEDGER_AMOUNT_INVALID`+`NOT_A_POSITIVE_INTEGER`；`Math.abs(amount) > cap` ⇒ +`OVER_MAX_SINGLE_AMOUNT`；`uID < 0` ⇒ `LEDGER_RESERVED_UID`；`user_found !== 1` ⇒ `LEDGER_RESERVED_UID`；`src/database.ts`：`amount > 0 ? 'mint' : 'entries'`（负 ⇒ 单腿 `kind='burn'`, `delta = String(amount)`） | `+137`⇒200/sigma+137/bal+137；`-37`⇒200/sigma−37/bal−37；`+100000`/`-100000`⇒200；`±100001`⇒400 `OVER_MAX_SINGLE_AMOUNT`；`0`⇒400 `NOT_A_POSITIVE_INTEGER`；`987654321`（库内无此用户）⇒400 `LEDGER_RESERVED_UID` + `Δledger_entry=0`、`ΔΣ=0`（**零开户**）；`-1`⇒400 `LEDGER_RESERVED_UID` |
| 3 | **`requireAdmin` 在最前**（非 admin ⇒ 403、无 token ⇒ 401） | `src/index.ts`：`const actor = await requireAdmin(req, res); if (!actor) return;` 是**处理器第一句**（在 `try` 之前） | 非 admin ⇒ `403 AUTH_FORBIDDEN`+`NOT_ADMIN`；**非 admin + `amount=100001` ⇒ 403（不是 400）**；无 token ⇒ `401 AUTH_UNAUTHORIZED` |
| 4 | **幂等**：规范要求键 ⇒ 补 `ops:` 前缀合规键；同键重投 ⇒ 200 replay 零新增分录 | `resolveAdminOpsKey(req, actor.session.uID, 'points_adjust', \`${uID}:1\`)`（既有助手，`src/admin-service.ts:51`）；键串形态 = 规范形 | 缺键⇒`400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`；`cli:` 前缀⇒`400 LEDGER_IDEMPOTENCY_KEY_INVALID`+`PREFIX_REQUIRED`（**规范只许 `ops:`**）；**4 个写用例用同键重投：全部 `200`、`Δledger_entry = 0`、`ΔΣ(cid=1) = 0`、`txid` 与首投逐字相同（A11 = `259` = A01）** |
| 5 | **审计留痕：库内无审计表 ⇒ 只登记不改（严禁建表）** | 未写 `migrations/**`、未执行任何 DDL | 见 §6「待批 6」；本片留痕 = 进程日志一行（`[admin.points.adjust] infra failure` **仅错误面**）+ 账本事件本体（`ref_type='currency'`/`ref_id='1'`/`memo=reason`） |
| 6 | **`asset` 代码一律不动**；只动 A1 一条路径 | `git diff` 面 = 上表 2 个 `src` 文件；`upsertAsset`/`getUserAsset` 及另 2 处调用点**未动** | 改后 A1 成功面 = `200`（**不再重定向到缺失的 `asset` 表**）；`information_schema` 现取 `asset` 表 = **不存在**（`asset_table_exists = false`，两轮一致） |

**成功面「不再重定向到缺失的 `asset` 表」声明（口径收敛，不含糊）**：A1 这一条路径的 `42P01` 面 = **0**（改前恒 `404`、改后实测 `200`，且 `adjustPoints` 内已无 `asset` 引用）。
**其余两处 `upsertAsset` 调用点**（`/api/auth/verify`、`/api/task-progress/claim/:jID`）的 `42P01` 面 **本片未测**（属批 5）⇒ 不得读成「全仓 `42P01` 归零」。

## §4 实测读数（改前 / 改后逐例）

**环境**：`http://127.0.0.1:5788`（面板 `sid=seafood-api`）· 真 token（`.env.local` 的 `SECRET_KEY` → `src/auth.createSessionToken`，产物**只落 12 位指纹**：admin `126153bb787e` / secret_key `b1ec01afb2eb`）· 真库（`.env.local` 的 `DATABASE_URL`，只读 SELECT）· `tsc --noEmit` = **0**（`TSC_EXIT=0`）。

### §4.1 改前基线（`a1li-20260930T-pre` · 跑在**旧码**上）

- 库面：`asset` 表 **不存在**（`asset_table_exists=false`）；`ledger_entry` 总 **243**；Σ(cid=1) **2000000**；
  逐 kind（16 类）：`mint 5` / **`burn 0`** / `transfer 12` / `hold 50` / `hold_release 8` / `hold_forfeit 0` … `currency_create_fee 38` / `listing_deposit 22` / `job_escrow 20` / `trade 32` …
- 路由面（逐例，真 HTTP）：`+137` ⇒ **404**；`-37` ⇒ `400 NOT_A_POSITIVE_INTEGER`；`-100000` ⇒ `400 NOT_A_POSITIVE_INTEGER`；
  `+100001` ⇒ `400 OVER_MAX_SINGLE_AMOUNT`；`0` ⇒ `400 NOT_A_POSITIVE_INTEGER`；非 admin ⇒ `403`；无 token ⇒ `401`；
  `uID=987654321` ⇒ **404**；`uID=-1` ⇒ **404**；缺 reason ⇒ `400 参数不完整`。
  ⇒ **成功面恒不可达；扣分（`burn`）与保留 uid 面旧码连错误码都没有**（`code=null`）。

### §4.2 改后逐例（`a1li-20260930T1455Z` 首轮 = 真写入；重投轮 = 幂等）

夹具：**新造一次性 uid `21`**（`public."users"` 新行，`evm` 由 run tag 派生）+ 非 admin 夹具；金额自备（A01 先铸给夹具账户）。

| 例 | 请求 | 首轮 status / code / reason | `ΔΣ(cid=1)` | `Δ余额` | `Δledger_entry`（kind） | 重投轮 |
|---|---|---|---|---|---|---|
| A01 | `amount=+137` | **200**（`op=mint`, `txid=259`, `new_points=137`） | **+137** | **+137**（0→137） | 1（`mint`） | 200 replay，Δ=0 |
| A02 | `amount=-37` | **200**（`op=burn`, `txid=260`, `new_points=100`） | **−37** | **−37**（137→100） | 1（`burn`） | 200 replay，Δ=0 |
| A03 | `amount=+100000` | **200**（`op=mint`, `txid=261`） | **+100000** | **+100000** | 1（`mint`） | 200 replay，Δ=0 |
| A04 | `amount=-100000` | **200**（`op=burn`, `txid=262`） | **−100000** | **−100000** | 1（`burn`） | 200 replay，Δ=0 |
| A05 | `amount=+100001` | 首轮 `503 LEDGER_TX_TIMEOUT / driver_connection_error`（**瞬时**）；**重投 ⇒ `400 LEDGER_AMOUNT_INVALID`+`OVER_MAX_SINGLE_AMOUNT`** | 0 | 0 | 0 | **400（通过）** |
| A06 | `amount=-100001` | **400** `LEDGER_AMOUNT_INVALID` / `OVER_MAX_SINGLE_AMOUNT` | 0 | 0 | 0 | 400 |
| A07 | `amount=0` | **400** `LEDGER_AMOUNT_INVALID` / `NOT_A_POSITIVE_INTEGER` | 0 | 0 | 0 | 400 |
| A08 | 非 admin | **403** `AUTH_FORBIDDEN` / `NOT_ADMIN` | 0 | 0 | 0 | 403 |
| A08b | 非 admin + `+100001` | **403**（权限闸优先） | 0 | 0 | 0 | 403 |
| A09 | 无 token | **401** `AUTH_UNAUTHORIZED` | 0 | 0 | 0 | 401 |
| A10 | `uID=987654321`（无此用户） | **400** `LEDGER_RESERVED_UID`（**零开户、零分录**） | 0 | 0 | **0** | 400 |
| A10b | `uID=-1` | **400** `LEDGER_RESERVED_UID`（在盘：`src/ledger-errors.ts:55` = 400「目标账户无效」） | 0 | 0 | 0 | 400 |
| A11 | **同键重投 A01** | **200**（`txid=259` = A01 逐字相同；`Δledger_entry=0`） | 0 | 0 | **0** | 200（`Δ=0`） |
| A12 | 缺幂等键 | **400** `LEDGER_IDEMPOTENCY_KEY_REQUIRED` | 0 | 0 | 0 | 400 |
| A13 | `cli:` 前缀键 | **400** `LEDGER_IDEMPOTENCY_KEY_INVALID` / `PREFIX_REQUIRED` | 0 | 0 | 0 | 400 |
| A14 | 缺 reason | **400**「参数不完整」（**既有行为未改**） | 0 | 0 | 0 | 400 |

> **首轮 `failed = ["A05"]`（唯一）**：其 `503` 是 **Neon 驱动瞬时抖动**（既有 A 档债务），且**不是本片 catch 产生的** ——
> 证据：`A05` 的失败面**在任何 DB 访问之前**（`Math.abs` 校验），同轮 `A06`（同路径、同码）⇒ `400`；
> 面板日志中 `[admin.points.adjust] infra failure` **全窗口仅 1 行**，且该行的 `message = LEDGER_RESERVED_UID`（= 上一轮 `A10b` 的**改前**读数），
> **没有** `A05` 的对应行 ⇒ `A05` 的 503 来自 `requireAdmin` 侧的基础设施分类（P4-SEC），非本路由 catch。
> **控制组**：同一请求重投 ⇒ `400 OVER_MAX_SINGLE_AMOUNT`（重投轮 `A05`），**判定 = 瞬时**。
>
> **重投轮 = 15/15 PASS，`POST2_EXIT=0`，`delta_overall = {sigma_cid1: "0", ledger_entries: 0, kinds_changed: []}`**（4 个写用例 + A11 全部 replay ⇒ 零新增分录）。

### §4.3 账本面（**改前 / 改后逐 kind 增量 + 逐笔归因**）

| 口径 | 改前基线 | 改后首轮 `pre` | 改后首轮 `post` | 增量 |
|---|---|---|---|---|
| `ledger_entry` 总 | **243** | 251 | **255** | **+4**（= 本片 4 笔：A01/A02/A03/A04） |
| `mint` | **5** | 7 | **9** | **+2**（A01、A03） |
| `burn` | **0** | 2 | **4** | **+2**（A02、A04）—— **`burn` 首次在本库被使用** |
| Σ(cid=1 `balance+frozen`) | **2000000** | 2000100 | **2000200** | **+100** = `+137 −37 +100000 −100000` **恰等于 4 例意图额之和** |

**逐笔归因**：新增 4 行的 `txid` = **259/260/261/262**（连续），`Ψ kind` 交替 `mint/burn/mint/burn` 与用例一一对应；
**本片零 `job_escrow`/其他 kind 写入**。
**并发写者登记（探针自曝）**：同一窗口内 `job_escrow 20 → 24`（**+4，非本片产生**，属他单元在跑的招工单）——
它落在 **`cid ≠ 1`** 的账户上，故 Σ**(cid=1)** 与本片读数**未受污染**（`+100` 恰等）；跨 cid 的全库 Σ 未作为判定口径。

### §4.4 回归面（两轮一致）

| 项 | 期望 | 实测 |
|---|---|---|
| `/health` | `200` | **200**（面板 `POST /api/restart {"sid":"seafood-api"}` 后 **3s** 起健康） |
| 注册点 | **65 不变** | **65**（`grep -cE '^app\.(get|post|put|delete|patch)\(' src/index.ts` 现取） |
| 已落 `410` 面 | **6/6** | **6/6**（`/api/auth/register`、`/api/shard/redeem`、`/api/chest/1/open`、`/api/admin/prize/{create,update,delete}`） |
| C1/C2 下限 | `10000/10000/50000` 常量在盘 + 低于下限 ⇒ `400` | 常量现取 `10000/10000/50000`；C1 实测 `400 LEDGER_AMOUNT_NOT_POSITIVE`+`BELOW_SERVER_FLOOR`；C2 同（**未被本片放松**） |
| `tsc --noEmit` | `0` | **`TSC_EXIT=0`**（改后两次） |

## §5 `NOT_MEASURED`（**禁填 0 / 空**）

| 编号 | 未测项 | 为何未测 |
|---|---|---|
| N1 | `burn` 超余额 ⇒ `LEDGER_INSUFFICIENT_BALANCE`（`LD001`）的 **HTTP 面** | 未构造该夹具（且已知该面在 neon HTTP 驱动下 `sqlstate` 丢失 ⇒ 会落 `500`，见 §6-D1；修复落点在**禁写文件**） |
| N2 | **并发**同键（两请求同时到达）⇒ `200` replay 的时序行为 | 单线程探针，未构造竞态 |
| N3 | `cid ≠ 1` 的调分面 | A1 规范**只许 `$`**（`docs/route-layer.spec.md:176`/`:640`）⇒ 本片**硬编码 `cid=1`、无 `cid` 入参面**，该分支不可达 |
| N4 | R24 `supply_cap` 触发面 | `$` 的 `supply_cap = NULL`（`p4-a1ledger-design.md:243`）⇒ 不可达 |
| N5 | 「日累计上限」 | **未实现**（`src/index.ts:1179` 注释逐字「日累计上限留后续（批 6）」）；四册 `grep` 零命中 |
| N6 | 审计留痕（审计台 **P6** / `audit_ledger` 权限位） | **库内无审计表** ⇒ 本片只登记不改（§6-D2） |
| N7 | 冻结前端在**不带 `ops:` 键**时的实况（`400` 代价） | 未触达前端写口（无调用面可测）；仅知同族先例 `§2.4 S1`（`docs/route-layer.spec.md:685` 的 `ops:` 注） |
| N8 | `requireAdmin` 的 **`requiredPermission` 维度**（本路由未传权限键） | 未构造「有 admin 身份但未授某权限」的夹具（A1 的权限键归属未在四册点名，`p4-a1ledger-design.md:255` N8） |
| N9 | 线上/预览库（另一 Neon 分支）是否有 `asset` 表 | 探针只连 `.env.local` 指向的库 |

## §6 债务 · 登记 · 夹具残留

**D1（既有债务 · 非本片引入 · 修复落点属禁写文件）**：DB 侧 `ledger_raise` 抛出的自定义 SQLSTATE 经 **neon HTTP 驱动**后 **`code` 丢失** ⇒ `ledgerErrorFromDbError`（`src/ledger.ts:1089`）返回 `null` ⇒ `normalizeLedgerError` 归一化为
`500 LEDGER_TRANSACTION_REQUIRED`。**实测证据（本片直接踩到，已留盘）**：改前那轮 `uID=-1` 的响应 = `500`，面板日志逐字
`{"code":"LEDGER_TRANSACTION_REQUIRED","http_status":500,"reason":"unclassified_pg_error","constructor_name":"NeonDbError","message":"LEDGER_RESERVED_UID",…,"stack_head":[…,"at async Function.adjustPoints (…/src/database.ts:981:26)"]}`。
**本片处置**：把「目标账户无效」面**前移到路由层**（保留 uid / 幽灵 uid 都在路由拒，`400 LD021`）⇒ A1 的该面**不再依赖**这条退化链；
**残留** = N1（`LD001` 面仍会落 `500`）。修复应在 `src/ledger.ts` / `src/ledger-errors.ts`（**本片禁写**）⇒ 登记为**批 6/后续单**。

**D2（待批 6 · 派单第 5 条）**：**审计留痕无落点** ⇒ 本片**未建表**、未写审计行；A1 的可核查留痕 = 账本事件本体（`ledger_entry`：
`kind`/`delta`/`uid`/`cid`/`memo=reason`/`ref_type='currency'`/`ref_id='1'`/`idempotency_key`/`request_fingerprint`/`txid`）。
**待批 6 一并处理**：① 审计台（P6 / `DL146⑤`）；② 「日累计上限」（N5）。

**D3（夹具残留 · 零 `DELETE` 纪律）**：3 轮 run 各 `INSERT` 2 行一次性 `public."users"` 夹具（现取确认到的 uid = `17`/`18`（改前轮）、
`21`（改后轮，A01 响应 `uID=21`）；首轮 `1340Z` 的 2 行 uid **未逐行现取** ⇒ 计数按 `INSERT` 次数 = **6 行**）。
夹具账户余额 = `100`（= `+137 −37 +100000 −100000`）；`burn` 面**未清零**（去掉这 100 需再调分，本片不做）。
**禁删除型 SQL ⇒ 未清理**，登记于此。

## §7 探针自曝（口径瑕疵 / 假阳性 / 未测项）

① **`idempotent_replay` 读取位置错**：首轮探针读 `data.idempotent_replay` ⇒ 全面记 `false`；该标志实际落在**响应根键**
（`sendSuccess(..., extra)` 的 `extra` 与同族先例 `src/index.ts:1159` 一致，符合 `DL98` 的 `200 { idempotent_replay: true, txid, … }`）。
⇒ 本报告的 replay 判定**改用更硬的判据**：`Δledger_entry = 0` + `ΔΣ = 0` + **`txid` 与首投逐字相同**（A11 = `259`）。
② **首轮 `A05` = `503`**：**瞬时**（§4.2 三重证据）；控制组 = 重投 `400`。**未**把它算作功能失败，也**未**把它写成「通过」。
③ **改前轮的 `A06`/`A10b` 记 `FAIL`** = **预期**（改前语义：负值被 `≤0` 挡成 `NOT_A_POSITIVE_INTEGER`；`-1` 落 `404`）—— 这两条 FAIL 正是「张力 T3 旧形态」的读数，**不是缺陷**。
④ **`A07` 窗口捕获到 `Δledger_entry=2`**（首轮）：非本片写入（并发写者的 `job_escrow`）⇒ 见 §4.3 并发登记；本片按**逐例窗口**读数归因，未用全窗口差值冒充逐例。
⑤ **`pre` 模式的 `pass` 列复用 `post` 期望**（探针实现如此）⇒ 改前轮只作**记录**用，不参与判定。
⑥ **退出码**：`PRE_EXIT=0` / `POST_EXIT=1`（首轮唯一 FAIL）/ `POST2_EXIT=0`，全部**直取**、不经管道。
⑦ **本次未按「骸架先行」分段落盘**：骨架已先行（首次落盘为主题 + TODO 骨架），正文在实测完成后**一次回填**（分 2 次写入）；如实登记，供流程审计。

## §8 写集自检（硬边界）

**只写（4 类）**：`backend-ts/src/database.ts` · `backend-ts/src/index.ts` · `backend-ts/scripts/p4z-a1li-01-e2e.ts` · `docs/audit/p4-a1li-impl.md` + `backend-ts/.p4-artifacts/a1li-*/**`。
**未写/未改**：`migrations/**`（**绝无建表/改表/DDL**）· `src/ledger.ts` · `src/ledger-errors.ts` · `src/commission.ts` · `src/currency-service.ts` · `src/admin-service.ts`（复用其助手，未改）· 任何 spec · `docs/seafood.master-plan.md` · `frontend/**` · 既有 audit/qa 件 · `.env.local`。
**未执行**：`git add/commit/push`（零 git 写操作）· 任何**删除型 SQL**（夹具残留见 D3）· 新 kind / 新错误码 / 新 `reason` · `npm install` · `execute_code` · `pkill -f` / `killall` · 常驻 server。
**服务启停（登记）**：仅 `POST http://127.0.0.1:5555/api/restart {"sid":"seafood-api"}` **两次**（各自改码后），重启后 `/health` 均先等到 `200`；**未**启停任何其他服务。

## §9 复算命令（退出码直取，不经管道）

```
# 1) 类型面
cd /Users/kevin/bistro/seafood/backend-ts && node_modules/.bin/tsc --noEmit; echo "TSC_EXIT=$?"

# 2) 改后实测（15 例 + 回归 + 账本面；会**真写入**账本与夹具）
node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
  scripts/p4z-a1li-01-e2e.ts "$PWD/.p4-artifacts/a1li-20260930T1455Z" post

# 3) 幂等面（同键重投 ⇒ 全 replay、零新增分录）
node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
  scripts/p4z-a1li-01-e2e.ts "$PWD/.p4-artifacts/a1li-20260930T1455Z" post   # 第二轮

# 4) 结构面现取
grep -n "ledger_post_event" src/database.ts                     # adjustPoints 内 1 处（单语句）
grep -cE "^app\.(get|post|put|delete|patch)\(" src/index.ts      # = 65（注册点不变）
grep -n "ADMIN_POINTS_ADJUST_MAX_PER_CALL" src/index.ts          # 常量 = 100000（未变）
grep -n "v_op NOT IN" migrations/0020_ledger_post_event_hold_family_drop_listing_deposit.sql  # = :156（op 白名单，无 burn）
```

**产物索引**：`a1li-20260930T-pre/a1li-01-e2e.pre.json`（改前基线）· `a1li-20260930T1340Z/a1li-01-e2e.post.json`（首轮改后，含 `A10b` 500 退化读数）· `a1li-20260930T1455Z/a1li-01-e2e.post.first.json`（**真写入轮**）· `…/a1li-01-e2e.post.rerun.json`（**幂等重投轮 15/15**）· 同名 `.log`。
