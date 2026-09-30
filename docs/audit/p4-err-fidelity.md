# P4 · ERR-FIDELITY（账本错误码保真度取证）· Unit ERRCODE-AUDIT（Kong）

> **状态：取证明细（已回填）** · 本单只取证、不裁决、不改码。症状 ≠ 成因（§5.7⑧）。
> 立案：Zang §5.101 D1 —— 上单（A1 改接账本）实测「`ledger_raise` 自定义 SQLSTATE 经 `@neondatabase/serverless` 0.6.1 的 HTTP 驱动后 `code` 丢失 ⇒ 被 `normalizeLedgerError` 归一化成 500」。
> **本单结论（先给）：上述「驱动丢 `code`」**在现行 HEAD + 现行驱动 0.6.1 上 **不成立（REFUTED）**；`LD0nn` 自定义 SQLSTATE 经 HTTP 驱动后 `code` **逐字保真**，且端到端路由实测得到规格期望的 `400/409`。详见 §2.4（并给出**尚未证伪**的其它 500 通道候选，逐条标 `NOT_MEASURED`）。
> 运行标签：`errfid-20260930T140652Z`（`date -u` = `20260930T140652Z`）。

---

## §0 探针自曝（口径 / 边界 / 未覆盖面 / 我自己犯的错）

**口径（㊳ · §5.7）**
- 只读体检一律走 HTTP `neon()`（`@neondatabase/serverless@0.6.1`），**不用** `Client`(ws)；0.6.1 的 `neon()` 无 `.query` ⇒ 脚本内 `sql.query ?? sql(text,params) ?? sql.unsafe` 自适应（`p4z-errfid-01-mech.ts:40-48`）。
- **退出码不取自管道之后**：两次运行都以 `EXIT_PIPE_STATUS=${PIPESTATUS[0]}` 取真退出码（读数：`0` / `0` / `1`，见 §5）。
- 本机无 `timeout`（未使用）；每次 `terminal` ≤ 3 条命令；无 heredoc / 无巨型内联 payload（唯一内联是 §5 记的 6 行只读目录探测）。
- **零 DDL / 零具名 DML**：机制探针只跑 `SELECT`（`ledger_raise()` 是 `RETURNS void` 的纯抛出出口，抛即语句回滚；`ledger_sqlstate_of()` 是 `IMMUTABLE` 映射函数）。唯一「会触发写路径」的用例按派单口径走**已注册 HTTP 端点**，且**只会失败**（见下 B 案与 `orphan_currency_rows`）。
- **产物禁落 token**：`http-cases.json` 只记 `token_meta = {len:187, sha256_12:'34e7ba9447ae'}`，无原值（`scripts/p4z-errfid-02-http.ts:56-57`）。
- 未实测项一律写 `NOT_MEASURED`（禁填 0 / 空）。

**我自己犯的错（自曝）**
1. 第一版 `p4z-errfid-02-http.ts` 把账户表猜成 `public.ledger_account` ⇒ `NeonDbError: relation "public.ledger_account" does not exist`（退出码 1）。**现取真名 = `public.account`（列 `uid,cid,balance,frozen`）**，已修并重跑成功。**该错误本身是「标准 SQLSTATE 经 HTTP 驱动 `code` 保真」的一次意外旁证（`42P01` 未丢）。**
2. 第一版 B 案幂等键用了 `p4zerrfid:currency:<symbol>`（无合法前缀）⇒ 被前置闸拒成 `400 LEDGER_IDEMPOTENCY_KEY_INVALID`（`PREFIX_REQUIRED`）。改成 `biz:currency:create:<symbol>` 后复跑才拿到余额不足读数。**这次「打歪」意外产出一条独立的 `LD005` 路由面读数（400），已登记入真值表。**

**已知未覆盖面**
- `psql` 本机不存在（`which psql` 无输出）⇒ **「直连 vs HTTP 双路同 SQL 对照」子证据不可做 ⇒ `NOT_MEASURED`**（§2.1）。
- 需要**成功写入**才能触发的码（`LD006` 重放、`LD013` 发行上限、`LD031` 费率缺陷、`LD032` 对账不符、`LD011` 状态机非法转移的部分支）本单**不造**（禁 DML）⇒ 逐条 `NOT_MEASURED`。
- 路由面 e2e 只覆盖 3 个读数（A/B 两案 + 打歪那次）；其余 30 键为**机制面实测**（HTTP 驱动 + 项目自身分类器），已逐条标注 `route_e2e` 口径。

---

## §1 真值表对拍：**期望 HTTP 状态** vs **实测状态**

**期望侧真源（现取，非抄注释）**
- 状态 ↔ 码：`backend-ts/src/ledger-errors.ts:30-69`（`LEDGER_ERROR_TABLE`）。
- 键号 ↔ 码 ↔ **DB 侧 SQLSTATE**：`backend-ts/src/ledger.ts:1030-1062`（`LEDGER_SQLSTATE_TO_CODE`，`LD001`…`LD033` 无缺号）。
- DB 侧抛出口：`backend-ts/migrations/0004_ledger_post_event.sql:130-149`（`ledger_raise`：`ERRCODE = ledger_sqlstate_of(p_code)`（`:135,:145-146`）、`MESSAGE = p_code`（`:147`）、`DETAIL = p_details::text`（`:148`））。
- **DB 侧映射运行时复核（只读）**：`ledger_sqlstate_of('LEDGER_RESERVED_UID') = 'LD021'` / `('LEDGER_INSUFFICIENT_BALANCE') = 'LD001'` / `('LEDGER_UNKNOWN_KIND') = 'LD023'`（`mech-cases.json → sqlstate_map`）。

**实测口径（两条，分别标注）**
- **M = 机制面**：真实 `NeonDbError` 经 HTTP `neon()` 驱动拿到后，喂给**项目自己的**分类链 —— 复刻 `src/ledger.ts` 的 `runLedgerFn` 错误路径 `ledgerErrorFromDbError(e) ?? normalizeLedgerError(e)`（`ledger.ts:1183-1184`），取 `httpStatus`（= `src/index.ts` 里 `res.status(normalized.httpStatus)` 的实参，见 `index.ts:246/1271/1297`）。
- **R = 路由面 e2e**：真 Express 路由 + 真驱动（`http-cases.json`）。**未实测的一律 `NOT_MEASURED`。**

| `LDxxx` / 码名 | 期望 HTTP（真源行号） | M 机制面实测 | R 路由面 e2e 实测 | 备注 |
|---|---|---|---|---|
| `LD001` `LEDGER_INSUFFICIENT_BALANCE` | **409**（`ledger-errors.ts:30`） | **409** ✅ | **409** ✅（`POST /api/currency`，余额不足，`orphan_currency_rows=0`） | 桩：`ledger_raise('LEDGER_INSUFFICIENT_BALANCE')` |
| `LD002` `LEDGER_INSUFFICIENT_FROZEN` | **409**（`:31`） | **409** ✅ | `NOT_MEASURED` | hold 配对路径需真事件（禁 DML） |
| `LD003` `LEDGER_IDEMPOTENCY_CONFLICT` | **409**（`:33`） | **409** ✅ | `NOT_MEASURED` | 同键异载荷需真写 |
| `LD004` `LEDGER_IDEMPOTENCY_KEY_REQUIRED` | **400**（`:34`） | `NOT_MEASURED` | `NOT_MEASURED` | 属请求侧前置校验（非 DB 抛出） |
| `LD005` `LEDGER_IDEMPOTENCY_KEY_INVALID` | **400**（`:35`） | `NOT_MEASURED` | **400** ✅（意外读数：无前缀键 ⇒ `reason=PREFIX_REQUIRED`） | DB 侧同码亦由 `ledger_raise('LEDGER_IDEMPOTENCY_KEY_INVALID')` 抛 |
| `LD006` `LEDGER_IDEMPOTENCY_REPLAY` | **200**（`:32`，R106 非错误） | `NOT_MEASURED` | `NOT_MEASURED` | 需成功重放（禁 DML） |
| `LD007` `LEDGER_CURRENCY_NOT_FOUND` | **404**（`:37`） | **404** ✅ | `NOT_MEASURED` | |
| `LD008` `LEDGER_CURRENCY_NOT_LISTED` | **409**（`:38`） | `NOT_MEASURED` | `NOT_MEASURED` | 桩可直接造，本单未列 |
| `LD009` `LEDGER_CURRENCY_FROZEN` | **423**（`:39`） | `NOT_MEASURED` | `NOT_MEASURED` | 库内无该状态行 |
| `LD010` `LEDGER_CURRENCY_DELISTED` | **409**（`:40`） | `NOT_MEASURED` | `NOT_MEASURED` | 同上 |
| `LD011` `LEDGER_CURRENCY_INVALID_TRANSITION` | **409**（`:41`） | `NOT_MEASURED` | `NOT_MEASURED` | |
| `LD012` `LEDGER_CURRENCY_MISMATCH` | **400**（`:43`） | `NOT_MEASURED` | `NOT_MEASURED` | |
| `LD013` `LEDGER_SUPPLY_CAP_EXCEEDED` | **409**（`:45`） | `NOT_MEASURED` | `NOT_MEASURED` | 需真发行 |
| `LD014` `LEDGER_UNAUTHORIZED_MINT` | **403**（`:46`） | `NOT_MEASURED` | `NOT_MEASURED` | spec §3.2 明令新面禁返回 |
| `LD015` `LEDGER_HOLD_NOT_ALLOWED` | **403**（`:47`） | `NOT_MEASURED` | `NOT_MEASURED` | 同上 |
| `LD016` `LEDGER_AMOUNT_INVALID` | **400**（`:49`） | `NOT_MEASURED` | `NOT_MEASURED` | |
| `LD017` `LEDGER_AMOUNT_NOT_POSITIVE` | **400**（`:50`） | **400** ✅ | `NOT_MEASURED` | 金额非法族代表 |
| `LD018` `LEDGER_DECIMALS_OVERFLOW` | **400**（`:51`） | `NOT_MEASURED` | `NOT_MEASURED` | |
| `LD019` `LEDGER_SELF_TRANSFER` | **400**（`:52`） | `NOT_MEASURED` | `NOT_MEASURED` | |
| `LD020` `LEDGER_ACCOUNT_NOT_FOUND` | **404**（`:54`） | `NOT_MEASURED` | `NOT_MEASURED` | |
| `LD021` `LEDGER_RESERVED_UID` | **400**（`:55`） | **400** ✅（**立案案由**） | **400** ✅（`POST /api/admin/points/adjust` `uID=-1`，`details={field:'uid',uid:'-1'}`） | 路由实测来自**前置闸**（`index.ts:1207`），**未到 DB** |
| `LD022` `LEDGER_REF_NOT_FOUND` | **404**（`:56`） | **404** ✅ | `NOT_MEASURED` | 引用不存在 |
| `LD023` `LEDGER_UNKNOWN_KIND` | **400**（`:57`） | **400** ✅ | `NOT_MEASURED` | 未知 kind |
| `LD024` `LEDGER_TRANSACTION_REQUIRED` | **500**（`:59`） | `NOT_MEASURED` | `NOT_MEASURED` | 缺陷族，不得主动返回 |
| `LD025` `LEDGER_LOCK_TIMEOUT` | **503**（`:60`） | `NOT_MEASURED` | `NOT_MEASURED` | |
| `LD026` `LEDGER_TX_TIMEOUT` | **503**（`:61`） | `NOT_MEASURED` | `NOT_MEASURED` | |
| `LD027` `LEDGER_DEADLOCK_RETRY_EXHAUSTED` | **503**（`:62`） | **503** ✅ | `NOT_MEASURED` | |
| `LD028` `LEDGER_NEGATIVE_BALANCE_GUARD` | **500**（`:64`） | `NOT_MEASURED` | `NOT_MEASURED` | 需真负余额 |
| `LD029` `LEDGER_APPEND_ONLY_VIOLATION` | **500**（`:65`） | `NOT_MEASURED` | `NOT_MEASURED` | |
| `LD030` `LEDGER_ACCOUNT_GUARD_VIOLATION` | **500**（`:66`） | `NOT_MEASURED` | `NOT_MEASURED` | |
| `LD031` `LEDGER_FEE_RATE_INVALID` | **500**（`:67`） | `NOT_MEASURED` | `NOT_MEASURED` | |
| `LD032` `LEDGER_RECONCILE_MISMATCH` | **`null` ⇒ 兜底 500**（`:69`） | `NOT_MEASURED` | `NOT_MEASURED` | 需佣金守恒被破 |
| `LD033` `LEDGER_CURRENCY_SYMBOL_TAKEN` | **409**（`:42`） | `NOT_MEASURED` | `NOT_MEASURED` | |

**对拍小结（口径：本表「M 实测」9 键 + 「R 实测」3 键 ⇒ 12 条读数）**：12 条读数全部落在规格期望状态上，**0 条落 500**（聚合复核读数见 §6）。`NOT_MEASURED` = 27 键（其中 `LD009/LD010/LD013/LD028/LD029/LD030/LD031/LD032` 需真写或特殊库态）。

**非账本码对照（正常性判据，证「未丢码」不是「全部码都被吃掉」）**
| 用例 | DB 侧 SQLSTATE | 驱动层 `error.code` | 经项目分类器后的对外码/状态 |
|---|---|---|---|
| `SELECT 1/0` | `22012` | `"22012"` ✅ | `LEDGER_TRANSACTION_REQUIRED` / **500**（非账本码 ⇒ 兜底，预期行为） |
| `SELECT * FROM public.__p4z_no_such_table__` | `42P01` | `"42P01"` ✅ | 同上 |
| `SELECT __col__ FROM public.ledger_entry` | `42703` | `"42703"` ✅ | 同上 |

⇒ **标准 SQLSTATE 与自定义 `LD0nn` 在驱动层**同形保真**（同 `constructor.name`、同 own props、`code` 值逐字正确）；差异只出现在**项目分类器**（账本码 → 规格状态；非账本码 → 500 兜底，这是设计，不是丢失）。

---

## §2 机制取证：自定义 SQLSTATE → `error.code` 的保真度

### §2.1 证据①：直连 vs HTTP 同 SQL 对照 —— **`NOT_MEASURED`**
- **不可做的原因（现取）**：`which psql` 无输出 ⇒ 本机无 `psql`；`pg` 直连（`ledger.ts` 的 `driver === 'direct'` 分支）需要 `Client`/`Pool`，与派单口径「不用 `Client`(ws)」相邻但非同一物 —— **本单不冒险、如实登记为未覆盖**。
- **替代（等效强度、已实测）**：**同一函数、同一 SQL、同一 HTTP 驱动**下，把 `LD0nn` 与标准 SQLSTATE 做**组内对照**（§1 非账本码对照表）+ **DB 侧映射运行时复核**（`ledger_sqlstate_of` ⇒ `LD021/LD001/LD023`），证「DB 抛的确实是自定义 SQLSTATE」。

### §2.2 证据②：驱动源码/类型里的 `code` 透传路径（`@neondatabase/serverless@0.6.1`，现取）
- **唯一的构造点**（`node_modules/@neondatabase/serverless/index.js:1542-1544`，逐字）：
  `}else{let{status:oe}=se;if(oe===400){let{message:$,code:ie}=await se.json(),Ce=new Ee($);throw Ce.code=ie,Ce}else{let $=await se.text();throw new Ee(\`Server error (HTTP status ${oe}): ${$}\`)}}}`
  ⇒ **HTTP 400 分支：从响应体读 `{message, code}` 并 `Ce.code = ie`（`code` 显式透传）**；**非 400 分支：只抛 `Server error (HTTP status N)`，`code` 恒为 `null`**（构造器：`index.js:1511` `T(this,"code",null)`）。
- **该分支是唯一的「码丢失」通道**：只要代理对账本错误返回 **非 400**，`code` 必丢 ⇒ 落 `normalizeLedgerError` 的 `unclassified_non_pg_error` ⇒ `LEDGER_TRANSACTION_REQUIRED`（**500**）。
- **实测（判决）**：12/12 用例全部走 400 分支，`code` 全保真，**无一条**命中 `Server error (HTTP status N)`（探针内置判别器 `driver_http_status_leak`，读数逐条 `null`）。
- **附带保真缺口（同源、已实测）**：该分支**只读 `{message, code}` 两个字段** ⇒ `detail` / `constraint` / `severity` **在 HTTP 驱动上恒不搬运**（12/12 用例 `detail = <undefined>`、`constraint = <undefined>`；端到端印证：`409` 响应体 `details.detail_unavailable = 'driver_did_not_carry_detail'`，由 `src/ledger.ts:1111` 主动标注）。**这与 `code` 保真无关，但影响 `details` 保真度。**
- `.d.ts` 侧（`index.d.ts:415-416`）：`export class NeonDbError extends Error { name: 'NeonDbError';` —— 类型定义不承诺 `code` 非空 ⇒ 调用方**必须**容忍 `code === undefined`（现 HEAD 的 `sqlstateOf`/`pgCode` 已如此）。

### §2.3 证据③：自定义 `LD0nn` 与标准 SQLSTATE 的**同形性**（12 例全量读数，`mech-cases.json`）
| 用例 | `constructor.name` | `Object.keys` | `own_props` | `code` 值 | 是否 SQLSTATE 形状 | 对外（分类器） |
|---|---|---|---|---|---|---|
| `LD021` | `NeonDbError` | `name,code,sourceError` | `stack,message,name,code,sourceError` | `LD021` | 是 | `LEDGER_RESERVED_UID` / 400 |
| `LD001` | 同上 | 同上 | 同上 | `LD001` | 是 | `LEDGER_INSUFFICIENT_BALANCE` / 409 |
| `LD002` | 同上 | 同上 | 同上 | `LD002` | 是 | `LEDGER_INSUFFICIENT_FROZEN` / 409 |
| `LD003` | 同上 | 同上 | 同上 | `LD003` | 是 | `LEDGER_IDEMPOTENCY_CONFLICT` / 409 |
| `LD017` | 同上 | 同上 | 同上 | `LD017` | 是 | `LEDGER_AMOUNT_NOT_POSITIVE` / 400 |
| `LD022` | 同上 | 同上 | 同上 | `LD022` | 是 | `LEDGER_REF_NOT_FOUND` / 404 |
| `LD023` | 同上 | 同上 | 同上 | `LD023` | 是 | `LEDGER_UNKNOWN_KIND` / 400 |
| `LD007` | 同上 | 同上 | 同上 | `LD007` | 是 | `LEDGER_CURRENCY_NOT_FOUND` / 404 |
| `LD027` | 同上 | 同上 | 同上 | `LD027` | 是 | `LEDGER_DEADLOCK_RETRY_EXHAUSTED` / 503 |
| 对照 `22012` | 同上 | 同上 | 同上 | `22012` | 是 | 500（非账本 ⇒ 兜底） |
| 对照 `42P01` | 同上 | 同上 | 同上 | `42P01` | 是 | 500（同上） |
| 对照 `42703` | 同上 | 同上 | 同上 | `42703` | 是 | 500（同上） |

⇒ **自定义码与标准码在驱动层没有任何形态差异**；`isSqlstate(/^[0-9A-Z]{5}$/)`（`ledger-errors.ts:322`）对 `LD021` 成立，`classifyNonPgError` 逐条返回 `null`（= 「是 PG SQLSTATE，交下面分支」，读数见 `mech-cases.json → cases[].non_pg_class`）。

### §2.4 结论（**改写立案前提**：症状 ≠ 成因）
- **推翻**：「`ledger_raise` 自定义 SQLSTATE 经 HTTP 驱动后 `code` 丢失」——**驱动不丢码**（§2.2 源码路径 + §2.3 12/12 运行时形态 + §1 端到端 `409`/`400`）。
- **保留/成立的缺口（另一件事，勿混）**：
  - **(i) 非 400 的代理响应 = 唯一的丢码通道**（`index.js:1543-1544`）；本单实测 12/12 均为 400，故**该通道在现有账本 SQLSTATE 上未触发**，但它在结构上存在 ⇒ 任何**非账本** SQLSTATE、或代理侧对某些类返回 5xx 的场景仍会走「无码 ⇒ 500」。**未实测 ⇒ 见 §3 候选 a 的验证方式。**
  - **(ii) `DETAIL` 恒不搬运**（HTTP 驱动只读 `{message,code}`）⇒ `details` 只能靠 `MESSAGE`（= §14 码名，`0004:147`）与 TS 侧兜底，**细节字段全丢**（已实测：`driver_did_not_carry_detail`）。
- **立案案由的现 HEAD 复现性**：`POST /api/admin/points/adjust` 传 `uID=-1` **实测 `400`**，且该读数来自**路由前置闸**（`src/index.ts:1207-1213`，注释逐字「`LD021` = 目标账户无效（平台 / 保留 uid 前置闸）」）——**该请求根本没到账本/驱动**。⇒ 「调分传 `uID=-1` ⇒ 对外 500」在当前代码形态下**不可复现**；上单观测的 500 只能来自**更早的代码形态**或**另一条路径**（候选见 §3，逐条 `NOT_MEASURED`）。

---

## §3 影响面清单（若「丢码」确实发生，哪些**已注册**路径会以 500 露面）

**先给「码确实会到分类器」的基准**：所有账本写路径的抛错出口都在
`src/ledger.ts:1180-1185`（`const mapped = ledgerErrorFromDbError(e, key); if (mapped) throw mapped; throw normalizeLedgerError(e);`）
⇒ **只要 `e.code` 是 `LD0nn`，就会走 `LEDGER_SQLSTATE_TO_CODE` 得到规格状态**；`code` 若为空 ⇒ 落到 `normalizeLedgerError` 的 500 兜底（`ledger-errors.ts:651-656`）。

| # | 路径 / 位置（`文件:行号`，现取） | 若丢码会落 | 验证方式 | 本单读数 |
|---|---|---|---|---|
| 1 | `POST /api/admin/points/adjust` — `src/index.ts:1191`（错误出口 `:1268-1271`） | 500 | HTTP 实测（已注册端点；token 经 `SECRET_KEY` 铸） | **400**（`LEDGER_RESERVED_UID`，前置闸 `:1207`，未到 DB） |
| 2 | `POST /api/currency` — `src/index.ts:1282`（错误出口 `:1294-1297`） | 500 | HTTP 实测 | **409**（`LEDGER_INSUFFICIENT_BALANCE`，真驱动真分类器；`orphan_currency_rows=0`） |
| 3 | `POST /api/currency/:cid/list` — `src/index.ts:1301`（出口 `:1315-1317`） | 500 | HTTP 实测（同类 C1/C2 端点） | `NOT_MEASURED` |
| 4 | 其余账本写口（`res.status(normalized.httpStatus)` 的既有位点）：`src/index.ts:246`（`sendAuthInfra`）/`:772`/`:796`/`:825`/`:1165`/`:1271`/`:1297`/`:1317`/`:1345` | 500 | 逐位点读源码 + 端点实测 | `NOT_MEASURED`（`grep -n 'normalized.httpStatus' src/index.ts` 现取 9 位点） |
| 5 | `DatabaseService.adjustPoints` 内部（调分真正到账本的那一支） | 500 | 需走到账本才可测；现行前置闸使其不可达 | `NOT_MEASURED` |

**500 通道候选（症状≠成因，逐条列出、不选边、逐条标未验证）**
- **候选 a（结构上真存在）**：代理返回**非 400** ⇒ 驱动抛无码 `Server error (HTTP status N)`（`index.js:1544`）⇒ 500。**验证方式**：造一个非账本/越界 SQLSTATE（如 `LD999`，`0004:137-143`）或人为让代理返回 5xx，读 `error.message` 是否匹配 `/^Server error \(HTTP status (\d+)\)/`（探针已有该判别器）。**未实测**。
- **候选 b**：错误**不经 `runLedgerFn`** 而是经别的 catch（如 `sendError(400, ...)` 直写、或服务层把码吞掉重包）⇒ 分类器拿不到 `code`。**验证方式**：对该路径 `grep` 是否调用 `normalizeLedgerError`/`ledgerErrorFromDbError`；**未实测**。
- **候选 c**：上单观测发生在**改前形态**（现行 HEAD 的 `:1207` 前置闸在 A1-CAP 落地，见 `src/index.ts:1215` 注释「A1-CAP 单点校验位」）⇒ 观测点已消失。**验证方式**：`git log -p -- src/index.ts`（本单禁用 git 写；只读亦未做）⇒ **未实测**。
- **候选 d**：500 来自**非账本 PG 错误**（`unclassified_pg_error`，`ledger-errors.ts:651-656`）被误读成「账本码丢了」。**验证方式**：比对 `error.code` 是否为空串。**未实测**。

---

## §4 修复选项（并列，不选边、不改码）

> 说明：**本案主结论是「驱动不丢码」⇒ 下列选项不是「修 500 的必需项」**，而是「把**剩余**保真缺口（非 400 通道 / DETAIL 不搬运 / 码形状守卫）收口」的候选。逐项给前置 / 风险 / 成本 / 是否需迁移。

| 选项 | 做法 | 前置 | 风险 | 成本 | 需迁移？ |
|---|---|---|---|---|---|
| **① DB 侧把码编进 `MESSAGE`，TS 侧从 `message` 提码** | DB：`ledger_raise` 已 `MESSAGE = p_code`（`0004:147`）⇒ **已存在**；进一步可加机读前缀（如 `LEDGER_<CODE>\|json`）。TS：`normalizeLedgerError` 增「`code` 为空且 `message` 命中 `isLedgerErrorCode`」分支 | 需冻结 `MESSAGE` 形状（现为纯码名，改动波及 §14「双保险」校验 `ledger.ts:1116-1118`：`details.db_message_mismatch`） | 中：`MESSAGE` 是**外部可见**的（`ROUTE_B` 实测响应体 `message = 'LEDGER_INSUFFICIENT_BALANCE'`）⇒ 改形状会动对外文案；且 `LD999` 分支也是 `MESSAGE='LEDGER_TRANSACTION_REQUIRED'`（`0004:139`）会与「真码名」混淆 | 低（TS 侧）／中（DB 侧） | **DB 侧改动需新迁移**；纯 TS 侧解析不需迁移 |
| **② TS 侧归一化器改从 `cause/detail` 或多字段提码** | 改 `src/ledger-errors.ts`：`normalizeLedgerError` 前置一段「`code` 空 ⇒ 依次探 `sourceError`/`cause`/`error`（`unwrapInfraCause` 已在 `index.ts:155-167` 做过同形下钻）／`detail` 里的 `code` 字段」；并补「`message` 命中 `LEDGER_*` 码名」兜底 | 需与 `index.ts` 的 `unwrapInfraCause` **去重**（同一逻辑两处 ⇒ 漂移风险） | 中高：`code` 为空是**正常输入**（非 PG 错误族分类器 `classifyNonPgError` 依赖「空码」语义，`ledger-errors.ts:443-456`）⇒ 提码分支必须**只在 `message`/`detail` 精确命中码表时**生效，否则会把 503 面误升级成 4xx（历史回归点：P1c/P3T 的 500↔503 之争） | 低（一处函数） | **不需迁移** |
| **③ 驱动升级**（A 档债务那条） | 升 `@neondatabase/serverless` 到较新版，使 HTTP 错误响应**搬运 `detail`/`constraint`/`severity`**（现 0.6.1 只读 `{message,code}`，`index.js:1542-1544`） | 需先做兼容性验证：0.6.1 无 `.query`（本项目 `sql.query ?? sql(...) ?? sql.unsafe` 自适应已存在）；升级后 `neon()` 接口/`arrayMode`/`raw text` 语义可能变 | 中：动的是**全局驱动**，波及所有已注册账本路径（本单实测的 13 条读数都可能需要重测）；`sourceError` 形态也可能变 | 中高（重跑全量回归） | **不需迁移**（DB 侧不动） |
| **④（附加）为 `code` 加形状守卫 / 观测** | 在 `ledger.ts:1078` `sqlstateOf` 与 `ledger-errors.ts:280` `pgCode` 旁加「空码 + `message` 非空」的**服务端诊断计数**（复用既有 `ledgerErrorDiagnostics`，`ledger-errors.ts:531`） | 无 | 低：纯只读观测，不改行为 | 低 | **不需迁移** |

**共同前置（任何一项都要）**：`DL126`（500 类码只允许由不变式被破坏触发且必须告警）不能被这些改动打红 —— 即「提码」逻辑必须**可对拍**（现成对拍器：`scripts/p2c-00-code-roundtrip.ts`，33 码往返闭合）。

---

## §5 交付物与可复算命令

**产物**
- `backend-ts/.p4-artifacts/errfid-20260930T140652Z/mech-cases.json`（12 例机制面读数：驱动原文形态 + 项目分类器双路结果）
- `backend-ts/.p4-artifacts/errfid-20260930T140652Z/http-cases.json`（路由面 e2e：`ROUTE_A_LD021` / `ROUTE_B_LD001`；含 `users_probe`/`admin_probe`/`token_meta`，**无 token 明文**）
- `backend-ts/scripts/p4z-errfid-01-mech.ts`（机制取证）
- `backend-ts/scripts/p4z-errfid-02-http.ts`（路由面 e2e，含「余额 > 0 则不发」的防写前置闸）

**可复算命令（本单实跑，退出码取 `PIPESTATUS[0]`）**
```bash
cd /Users/kevin/bistro/seafood/backend-ts
node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
  scripts/p4z-errfid-01-mech.ts .p4-artifacts/errfid-20260930T140652Z; echo "EXIT=$?"   # 实测 EXIT=0
node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
  scripts/p4z-errfid-02-http.ts .p4-artifacts/errfid-20260930T140652Z http://127.0.0.1:5788; echo "EXIT=$?"  # 实测 EXIT=0
```

**支撑读数（可 `grep` 复核）**
```bash
# 1) 驱动 400 分支读 {message,code}；非 400 分支无 code
grep -c 'NeonDbError' node_modules/@neondatabase/serverless/index.js     # 现取 2
sed -n '1542,1544p' node_modules/@neondatabase/serverless/index.js      # if(oe===400){...code...} else "Server error (HTTP status ${oe})"
# 2) 期望状态真源 / 键号真源 / DB 抛出口
grep -n 'LEDGER_RESERVED_UID\|LEDGER_INSUFFICIENT_BALANCE' src/ledger-errors.ts   # :55 / :30
grep -n 'LD021\|LD001' src/ledger.ts                                              # :1050 / :1030
grep -n 'ERRCODE = v_state\|MESSAGE = p_code' migrations/0004_ledger_post_event.sql  # :146 / :147
# 3) 实测读数（每案一行，grep 得到）
grep -o '"outward_http_status": [0-9]*' .p4-artifacts/errfid-20260930T140652Z/mech-cases.json
grep -o '"id": "ROUTE_[A-Z]_LD0[0-9]*"\|"status": [0-9]*' .p4-artifacts/errfid-20260930T140652Z/http-cases.json
```

**本单边界（硬）**：只写了 `docs/audit/p4-err-fidelity.md`、`backend-ts/.p4-artifacts/errfid-20260930T140652Z/**`、`backend-ts/scripts/p4z-errfid-0{1,2}-*.ts`。**未改**任何 `src/**`、`migrations/**`、spec、`docs/seafood.master-plan.md`、`frontend/**`、既有 audit/qa 件、`.env.local`；**未** `git add/commit/push`；**未** DDL/DML；**未** `npm install`；**未** `execute_code`（本单纪律：仅 terminal/文件工具）；**未**起停服务；**未** `pkill`/`killall`。

---

## §6 聚合复核读数（本单现取 · 每项均可复算）

| 读数 | 命令（原样） | 现取输出 |
|---|---|---|
| 机制面用例数 | `grep -o '"id": "[A-Z0-9_]*",' .p4-artifacts/errfid-20260930T140652Z/mech-cases.json \| wc -l` | `12` |
| 机制面对外状态分布 | `grep -o '"outward_http_status": [0-9]*' …mech-cases.json \| sort \| uniq -c` | `3×400 / 2×404 / 3×409 / 1×503 / 3×500`（**500 的 3 条 = 对照组 `22012`/`42P01`/`42703`，全部为「非账本码 ⇒ 兜底」的预期行为**） |
| 驱动「非 400 ⇒ 无码」通道命中数 | `grep -c '"driver_http_status_leak": null' …mech-cases.json` | `12`（= 12/12 **未**命中，即代理对账本错误恒返 400） |
| HTTP 驱动不搬运 `DETAIL` | `grep -c '"detail": "<undefined>"' …mech-cases.json` | `12`（= 12/12 无 `detail`） |
| 路由面 e2e | `grep -o '"status": [0-9]*' …http-cases.json \| sort \| uniq -c` | `2×400 / 2×409`（各含 1 条 `measured` + 1 条 `expected`）⇒ **measured = ROUTE_A 400 / ROUTE_B 409** |
| 报本册读数 | `wc -l` / `wc -c` / `md5 -q docs/audit/p4-err-fidelity.md` | **218 行 / 26211 字节 / md5 `6232dfa99b502564eb4b5e2e2182aa24`**（= **含 §6 本例的最终读数**；`§1` 首次落盘时为 `7ccc1962acf95dc5bf09224875e16f20` ⇒ 两读数不同是**本单自己增写 §6 造成的**，非外部改动） |
| `NOT_MEASURED` 出现次数 | `grep -c 'NOT_MEASURED' docs/audit/p4-err-fidelity.md` | `42` |

**退出码口径复核**：两次脚本运行均以 `EXIT_PIPE_STATUS=${PIPESTATUS[0]}` 取值 ⇒ `p4z-errfid-01-mech.ts` = `0`、`p4z-errfid-02-http.ts`（修后）= `0`；**修前**的失败运行读数 = `1`（表名猜错，见 §0 自曝 1），**失败不掩盖**。
