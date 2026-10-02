# P6-D1'：无 SQLSTATE（`code == null`）的驱动/传输错 ⇒ 503（且鉴权层不得吞成 401）

- **单号 / 角色**：Unit BE-ERR503 / D1'（Kong，批 6 最后一项）
- **仓 / 面**：`/Users/kevin/bistro/seafood`，后端 `backend-ts`（Neon / `@neondatabase/serverless` **0.6.1**）
- **交付**：本文件 + 4 个取证脚本 + `.p4-artifacts/p6d1p-*` 产物（未提交）
- **一句话结论**：驱动/传输类「无 SQLSTATE」错误**不再**被分类器误判成 500（`LEDGER_TRANSACTION_REQUIRED`）、
  也**不再**被 `/api/auth/verify` 的 catch-all 吞成 401；一律落 **503 `LEDGER_TX_TIMEOUT` + 机读 `reason`**。
  **未新增错误码（33 码不动）、未新增 reason 值、400 分支逐条不变、注册点仍 67、账本零位移。**

---

## 1. 只读取证（逐 `文件:行号`；均为现取）

### 1.1 错误分类真源

| 面 | 位置 | 现取结论 |
|---|---|---|
| 33 码表 / bucket 表 | `src/ledger-errors.ts:28-70`（`LEDGER_ERROR_TABLE`）、`:112-150`（`LEDGER_ERROR_BUCKETS`） | 本单**逐条未动**（单测 U0c/U0d 逐码对拍快照） |
| PG SQLSTATE 映射（含 400 分支） | `src/ledger-errors.ts:628-716`（`normalizeLedgerError`，`:653-689` 的 `switch`） | 400 分支**逐条未动**（U1 全绿） |
| 非 PG 分类器 | `src/ledger-errors.ts:500`（`classifyNonPgError`） | **本单唯一改动的分类器入口**（`:514` 新增一分支） |
| 既有 503 通道（分类器） | `src/ledger-errors.ts:519`（`TRANSIENT_NON_PG_REASONS`）、`:642-651`（`LEDGER_TX_TIMEOUT` + `reason`） | **复用**，未改 |
| 驱动封装（路由层下沉真因） | `src/index.ts:193-205`（`unwrapInfraCause`） | 未改（本单复用） |
| DB 事务层 | `src/db.ts:145-160`（`mapTxError`，只映射 `55P03/57014/40001/40P01`，**其余原样抛**）、`:98-126`（两条池，`connectionTimeoutMillis=10000`） | 未改；无码错误由此冒到路由层 |

**驱动侧现取实证**：`node_modules/@neondatabase/serverless/index.js:1544` 逐字
`throw new Ee(\`Server error (HTTP status ${oe}): ${$}\`)` ⇒ **非 400** 不搬 `code`（`code` 恒 `null`），与冻结事实一致。

### 1.2 现取「抛什么形状」（只读取证脚本 `scripts/p4z-d1p-00-probe-shape.ts`，产物 `p6d1p-*/shape-probe.json`）

| 路径 | 构造器 / `code` | `message` | 真因链 |
|---|---|---|---|
| `Pool` + WebSocket（= `src/db.ts` 两条池的**实际**路径） | `ErrorEvent`（`code` **无**，own props 只有 `stack`，`type`/`message` 在原型 getter） | `connect ECONNREFUSED 127.0.0.1:443` / `Client network socket disconnected…` | `.error` = `Error{code:'ECONNREFUSED'|'ECONNRESET'}` |
| `neon()` HTTP | `NeonDbError`（`code: null`） | `Error connecting to database: fetch failed` | `sourceError` = `TypeError('fetch failed')` → `cause` = `Error{code:'ECONNREFUSED'|'ECONNRESET'}` |

⇒ 修前：WS 形态已由 `isEventObjectFamily`（P3T）覆盖（既有 503）；**HTTP 形态（`code == null` + 外层文案）两样旧判据都不命中** ⇒ `unclassified_non_pg_error`（500 类）；`/api/auth/verify` 更把它吞成 401。

### 1.3 现有 503 理由表（reuse 优先 ⇒ 本单**复用**，新造 = 0）

| reason | 语义 | 位置 | 本单是否新造 |
|---|---|---|---|
| `pool_connection_timeout` | 连接池过载 / 拿连接超时 | `ledger-errors.ts:449` → `:519` → 503 | 否（既有） |
| **`driver_connection_error`** | **驱动 / OS 连接级错误、事件对象族** | `ledger-errors.ts:450-453`（既有）/ **`:514`（本单新增同值入口）** | 否（**复用**） |
| `too_many_connections` / `out_of_memory` / `disk_full` / `admin_shutdown` / `crash_shutdown` / `cannot_connect_now` / `io_error` / `read_only_transaction` / `database_unavailable` | infra SQLSTATE（`53300/53200/53100/57P01/57P02/57P03/58030/25006/3D000`） | `:337-347` → `:632-637`（503） | 否（既有） |
| 类级兜底：`insufficient_resources`(`53*`) / `operator_intervention`(`57*`) / `system_error`(`58*`) / `connection_error`(`08*`) / `internal_error`(`XX*`) | 按 SQLSTATE 类 | `:350-356` | 否（既有） |

### 1.4 鉴权层 catch-all 位置（即「把 DB 异常吞成 401」的那段）

| 面 | 位置（现盘） | 修前行为 |
|---|---|---|
| **`/api/auth/verify` 单一 catch** | `src/index.ts:401-425`（catch 在 `:424-426`：`sendError(res, 401, …)`） | **一切异常同形 401** ← 本单的「吞 401」真源；`/api/auth/login`（`:452-455`）改 `req.url` 复用同一 handler |
| `resolveActor` | `src/index.ts:207-247`（catch-all 在 `:244-246` ⇒ `{kind:'infra', error}`） | **已正确分流**（P4-SEC）：`unauthorized⇒401`，`infra⇒分类器` |
| `requireActor` infra 面 | `src/index.ts:263-286`（`:279` 分类器、`:284` 以 `normalized.httpStatus` 写响应） | **已正确分流**（既有 503） |
| 401/403 形状（真实鉴权失败） | `src/index.ts:254-261`（`sendAuthError`） | 未改（本单不动 401/403 形状） |

---

## 2. 修（改动点，逐条）

### 2.1 分类器：`src/ledger-errors.ts`

- 新增判据（`**:466-470**` `DRIVER_TRANSPORT_MESSAGE_RE`、**`471-484`** `nestedDriverTransientCode`、**`487-491`** `isNullCodeDriverTransportError`）；
- 在 `classifyNonPgError` **末尾**（**`:514`**）加一行：`if (isNullCodeDriverTransportError(e, code, message)) return 'driver_connection_error';`
- 判据 = **无码**（`code` 为空：`null`/`undefined`/`''`）**且**（`message` 命中驱动/传输形态 **或** `cause`/`sourceError`/`error` 链内有 `ECONNREFUSED/ECONNRESET/ENOTFOUND/ETIMEDOUT/EHOSTUNREACH/ENETUNREACH/EPIPE/EAI_AGAIN`）。
- **顺序保证 400 分支不变**：带 `code` 的错误在 `:446`（`isSqlstate`）就被挡回老路径；本条**只在无码时生效**。
- **不新造码、不新造 reason**：复用 `driver_connection_error`（已在 `TRANSIENT_NON_PG_REASONS`，`:519`）⇒ 出口仍是既有 `LEDGER_TX_TIMEOUT`(LD025) / 503（`:642-651`）。
- **不得过宽（判负铁律）**：`new TypeError('bug')` / `new Error('boom')` / `{message:'internal invariant broken'}` 等**无传输信号**的裸错误**仍 500**（DL126：500 类只允许由不变式被破坏触发且必须告警）——单测 U3 四项全绿。

### 2.2 鉴权层：`src/index.ts` `/api/auth/verify`（`:401-451`）

- 两段式**语义边界**：
  - ① 凭据面（`consumeWalletAuthChallenge`：格式 / HMAC / nonce 过期 / EIP-191 恢复不符）⇒ **401**（唯一一处 `sendError(res, 401 …)`，现盘 `:419`；**401 只用于真鉴权失败**，本段纯计算无 IO）；
  - ② 落库面（`findOrCreateUserByEvm` / `getUserAsset`）⇒ **既有** §14 分类器 `normalizeLedgerError(unwrapInfraCause(error))`（`:449`），以 `normalized.httpStatus` 写响应（R107 形状），原始信息只进服务端日志（`console.error('[auth.verify] infra failure:'…)`，R108 诊断面 / R107 不外泄）。
- `/api/auth/login`（`:452-455`）经同一 handler ⇒ 同口径；`/api/auth/register`、`/api/auth/challenge` 仍 400（不碰库，未动）。

### 2.3 不变量（逐条自证）

1. 33 码的 `status` **与** `bucket` 逐条等于改前快照 → U0c/U0d `diff=[]`；
2. 400 分支（`23514/23505/23503/55P03/57014/40001/40P01/08P01/P0001/infra 类）逐条对拍不变 → U1 17 项全绿（含 `08P01` **仍 500**、`42P01` **仍 500**）；
3. 注册点 `app.<method>(` 计数 **= 67** → U5；
4. 无 DDL/DML、无迁移、未碰 `frontend/**` / `spec` / `master-plan` / `vercel` / `git`。

---

## 3. 负向臂**实测**（临时实例 `5799` + 不可达数据库）

- 脚本：`scripts/p4z-d1p-02-negative-arm.ts`；产物：`.p4-artifacts/p6d1p-20261002T021223Z/negative-arm.json`（+ 服务端日志同目录）
- 目标库：**子进程 env 里所有 `*DATABASE_URL*` / `*POSTGRES*` 键先被摘除、再统一置为 `127.0.0.1:1`（不可达）**（真值一律不回显、不落盘）；`VERCEL` 键剔除；`PORT=5799`（非面板端口）。
- 收尾：**按精确 PID** `process.kill(77990,'SIGTERM')`（`sigterm_ok=true`，**未用** SIGKILL）⇒ `port_closed=true`；**未使用** `pkill -f` / `killall`；面板托管服务全程未动。

### 3.1 三个必测面（原始状态码 / 响应体逐字）

| # | 请求 | 状态 | 响应体（逐字，截断处标 …） |
|---|---|---|---|
| **R1** 碰库读端点 | `GET /api/user`（有效 token） | **503** | `{"error":{"code":"LEDGER_TX_TIMEOUT","message":"系统繁忙，请稍后重试","i18n_key":"ledger.err.LEDGER_TX_TIMEOUT","details":{"reason":"driver_connection_error","error_code":"ECONNREFUSED"}}}` |
| R2 碰库读端点 | `GET /api/prize-item`（有效 token） | **503** | 同上（`reason=driver_connection_error`、`error_code=ECONNREFUSED`） |
| R3 碰库读端点 | `GET /api/tasklist/pending-verification?limit=1` | **503** | 同上 |
| **A3** 鉴权端点 ★ | `POST /api/auth/verify`（**真签名的 challenge**，库不可达） | **503** | `{"error":{"code":"LEDGER_TX_TIMEOUT","message":"系统繁忙，请稍后重试","i18n_key":"ledger.err.LEDGER_TX_TIMEOUT","details":{"reason":"driver_connection_error","error_code":"ECONNREFUSED"}}}` |
| **H1/H2** 健康探针 | `GET /api/health` / `GET /health` | **503** | `{"ok":false,"db_version":"unknown","schema_version":null,"time":"2026-10-02T02:12:24.413Z"}` |

**A3 = 503 且 `a3_401_violation=false`** —— 即「鉴权端点遇无 SQLSTATE 驱动错不得返 401」**已实测通过**。

### 3.2 对照面（401 面仍在 —— 不得把真鉴权失败也改成 503）

| # | 请求 | 状态 | 响应体 |
|---|---|---|---|
| A0 | `GET /api/user`（**无 token**） | **401** | `{"error":{"code":"AUTH_UNAUTHORIZED","message":"AUTH_UNAUTHORIZED","i18n_key":"auth.err.AUTH_UNAUTHORIZED","details":{}}}` |
| A2 | `POST /api/auth/verify`（**坏签名** + 有效 challenge） | **401** | `{"success":false,"message":"Invalid wallet signature","error":"Invalid wallet signature"}` |
| A1 | `POST /api/auth/challenge` | 200 | 正常签发（不碰库） |

### 3.3 修前 / 修后对照（同一形态、可复核产物）

| 时点 | A3（`/api/auth/verify` + 库不可达） | 产物 |
|---|---|---|
| **修前**（只读取证的现盘行为） | **401** + `{"success":false,"message":"Error connecting to database: fetch failed","error":"Error connecting to database: fetch failed"}`（被吞成鉴权失败） | `.p4-artifacts/p6d1p-20261002T021145Z/negative-arm.json`（凭据面已分流、落库面 catch 未改的**中间态实测**） |
| **修后** | **503** + `LEDGER_TX_TIMEOUT` / `reason=driver_connection_error` / `error_code=ECONNREFUSED` | `.p4-artifacts/p6d1p-20261002T021223Z/negative-arm.json` |

> 诚实边界：R1/R2/R3 三条读面在**修前即已 503**（`Pool`-over-WS 的 `ErrorEvent` 被 P3T 的 `isEventObjectFamily` 覆盖 + P4-SEC 的 `resolveActor` 分流）。
> 本单**新增**的覆盖面 = ①`code == null` 且**无内层码/外层文案**的形态（如 `NeonDbError{code:null,'Error connecting to database: fetch failed'}`、`Server error (HTTP status N)`）在**分类器**里直接归 503（单测 U2 六例）；
> ②`/api/auth/verify` 的落库面不再吞成 401（负向臂 A3：401 → 503，实测）。

### 3.4 范围外诚实登记（负向臂同时测到，**未隐藏**）

| # | 请求 | 实测 | 说明 |
|---|---|---|---|
| X1 | `GET /api/task/all?limit=1` | **500** `{"success":false,"message":"Failed to load tasks"…}` | 该 catch **硬编码 `sendError(500)`、不接分类器** ⇒ 属**本单范围外**（派单只点名分类器 + 鉴权层；批 5 `p6-batch5-missing-tables.md` C-1 亦只列 claim/verify 两处 catch） |
| X2 | `GET /api/user/asset/1` | **200**（`points:0` 空态） | 库不可达时仍 200 ⇒ 该面疑似内部兜底，**其错误是否被吞 = 未测**（见 §5.6） |
| X3 | `GET /api/home?...` | **500** `{"success":false,"message":"Failed to load home payload"…}` | 同 X1（硬编码 500，范围外） |
| X4 | `POST /api/task-progress/claim/1` | **410** `LEDGER_REF_NOT_FOUND` / `reason=CLAIM_RETIRED` | 弃用面、**不碰库** ⇒ 不受影响（批 5 C-1 曾把该 catch 列为 D1' 改动点，但现盘已改为 410 弃用常量响应，无需分流） |
| A4 | `POST /api/auth/login`（复用**已消费**的 nonce） | **401** `"Challenge has been consumed or expired"` | 属**凭据面**真鉴权失败（nonce 已由 A3 消费）⇒ 401 正确 |

---

## 4. AC 读数（全部自跑，退出码取自命令自身、不经管道）

| AC | 命令 / 口径 | 读数 | 判定 |
|---|---|---|---|
| ① `tsc` 0 行 | `npx tsc --noEmit` | `TSC_EXIT=0`，`TSC_LINES=0` | ✅ |
| ② 离线套件不掉 | `ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts` | `total=126 passed=126 failed=0`（基线 126）`p6tr1a-20261002T021222Z` | ✅ |
| ③ 分类器单测（新增） | `ts-node --transpile-only scripts/p4z-d1p-01-classifier-unit.ts` | **41/41 PASS**（`p6d1p-unit-20261002T021222Z`） | ✅ |
| ③-a 400-with-code 逐码映射不变 | U0c/U0d/U0f/U0g + U1（17 例） | 33 码 `status`/`bucket` 与快照 `diff=[]`；`08P01→500`、`42P01→500`、`55P03/57014/40001/40P01→503` | ✅ |
| ③-b `code==null` ⇒ 503 | U2（6 例） | `NeonDbError{fetch failed}` / `Server error (HTTP status 502)` / 裸 `fetch failed` / 有内层 `ECONNRESET` 的包装 / 池超时（既有） / WS `ErrorEvent` 族 ⇒ **全部 503 `LEDGER_TX_TIMEOUT`** | ✅ |
| ③-c 鉴权路径 `code==null` ⇒ 503 而非 401 | U4a/U4b（分类器）+ U4c/U4d/U4e/U4f（静态面：`sendError(res,401)` 计数=1 且位于 DB 调用**之前**）+ 负向臂 A3 | 全绿；A3 实测 **503**、`a3_401_violation=false` | ✅ |
| ④ 负向臂三面真读数 | `p4z-d1p-02-negative-arm.ts` | must503 **6/6**、must401 **2/2**（见 §3） | ✅ |
| ⑤ 注册点不变 | U5（`src/index.ts` 的 `app.<method>(` 计数，同 `p4z-b6audit-01-e2e.ts` 口径） | **67** | ✅ |
| ⑥ 账本零位移（两个数） | `p4z-d1p-03-ledger-count.ts`（只读 `neon()`，两个数 + 余额合计） | **改前**：`ledger_entry=271 account=27`（合计 `2009792`，`p6d1p-20261002T021043Z`）→ **改后**：`ledger_entry=271 account=27`（合计 `2009792`，`p6d1p-20261002T021225Z`） | ✅ 零位移 |
| ⑦ 报告 | 本文件 + `NOT_MEASURED`（§5） | — | ✅ |

---

## 5. `NOT_MEASURED`（**逐项**，禁填 0 / 空）

1. **生产（Vercel）实况**：本单负向臂只在**本地临时实例 5799** 上跑；禁 `vercel`、未部署、未调线上 URL ⇒ 生产 `seafood-opal` 的 503 面 **NOT_MEASURED**（原因：红线禁部署/禁 `vercel`）。
2. **前端错误分支走向**：`401 → 503` 对前端「凭据无效 / 服务不可用」文案分流的影响 **NOT_MEASURED**（原因：红线禁碰 `frontend/**`，需 FE 单测或浏览器实测，不在本单）。
3. **`42P01`（缺表）是否改判 503**：**未做、未改**；现状实测 `500`（U1_42P01_unchanged_500 PASS）。批 5 C-1 曾列「42P01 ⇒ 503」，但本单派单范围只含「无 SQLSTATE（`code == null`）」⇒ 改判与否 **NOT_MEASURED**（原因：超本单红线⑤「不得改 bucket/码表」，且会改变既有 500 告警面）。
4. **硬编码 500 的读面 catch**（`/api/task/all`、`/api/home`、`/api/prize/all`、`/api/prize/:bID`、`/api/user/asset/:uID` 等）：**未接分类器、未改**；负向臂实测 `500`（X1/X3）。这些面在库不可达时的 503 化 **NOT_MEASURED**（原因：超「错误分类 + 鉴权层最小面」授权面，已登记给下一单）。
5. **其余注册面的逐个负向实测**：本单实测 6 个面 + 登记 4 个面；其余 ~57 个注册面 **NOT_MEASURED**（原因：budget/35 calls 与面板端口纪律，未逐面起实例）。
6. **`/api/user/asset/:uID` 的错误吞并**：库不可达时实测 **200**（空态）；该面是否**内部吞错**（`database.ts` 层兜底）**NOT_MEASURED**（原因：未追 `DatabaseService.getUserAsset` 内部 catch，超本单授权面）。
7. **`pool_connection_timeout` 的端到端触发**：本单只做分类器单测（U2 既有分支不变）⇒ 真实并发过载下该 reason 的 HTTP 读数 **NOT_MEASURED**（原因：需并发压测，不在本单）。
8. **`error_code` 细分**：无码形态落到 `driver_connection_error` 时 `details.error_code` 记 `'none'`（顶层无码）或由路由层 `unwrapInfraCause` 下沉后的真实码（负向臂实测 `ECONNREFUSED`）；**上游真因码的完整分布** **NOT_MEASURED**（只测了本机拒连/不可达两形态）。

---

## 6. 范围外 / 未做（显式）

- 未改 `400` 分支、未改码表/bucket、未新增码或 reason、未改 DB 层与迁移、未碰 `frontend/**`、未改 `spec`/`master-plan`、未 `git add/commit/push`、未 `npm install`、未 `vercel`。
- 未改批 5 C-1 点名的 `claim` catch —— 现盘该面为 **410 弃用常量响应（不碰库）**，无需分流（实测 X4）。
- 未新增/删除端点 ⇒ 注册点恒 67。

## 7. 纪律自曝（自报，不掩饰）

- **`terminal` 调用 9 次**（派单软约束「≤3 条命令」）——超约束，原因是 AC 需 5 段实测（probe / tsc / 离线 / 单测 / 负向臂 / 计数）分轮跑；**每次调用的退出码均在管道之前用 `$?` 捕获**。
- 未使用 `pkill -f` / `killall`；临时实例 **只按精确 PID** 关闭（`SIGTERM` 成功，未升 `SIGKILL`），并实测端口已释放。
- 全程未读取/回显任何 `.env*` 值或密钥（只记 `sha256` 前 12 位指纹）；未对真库做任何写操作（`ledger-count` 仅 `SELECT count/sum`）。
- 已发现并修正一处自伤：新增注释里出现 `p6d1p-*/…` 会**提前终止块注释**（`tsc` 报 113 行错误）—— 已改为 `p6d1p-STAMP/…`，复跑 `TSC_LINES=0`。
