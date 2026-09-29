# P4-B3c · 招工资金编排（`job_escrow` 托管 → 发放 → 退回）报告

> **口径**：唯一权威 = `docs/route-layer.spec.md` **v0.3**（716 行）。本报告**先落盘骨架**（§1 = 必做①「先写进报告再动代码」），随后逐段回写读数（§2–§8 为实测回填）。
> **run tag**：`b3c-20260930T021741`（产物 = `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b3c-20260930T021741/**`，绝对路径见 §8）。
> **服务**：`seafood-api` @ `http://127.0.0.1:5788`（面板 sid `seafood-api`；重启只走 `POST :5555/api/restart`，重启后等 `/health` 200 —— 实测 `waited_ms=2646`）。

---

## §0 本片范围

| 项 | 值 | 依据 |
|---|---|---|
| 事件 | **J1**（发布+托管）· **J5**（审核通过→发放+手续费+返佣）· **J6**（拒绝/取消→退托管） | `route-layer.spec` §4.2 `:413,417,418` |
| kind（本片实测用到 5 个） | `job_escrow` · `job_payout` · `job_fee` · `commission` · `job_escrow_refund` | 同上（§4.1 关闭集 20 的子集） |
| 编排函数 | `public.job_post_event(payload jsonb)`（迁移既有，**本片未改它**）；op ∈ `publish`/`settle`/`refund` | `migrations/0013_job.sql:431-708` |
| 资金写路径 | **唯一** = `SELECT ledger_post_event($1::jsonb)`（由 `job_post_event` 内部调用）⇒ 业务行状态 + 分录**同一条语句** | §4.0 R1/R2/R4；`0013:650-687` |
| 本片**未改** | `migrations/**`（**无需新迁移**）· `src/ledger.ts` · `src/ledger-errors.ts` · `src/commission.ts` · `frontend/**` · `.env.local` · 任何 spec | 派单硬边界；结构证明见 §6 |

---

## §1 本片事件与端点清单（必做① · 从 spec §4.2 抽取，**动代码前落盘**）

### 1.1 前端实际消费路径（**现取口径** · 只读 `frontend/src` + `frontend/admin.html`）

命令与产物：`grep -rho "/api/[a-zA-Z0-9/_:.\${}-]*" frontend/src frontend/admin.html | sed 's/\${[^}]*}/:id/g' | sort -u` ⇒ **70 行**去重清单 = `.p4-artifacts/b3c-20260930T021741/frontend-api-paths.txt`。

**本片（招工资金）相关命中 = 3 条**（其余 67 条与招工资金无关）：

| 前端路径 | 消费点（现取） | 处置 |
|---|---|---|
| `POST /api/tasklist/:jID/verify` | `frontend/src/pages/DashboardPage.jsx:223`（`fetchApiJson(\`/api/tasklist/${jID}/verify\`, {method:'POST', body: JSON.stringify({approved})})`）；单测 `frontend/src/test/unit/dashboard-page.test.jsx:115,140` | **唯一**被前端真实调用的本片写口 ⇒ **保留并改接**（既有路径，§1 #49「保留·改接」） |
| `GET /api/tasklist/pending-verification` | `DashboardPage.jsx:125` | 读口，本片**未动** |
| `GET /api/tasklist/pending-verification/count` | `DashboardPage.jsx:124` | 读口，本片**未动** |

**反证读数**：`/api/job`、`/api/job/:jobId/cancel`、`/api/job/:jobId/review`、`/api/job/:jobId/{apply,accept,submit}` 在 `frontend/src` 中 **命中 = 0**（同 `route-layer.spec` §1.2:165 「前端零调用」口径）。

### 1.2 §4.2 抽取表（事件 → 端点 → 编排 → kind → 必需字段 → 幂等键 → 资金四栏 → 期望码）

| # | 事件 | 触发端点（spec） | 编排函数 | kind（**必须在关闭集内**） | 必需字段 | 幂等键（**函数派生**） | 资金四栏（谁出/谁收/平台费来源/佣金来源与分配） | 失败/回滚 | 期望码 | 本片处置 |
|---|---|---|---|---|---|---|---|---|---|---|
| **J1** | 招工发布 + 托管 | `POST /api/job` | `job_post_event(op='publish')` | `job_escrow` **×2** | `create_key`(`cli:`) · `employer_uid` · `cid` · `reward` · `title?` · `description?` · `request_fingerprint` | 创建键 = `job.create_key`(UNIQUE)；事件根键 = `biz:job:escrow:<job_id>`（`0013:555`） | 雇主**可用余额** `−reward` → 雇主自己 **冻结** `+reward`（**无人收钱**） | 单语句隐式事务：业务行 + 2 分录同生同灭；任一闸失败 ⇒ 整事件回滚（**不留孤儿 job 行**） | `400` LD005/LD016/LD017/LD022；`404` LD007/LD023；`409` LD001/LD008/LD011/LD003 | **服务层交付**（前端零调用 ⇒ 路由随批 4） |
| **J5** | 审核通过 → 发放 + 手续费 + 10 级返佣 | `POST /api/tasklist/:jID/verify`（**既有路径，前端真实消费**）· `POST /api/job/:jobId/review`（新路径） | `job_post_event(op='settle')` | `job_payout` **×2** + `job_fee` **×2**（`fee>0`）+ `commission` **×2N**（`x_L=0` 的层**不建分录**） | `job_id` · `request_fingerprint`（`gross` = `job.reward`；`worker_uid` **必须已选定**） | `biz:job:settle:<job_id>`（`0013:592`=`commission.ts:119`） | 雇主（**从冻结额出**）`−net`（`job_payout`）+ `−fee`（`job_fee`） → 打工人 `+net`；平台费 `fee=(gross×fee_rate_bp+5000)/10000`，**有邀请人 ⇒ 全额入 `-2`**（DL86，`chain_depth ≥ 1`）；**无邀请人 ⇒ 全额入 `-1`**；佣金来源 = 佣金池 `-2` 的全额 `fee`，沿 `referral` 上溯 `M=min(levels,chain_depth)` 层按 `weights_bp[1..M]` **重归一化**最大余数法分配，`Σx_L == fee` | 单语句：`job_payout`→`job_fee`→`commission` 同一事件；任一失败 ⇒ 全部回滚（**不存在「状态 settled 但没发放」**）；重放不重写业务行 | `409` LD002（在冻不足）/LD011 + `JOB_STATE_INVALID`；`500` LD032/LD030 | **既有路径 = 本片改接（不增注册点）**；`/api/job/:jobId/review` = 新路径 ⇒ **服务层、路由随批 4** |
| **J6** | 拒绝 / 取消 → 退托管 | `POST /api/job/:jobId/cancel` · `review(reject)`；**既有路径的 reject 分支 = `/api/tasklist/:jID/verify` + `{approved:false}`** | `job_post_event(op='refund')` | `job_escrow_refund` **×2** | `job_id` · `to_status ∈ {cancelled, rejected}` | `biz:job:refund:<job_id>`（`0013:589`） | 雇主（**从冻结额出** `−reward`）→ 雇主自己（可用余额 `+reward`） | 单语句回滚；`escrow_txid IS NULL` ⇒ **拒**（防凭空退款，`0013:618-623`） | `400` LD016 + `not_a_refund_target`；`409` LD011 + `JOB_STATE_INVALID`/`job_escrow_missing` | `POST /api/job/:jobId/cancel` 前端零调用 ⇒ **服务层、路由随批 4**；**拒绝分支走既有 verify 路径（本片改接）** |

### 1.3 端点注册处置（**基线 = 53，现取复算 = 53（不变）**）

| 动作 | 路径 | 前端调用 | 处置 | 依据 |
|---|---|---|---|---|
| **改接**（已存在，`src/index.ts:1059` → 改后 `:1061` 起） | `POST /api/tasklist/:jID/verify` | **有**（`DashboardPage.jsx:223`） | 改为 `job_post_event(op='settle'\|'refund')`（`approved !== false` ⇒ settle；`approved === false` ⇒ refund `to_status='rejected'`） | §1 #49「保留·改接」+ §4.2 J5/J6 + §4.6 批 3 |
| **不注册**（新增路径） | `POST /api/job`（J1） | **0** | 服务层交付 `publishJob`，路由随批 4 | §1.1:136 + §1.2:165/168 + Zang §5.74/§5.76 |
| **不注册**（新增路径） | `POST /api/job/:jobId/cancel`（J6） | **0** | 服务层交付 `refundJob`，路由随批 4 | §1.1:141 |
| **不注册**（新增路径） | `POST /api/job/:jobId/review`（J5/J6） | **0** | 服务层交付 `settleJob`/`refundJob`，路由随批 4 | §1.1:140 |

> **注册点实测**：`grep -cE '^app\.(get|post|put|delete|patch)\(' src/index.ts` = **53**（改前 = 53，改后 = 53）⇒ **有变化 = 0**。
> **登记（待 v0.4 改标）**：`route-layer.spec` §1.1 把 `POST /api/job`（`:136`）、`/api/job/:jobId/review`（`:140`）、`/api/job/:jobId/cancel`（`:141`）标「批 3」；按本片**现取**的前端消费面，这三条**前端零调用** ⇒ 实际交付形态 = **服务层已实现、路由层随批 4**（与 `:137/:138/:139/:142` 已改标的同族口径一致）。

---

## §2 实现（实测）

### 2.1 改动面（最小 diff · 3 文件 + 3 探针）

| 文件 | 性质 | 内容 |
|---|---|---|
| `backend-ts/src/job-funds-service.ts` | **新建**（`wc -l` = **330**） | `publishJob`（J1）· `settleJob`（J5）· `refundJob`（J6）· `verifyJobSubmission`（`/api/tasklist/:jID/verify` 的路由入口）· `resolveJobCreateKeyRequired`（§4.5 四步校验序） |
| `backend-ts/src/database.ts` | 改（**只加 3 个 method**） | `jobPostEvent(payload)`（**唯一资金写路径**：`SELECT public.job_post_event($1::jsonb)`）· `resolveReviewTarget(identifier)`（**只读**前置解析）· `reviewJobSubmission({...})`（**结论位 + 资金同一条语句**） |
| `backend-ts/src/index.ts` | 改（**改接 1 条既有路由**，注册点不变） | `POST /api/tasklist/:jID/verify` → `verifyJobSubmission`；错误面统一 `sendVerbError`（R107），**成功面键集不变**（见 §4.4） |
| `backend-ts/scripts/p4z-b3c-{01-snapshot,02-e2e,03-chain}.ts` | 新建（产物脚本） | 台账快照 / 端到端 / DL86 有链形态补测；**未改 `p4z-01-probe.ts`** |

**编译门**：`node_modules/.bin/tsc --noEmit` ⇒ **exit 0**（实测）。

### 2.2 口径决定（登记 · 实现方不自选的部分已逐条给出依据）

| # | 决定 | 依据 / 理由 |
|---|---|---|
| D1 | **金额零客户端输入** | J5/J6 的 payload **不含任何金额**：`gross = job.reward`（`0013:632`）、`fee = f(reward, commission_policy.fee_rate_bp)` 由 DB `job_settle_plan` 派生 ⇒ §4.4-11 / Zang §5.82 7-23 的洞（「传 `fee=1` 绕过」）在招工面**结构上不存在**。J1 的 `reward` 是**雇主自定的业务约定额**（`DL50`：`job.reward` 是业务约定额、不是余额），**不是**费率/平台费 ⇒ 不适用于「金额服务端取数」。**本片未引入任何下限常量、未发明任何数值**。 |
| D2 | **J1 的 `create_key` 缺失 ⇒ fail-loud（不派生）** | 与批 2a `resolveJobCreateKey` 的**内容派生兜底不同**（理由登记）：该键是创建面**唯一权力**，内容派生会让「同内容的两条不同招工」相互碰撞成 `200` 重放（静默丢单）。故取 §4.5 + DB 侧 `0013:480-483` 的同码 `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`。实测：`J1_neg_no_key` ⇒ 400 + `LEDGER_IDEMPOTENCY_KEY_REQUIRED`；`J1_neg_bad_prefix` ⇒ 400 + `LEDGER_IDEMPOTENCY_KEY_INVALID`。 |
| D3 | **前置闸最小化**：只做 4 道应用层闸（① token 侧身份 ② 代他人出资 ③ `create_key` 形状 ④ refund 的 `to_status` 白名单），其余入参/状态/币种/余额闸**一律交 DB 编排函数** | §4.2 的「期望码」真源 = `job_post_event` 的 `ledger_raise`（码 + `details.reason` 逐字一致）⇒ 应用层复刻会**制造第二真源**。异常统一经 `ledgerErrorFromDbError` → `normalizeLedgerError` 原码/原 status 映射（§3.3-4）。 |
| D4 | **「审核通过 → 发放」原子 = 一条 SQL 语句**（`reviewJobSubmission` 的 `WITH ev AS (SELECT job_post_event(...)), sub AS (UPDATE job_submission ...)`） | §4.0 R4 + 派单硬口径 #3「业务行状态变更 + 分录必须同一事务/同一语句」。**收益**：`job_submission.review_status` 的结论位与发放**同生同灭** ⇒ 连「已审核但没发放」也不可能（`0014:209-248` 的不可变守卫把结论位做成一次性写定，本片在同一 UPDATE 内一次写全 `review_status/reviewed_by/reviewed_at/review_memo`）。 |
| D5 | **路由入口的 `:jID` 语义 = `job_application.application_id`（容错兼收 `job_id`）** | 现取口径：前端读口 `getTaskProgress`（`database.ts:1144`）与 `listPendingVerification`（`:1851`）都返回 `a.application_id AS "jID"` ⇒ 前端 `DashboardPage.jsx:223` 传的是 `application_id`。故路由须先解析到 `job_id` 再调编排函数（§4.2 J5 的「必需字段 = `job_id`」是**编排入参**，不是 URL 参数）。实现 = `resolveReviewTarget`（**只读**）。 |
| D6 | **成功面键集冻结** | §2 母约束 F1 / §3.3-8。approve 分支实测 **11 键**（`jID,tID,uID,info_input,time_created,time_submitted,time_checked,time_claimed,points_claimed,task,user`）、reject 分支 **9 键**（同前 9）—— **与改接前逐键一致**（改接前 = `...TaskProgressRecord(9 键)` + `task` + `user`）。唯一新增 = **重放时顶层** `idempotent_replay:true`（§3.2「200（良性）」/ R106 的既有标记手法，非 `data` 键）。 |

### 2.3 ★ 既有路径的**行为 delta**（两条，登记待 Zang 复核）

| # | 改前 | 改后 | 依据 / 理由 |
|---|---|---|---|
| Δ1 | 非数字 `:jID` ⇒ `400 Invalid jID`（`sendError` 裸文案） | `404 LEDGER_REF_NOT_FOUND` + `reason=jID_not_found`（R107） | 与 `cid` 形状闸同族口径（`currency-service.ts:341`：非整数 ⇒ **该对象不存在** ⇒ 404）+ §3.3-8「错误分支用 R107」。实测：`HTTP_verify_nonnumeric_404` ⇒ 404。 |
| Δ2 | 有「admin 的提交不在面板队列里审」的 `400` 守卫（`sendError` 裸文案） | **撤除** | ① 该守卫在**读口已结构性排除**（`database.ts:1872`：`COALESCE(u.is_admin,false) = false`）⇒ 队列永不产出这类项；② 它是 bespoke 形状，与 §3.3-8「错误分支一律 R107」冲突；③ 若需恢复，应作为独立裁定（**本片不自选**）。 |

> 另：`DatabaseService.markTaskProgressChecked` / `rejectPendingTaskProgress`（旧直写路径）**保留未删**（无调用方），归批 4 收口。

---

## §3 台账 before / after（全账户逐行 + 逐 kind 计数）

产物：`<run>/b3c-01-snapshot-pre.json` · `<run>/b3c-01-snapshot-post.json`（含**逐行** `uid/cid/balance/frozen`）。

| 读数 | pre | post | Δ |
|---|---|---|---|
| `account` 行数 | 5 | 10 | +5（本片 5 个新测试用户按需 0/0 开户） |
| **`Σbalance`** | **1995998** | **1995998** | **0** |
| **`Σfrozen`** | **4002** | **4002** | **0** |
| **`Σtotal` = `Σ(balance+frozen)`** | **2000000** | **2000000** | **0** ✅（**与派单给我的基线 2000000 逐字相同**） |
| `ledger_entry` 总行数 | 42 | 76 | **+34** |
| `ledger_entry` 逐 kind 求和 == 总数 | 42 == 42 ✅ | 76 == 76 ✅ | — |

**逐 kind 计数（pre → post，Δ）**：

| kind | pre | post | Δ | 归因（逐事件枚举） | 属本片 |
|---|---|---|---|---|---|
| `job_escrow` | 0 | 10 | **+10** | 5 次 publish × 2 腿（jobA=5, jobB=8, jobC=9, jobD=10, chain=11） | ✅ |
| `job_payout` | 0 | 6 | **+6** | 3 次 settle × 2 腿 | ✅ |
| `job_fee` | 0 | 6 | **+6** | 3 次 settle × 2 腿 | ✅ |
| `commission` | 0 | 4 | **+4** | 1 次带链 settle × 2 层 × 2 腿（DL86 `-2` 形态） | ✅ |
| `job_escrow_refund` | 0 | 4 | **+4** | 2 次 refund × 2 腿（HTTP reject / 服务层 cancel） | ✅ |
| `transfer` | 0 | 4 | **+4** | **fixture 供资** 2 次 × 2 腿（`fundFromResidual`：从残差夹具账户转账，**净额守恒、不 mint**） | ❌（夹具，已声明） |
| `currency_create_fee` | 20 | 20 | 0 | 未被本片触及 | — |
| `hold` | 4 | 4 | 0 | 同上 | — |
| `listing_deposit` | 16 | 16 | 0 | 同上 | — |
| `mint` | 2 | 2 | 0 | 同上（**本片零 mint**） | — |

> **Δ 算术闭合**：4+10+4+6+6+4 = **34** == 总增量 34 ✅ ⇒ **没有任何被拒调用产生分录**（判据是枚举等式，不是「看起来没涨」）。
> **非本片增量唯一来源 = `transfer` ×4**（夹具供资），**逐字声明**，不计入本片资金事件。

**关键账户 post 读数**（`cid=1`；完整逐行见产物）：

| uid | 角色 | `balance` | `frozen` | 备注 |
|---|---|---|---|---|
| 2 | 雇主 E | 7600 | **0** | 全部托管已结算/退回 ⇒ **`frozen` 归零**（无残留冻结） |
| 3 | 打工人 W（无邀请人） | 1386 | 0 | = 396（jobA net）+ 990（jobB net） |
| 6 | 打工人 W2（链深 2） | **990** | 0 | = 1000 − 10（fee） |
| -1 | 平台收入 | 11217 | 0 | 仅收 `job_fee`（无链两单：+4、+10） |
| **-2** | **佣金池** | **0** | **0** | **进出守恒 ⇒ 零残留**（入 10 / 出 10，DL86 `-2` 形态） |

---

## §4 端到端读数（**真 token = `.env.local` 的 `SECRET_KEY`**）

产物：`<run>/post/e2e.json`（e2e，含 23 条 HTTP 记录 + 15 条 service 记录）· `<run>/post/b3c-03-chain.json`（DL86 有链补测）。
**token 现取取证**：两候选各铸一枚 ⇒ 命中 `200` 者 = **`env-SECRET_KEY(.env.local)`**（`auth.ts` 硬编码兑底**未命中**，与「旧兑底常量已失效」一致）；产物 `leak_check = {eyJ:0, secret_occurrences:0}` ✅。

### 4.1 资金链（HTTP = 真端点；service = 同函数服务层入口）

| # | 用例 | 路径 | 实测 |
|---|---|---|---|
| E1 | 面板重启 + `/health` | 面板 | `POST /api/restart {sid:'seafood-api'}` ⇒ `{ok:true,state:'running',pid:48087}`；`/health` **200**（`waited_ms=2646`） |
| E2 | **J1 托管**（jobA 400） | service | `200`；`job_escrow` **2 腿** 全在 uid 2：`(−400,0)` / `(0,+400)`；`balance_after 7600 / frozen_after 400`；事件键 `biz:job:escrow:5` + `#2` |
| E3 | **J1 幂等重投**（同 `create_key`） | service | `200` + **重放**；分录**仍 2 腿**（不翻倍）、业务行未重写 |
| E4 | J1 负例 | service | 缺键 **400** `LEDGER_IDEMPOTENCY_KEY_REQUIRED`；坏前缀 **400** `..._INVALID`（`PREFIX_REQUIRED`）；代他人出资 **403** `AUTH_FORBIDDEN`；**余额不足 409 `LEDGER_INSUFFICIENT_BALANCE`**；未知 cid **404** `LEDGER_CURRENCY_NOT_FOUND` |
| E5 | **J5 结算（无邀请人）** | **HTTP verify `{approved:true}`** | `200`；**4 腿**：`job_payout` uid2 `(0,−396)` → uid3 `(+396,0)`；`job_fee` uid2 `(0,−4)` → **uid −1 `(+4,0)`**；`-2` 命中 **0**（DL86 无链形态）；job → `settled`、`settle_txid=54`、`ledger_event_keys=[escrow, settle]` |
| E6 | **「审核通过 → 发放原子」证据** | HTTP | 同一次 HTTP 调用后：`job_submission.submission_id=7` → `review_status='approved'`、`reviewed_by=1`、`reviewed_at` 非空、`review_memo='job settle:5'` —— **结论位与 4 条分录同一条语句落库** |
| E7 | **J5 重投（同键）** | HTTP | `200` + **`idempotent_replay:true`（顶层）**；分录**仍 4 腿、txid 集合逐字相同** |
| E8 | **DL86 有邀请人形态** | HTTP verify（链：P2←P1←W2，`depth=2`，经迁移既有 `public.referral_bind(child,parent)` 建链） | `200`；**8 腿** = `job_payout`×2 + `job_fee`×2 + **`commission`×4**；`job_fee` 入 `-2` = **+10**，`commission` 出 `-2` = **−10**，受益人合计 **+10** ⇒ **`-2` 进出守恒**；**`-1` 命中 0**（有链 ⇒ **不得**写 `-1`，DL86 逐字） |
| E9 | **J6 退托管（HTTP reject）** | HTTP verify `{approved:false}` | `200`；`job_escrow_refund` **2 腿** 全在 uid 2 `(+300,0)` / `(0,−300)`；job → **`rejected`**；`escrow_txid=64`；submission → `review_status='rejected'`、`reviewed_by=1` |
| E10 | **J6 cancel 路径**（`to_status='cancelled'`） | service | `200`；`job_escrow_refund` 2 腿；job → `cancelled` |
| E11 | J6 负例 | service | 非法 `to_status` ⇒ **400 `LEDGER_AMOUNT_INVALID` + `reason='not_a_refund_target'`**（§4.2 J6 逐字）；未知 job ⇒ **404 `LEDGER_REF_NOT_FOUND`**；已取消 job 重投 ⇒ `200` **重放**（同键同指纹，R6） |
| E12 | J5 未知 job | service | **404 `LEDGER_REF_NOT_FOUND`** |

### 4.2 鉴权 / 404 面（**响应体 + 零分录** 双取证，纪律⑩）

| 用例 | 实测 | 零分录取证 |
|---|---|---|
| 无 token | **401 `AUTH_UNAUTHORIZED`**（R107） | §3 的枚举等式（Δ 合计 == 34）⇒ 该调用**零分录** |
| 有 actor 非 admin（雇主 token） | **403 `AUTH_FORBIDDEN`** + `details.reason=**NOT_ADMIN**` | 同上 |
| 未知 `:jID`（999999999） | **404 `LEDGER_REF_NOT_FOUND`** + `reason=jID_not_found` | 同上 |
| 非数字 `:jID`（`abc`） | **404 `LEDGER_REF_NOT_FOUND`**（见 §2.3 Δ1） | 同上 |

> **口径限定**：本机**无 access log 可用**（服务端日志由面板 `/api/logs/:sid` 暴露，本片未取） ⇒ 401/403 的「未触 DB」**未直接取证**，判据只用「响应体 + 零分录」⇒ 本项标 **`NOT_MEASURED`（未触 DB 部分）**，**不以「查不到」当「无异常」**。

### 4.3 逐腿取证（**按事件根键 dump**）

| 事件 | 腿数 | 腿所在 kind | 账户 | **`Σ(delta+frozen_delta)`** | 判读 |
|---|---|---|---|---|---|
| `biz:job:escrow:5` | 2 | 全 `job_escrow` | 仅 uid 2 | **0** | 同账户 `balance↔frozen` ✅ |
| `biz:job:settle:5` | 4 | `job_payout`/`job_fee` | uid 2 · uid 3 · **uid −1** | **0** | 全在 `balance` 面，**零预期外 `frozen` 残差**（uid2 `frozen_after=0`）✅ |
| `biz:job:settle:8` | 4 | 同上 | uid 2 · uid 3 · **uid −1** | **0** | 同上 |
| `biz:job:settle:11`（链） | 8 | + `commission`×4 | uid 2 · uid 6 · uid 5 · uid 4 · **uid −2** | **0** | `-2` 进出守恒 ✅ |
| `biz:job:refund:9` | 2 | 全 `job_escrow_refund` | 仅 uid 2 | **0** | 同账户 `frozen→balance` ✅ |
| `biz:job:refund:10` | 2 | 同上 | 仅 uid 2 | **0** | 同上 ✅ |

⇒ **每一个事件都是纯转移**（`Σ(delta+frozen_delta) == 0`）**且 `Σtotal` 全库不变**（§3）。

### 4.4 响应键集（成功面冻结 · §2 F1）

| 分支 | 键数 | 键（逐字） |
|---|---|---|
| approve（首投 & 重放） | **11** | `jID,tID,uID,info_input,time_created,time_submitted,time_checked,time_claimed,points_claimed,task,user` |
| reject | **9** | 同上前 9 键 |

---

## §5 资金不变量对拍（**判据**）

| # | 不变量 | 读数 | 结论 |
|---|---|---|---|
| I1 | **`Σtotal` 不变**（纯转移） | 2000000 → **2000000** | ✅（**等于派单基线，无需停下来查**） |
| I2 | `Σbalance` / `Σfrozen` 分别不变 | 1995998/4002 → **1995998/4002** | ✅（托管已全链闭合 ⇒ 冻结面回到基线） |
| I3 | 分录增量 == 事件数 × 分录条数（**不得再把 0 当绿灯**） | 34 == 4(夹具)+10+4+6+6+4 | ✅（枚举等式，见 §3） |
| I4 | 托管/退款事件 = **同账户 2 腿 `balance↔frozen`** | escrow×5、refund×2 全部 2 腿同 uid、`Σ=0` | ✅ |
| I5 | 发放/手续费腿全在 `balance` | settle ×3：`job_payout`/`job_fee` 腿 `frozen_delta` 仅出现在**雇主**腿（从在冻出账，`FROZEN_SETTLE_KINDS` 语义） | ✅（**预期内**；非「预期外 frozen 变动」） |
| I6 | **无预期外 `frozen` 变动** | post 全账户 `frozen` = 仅夹具非 cid1/未涉账户；uid2 `frozen=0`；`Σfrozen` 回到基线 | ✅ |
| I7 | **`23514`（非负 CHECK）不得触发** | 全程无任何异常；`Σfrozen`/余额均 ≥ 0（逐行 dump 无负数） | ✅（**判据 = 未出现**；不是「已触发并被拦」） |
| I8 | **无孤儿分录** | 每条新分录都带 `event_root_key` ∈ {`biz:job:escrow:{5,8,9,10,11}`, `biz:job:settle:{5,8,11}`, `biz:job:refund:{9,10}`} + 2 次夹具 `transfer`；**每条都能对应到一个业务状态变化**（job 行 `open→settled/rejected/cancelled` + `escrow_txid/settle_txid/ledger_event_keys` 回写） | ✅ |
| I9 | **无孤儿业务行** | `job` 行含 `cli:b3c:%` = **5** == 成功 publish 次数（A/B/C/D/chain）；三次失败 publish（无键/大额/未知 cid）**零残留行** | ✅ |

---

## §6 冻结面自证（结构证明）

`git status --porcelain`（现取）：

```
 M backend-ts/src/database.ts        ← 本片
 M backend-ts/src/index.ts           ← 本片
 M docs/data-layer.spec.md           ← ★ 本片之前既有状态（本片未写）
 M docs/route-layer.spec.md          ← ★ 同上
?? backend-ts/.p4-artifacts/...      ← 本片产物
?? backend-ts/scripts/p4z-b3c-0{1,2,3}-*.ts   ← 本片探针
?? backend-ts/src/job-funds-service.ts        ← 本片
?? docs/audit/p4-b3c-job-funds.md             ← 本片报告（本片写过的**唯一** `docs/**`）
?? docs/audit/route-layer-v0.4-delta.md · docs/versions/*  ← ★ 本片之前既有状态（未写）
```

⇒ **`backend-ts/src/ledger.ts` · `src/ledger-errors.ts` · `src/commission.ts` · `src/job-service.ts` · `migrations/**` 均未出现在改动清单内**（结构证明「未改」，不是纪律声明）。现取 sha256（前 16 位）：

| 文件 | sha256(前16) |
|---|---|
| `src/ledger.ts` | `c3430e56a03e4516` |
| `src/ledger-errors.ts` | `5a671354eb7bfd67` |
| `src/commission.ts` | `7b5ff9b36bfd7a34` |
| `src/job-service.ts` | `37e30f31ebc6c039` |

其它：`migrations/` 文件数 = **19**（**本片未新增迁移**，与「注册表 19」一致）；`src/job-funds-service.ts` **不 import `./commission`**（佣金拆分归 DB `job_settle_plan`；派单硬口径 #5）。

---

## §7 登记 / 未测（**`NOT_MEASURED`**，禁填 0/空）

| # | 项 | 状态 | 说明 / 依据 |
|---|---|---|---|
| N1 | **`/api/job`、`/api/job/:jobId/{review,cancel,apply,accept,submit}` 的 HTTP 面** | **`NOT_MEASURED`** | 路径**未注册**（前端零调用 ⇒ §1.2/§5.74/§5.76）⇒ HTTP 面按设计不存在（实测未注册路径落 §1.3 兜底 404）；**服务层已实测**（E2/E3/E4/E10/E11/E12）。 |
| N2 | **★ 集成缺口 F-1：前端 verify 按钮在批 4 前走不通完整资金链** | **实测事实** | settle 要求 `job.worker_uid` **已选定**（§4.2 J5：「`worker_uid` 必须已选定」；`job_settle_plan(job_id, employer, **worker_uid**, ...)`）。而「选定 = `accept`」的唯一入口 `/api/job/:jobId/accept` **未注册**（批 4）⇒ 现网前端 `DashboardPage` 的 verify 队列里，job 若未经 accept 路径选定 worker，settle 必失败。本片 e2e 的 `apply/accept/submit` **全部走 service 层**（同一函数，非假数据）。**建议（供 Zang 定案）**：批 4 注册 `/api/job/:jobId/accept` 后复测该链，或在批 4 前不把该按钮上线。 |
| N3 | **`disputed` 状态分支**（`submitted→disputed`/`disputed→settled`） | **`NOT_MEASURED`** | §4.2 无对应事件行（P6 仲裁路径）⇒ 未构造、未测。 |
| N4 | **币种 `draft`/`frozen`/`delisted` 对 J1 的闸** | **`NOT_MEASURED`** | 只测了「未知 cid ⇒ 404」；三态闸由 DB `LD008/LD009/LD010` 承担（`0013:562-565`），本片未构造三态夹具。 |
| N5 | **401/403 的「未触 DB」** | **`NOT_MEASURED`** | 本机无 access log 直证 ⇒ 只用「响应体 + 零分录」（§4.2 口径限定）。 |
| N6 | **`job_escrow_missing`（`escrow_txid IS NULL` 防凭空退款）** | **`NOT_MEASURED`** | 需构造「有 job 行、无托管」的畸形夹具（`job_ledger_ref_guard` 使 `escrow_txid` 一次写定）⇒ 未构造。 |
| N7 | **并发**（同 job 双 settle 竞争；锁序 DL141） | **`NOT_MEASURED`** | 单线程探针；未做并发对拍。 |
| N8 | **探针自曝** | — | ① 首轮 `§3` 读数用 jq 取错路径（写成 `<run>/pre/*.json`，实际在 `<run>/*-pre.json`）⇒ 报错 `No such file`，**是探针路径错，不是产物缺失**（纪律④：读数异常先怀疑自己的探针）；② 首轮 e2e 的 `J5_B` 因 **`public.referral` 现为空**（`chain_worker_uid=null`）只测到「无链 ⇒ `-1`」形态 ⇒ 追加 `p4z-b3c-03-chain.ts` 用迁移既有 `referral_bind(child,parent)`（签名现取 = `p_child_uid bigint, p_parent_uid bigint`）建真链后补测 `-2` 形态（E8）。⇒ **DL86 两形态均已实测**。 |
| N9 | **`docs/*.spec.md` 的 `git status` = `M`** | 非本片 | 本片写过的 `docs/**` **只有** `docs/audit/p4-b3c-job-funds.md`（如实声明，不认领他人改动）。 |

---

## §8 产物清单（run-tagged · **绝对路径**）

| 产物 | 绝对路径 |
|---|---|
| 台账 pre | `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b3c-20260930T021741/b3c-01-snapshot-pre.json` |
| 台账 post | `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b3c-20260930T021741/b3c-01-snapshot-post.json` |
| e2e（23 HTTP + 15 service 记录 + 逐腿） | `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b3c-20260930T021741/post/e2e.json` |
| DL86 有链补测 | `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b3c-20260930T021741/post/b3c-03-chain.json` |
| 前端路径现取清单（70 行） | `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b3c-20260930T021741/frontend-api-paths.txt` |
| 探针 | `/Users/kevin/bistro/seafood/backend-ts/scripts/p4z-b3c-01-snapshot.ts` · `-02-e2e.ts` · `-03-chain.ts` |
| 本报告 | `/Users/kevin/bistro/seafood/docs/audit/p4-b3c-job-funds.md` |
