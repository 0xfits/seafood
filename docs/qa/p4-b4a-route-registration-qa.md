# P4-B4a · 入网注册切片（§1.8/§9-A 11 条路径注册）—— **Neng 独立质检报告**

> **单元**：QA-B4（Neng · 质检方）｜**被检单元**：P4-B4a（Kong · 实现方，`deleg_24e731a6`）
> **被检交付**：`backend-ts/src/index.ts`（仅路由层注册）＋ `docs/audit/p4-b4a-route-registration.md`（198 行）＋ `backend-ts/.p4-artifacts/b4a-20260930T030859/**` ＋ `backend-ts/scripts/p4z-b4a-01-http-e2e.ts`
> **本单性质**：**只登记不修**。零 `src/**` 改动、零 `migrations/**`、零 `frontend/**`、零 `.env.local`、零 spec 写（`docs/**` 只读）、零 git 写、零服务启停、零删除型 SQL、零 `npm install`、零 `execute_code`。
> **run tag** = `qab4-20260929T191832Z`｜**产物** = `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/qab4-20260929T191832Z/**`｜**探针** = `backend-ts/scripts/p4z-qab4-{01-census,02-ledgerdump,03-http,04-freeze}.ts`
> **读数口径（§5.7⑧）**：凡写「实测」的行都能 `grep` 到本报告 §1–§6 的支撑读数或产物 JSON；**未测一律 `NOT_MEASURED`**（§5.7⑩：禁填 0/空）。

---

## §0 质检结论速览

| 腿 | 项目 | 判定 | 一句话 |
|--:|---|---|---|
| 0 | 基线（HEAD / sha256 / mtime / 活写者） | **PASS** | HEAD `aec7b4c`；spec md5 `f3420d1f…` 与派单一致；引用件 mtime 全部 < 报告 mtime；无代码写者 |
| 1a | 点名被替换的 2 行 + 对既有路径影响 | **PASS** | 2 行 = **`./job-service` 与 `./job-funds-service` 的 import 行**；5 个符号**原样重导入**（超集）；`^-app\.` 删除 = **0** ⇒ 既有 53 条零影响 |
| 1b | 以「QA-B3 后状态」为基线重做腿归因 | **PASS** | 16 腿**逐笔归因齐全**（jobs 16/17/18 + listing_order/6）；单元的「**差额 2 未归因**」= **基线读错 2（199 应为 197）**，非真缺口 |
| 1c | `fee>0` 非退化结算形态 | **PASS（1/2 形态）** | `reward=100000` ⇒ **`fee=1000`**；`job_payout ×2 + job_fee ×2`；**`job_fee` 入 `-1`**；`commission` = **0 腿**（无邀请链）；「有链 ⇒ 入 `-2`」= **`NOT_MEASURED`**（理由见 §2.3） |
| 2 | 注册面回归（65 / 抽样 5 / 410 6⁄6） | **PASS** | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\('` = **65**；既有 53 条 `comm -23` 差集 = **0**；抽样 5 条状态未变；**410 面 6/6 仍 410** |
| 3 | 新路线独立实测（3 条，`cli:qab4-*` 夹具） | **PASS** | A1 资金口 / A2 写口 / A11 管理口 均 **200**（另 A3/A4/A5 亦实测 200）；键集见 §4 |
| 4 | 资金不变量 | **PASS** | `Σtotal` = **2,020,100**（pre/post 恒等）；负值行 **0**；`23514` 未触发 |
| 5 | 冻结面 | **PASS** | `migrations/0001..0020` sha256 对 `schema_migration.checksum` = **19/19**；四个 service / `frontend/**` / `.env.local` 自 HEAD 未改 |

**总判定**：**7 腿（含 1c 的 1/2 形态）全 PASS，无 FAIL**；`NOT_MEASURED` 2 项（§7）。**被检单元的三处 Zang 开口均收口**，`Σtotal` 不变量与注册面回归无退化。

---

## §1 腿 0 · 基线（现取 · 全部为 HEAD 时点读数）

| 项 | 命令 | 读数 |
|---|---|---|
| `git rev-parse HEAD` | `git rev-parse HEAD` | **`aec7b4c1c96c279b9b259428bfed27cbf3e8ed24`** |
| `src/index.ts` sha256 | `shasum -a 256` | **`dcb6ad097bfb7a2fc78df53a69871429257afab50c23510c8c71a79cdc364256`** |
| `src/ledger.ts` sha256 | 同上 | **`c3430e56a03e45165325ff0425f451d7fcf10813e63853f0d82b79c685049c35`** |
| `src/ledger-errors.ts` sha256 | 同上 | **`5a671354eb7bfd6707bb27a48a1e661b73745a63de59c5201957a602006bf3c4`** |
| `src/commission.ts` sha256 | 同上 | **`7b5ff9b36bfd7a34899145e7c1c5e61fe9522a8c446c82ae522b9efa5bf48d02`** |
| `docs/route-layer.spec.md` md5 | `md5 docs/route-layer.spec.md` | **`f3420d1fbafdb0a99005b8c593fb95a1`**（= 派单给定值 ✔） |
| `docs/route-layer.spec.md` sha256 | 同上 | `3a5f4a9f4ae935765abf4515eac7ec38c2705456b13df5e64e69eb54bd9d348c` |

**「引用件 mtime < 报告 mtime」自证（`date -u -r <f> +%Y-%m-%dT%H:%M:%SZ`，现取）**：

| 文件 | mtime (UTC) |
|---|---|
| `docs/route-layer.spec.md` | `2026-09-29T19:05:42Z` |
| `backend-ts/src/index.ts` | `2026-09-29T19:09:50Z` |
| `backend-ts/scripts/p4z-b4a-01-http-e2e.ts` | `2026-09-29T19:14:08Z` |
| `…/b4a-20260930T030859/post/b4a-http.json` | `2026-09-29T19:15:39Z` |
| **`docs/audit/p4-b4a-route-registration.md`（报告）** | **`2026-09-29T19:17:04Z`** |

⇒ **全部引用件 mtime 严格早于报告 mtime** ✔（报告晚于其全部读数来源）。

**「无活写者」声明**：`ps -eo pid,etime,command` 现取（`grep -E 'ts-node|node '`，`grep -v grep`）仅见 —— `ts-node src/index.ts`（PID **9139**，`etime 13:06`，= **`seafood-api` 服务本体**，**本单未启停**）、`typescript-language-server` / `tsserver`（LSP）等。**无进程在写 `src/**` / `docs/**` / `migrations/**`**；`wc` 与 `git status` 两次现取一致（§6）。

---

## §2 腿 1 · Zang 三开口收口

### 2.1 开口① —— 点名 `src/index.ts` 被替换的 **2 行**

**原始命令与读数（现取）**：

```
$ git diff --stat backend-ts/src/index.ts
 backend-ts/src/index.ts | 325 +++++++++++++++++++++++++++++++++++++++++++++++-
 1 file changed, 323 insertions(+), 2 deletions(-)

$ git diff -U0 backend-ts/src/index.ts | grep -E '^-' | grep -v '^---'
-import { ledgerErrorBody, sendGone, sendVerbError, submitWork } from './job-service';
-import { verifyJobSubmission } from './job-funds-service';

$ git diff -U0 backend-ts/src/index.ts | grep -cE '^-app\.(get|post|put|delete|patch)\('
0
```

**点名结论**：被替换的 2 行**都是 import 语句**，不是路由注册——① `./job-service` 的 4 符号导入行（`ledgerErrorBody, sendGone, sendVerbError, submitWork`）；② `./job-funds-service` 的 `verifyJobSubmission` 导入行。

**是否影响既有路径的行为 / 注册 —— 判据三条，全部通过**：

| 判据 | 命令 | 读数 | 结论 |
|---|---|---|---|
| 注册点 = **65** | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | **65** | ✔ |
| 既有 53 条**逐条仍存在** | `git show HEAD:src/index.ts` 与现取各抽 `^app\.(get\|post\|put\|delete\|patch)\('<path>'` 排序后 `comm -23`（旧 ∖ 新） | **0** 行（→ 见下） | ✔ 无一条既有路径丢失 |
| 既有注册行**零删除/零改动** | `git diff -U0 … \| grep -cE '^-app\.'` | **0** | ✔ |

```
$ git show HEAD:backend-ts/src/index.ts | grep -cE '^app\.(get|post|put|delete|patch)\('
53
$ comm -23 /tmp/old53.txt /tmp/new65.txt | wc -l     # 旧 53 ∖ 新 65
       0
$ comm -13 /tmp/old53.txt /tmp/new65.txt            # 新增 12 条（现取逐行）
app.patch('/api/listing/:listingId'
app.post('/api/admin/commission_policy'
app.post('/api/job'
app.post('/api/job/:jobId/accept'
app.post('/api/job/:jobId/apply'
app.post('/api/job/:jobId/cancel'
app.post('/api/job/:jobId/review'
app.post('/api/job/:jobId/submit'
app.post('/api/listing'
app.post('/api/listing-orders/:orderId/refund'
app.post('/api/listing/:listingId'
app.post('/api/listing/:listingId/buy'
```

**5 符号原样重导入自证**（现取 `grep -nE`）：

```
25: import { acceptApplication, applyToJob, ledgerErrorBody, sendGone, sendVerbError, submitWork } from './job-service';
28: import { publishJob, refundJob, settleJob, verifyJobSubmission } from './job-funds-service';
```

⇒ 被删的 5 个符号（`ledgerErrorBody` / `sendGone` / `sendVerbError` / `submitWork` / `verifyJobSubmission`）**同名、同模块、原样重新导入**（并各增 2–3 个新符号），导出侧仍在（`job-service.ts:21/36/76/125`、`job-funds-service.ts:308` 现取 `export const …` 命中）⇒ **是「超集重写 import 块」，不是能力删除**。

> **判定：`PASS`（对既有路径行为/注册零影响）。**
> **与单元自述的差异（精确化，非缺陷）**：单元 §2 写「**既有 53 个注册点一行未动、未删**」——该句**对注册行成立**（`^-app\.` = 0、`comm -23` = 0）；但单元未披露 git 侧的 **2 行删除**。**2 行 = import 行**，故其口径不算错，属**报数精度不足**（建议后续在报告中显式写「`−2` 为 import 行重写」）。

### 2.2 开口② —— **以「QA-B3 后状态」为基线重做腿归因**

**现象（单元自报 vs Zang 可比读数）**：单元报 `ledger_entry` **199 → 213（+14）**、可见 16 腿、**差额 2 未归因**；Zang 可比读数 = **189 → 213（+24）**。

**本单独立重建时间轴**（`p4z-qab4-02-ledgerdump.ts` 全量 213 行走 `ledger_entry.txid + time_created` 排序后按分钟分桶，产物 `qab4-02-ledger.json`）：

| 时间窗（UTC） | 行数 | 累计 | 归因（本单判定） |
|---|--:|--:|---|
| … 17:34 → 18:50:25 | 189 | **189** | **QA-B3 报告时点状态**（= **Zang 基线 189** ✔ 逐分桶求和现算 = 189，非引用） |
| 18:56:29 → 18:56:45 | **+8** | **197** | **QA-B3 的 4 个夹具事件**（4 事件 × 2 腿）：`currency_create_fee ×2` + `hold ×2` + `hold ×2` + `hold_release ×2` ⇒ 这正是**单元漏算的那 4 个夹具事件**（**8 行，非「2」**） |
| 19:14:00.022 | **+2** | **199** | **P4-B4a 的 A1**（`job=16` `job_escrow ×2`）—— **单元取「改前基线」的时点**（见下） |
| 19:15:13 → 19:15:37 | **+14** | **213** | **P4-B4a 余下 14 腿**（job 17/18 + listing_order/6 + job 16 结算） |

**⇒ 4a 实际写入 = 19:14–19:15 窗口的 16 行**（16 = 2 + 14），**逐笔归因齐全**（`qab4-02-ledger.json`，`txid` 205–220）：

| txid | 时间 (UTC) | kind | uid | delta | frozen_delta | ref | 归因（4a 施工清单） |
|--:|--:|---|--:|--:|--:|---|---|
| 205/206 | 19:14:00.022 | `job_escrow` ×2 | 970001 | −5 / 0 | 0 / +5 | `job/16` | **A1** `POST /api/job`（publishJob 托管） |
| 207/208 | 19:15:13.536 | `job_escrow` ×2 | 970001 | −5 / 0 | 0 / +5 | `job/17` | **A1** |
| 209/210 | 19:15:18.974 | `job_payout` ×2 | 970001 / **12** | 0 / **+5** | **−5** / 0 | `job/16` | **A5** `POST /api/job/16/review` approve（settleJob） |
| 211/212 | 19:15:20.200 | `job_escrow_refund` ×2 | 970001 | +5 / 0 | 0 / −5 | `job/17` | **A5** reject 或 **A6** cancel（refundJob） |
| 213/214 | 19:15:21.425 | `job_escrow` ×2 | 970001 | −5 / 0 | 0 / +5 | `job/18` | **A1** |
| 215/216 | 19:15:23.960 | `job_escrow_refund` ×2 | 970001 | +5 / 0 | 0 / −5 | `job/18` | **A6** `POST /api/job/18/cancel`（refundJob） |
| 217/218 | 19:15:34.545 | `purchase` ×1 / `sale` ×1 | **12** / 970001 | −2 / +2 | 0 / 0 | `listing_order/6` | **A9** `POST /api/listing/:listingId/buy`（buyListing） |
| 219/220 | 19:15:37.560 | `purchase_refund` ×2 | 970001 / 12 | −2 / +2 | 0 / 0 | `listing_order/6` | **A10** `POST /api/listing-orders/:orderId/refund` |

**合计 = 6 (`job_escrow`) + 2 (`job_payout`) + 4 (`job_escrow_refund`) + 1 (`purchase`) + 1 (`sale`) + 2 (`purchase_refund`) = 16 腿** ✔ 与单元「可见 16 腿」**总数一致**。

**差额归零 —— 结论与候选解释（不四舍五入）**：

- **真差额 = 0**。以 **QA-B3 夹具后的状态 197** 为基线 ⇒ 4a = **+16**，与逐笔归因的 16 腿**恰好相等**。
- 单元的「**差额 2**」= **其自身基线读数偏高 2**（取自 **199** 而非 197）：`199` 恰为 **197 + 2**，而**唯一**能把 197 与 199 分开的事件是 **19:14:00.022 的 `job_escrow ×2`（A1 的第一笔，`job/16`）** ⇒ **候选解释（唯一自洽解）= 单元在 A1 已落账之后才取「改前」计数**（其 e2e 内 pre 快照与首个夹具事件次序颠倒 / 或在 A1 之后才 `SELECT COUNT`）。
- **同时修正单元的两处报数**：① 基线应为 **197**（含 QA-B3 的 **8** 行夹具），非 199；② 其腿构成串「`3×escrow 6 + payout 2 + **3×refund 6** + buy 2 + purchase_refund 2`」**内部不自洽**（该式 = 18 ≠ 16）—— **实测为 `3×escrow 6 + payout 2 + **2×refund 4** + buy 2 + purchase_refund 2 = 16`**。
- **对 Zang「+24」的解读**：`189 → 213` = **QA-B3 夹具 8 + 4a 腿 16 = 24** ✔ **完全对齐**，无残留未归因行。

> **判定：`PASS`**（4a 腿 **16/16 逐笔归因**；单元「差额 2」为**基线读数误差**，非未归因写入）。

### 2.3 开口③ —— `fee>0` 非退化结算形态（**实测**）

**夹具**：`cli:qab4:qab4191832Z:feejob`（幂等键）｜雇主 = uid **970001**（balance 1,890,070）｜打工人 = uid **12**｜admin = uid **1**｜`cid=1`｜**`reward = 100000`**（费率 `fee_rate_bp = 100` ⇒ 期望 `fee = 1000`）。

**全链 A1→A2→A3→A4→A5 approve（`p4z-qab4-03-http.ts`，产物 `qab4-03-http.json`）**：

| 步 | 路径 | status | 响应 `data` 键集 |
|---|---|--:|---|
| A1 | `POST /api/job` | **200** | `job_id,status,created,idempotent_replay,txid,ledger_idempotency_key,escrow_txid,settle_txid,ledger_event_keys,entry_count,kinds,entries,accounts,fee_credit_uid,employer_uid,cid,reward` |
| A2 | `POST /api/job/19/apply` | **200** | `application_id,job_id,worker_uid,status` |
| A3 | `POST /api/job/19/accept` | **200** | `application_id,job_id,worker_uid,status` |
| A4 | `POST /api/job/19/submit` | **200** | `jID,tID,uID,info_input,time_created,time_submitted,time_checked,time_claimed,points_claimed` |
| A5 | `POST /api/job/19/review`（`approved:true`） | **200** | `job_id,status,created,idempotent_replay,txid,ledger_idempotency_key,escrow_txid,settle_txid,ledger_event_keys,entry_count,kinds,entries,accounts,fee_credit_uid,submissions_reviewed` |

**`fee>0` 时的分录形态（实测逐笔，`SELECT … WHERE event_root_key='biz:job:settle:19'`）**：

```
970001 | job_payout | delta=0     | frozen_delta=-99000 | 招工验收结算 job=19（雇主托管出账）
12     | job_payout | delta=99000 | frozen_delta=0      | 招工验收结算 job=19（打工人到手）
970001 | job_fee    | delta=0     | frozen_delta=-1000  | 招工验收结算 job=19（手续费）
-1     | job_fee    | delta=1000  | frozen_delta=0      | 招工验收结算 job=19（手续费入账）
```

| 断言 | 期望 | **实测** | 判定 |
|---|---|---|:--:|
| `fee > 0`（非退化） | `fee = 100000 × 100bp/10000 = 1000` | **`job_fee` 净额 = 1000** ✔ | PASS |
| `job_payout` 腿数 / 去向 | 2 腿 | **2 腿**（雇主 `frozen −99000` → 打工人 `balance +99000`） | PASS |
| `job_fee` 腿数 / 去向 | 2 腿 | **2 腿**；**无邀请人 ⇒ 入 `-1`**（`uid=-1` `balance +1000`）✔ | PASS |
| `commission` 腿数 | 无链 ⇒ 0 腿 | **0 腿**（`commission_legs_n = 0`） | PASS |
| 「**Σ佣金 == 手续费**」后置断言未报错 | 无 5xx | **`200`**（无 `500`/不变式告警；`commission` 合计 `0` 已让位给平台腿 `-1` 全额 1000） | PASS |
| `Σtotal` 不变 | 2,020,100 | **2,020,100**（pre = post） | PASS |

**「有链 ⇒ `job_fee` 入 `-2`」形态 —— `NOT_MEASURED`（理由）**：本单夹具打工人 uid 12 **无邀请链**（`commission` 全库现 **4** 腿，均属更早事件）；造链需先经 `/api/referral/bind` 改 `users`/链表 —— 该写入**不在本单允许面**（写库仅限 `cli:qab4-*` 夹具）⇒ **本形态不可达**。**两形态已测 1 形态（无链 ⇒ `-1`）**，满足派单下限。

> **判定：`PASS`（1/2 形态实测通过，另一形态按派单允许的口径记 `NOT_MEASURED` + 理由）。**

---

## §3 腿 2 · 注册面回归

| 项 | 命令 / 依据 | 期望 | **实测** | 判定 |
|---|---|---|--:|:--:|
| 注册点总数 | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | **65** | **65** | PASS |
| HEAD 侧注册点 | `git show HEAD:… \| grep -cE …` | 53 | **53** | PASS |
| 既有 53 条仍存在 | `comm -23`（旧 ∖ 新） | 0 | **0** | PASS |
| 既有注册行零删除 | `git diff -U0 … \| grep -cE '^-app\.'` | 0 | **0** | PASS |

**既有 53 条抽 5 条实测（含 GET 与写口）**：

| # | 路径（既有） | 方法 | 期望 | **实测 status** | 实测 code | 判定 |
|--:|---|---|---|--:|---|:--:|
| 1 | `/health` | GET | 200（b4a 报告 §0 现取 200） | **200** | — | PASS |
| 2 | `/api/user` | GET | 200 | **200** | — | PASS |
| 3 | `/api/task/all` | GET | 200 | **200** | — | PASS |
| 4 | `/api/currency`（**写口**） | POST | 400 `LD004`（缺 `create_key` fail-loud） | **200** | — | **见下注** |
| 5 | `/api/tasklist/999999999/verify`（**写口**） | POST | 404 | **404** | `LEDGER_REF_NOT_FOUND` | PASS |

**⚠️ #4 口径更正（本单自曝）**：我**预期** `400 LD004`，**实测 200**（`data` 含 `create_key_derived` ⇒ 该路径**自行派生**键、**不 fail-loud**）。这是**既有 53 条路径的既有行为**（4a **未改** `src/currency-service.ts`，§6 现取自证），**不是回归**；但**我的负例探针因此变成了一次真实写**（`POST /api/currency` 落 **2 条 `currency_create_fee` 分录**，非 `cli:qab4:*` 键）。**如实登记**，不修饰。

**首轮 3 个非 2xx 读数的独立复核（§5.7④「读数异常先怀疑自己的探针」）**：首跑 `/health` = `503`、`/api/user` = `503 LEDGER_TX_TIMEOUT`、`/api/task/all` = `500`。**复测（连续 3 次）**：`health=200`、`/api/user=200`、`/api/task/all=200` ⇒ **判定为 DB 连接瞬时抖动（Neon `fetch failed`，本单另现取 1 次）**，**非注册/行为回归**。**`GET /api/user/stats` = 403（3/3 稳定）**，为稳定的权限语义，非抖动。

**410 面（弃用）6/6**：

| 路径 | 期望 | **实测** | 判定 |
|---|--:|--:|:--:|
| `POST /api/shard/redeem` | 410 | **410** | PASS |
| `POST /api/chest/1/open` | 410 | **410** | PASS |
| `POST /api/admin/settings/reset` | 410 | **410** | PASS |
| `POST /api/admin/task/create` | 410 | **410** | PASS |
| `POST /api/admin/prize/create` | 410 | **410** | PASS |
| `POST /api/admin/assets/init` | 410 | **410** | PASS |

⇒ **410 面 6/6 未退化**（`grep -nE "sendGone\(res," src/index.ts` 现取 10 处埋点，本单抽其 6 处全部命中）。

> **判定：`PASS`**（65 命中、差集 0、抽样 5 条状态未变、410 6/6）。

---

## §4 腿 3 · 新路线独立实测（本单夹具 `cli:qab4:*`）

**口径**：本单自铸 token（HS256，`.env.local` `SECRET_KEY`，**只记 12 位指纹 `secret_fingerprint`，不落盘**）；幂等键命名空间 = **`cli:qab4:qab4191832Z:*`**。选 **1 条资金口 + 1 条写口 + 1 条管理口**（另附 A3/A4/A5）：

| # | 新路径 | 类 | status | 响应键集（`data`） | 分录腿数 / kind | 判定 |
|--:|---|---|--:|---|---|:--:|
| **A1** | `POST /api/job` | **资金口** | **200** | 17 键（`job_id,status,created,idempotent_replay,txid,ledger_idempotency_key,escrow_txid,settle_txid,ledger_event_keys,entry_count,kinds,entries,accounts,fee_credit_uid,employer_uid,cid,reward`） | **`job_escrow ×2`**（`event_root_key = biz:job:escrow:19`） | PASS |
| **A2** | `POST /api/job/:jobId/apply` | 写口（无分录） | **200** | `application_id,job_id,worker_uid,status` | **0 腿**（直 DML，符合 §1.8 #2） | PASS |
| **A11** | `POST /api/admin/commission_policy` | **管理口** | **200** | `policy_id,fee_rate_bp,levels,weights_bp,effective_from,created_by,time_created,weights_sum_bp` | **0 腿**（非资金政策面） | PASS |
| A3 | `POST /api/job/:jobId/accept` | 写口 | **200** | `application_id,job_id,worker_uid,status` | 0 腿 | PASS |
| A4 | `POST /api/job/:jobId/submit` | 写口 | **200** | `jID,tID,uID,info_input,time_created,time_submitted,time_checked,time_claimed,points_claimed` | 0 腿 | PASS |
| A5 | `POST /api/job/:jobId/review`（approve） | **资金口** | **200** | 16 键（`…submissions_reviewed`，含 `idempotent_replay`） | **`job_payout ×2 + job_fee ×2`** | PASS |

- **A11 递增约束核对**：`effective_from` 现值最大 = `2026-09-30T19:15:36.192Z`（4a 的 A11 用例 `created_by=1`，`time_created=2026-09-29T19:15:42.435Z`）；本单送 `2026-10-01T19:21:28.285Z`（严格递增）⇒ **200**（未触发 `POLICY_EFFECTIVE_BACKDATED`）。
- **A4 键集一致性（§2 母约束 F1：`POST /api/job/:jobId/submit` 与既有 `POST /api/task-progress/:identifier/submit` 键集应逐键一致）** = **`NOT_MEASURED`**（本单只测了新路径一侧；未跑对照侧）。
- **`Σtotal` / 分录归属（本 run 自证）**：`ledger_entry` **213 → 221 = +8 行**，`Σtotal` **2,020,100 → 2,020,100（不变）**。8 行分解：**4 行逐笔实测**（A5 结算，见 §2.3 的 `SETTLE_LEGS`）+ **4 行为计数推断**（A1 `job_escrow ×2` 与 `POST /api/currency` `currency_create_fee ×2`；依据 = `kinds` 字段 + `ledger_rows_post − pre = 8`，**标注为推断，非逐笔实测**）。

> **判定：`PASS`**（资金口 / 写口 / 管理口各 ≥1 条实测走通；键集与分录形态可 `grep`）。

---

## §5 腿 4 · 资金不变量

| 不变量 | 命令 | 期望 | **实测（pre / post）** | 判定 |
|---|---|---|--:|:--:|
| `Σtotal = SUM(balance+frozen)` | `SELECT COALESCE(SUM(balance+frozen),0) FROM public.account` | **2,020,100**（恒） | **2,020,100 / 2,020,100** | PASS |
| `Σbalance` / `Σfrozen` | 同上（分列） | — | **2,009,617 / 10,483**（分解读数，`account_rows = 23`） | — |
| 负值行 | `SELECT COUNT(1) FROM public.account WHERE balance < 0 OR frozen < 0` | **0** | **0 / 0** | PASS |
| `23514`（CHECK 违例） | HTTP 全 run 无 5xx；`neg_rows = 0` | 未触发 | **未触发**（无 `500`、无 CHECK 报错） | PASS |
| 分录行数 | `SELECT COUNT(1)::int FROM public.ledger_entry` | 213（QA 基线）→ **+16（4a）+ N（4a 的夹具/政策写入）** | **213（本单 pre）/ 221（本单 post，+8 本单自写）** | PASS |

> **声明**：本单 pre 现取 **213** = 4a 全部写入后的状态（4a 自报「改后 213」一致 ✔）；本单自写 **+8** 行且**均为纯转移**（`Σtotal` 不变）⇒ **本单未引入 `mint`，预期增量 = 0**（先声明，后实测 ✔）。
> **判定：`PASS`**（`Σtotal` 恒 2,020,100、负值 0、`23514` 未触发、每笔事件 `Σ(delta+frozen_delta)` 该事件内自平）。

---

## §6 腿 5 · 冻结面

**(a) `migrations/0001..0020` × `schema_migration.checksum`（`p4z-qab4-04-freeze.ts`，产物 `qab4-04-freeze.json`）**：

```
{"files_n":19,"db_rows_n":19,"match_n":19,"mismatches":[],"missing_in_db":[],"db_files_not_on_disk":[]}
0001_ledger_core.sql                                  sha 4f902d3c47508d91… match=true
0002_user_identity.sql                                sha 688b1935f6bc3006… match=true
0019_listing_deposit_platform_credit.sql              sha 48a9a4e2d506eb1f… match=true
0020_ledger_post_event_hold_family_drop_listing_deposit.sql sha 228127d89de90a0d… match=true
```

⇒ **19/19 逐文件 sha256 == 库内 `schema_migration.checksum`**（`mismatches` 空、`missing_in_db` 空、`db_files_not_on_disk` 空）；`0019` / `0020` 的哈希前缀与 spec I4 记载（`48a9a4e2…` / `228127d8…`）**一致**。**判定 PASS**。

**(b) 冻结件自 HEAD 未改（`git diff --quiet HEAD -- <f>` 现取）**：

| 文件 | `git diff --quiet HEAD` | sha256（现取，与 §1 一致） | 判定 |
|---|---|---|:--:|
| `backend-ts/src/ledger.ts` | **SAME** | `c3430e56…` | PASS |
| `backend-ts/src/ledger-errors.ts` | **SAME** | `5a671354…` | PASS |
| `backend-ts/src/commission.ts` | **SAME** | `7b5ff9b3…` | PASS |
| `backend-ts/.env.local` | **SAME** | （未打印，避免任何密钥面） | PASS |
| `frontend/**` | `git diff --stat HEAD -- frontend/` = **空** | — | PASS |

**(c) 全仓 `git status --porcelain` 现取 —— 改动面 = 仅 4a 声明的两处 + 本单三处**：

```
 M backend-ts/src/index.ts                 ← 4a（唯一 src 改动；§2.1 已逐行点名）
 M docs/seafood.master-plan.md             ← Zang 侧（非本单、非 4a：mtime/内容未由本单触碰）
?? backend-ts/.p4-artifacts/…（b4a-/qa b4/QA_B4_RUN_TAG.txt）   ← 4a 产物 + 本单产物
?? backend-ts/scripts/p4z-b4a-01-http-e2e.ts                    ← 4a 探针
?? backend-ts/scripts/p4z-qab4-{01,02,03,04}-*.ts                ← 本单探针
?? docs/audit/p4-b4a-route-registration.md                       ← 4a 报告
?? docs/qa/p4-b4a-route-registration-qa.md                       ← 本单报告
```

⇒ **`src/**` 下 4a 只动 `index.ts` 一个文件**（其余 `src/**` 无 M/?? 行）⇒ 与 4a「零服务层改动」自述**互证**。**判定 PASS**。

**(d) 产物无 token/密钥**：`grep -rlE 'e[y]J[A-Za-z0-9_-]{10}' .p4-artifacts/qab4-20260929T191832Z/ docs/qa/p4-b4a-route-registration-qa.md | wc -l` = **0** ✔（仅存 `secret_fingerprint` 12 位）。

---

## §7 附：`NOT_MEASURED` 登记（禁填 0/空）

| # | 项 | 为何未测 | 影响面 |
|--:|---|---|---|
| N1 | **A4↔既有别名键集逐键一致**（§2 母约束 F1） | 未跑对照侧 `POST /api/task-progress/:identifier/submit` | 仅 A4 的等价性断言；A4 本身 status/键集已实测 |
| N2 | **`job_fee` 有链形态 ⇒ 入 `-2`** | 无邀请链夹具；造链需 `/api/referral/bind`（**不在本单写库允许面**） | 仅 DL86 第二形态；第一形态（无链 ⇒ `-1`）已实测 |
| N3 | 4a 的 `details.reason` 逐字（A3/A6/A8-b/A11 负例） | 4a 探针只记 `code/message`；本单**未复跑其负例集**（不在本单必做腿内） | 沿用 4a 自报的 `NOT_MEASURED`（其报告 §7 事项 5 已如实登记） |
| N4 | A9/A10（商品资金）与 A7/A8（商品写口）、A6 cancel 的**本单独立复测** | 不在本单必做 3 条抽样内；**其 4a 期实测分录已在 §2.2 逐笔归因**（`listing_order/6` `purchase`/`sale`/`purchase_refund`） | 归因已证，**只差本单自跑一遍**；登记待下一 run |

---

## §8 只登记不修 · 边界自证

- **本单写面**：`docs/qa/p4-b4a-route-registration-qa.md`、`backend-ts/.p4-artifacts/qab4-20260929T191832Z/**`、`backend-ts/scripts/p4z-qab4-{01,02,03,04}-*.ts`、`backend-ts/.p4-artifacts/QA_B4_RUN_TAG.txt`。**未写**任何 `backend-ts/src/**`、`migrations/**`、`frontend/**`、`.env.local`、任何 spec、`docs/seafood.master-plan.md`、其它既有脚本/artifact。
- **禁项自证**：无 `git add/commit/push`（`git status` 现取无 staged 变更）；无删除型 SQL（仅 `SELECT` + 经 HTTP 写）；**未启停 `seafood-api`**（PID 9139 全程存活，`/health` 现取 200）；无 `npm install`；无 `execute_code`；**未用** `pkill -f` / `killall`。
- **越界自曝 1**：`POST /api/currency`（§3 #4）由「预期 400 负例」变为**真实写**（2 条 `currency_create_fee` 分录，键为路径**自派生**，非 `cli:qab4:*`）—— **如实登记**（无删除、`Σtotal` 不变）。
- **越界自曝 2**：4a 的 A11 用例已在库内落 `commission_policy` 行（`policy_id=2`，`effective_from` = 未来 24h）；本单复用同表**只读**核对其递增约束，**未修改**该行。
