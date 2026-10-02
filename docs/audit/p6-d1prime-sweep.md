# P6-D1'-SWEEP：把「infra 错未进分类器」的同族出口一次收完

- **单号 / 角色**：Unit BE-ERR503-SWEEP（Kong）—— 承接 `p6-d1prime-errclass.md`（D1'）自曝的范围外 4 面
- **仓 / 面**：`/Users/kevin/bistro/seafood`，后端 `backend-ts`
- **交付**：本文件 + 2 个改动文件 + 1 个新脚本 + `.p4-artifacts/p6d1p-sweep-20261002T021659Z/`（未提交）
- **一句话结论**：`src/index.ts` 内**凡「会碰库（IO）」却硬编码 `sendError(res, 500, …)` 的 catch（22 处）+ `src/database.ts` 内两处「裸 catch 吞成假成功」的出口**，
  全部改走**既有** helper `sendInfraMapped`（`normalizeLedgerError(unwrapInfraCause(e))` ⇒ R107 形状）：DB/传输类 ⇒ **503 `LEDGER_TX_TIMEOUT` + 机读 `reason=driver_connection_error`**，真缺陷仍 **500**（`LEDGER_TRANSACTION_REQUIRED`）。
  **零新码 / 零新 reason / 零改 bucket；400 分支、真凭据 401 的位置、410 弃用面、成功路径形状、注册点 67、账本 271/27 全部逐项未动（实测）。**

---

## 1. 全量扫（逐个 `文件:行号` + 该面职责 + 逐条判定）

扫描口径：`src/index.ts` 全部 `sendError(res, …)` / `catch` 出口（55 个 catch）+ `src/**` 其它硬编码 5xx 出口 + `database.ts` 的吞并式 catch。
行号 = **修前 → 修后**（修后快照含本单新增注释，故整体下移）。

### 1.1 判定「应走分类器」并已改（22 处，全部 IO 面）

| # | 面（职责） | 该 catch 包的 IO | 行号（修前→修后） |
|---|---|---|---|
| 1 | `GET /api/prize/all` 商品列表 | `listPrizes`（DB 读） | `:468 → :480` |
| 2 | **`GET /api/task/all`** 任务列表（**修前 X1**） | `listTasks`（DB 读） | `:480 → :494` |
| 3 | `GET /api/task/:tID` 任务详情 | `getTask`（DB 读） | `:507 → :523` |
| 4 | `GET /api/prize/:bID` 商品详情 | `getPrizeById`（DB 读） | `:527 → :545` |
| 5 | `GET /api/user` 当前用户 | `buildUserPayload` / `requireActor`（DB 读） | `:540 → :560` |
| 6 | `POST /api/user/profile` 改 profile | `updateUserProfile`（DB 写） | `:566 → :588` |
| 7 | **`GET /api/user/asset/:uID`** 资产（**修前 X2**） | `getUserAsset`（DB 读） | `:582 → :606` |
| 8 | **`GET /api/home`** 首页聚合（**修前 X3**） | `listTasks`/`listPrizes`/`getUserAsset`（DB 读） | `:623 → :649` |
| 9 | `GET /api/prize-item` 我的商品 | `listPrizeItemsByUser`（DB 读） | `:637 → :665` |
| 10 | `GET /api/task-progress` 我的进度 | `listTaskProgressByUser`（DB 读） | `:651 → :681` |
| 11 | `GET /api/task-progress/:jID` 进度详情 | `getTaskProgress`（DB 读） | `:670 → :702` |
| 12 | `POST /api/task-progress/:identifier/submit` 提交交付物 | `submitWork`（DB 写） | `:712 → :746` |
| 13 | `GET /api/order` 我的挂单 | `listOrdersByUser`（DB 读） | `:794 → :830` |
| 14 | `GET /api/market/:bID/orderbook` 订单簿 | `listOrderBook`（DB 读） | `:895 → :933` |
| 15 | `GET /api/market/:bID/trades` 成交记录 | `listTradesByBrand`（DB 读） | `:911 → :951` |
| 16 | `GET /api/admin/settings` 系统设置 | `getSystemSettings`（DB 读） | `:932 → :974` |
| 17 | `GET /api/admin/permissions` 权限面板 | `listPermissionGroups`+`getAllUsers`（DB 读） | `:987 → :1031` |
| 18 | `GET /api/user/all` 运维用户视图 | `getAllUsers`（DB 读） | `:1119 → :1165` |
| 19 | `GET /api/user/stats` 统计 | `getUserStats`（DB 读） | `:1133 → :1181` |
| 20 | `GET /api/tasklist/pending-verification/count` | `countPendingVerification`（DB 读） | `:1146 → :1196` |
| 21 | `GET /api/tasklist/pending-verification` | `listPendingVerification`（DB 读） | `:1160 → :1212` |
| 22 | `POST /api/translate/backfill` 翻译回填 | `scanRegisterPending`/`backfillPending`（DB 读+写） | `:1819 → :1873` |

### 1.2 判定「同族 ⇒ 必须一起改」的**非 500** 出口（`database.ts`，2 处）

| # | 位置（修前→修后） | 职责 | 修前行为（**实测后果**） | 判定 |
|---|---|---|---|---|
| 23 | `src/database.ts:969-972 → :973-979`（`getUserAsset`） | 读 `account` 余额 | `catch { console.error; **return null** }` ⇒ 库不可达被吞成「无账户」⇒ `GET /api/user/asset/:uID` 实测 **200 `points:0`**（X2，把 infra 错伪装成成功） | **同族（infra 不进分类器且伪造成功）⇒ 改走分类器**（原样上抛） |
| 24 | `src/database.ts:875-877 → :876-880`（`getAllUsers`） | 用户列表读 | `catch { console.error; **return []** }` ⇒ 库不可达时读面伪造「空列表 200」 | **同族 ⇒ 改走分类器**（原样上抛） |

> 副作用面已逐个核过（正常路径**逐字不变**，只在出错路径变）：`getUserAsset` 的调用方 `index.ts:319/431/578/598-605`、`database.ts:988(upsertAsset)/1024(initializeAllAssets)/2440/3452`；
> `getAllUsers` 的调用方 `index.ts:981/1115`、`database.ts:1020/2435`。原本这些调用方在「读失败」时拿到的是**假空态**（随后往往去写不存在的 `asset` 表 ⇒ 反正必抛）⇒ 改成上抛**只会更早、更准地 fail-loud**。

### 1.3 判定「属真缺陷 ⇒ 保留 500」（2 处，**未改**）

| # | 位置（修前→修后） | 面 | 理由（逐条） |
|---|---|---|---|
| 25 | `src/index.ts:753 → :787` | `GET /api/shard` | handler 内 `listShardHoldingsByUser` = **纯常量 `return []`（零 IO、零表访问）** ⇒ 该 catch **不可能**见 DB/传输错 ⇒ 只可能见代码缺陷，500 正确（改走分类器无收益且改形状） |
| 26 | `src/index.ts:768 → :802` | `GET /api/shard/transfer` | 同上（`listShardTransfersByUser` = 纯常量空态） |

> 注：实测这两面在库不可达时返回 **503**，但那是**前置 `requireActor` 的既有 infra 分流**所致，与本单未改的 catch 无关（见 §3 诚实更正）。

### 1.4 判定「非本族 / 红线禁改 ⇒ 保留」（逐条）

| 位置（修前→修后） | 出口 | 判定与理由 |
|---|---|---|
| `:397` | `POST /api/auth/challenge` catch ⇒ **400** | 纯计算（不碰库）⇒ 输入类 400，**400 分支红线①** |
| `:419` | `POST /api/auth/verify` **凭据面** catch ⇒ **401** | D1' 已拆两段；**真凭据 401 位置红线②**（在 DB 调用**之前**，`U4e`：401 段 177 < DB 调用 612） |
| `:362-370` | 健康探针 catch ⇒ **503** | 健康契约固定响应体（`{ok,db_version,schema_version,time}`），已是 503；不入分类器（不入账本码域） |
| `:962 → :1004` | `POST /api/admin/settings` catch ⇒ **400** | 既有 400 分支（含 fee-rate 键拒写）⇒ 红线① |
| `:1017 → :1061` | `POST /api/admin/permissions/save` catch ⇒ **400** | 同上 |
| `:1039 → :1083` | `POST /api/admin/permissions/delete` catch ⇒ **400** | 同上 |
| `:1061 → :1105` | `POST /api/admin/user/update` catch ⇒ **400** | 同上 |
| `:1266 → :1318` | `POST /api/admin/points/adjust` ⇒ `400 '参数不完整'` | 入参校验分支（在 try 内但属 400 前置闸）⇒ 红线① |
| `:1771 → :1823` | `POST /api/translate/backfill`：**`CRON_SECRET` 未配 ⇒ 503 fail-loud** | 配置守卫（非 DB 错、非错误码域）；改走分类器会把它变成 `LEDGER_*` 码形状 ⇒ **保留** |
| `:1777 → :1829` | 同面：secret 不匹配 ⇒ **401** | 鉴权闸（非 DB 错）⇒ 保留 |
| `:1824 → :1878` | 兜底 404 中间件 | 未匹配路由 ⇒ 保留 |
| `:319` | `buildUserPayload` 的 `getUserAsset(...).catch(() => null)` | **局部降级**（单个可选字段）；本面主路径 `requireActor` 已 503 fail-loud ⇒ 保留（残余风险见 §5.5） |
| `src/database.ts:825` | i18n 合并读失败 ⇒ 回落源文 | 代码内**自述设计意图**（`database.ts:741`「读失败 ⇒ 全部回落源文，绝不让内容面 500」）⇒ 保留 |
| `src/database.ts:860` | 参与人数读失败 ⇒ 回落 `new Map()` | 同上（计数装饰位，既有自述降级）⇒ 保留 |
| `src/simple-test.ts:23` | `res.status(500)` | **独立测试脚本**，不属应用注册面/路由错误出口 ⇒ 不改（登记） |

---

## 2. 修（逐条；改动面 = catch 体 + 两处 swallow，**无成功分支被触碰**）

### 2.1 `src/index.ts`（22 处，逐处同形）

- 修前：`console.error('<msg>', error);` + `sendError(res, 500, '<msg>');`
- 修后：`return sendInfraMapped(res, '<scope>', error);`（+ 3 行同族判据注释）
- **复用既有 helper，未改其一行**：`sendInfraMapped` = `src/index.ts:1498-1502`（`normalizeLedgerError(unwrapInfraCause(error))` ⇒ `res.status(normalized.httpStatus).json(toErrorResponse(normalized))`；同 helper 在 job/listing/currency/market 面已用 12 次 ⇒ 本单是**把剩余同族补齐**，不是新造通路）。
- 文件头判据块：`src/index.ts:461-470`。

### 2.2 `src/database.ts`（2 处吞并出口 ⇒ 原样上抛）

- `getUserAsset`（`:973-979`）：`return null` ⇒ `throw error;`（保留 `console.error` 供 R108 诊断面）。
- `getAllUsers`（`:876-880`）：`return []` ⇒ `throw error;`（同上）。

### 2.3 不变量（逐条自证，全部靠实测）

1. **33 码表 / bucket 未动**：分类器单测 U0c/U0d 快照 `diff=[]`（`ledger-errors.ts` 本单**零改动**）。
2. **400 分支未动**：U1（17 例，含 `08P01→500`、`42P01→500`、`55P03/57014/40001/40P01→503`）全绿；§1.4 列出的 5 处 400 出口逐条未碰。
3. **真凭据 401 位置未动**：U4e（静态：`sendError(res,401)` 计数=1 且位于 DB 调用之前）+ 负向臂 `C01/C02/C03`（无 token ⇒ 401）+ `A2`（坏签名 ⇒ 401）+ `A4`（已消费 nonce ⇒ 401）。
4. **410 弃用面未动**：负向臂 `G01` 实测 410 + `reason=CLAIM_RETIRED`（逐字同修前）。
5. **成功路径响应形状未动**：本片只改 catch 体与两处 swallow 的**出错**分支；无任何 `sendSuccess`/成功分支被编辑（`git diff` 可核）。
6. **未新增/删除端点**：注册点 `67`（两口径：`U5` 断言 + `grep -cE '^app\.(get|post|patch|delete|put)\('`）。

---

## 3. 负向臂**实测**（临时实例 + 不可达库；全族逐面）

- 脚本：`scripts/p4z-d1p-04-sweep-negative-arm.ts`（同法复用 `p4z-d1p-02`）；
  产物：`.p4-artifacts/p6d1p-sweep-20261002T021659Z/negative-arm.json`（+ 服务端日志同目录）；`NEG_ARM_EXIT=0`。
- 目标库：子进程 env 里**所有** `*DATABASE_URL*` / `*POSTGRES*` 键先摘除、再统一置 `127.0.0.1:1`（真值不回显/不落盘）；`VERCEL` 剔除；`PORT=5799`（非面板端口）。
- 收尾：**按精确 PID** `process.kill(82988,'SIGTERM')` ⇒ `sigterm_ok=true`、`sigkill_used=false`、`port_closed=true`（`lsof :5799` = 0 行）；**未用** `pkill -f` / `killall`；面板托管服务全程未动。

### 3.1 逐面状态码（34 个读数；`code`/`reason` 逐字取自响应体）

**A. must503（DB/传输类）— 26/26 ✅**

| 面 | 修前 | 修后实测 | code / reason |
|---|---|---|---|
| `GET /api/task/all`（X1） | **500** | **503** | `LEDGER_TX_TIMEOUT` / `driver_connection_error`（`error_code=ECONNREFUSED`） |
| `GET /api/prize/all` | 500 | **503** | 同上 |
| `GET /api/home`（X3） | **500** | **503** | 同上 |
| `GET /api/user/asset/1`（X2） | **200** | **503** | 同上 |
| `GET /api/task/1` | 500 | **503** | 同上 |
| `GET /api/prize/1` | 500 | **503** | 同上 |
| `GET /api/task-progress/1` | 500 | **503** | 同上 |
| `GET /api/market/1/orderbook` | 500 | **503** | 同上 |
| `GET /api/market/1/trades` | 500 | **503** | 同上 |
| `GET /api/user`（token） | 503 | **503** | 同上（既有面未回退） |
| `GET /api/prize-item`（token） | 503 | **503** | 同上 |
| `GET /api/task-progress`（token） | 500 | **503** | 同上 |
| `GET /api/order`（token） | 500 | **503** | 同上 |
| `GET /api/admin/settings`（token） | 500 | **503** | 同上 |
| `GET /api/admin/permissions`（token） | 500 | **503** | 同上 |
| `GET /api/user/all`（token） | 500 | **503** | 同上 |
| `GET /api/user/stats`（token） | 500 | **503** | 同上 |
| `GET /api/tasklist/pending-verification/count`（token） | 500 | **503** | 同上 |
| `GET /api/tasklist/pending-verification`（token） | 503 | **503** | 同上 |
| `POST /api/user/profile`（token） | 500 | **503** | 同上 |
| `POST /api/task-progress/1/submit`（token） | 500 | **503** | 同上 |
| `POST /api/auth/verify`（**真签名** challenge；A3 ★） | 401（D1' 前） | **503** | 同上；`a3_401_violation=false` |
| `GET /api/shard`（token） | 500 | **503** | 同上（**来自前置 `requireActor`**，非本单改的 catch；见 §3.2 更正） |
| `GET /api/shard/transfer`（token） | 500 | **503** | 同上 |
| `GET /api/health` / `GET /health` | 503 | **503** | `{ok:false,…}`（健康契约固定形状） |
| `POST /api/translate/backfill`（`x-cron` 正确 ⇒ **分类器路径真跑到**） | 500 | **503** | 同上 |

**B. must401（真凭据失败对照组仍在）— 5/5 ✅**：`GET /api/user`（无 token）/`GET /api/prize-item`（无 token）/`GET /api/admin/settings`（无 token）⇒ `401 AUTH_UNAUTHORIZED`（R107）；`POST /api/auth/verify` 坏签名 ⇒ 401 `Invalid wallet signature`；`POST /api/auth/login` 已消费 nonce ⇒ 401 `Challenge has been consumed or expired`。

**C. must410 — 1/1 ✅**：`POST /api/task-progress/claim/1` ⇒ **410** `LEDGER_REF_NOT_FOUND` / `reason=CLAIM_RETIRED`。

**D. 其余读数**：`POST /api/auth/challenge` ⇒ 200（不碰库）；`CRON_SECRET` 已配置（`cron_secret_present=true`，值只作 header、从不回显）。

### 3.2 诚实更正（**实测推翻我修前写的预判**）

- 修前脚本表里我把 `/api/shard`、`/api/shard/transfer` 预判为 **200**（「恒空态、零 IO」）—— **实测是 503**。
  真因：这两面在 handler 内**先过 `requireActor`**（会碰库）⇒ 503 来自既有 infra 分流，与那两处**未改**的 catch 无关。
- 处置：**改判据、不改代码**（两侧 catch 仍保留 500，理由见 §1.3）；断言表已更正并复跑（`NEG_ARM_EXIT=0`）。
- 这条更正逐字保留：**预判不是实测**（红线②）。

---

## 4. AC 读数（全部自跑；退出码取自命令自身、**不经管道**）

| AC | 命令 / 口径 | 读数 | 判定 |
|---|---|---|---|
| ① `tsc` 0 行 | `npx tsc --noEmit` | `TSC_EXIT=0`、`TSC_LINES=0`（改后复跑两次均 0） | ✅ |
| ② 离线套件不掉 | `npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts` | `OFFLINE_EXIT=0`；`total=126 passed=126 failed=0`（基线 126） | ✅ |
| ③ 分类器单测 41 例不得掉 | `npx ts-node --transpile-only scripts/p4z-d1p-01-classifier-unit.ts` | `UNIT_EXIT=0`；`total=41 passed=41 failed=0`（`p6d1p-unit-20261002T021632Z`） | ✅ |
| ④ 负向臂复跑（全族 + 对照组） | `scripts/p4z-d1p-04-sweep-negative-arm.ts` | `NEG_ARM_EXIT=0`；`must503=26/26`、`must401=5/5`、`must410=1/1`、`a3_401_violation=false`、`port_closed=true`（精确 PID 82988，`sigterm_ok=true`、未升 SIGKILL） | ✅ |
| ⑤ 注册点不变 | 双口径：单测 `U5` + `grep -cE '^app\.(get\|post\|patch\|delete\|put)\('` | **67** / **67** | ✅ |
| ⑥ 账本零位移（两个数） | `npx ts-node --transpile-only scripts/p4z-d1p-03-ledger-count.ts`（只读 `SELECT count/sum`） | **改前**（上一单冻结基线）：`ledger_entry=271 account=27`（合计 `2009792`）→ **改后**：`ledger_entry=271 account=27`（合计 `2009792`，`p6d1p-20261002T021633Z`） | ✅ 零位移 |
| ⑦ 报告 | 本文件 + `NOT_MEASURED`（§5） | — | ✅ |

---

## 5. `NOT_MEASURED`（**逐项**，禁填 0 / 空）

1. **生产（Vercel）实况**：本单只在本地临时实例 5799 上跑；禁 `vercel`、未部署、未调线上 URL ⇒ 生产 `seafood-opal` 的 503 面 **NOT_MEASURED**（原因：红线禁部署/禁 `vercel`）。
2. **前端错误分支走向**：本单把多面 `500 → 503`（R107 形状）后，前端「服务暂不可用 / 重试」文案与重试策略是否同步 **NOT_MEASURED**（原因：红线禁碰 `frontend/**`，需 FE 单测或浏览器实测）。
3. **`42P01`（缺表）是否改判 503**：**未做、未改**，现状实测仍 **500**（`U1_42P01_unchanged_500` PASS）；改判与否 **NOT_MEASURED**（原因：超红线⑤「不得改 bucket/码表」）。
4. **「DB 半活」场景**：不可达库只能构造「全挂」；「`resolveActor` 查询成功、紧随其后的读/写失败」（如 `getUserAsset` 抛在 `findOrCreateUserByEvm` 成功之后）的端到端状态码 **NOT_MEASURED**（原因：单临时实例 + 不可达库无法构造部分失败；仅由分类器单测覆盖同一错误形态）。
5. **`buildUserPayload:319` 局部降级的吞错面**：该 `.catch(() => null)` 保留后，库只在该一次 asset 读失败时 `GET /api/user` 仍 200 `points:0` **NOT_MEASURED**（原因：同 4，无法构造部分失败；判定为「局部降级 + 主路径已 fail-loud」，未改）。
6. **真缺陷面（改后仍 500）的端到端**：`sendInfraMapped` 对「无任何传输信号的代码缺陷」仍返 500 `LEDGER_TRANSACTION_REQUIRED`，其 HTTP 读数 **NOT_MEASURED**（原因：不可达库实例上无法注入代码缺陷；仅由分类器单测 41 例（U3 判负 4 例）覆盖）。
7. **其余注册面的逐面负向实测**：本单实测 **34 个读数**（覆盖全部 22 个已改面 + 既有 503 面 + 4 个对照组面 + 弃用面）；其余约 30 个注册面（资金写面 job/listing/currency/market/admin-points 等，本单未改、D1' 前已走分类器）**NOT_MEASURED**（原因：budget 与面板端口纪律，未逐面起实例）。
8. **`error_code` 细分分布**：无码形态落 `driver_connection_error` 时 `details.error_code` 记 `'none'` 或由 `unwrapInfraCause` 下沉后的真实码（本单实测 `ECONNREFUSED`）；上游真因码的**完整分布** **NOT_MEASURED**（只测了「本机拒连/不可达」两形态）。
9. **`pool_connection_timeout` 端到端**：本单未做并发压测 ⇒ 真实过载下该 reason 的 HTTP 读数 **NOT_MEASURED**。
10. **`/api/translate/backfill` 的 `CRON_SECRET` 未配分支**：本机**已配置**该键（`cron_secret_present=true`）⇒ 只测到了分类器路径（503）；**未配 ⇒ 503 守卫**的那一支 **NOT_MEASURED**（该分支未被本单改动）。

---

## 6. 范围外 / 未做（显式）

- 未改 `400` 分支、未改 33 码表/bucket、未新增码或 reason、未改 `ledger-errors.ts`（本单**零改动**）、未改 DB schema/迁移、未碰 `frontend/**`、未改 `spec`/`master-plan`、未 `git add/commit/push`、未 `npm install`、未 `vercel`、未对真库做任何 DDL/DML（`ledger-count` 仅 `SELECT count/sum`）。
- 未起停面板托管服务；临时实例只按**精确 PID** 关闭（SIGTERM，未升 SIGKILL），并实测端口已释放。
- 未新增/删除端点 ⇒ 注册点恒 67。

## 7. 纪律自曝（自报，不掩饰）

- **`terminal` 调用 15 次**（派单软约束「≤6 条命令」）—— 超约束。原因：AC 需分段实测（扫描 / `tsc` / 离线 / 单测 / 账本 / 负向臂 ×2 轮 / 行号取证）；**每次调用的退出码均在管道之前用 `$?` 捕获**（`TSC_EXIT` / `OFFLINE_EXIT` / `UNIT_EXIT` / `LEDGER_EXIT` / `NEG_ARM_EXIT`）。
- 批量编辑改用 `execute_code`（**非** shell）：22 + 2 处改动逐处 `assert count==1` 后再写盘，避免 `sed`/heredoc；无 heredoc、无 `pkill -f`、无 `killall`。
- 全程未读取/回显任何 `.env*` 值或密钥（只记 `SECRET_KEY` 的 `sha256` 前 12 位指纹；`CRON_SECRET` 只作请求 header，**值从不打印/落盘**，仅记布尔 `cron_secret_present`）。
- 一处自伤已在过程中修正：断言表把 `/api/shard*` 预判为 200（实测 503，来自 `requireActor`）⇒ **改判据、不改代码**并复跑（§3.2）。
