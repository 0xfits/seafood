# S40b · 受控实例取证（收尾单）—— 15 门两相位 · `s7 G9` 数据态感知收口 · R1 受控复现

> 本单 = **S40 收尾单**（上一单迭代耗尽：实例/门对照/HTTP 取证已做完，报告未写、R1 未跑、门套口径未定）。
> 产物根：`backend-ts/.s40-artifacts/s40b-20261005T113427Z/`（新前缘命名，**不覆盖**已有件 `s40-20261005T112247Z/`）。
> 语言口径：全部读数为**现取**；命令与输出逐条给出；数不出来的写 `NOT_MEASURED`，不洗白。

---

## §0 开场对锚与端口/PID 清单

**对锚（开工现取）**：

```
$ git log --oneline -3
8c85a70 docs: §5.362/v0.362 —— … 我两条裁定 …+ 派 S40（受控实例取证…）   ← 开工时 HEAD
$ git rev-parse HEAD → 8c85a703ee35ab11ddbb6e2d0e5356b6cc171aed
$ git status --porcelain   → 零 tracked 改动（仅历史 untracked 产物目录）
```

**★ 会话期间 HEAD 前移（由 Zang 侧发生，非本单）**：

```
开工 HEAD = 8c85a70
收尾 HEAD = 5a2f640  （git show --stat 5a2f640 → 仅 docs/seafood.master-plan.md +13 行，= 本单的派单回执 commit）
```

⇒ 该前移**未触碰**本单任何在改文件（`backend-ts/scripts/**` / `docs/audit/**`），对本单读数为零影响。**收尾时 tracked 改动 = 恰 1 件**：
`M backend-ts/scripts/p8-s7-batt-checkin-gate.ts`（= `s7 G9` 门侧修为，§5）。

**端口/PID 清单（现取 · 开工与收尾各一次）**：

| 端口 | 归属 | 开工 | 收尾 |
|---|---|---|---|
| 5787 | 他人（node，pid 30475） | LISTEN | **LISTEN（未受影响）** |
| 5788 | 他人（node，pid 65096） | LISTEN | **LISTEN（未受影响）** |
| 5555 | 他人（node，pid 61000） | LISTEN | **LISTEN（未受影响）** |
| 5191 | 他人（Python，pid 61407） | LISTEN | **LISTEN（未受影响）** |
| **5792** | **本单受控实例** | 开工前空 | **起→用→按精确 PID 收尾后空** |
| 5793–5799 | 保留 | 未占用 | **全空** |

> 上一单子代理的 5792 实例**已随其终止**；本单开工 `lsof` 复核 `5790-5799` = 空，遂起本单实例（唯一）。

---

## §1 实例启动与收尾证据

**启动**（仅 `5792`；只许 `5792–5799`；绝未碰 `5787/5788/5555/5191`）：

```
$ cd backend-ts && PORT=5792 npx ts-node --transpile-only src/index.ts   （后台）
$ cat instance-5792.stdout
TypeScript backend running on port 5792
Using Neon PostgreSQL for Seafood API routes
$ curl -s http://127.0.0.1:5792/health
{"ok":true,"db_version":"PostgreSQL 18.6 …","schema_version":"0043","time":"2026-10-05T11:41:18.897Z"}
$ lsof -nP -iTCP:5792 -sTCP:LISTEN
node  20803 kevin  15u  IPv6 …  TCP *:5792 (LISTEN)
```

* 进程树：`20424 npm exec ts-node …` → `20803 node …/ts-node …`（**监听 PID = 20803**）。
* 就绪判定：`/health` 轮询首次即 `200`（≤1s），**非盲等**。

**收尾**（按**精确 PID** 收，未用 `pkill -f`/`killall`）：

```
$ kill 20803 ; sleep 2 ; kill 20424 ; sleep 1
$ lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(579[2-9])\b'   → （5792-5799 全空 ✔）
$ lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(5787|5788|5555|5191)\b'
node 30475 … :5787 (LISTEN)   node 61000 … :5555   Python 61407 … :5191   node 65096 … :5788   ← 四人监听**未受影响**
$ ps -p 20424,20803   → （两 PID 已退出，无残留）
```

> ✔ **收尾 `lsof` 验释放：`5792–5799` 全空**；他人端口四条逐一在列、无恙。与本单开工复核（`5790-5799` 空）对称。

---

## §2 门 base URL 机制（现取 · **全 env 可覆写，未硬编码 5788**）

门打受控实例的 base URL **全部经 `process.env` 覆写**，逐门现取：

| 门 | 现取机制 | 缺省值（仅缺 env 时） |
|---|---|---|
| `p8-s7-batt-checkin-gate.ts:648` | `process.env.P8S7_BASE` | `http://127.0.0.1:5797` |
| `p8-s8-rating-timeliness-gate.ts:752` | `process.env.P8S8_BASE` | `http://127.0.0.1:5797` |
| `p8-s10-invite-reward-gate.ts:430` | `process.env.P8S10_BASE` | `http://127.0.0.1:5796` |
| `p8-s11-audit-console-gate.ts:549` | `process.env.P8S11_BASE` | `http://127.0.0.1:5797` |
| `p8-s5-02-ownership-gate.ts:24` | `http://127.0.0.1:${process.env.PORT \|\| '5796'}` | `PORT` 缺省 `5796` |

* 本单门套 runner（`run_gates_s40b.sh`）把上列**全部**覆写为 `http://127.0.0.1:5792` 且 `export PORT=5792`。
* 服务进程侧：`src/index.ts:91 **const PORT = Number(process.env.PORT || 5788)**` ⇒ 亦 env 可覆写（默认 5788，非写死）。
* 结论：**门 base URL 与实例端口皆 env 驱动；5788 只是服务默认值，门缺省是 5796/5797，均被 runner 覆写为 5792**。

---

## §3 ★ 15 门前后逐门对照（门集现取 · 两相位）

**★ 门集口径（Zang 裁定 #1 · 逐字执行）= `15 门`**，显式集合：

```
① p8-s1-app-config-gate        ② p8-s2-fee-rebate-gate     ③ p8-s3-deposit-gate
④ p8-s3b-address-gate          ⑤ p8-s4-currency-review-gate ⑥ p8-s5-02-ownership-gate   ← 具 HTTP 腿
⑦ p8-s5-compliance-gate        ⑧ p8-s6-site-text-gate      ⑨ p8-s7-batt-checkin-gate
⑩ p8-s8-rating-timeliness-gate ⑪ p8-s9-bttc-gate           ⑫ p8-s10-invite-reward-gate
⑬ p8-s11-audit-console-gate    ⑭ s36-00-identity-pk-form-gate ← S36b 新立独立门（本单补齐）
⑮ p7b-03-offline-gates
```

* 13 基线 = ①②③④⑤⑦⑧⑨⑩⑪⑫⑬⑮ ＋ 显式两条 = ⑥ 与 ⑭ ⇒ 合 **15**。
* runner：`backend-ts/.s40-artifacts/s40b-20261005T113427Z/run_gates_s40b.sh`（两相位各跑 15 门，`--json` 落 `s36-00`）。
* 相位定义：**before = 无受控实例**（`5792-5799` 空）；**after = 实例起于 `5792`**。
* 命令：`.s40-artifacts/s40b-20261005T113427Z/run_gates_s40b.sh before|after`（base 全指 `http://127.0.0.1:5792`）。

| # | 门 | 基数(total) | **before**（无实例） | **after**（5792 起） |
|--:|---|--:|---|---|
| 1 | p8-s1-app-config-gate | 24 | EXIT 0 · 24/24 | EXIT 0 · 24/24 |
| 2 | p8-s2-fee-rebate-gate | 44 | EXIT 0 · 44/44 | EXIT 0 · 44/44 |
| 3 | p8-s3-deposit-gate | 45 | EXIT 0 · 45/45 | EXIT 0 · 45/45 |
| 4 | p8-s3b-address-gate | 38 | EXIT 0 · 38/38 | EXIT 0 · 38/38 |
| 5 | p8-s4-currency-review-gate | 79 | EXIT 0 · 79/79 | EXIT 0 · 79/79 |
| 6 | p8-s5-02-ownership-gate | 6 | **EXIT 2 · fetch failed** | EXIT 0 · **6/6** |
| 7 | p8-s5-compliance-gate | 117 | EXIT 0 · 117/117 | EXIT 0 · 117/117 |
| 8 | p8-s6-site-text-gate | 64 | EXIT 0 · 64/64 | EXIT 0 · 64/64 |
| 9 | p8-s7-batt-checkin-gate | 60 | **EXIT 1 · 57/60（G8/G9/G10 红）** | EXIT 0 · **60/60** |
| 10 | p8-s8-rating-timeliness-gate | 92 | **EXIT 1 · 89/92（H5/H6/H7 红）** | EXIT 0 · **92/92** |
| 11 | p8-s9-bttc-gate | 100 | EXIT 0 · 100/100 | EXIT 0 · 100/100 |
| 12 | p8-s10-invite-reward-gate | 49 | **EXIT 1 · 48/49（K8 红）** | EXIT 0 · **49/49** |
| 13 | p8-s11-audit-console-gate | 87 | **EXIT 1 · 86/87（K10 红）** | EXIT 0 · **87/87** |
| 14 | **s36-00-identity-pk-form-gate** | 门自证 | EXIT 0 · **188 受体 / 30 命中 / 基线 30 / 新增 0 · GREEN** | EXIT 0 · **同左（相位不变）** |
| 15 | p7b-03-offline-gates | — | EXIT 0 | EXIT 0 |

> **★ `s36-00` 补齐读数**（本单新增门 · 离线零 DB/网络 ⇒ **两相位逐字相同**）：
> `[自证] 扫描面=3层(src:20文件/23受体 migrations:42文件/36受体 scripts:298文件/129受体) 受体数=188 命中数=30 基线数=30 新增=0 出带显式给号=5(floor=900000000)`；`verdict=GREEN, exit_code=0`（`baseline_count=30`，`new_hits=[]`，`stale_baseline_entries=[]`）。

### §3.1 「8 红」逐条（before 相位 HTTP 腿 · 现取 actual）

| # | 门·check | before 读数（actual） | 归类 | after（新门/实例） |
|--:|---|---|---|---|
| 1 | s7 **G8** | `{"no_token":{…全 -1},"err":null}` | fetch failed（无实例） | ✅ 401×4 |
| 2 | s7 **G9** | `{"resp":{"status":-1,"body":null},"shape_ok":false}` | fetch failed（无实例） | ✅ 见 §5（数据态感知 ⇒ 200 replayed） |
| 3 | s7 **G10** | `{"status":-1}` | fetch failed（无实例） | ✅ 200 |
| 4 | s8 **H5** | `{"no_token":{},"err":"fetch failed"}` | fetch failed | ✅ |
| 5 | s8 **H6** | `{"read_200":{}}` | 空（无实例） | ✅ |
| 6 | s8 **H7** | `{"write_bad":{}}` | 空（无实例） | ✅ |
| 7 | s10 **K8** | `{"pub":-1,"no_tok_batt":-1,"tok_batt":-1,"err":"fetch failed"}` | fetch failed | ✅ |
| 8 | s11 **K10** | `{"no_tok":-1,…,"err":"fetch failed"}` | fetch failed | ✅ |

* **7 条 = 纯「实例不在场」**（HTTP 传输层失败），after 相位**逐条转绿**。
* **第 8 条（`s7 G9`）= 数据依赖型假红**（非 fetch failed · 非产品回归）—— 见 §5：**根因已实测**（`POST /api/checkin/makeup` 对已补签 actor ⇒ **409** + `LEDGER_CURRENCY_INVALID_TRANSITION` + `details.reason=CHECKIN_MAKEUP_TARGET_INVALID`），**门侧修为「数据态感知」后转绿且判据未放宽**。

> 备注：上一单（旧门）after 相位 = 57→58/59，`s7 G9` **仍红**（旧判据硬「必 200」，实测 409）⇒ 「7 转绿」。本单新门 after 相位 `s7` = **60/60**（G9 数据态感知）⇒ **8/8 全绿**。

---

## §4 Part II · 逐端点真响应体逐字与 S32c 预期对拍

**探针**：`s40b-http-probe.ts`（= 上一单探针逐字复用），打 `BASE=http://127.0.0.1:5792`（本单实例）。
**产物**：`partII-endpoints-nocred.json`（16 端无凭证）· `partII-endpoints-token.json`（6 端带 token）。
**预期真源（现取）**：`docs/audit/s32c-senderror-migration-executed.md §1`（16 处 `status || code || i18n_key || message || details` 逐字表）。

**① 与上一单（`s32c-endpoints*.json`）逐字对拍 —— 22/22 响应体 byte-identical：**

```
无凭证 16 端: 16/16 逐字相同（status + body 全等）
带 token 6 端:  6/6  逐字相同
```

**② 与 S32c §1 预期（status + code + details.reason）对拍 —— 22/22 一致：**

| # | 方法 路径 | 凭证 | 实测 status | 实测 code | 实测 details.reason | §1 预期 | 判定 |
|--:|---|---|--:|---|---|---|---|
| 3 | POST /api/auth/verify | 无 | 401 | `AUTH_UNAUTHORIZED` | `{}` | 401 `AUTH_UNAUTHORIZED` | ✔ |
| 4 | GET /api/task/abc | 无 | 404 | `LEDGER_REF_NOT_FOUND` | `tID_not_found` (ref_type `job`) | 404/`…`/`tID_not_found` | ✔ |
| 5 | GET /api/prize/abc | 无 | 404 | `LEDGER_REF_NOT_FOUND` | `bID_not_found` (ref_type `prize`) | ✔ | ✔ |
| 6 | GET /api/prize/999999999 | 无 | 404 | `LEDGER_REF_NOT_FOUND` | `prize_not_found` | ✔ | ✔ |
| 9 | GET /api/user/asset/abc | 无 | 404 | `LEDGER_REF_NOT_FOUND` | `uID_not_found` (ref_type `user`) | ✔ | ✔ |
| 10 | GET /api/task-progress/abc | 无 | 401 | `AUTH_UNAUTHORIZED` | `{}` | 401（凭证先于校验） | ✔ |
| 10 | GET /api/task-progress/abc | **token** | 404 | `LEDGER_REF_NOT_FOUND` | `jID_not_found` (ref_type `job_submission`) | ✔ | ✔ |
| 11 | GET /api/task-progress/999999999 | **token** | 404 | `LEDGER_REF_NOT_FOUND` | `jID_not_found` | ✔ | ✔ |
| 12 | POST /api/task-progress/abc/submit | 无 | 401 | `AUTH_UNAUTHORIZED` | `{}` | 401 | ✔ |
| 12 | POST /api/task-progress/abc/submit | **token** | 404 | `LEDGER_REF_NOT_FOUND` | `job_not_found` (ref_type `job`) | ✔ | ✔ |
| 16 | GET /api/market/abc/orderbook | 无 | 404 | `LEDGER_REF_NOT_FOUND` | `bID_not_found` (ref_type `brand`) | ✔ | ✔ |
| 17 | GET /api/market/abc/trades | 无 | 404 | `LEDGER_REF_NOT_FOUND` | `bID_not_found` (ref_type `brand`) | ✔ | ✔ |
| 24 | POST /api/translate/backfill | 无 | 401 | `AUTH_UNAUTHORIZED` | `{}` | 401 | ✔ |
| 25 | GET /api/this-endpoint-does-not-exist | 无 | 404 | `LEDGER_REF_NOT_FOUND` | `route_not_found` (ref_type `endpoint`) | ✔ | ✔ |
| 25b | GET /definitely/not/registered/xyz | 无 | 404 | `LEDGER_REF_NOT_FOUND` | `route_not_found` | ✔ | ✔ |
| 8 | POST /api/user/profile | 无 | 401 | `AUTH_UNAUTHORIZED` | `{}` | 401 | ✔ |
| 8 | POST /api/user/profile（缺 bio） | **token** | 400 | —（**§2 保留面**旧形状 `{"success":false,"message":"bio is required","error":"bio is required"}`） | — | 400 `bio is required`（`§2 #7` 只登记不改） | ✔ |
| 14 | GET /api/shard | 无 | 401 | `AUTH_UNAUTHORIZED` | `{}` | 401 | ✔ |
| 14 | GET /api/shard | **token** | 200 | — | `{"success":true,"message":"OK","data":[],"deprecated":true}` | 200（非违约基线） | ✔ |
| 15 | GET /api/shard/transfer | 无 | 401 | `AUTH_UNAUTHORIZED` | `{}` | 401 | ✔ |
| 15 | GET /api/shard/transfer | **token** | 200 | — | 同 #14（`deprecated:true`） | 200 基线 | ✔ |
| 21 | POST /api/admin/points/adjust | 无 | 401 | `AUTH_UNAUTHORIZED` | `{}` | 401（**需 admin**，三分派 400 面不可达，见 §7） | ✔（仅 401 面） |

> **无凭证 16 端 + 带 token 6 端 = 22 条真响应体，全部与 S32c 预期逐字一致。**

---

## §5 ★ 门侧修为：`s7 G9` 改「数据态感知」（Zang 裁定 #2 · 判据**未放宽**）

### §5.1 改动（逐处留痕 · 供审 revert）

* **唯一被改文件**：`backend-ts/scripts/p8-s7-batt-checkin-gate.ts`（`git diff`：`110 insertions(+), 8 deletions(-)`）。
* 改动点：
  1. `import { … , DatabaseService, … } from '../src/database'`（+1 行，读 `checkin_policy` 现取 `makeupCostUsd`）。
  2. `api()` 由「只回 `{status, success}`」改为**回完整响应体** `{status, success, body}`；传输层失败 ⇒ `status:-1`（不吞）。
  3. **G9 主体重写**（新增 `makeupState` 现取读库 + 由数据态推唯一期望分支 + 状态码/形状双断言）。
  4. 新增 `G9__selftest` 判负；`readings` 增 `makeup_state`。

### §5.2 G9 判据（由数据态推「唯一期望」，非「接受任意码」）

先**现取**该 actor 对该 `target_day`（`prevBusinessDay()`）的补签数据态（读库 4 布尔 + 余额 + 成本）：

```
applied_target = ∃ applied 补签行 (uid,target_day)
checkin_target = ∃ 签到行 (uid,target_day)
today_row      = ∃ 补签行 (uid, makeup_day=今日UTC)
key_row        = ∃ 补签行 (uid, idempotency_key='biz:checkin:makeup:<uid>:<target>')
```

再**推出唯一期望分支**（逐条对齐产品 SQL `database.ts checkinMakeup` 的 `CASE`/`ON CONFLICT(uid,makeup_day)`）：

| 数据态 | 分支 | 期望 status | 期望响应体形状（**逐字断言**） |
|---|---|--:|---|
| `today_row=false` ∧ 未补签 ∧ 未签到 ∧ 余额≥成本 | `a_applied` | **200** | `success===true` ∧ `data` 键集**恰** `{costUsd,restoredStreakDay,txid}` |
| `today_row=false` ∧ （已补签 ∨ 已签到） | `b_target_invalid` | **409** | `error.code='LEDGER_CURRENCY_INVALID_TRANSITION'` ∧ `details.field='checkin_makeup'` ∧ `details.reason='CHECKIN_MAKEUP_TARGET_INVALID'` |
| `today_row=false` ∧ 余额<成本 | `d_insufficient` | **409** | `error.code='LEDGER_INSUFFICIENT_BALANCE'` ∧ `details.field='checkin_makeup'` |
| `today_row=true` ∧ `key_row=true`（今日已有留痕 ∧ 同键） | `b_replayed` | **200** | 同 `a` 形状 **∧** `idempotent_replay===true` |
| `today_row=true` ∧ `key_row=false` | `c_daily_limit` | **409** | `…code='LEDGER_CURRENCY_INVALID_TRANSITION'` ∧ `details.reason='CHECKIN_MAKEUP_DAILY_LIMIT'` ∧ `details.field='checkin_makeup'` |

> **硬约束落地**：`g9Pass = (httpErr===null) ∧ (resp.status ≠ -1) ∧ (resp.status === expected_status) ∧ shape_ok`。
> ⇒ **任分支皆断言 status + 响应体形状**；**`fetch failed`/`status:-1` 一律判负**；**无「任意码放行」路径**；**未删断言**（分母 59→**60**，+1 判负 selftest，**只增不减**）。

### §5.3 为何是「数据态感知」而非「两分支选一」（现取证据：两分支不可同时单纯可测）

* 门选 actor = 最低 `uid`（余额≥100 非 admin）= **uid 2**（现取：`probe-actor-state.ts` → `gate_actor_uid=2`）。
* 现取 DB（`probe-branch-feasibility.ts`）：`madeUpCleanCandidates = []` —— **当前不存在「今日无补签留痕 ∧ 已补签某 target」的干净 actor**（仅 uid2/uid12 有 applied 行，且二者今日均已被留痕行污染）。⇒ 单纯「干净两分支」**无法稳定同时覆盖 (a)/(b)**；而 uid2 的真实态恰为 `today_row=true ∧ key_row=true` ⇒ 产品确定返 **200 replayed**（非 409）。若硬用「已补签⇒必 409」即**假红**（旧门即此病）。
* 故判据 = **完整数据态模型**（含 (a)/(b) 两分支为其中 `today_row=false` 的特例）——每个状态**断言一个具体 code + 形状**，**判据强化而非放宽**。

### §5.4 前后读数（同门 · 同实例相位）

| 相位 | G8 | **G9** | G9__selftest | G10 | s7 total |
|---|---|---|---|---|---|
| before（无实例） | ❌ `status -1` | ❌ `resp.status=-1`（expected 200 ⇒ 不符） | ✅ | ❌ -1 | 57/60 |
| after（5792 起） | ✅ | ✅ | ✅ | ✅ | **60/60** |

**G9 after 逐字 actual**：

```json
{"state":{"actor_uid":2,"target":"2026-10-02","applied_target":true,"checkin_target":false,
          "today_row":true,"key_row":true,"balance":"7500","cost_usd":100,
          "branch":"b_replayed","expected_status":200,"expected":"replayed"},
 "resp":{"status":200,"body":{"success":true,"message":"Makeup done (idempotent replay)",
          "data":{"restoredStreakDay":1,"costUsd":100,"txid":"735"},"idempotent_replay":true}},
 "shape_ok":true,"err":null}
```

**before 逐字 actual**（证 `status:-1` 被**判负**，非放行）：

```json
{"state":{…"branch":"b_replayed","expected_status":200…},"resp":{"status":-1,"body":null},"shape_ok":false,"err":null}
```

### §5.5 判负（`G9__selftest`）

四形状谓词（`judge200 / judge409Target / judge409Daily / judge409Insuff`）各喂「对 / 错状态码 / 错形状」三例：

```
judge200(200+三键) = true ; judge200(409+空body) = false ; judge200(200+缺键) = false
judge409Target(409+正确码/形) = true ; judge409Target(200) = false ; judge409Target(409+错码) = false
judge409Daily(409+DAILY_LIMIT) = true ; judge409Daily(409+TARGET_INVALID) = false
judge409Insuff(409+INSUFFICIENT_BALANCE) = true ; judge409Insuff(409+错码) = false
⇒ G9__selftest = PASS（{"fired":true}）
```

> **根因（实测）**：`POST /api/checkin/makeup` 对「已补签/已签到」`target_day` ⇒ 409 + `LEDGER_CURRENCY_INVALID_TRANSITION` + `details.reason=CHECKIN_MAKEUP_TARGET_INVALID` + `details.field=checkin_makeup`（**业务态拒绝**，**非 fetch failed、非产品回归**；DB 证据 `checkin_makeup_log log_id=60 result=applied (uid2,target 2026-10-02)`）。旧门「必 200」据此**假红**。

---

## §6 R1 受控复现（SAVEPOINT 版 · 已修 `policy_id` 漏给号缺陷）

**探针**：`.s40-artifacts/s40b-20261005T113427Z/s40b-r1.ts`（**新写**；修正上一单 `s40-r1.ts` 的实质缺陷：其 `names` 含 identity 列 `policy_id` ⇒ 实际显式喂 `NULL` ⇒ **nextval 未触发**，`nextval_consumed=0`，R1 机理**未被验到**）。
**产物**：`r1-repro.json`。

**机制（现取）**：`public.commission_policy` 有 `trg_commission_policy_weights_guard`（**BEFORE INSERT OR UPDATE FOR EACH ROW** → `commission_policy_weights_guard()`，在 `sum(weights_bp)=0` 时 `RAISE EXCEPTION … USING ERRCODE='23514'`）；`policy_id = GENERATED BY DEFAULT AS IDENTITY`。INSERT **省略** `policy_id` ⇒ 取 `nextval`；随后 BEFORE 触发器 RAISE ⇒ 该行丢弃，**但 PG 序列不随回滚**。

**事务口径**：`withTransaction`（`BEGIN`）→ `SAVEPOINT s40b_r1` → `INSERT`（触发 RAISE）→ `catch` = `ROLLBACK TO SAVEPOINT s40b_r1` → **同事务内续读**（证 SAVEPOINT 回滚生效）→ 显式 `throw` 终止 ⇒ 整体 `ROLLBACK`。

**四项读数（逐字）**：

```
seq_before                         = { last_value: 35, is_called: true }
seq_in_tx_after_savepoint_rollback = { last_value: 36, is_called: true }   ← nextval 已耗（同事务内可见）
seq_after_rollback                 = { last_value: 36, is_called: true }   ← ★ 整体回滚后仍为 36 ⇒ 不回退
count_before                       = 4
count_in_tx_after_savepoint_rollback = 4
count_after_rollback               = 4
raise_error = { code: "23514", sqlstate: "23514", message: "commission_policy_weights_guard: sum(weights_bp) = 0 (degenerate denominator W = 0)" }
inserted_pk_returned = null
residue_rows = 0                     ← ★ 残留 = 0（表行数前后相等）
nextval_consumed = 1                 ← ★ 成本：序列被永久推进 1
nextval_rollback_not_possible = true
```

* **ERRCODE/SQLSTATE** = `23514 / 23514`（`check_violation`，由触发器 `USING ERRCODE`）。
* **残留 = 0 证据**：`count_after_rollback - count_before = 0`，且 `inserted_pk_returned=null`（行未落）。
* **★ 成本登记**：**`nextval` 不可回滚** —— 本次实验令 `commission_policy_policy_id_seq` **永久 35→36**（实测 `seq_after_rollback=36`）。序列耗值**非数据残留**（无行、无余额变动），但**不可逆**。
* 探针**可判负**：上一单缺陷版（显式喂 `policy_id=NULL`）= `nextval_consumed=0` ⇒ **证伪 R1 机理**；本版省略 identity-PK ⇒ `nextval_consumed=1` ⇒ **证成**。

---

## §7 未做与 `NOT_MEASURED`（逐条，不洗白）

1. **`#21 POST /api/admin/points/adjust` 三分派 400 面**（`§1.B.21`：`{field:'uid'|'amount'|'reason', reason:'MISSING'}`）—— **NOT_MEASURED**：需 **admin 会话 token** 且构造缺字段体；本单只测到无凭证 **401**（正确但因缺 admin 凭证不可达其 400 分支）。
2. **`#8 POST /api/user/profile` 的 404 `user_not_found` 分支** —— **NOT_MEASURED**：需「有效 token（已建户）+ 该 uid 不存在」的矛盾态；本单只测到 401（无凭证）与 400 `bio is required`（带 token 缺 bio）。
3. **`#14/#15` 的 `sendInfraMapped` 分类器分支**（`§1.C`：infra ⇒ 503 `LEDGER_TX_TIMEOUT` / 真缺陷 ⇒ 500 `LEDGER_TRANSACTION_REQUIRED`）—— **NOT_MEASURED**：需**诱导库/传输层故障**方可触发；本单只测到 401（无凭证）与 200 `deprecated:true`（带 token 非违约基线）。
4. **`§2` 保留 9 处**（`#1 register` 410 / `#2 challenge` 400 / `#7 profile` 400 / `#13/#22 info_input required` 400 / `#18/#19/#20` admin permission 400 / `#23 CRON_SECRET` 503）—— **NOT_MEASURED**（其中 `#7 **bio is required` 400 已由 s32cTok 覆盖，其余未逐端取真响应体）。
5. **`s7 G9` 的 `a_applied` / `d_insufficient` / `c_daily_limit` 三分支的真 HTTP 实测** —— **NOT_MEASURED**（本轮 actor uid2 数据态 = `b_replayed`；其余分支**谓词已由 `G9__selftest` 判负证成**，但**未在活体实例上逐分支取真响应体**）。
6. **`s5-02` before 相位门内读数** —— **NOT_MEASURED**：无实例 ⇒ 探针 `fetch failed` 即退 `EXIT 2`，无 `total/passed` 行（after 相位 = **6/6**）。
7. **`p7b-03-offline-gates` 内部计数** —— 其 stdout 无 `SUMMARY total=` 行（门自证形式不同），本报表只记 `EXIT 0`，**未逐条列其内部断言数**。
8. **前端 `frontend/**` 任何读数** —— 本单未触（硬口径禁止改前端，且门套不覆盖前端）。

---

## §8 自曝

1. **门跑真 DB 写**：本单**两相位各跑 15 门**（before/after），`s7/s8/s10/s11` 含 HTTP 写路径。经快照对拍（`db-snapshot-pre.json` vs `db-snapshot-post.json`）：
   * **表行数净变化 = 0**（18 张关键表逐一相等；并扫全部 **34 张 public 基表**凡有 `time_created/created_at` 者，`>= 2026-10-05 11:38Z` 的**新行 = 0**，`probe-net-writes.ts`）。
   * **序列被耗（不可回滚 · 无行落）**：`checkin_makeup_log_log_id_seq 103→104` · `checkin_log_log_id_seq 255→257` · `batt_entry_txid_seq 653→659` · `ledger_entry_txid_seq 2611→2629` —— 来自门内 `ON CONFLICT` 插入与 `ROLLBACK` 事务（nextval 先于回滚求值）。
2. **上一单既有真 DB 写（本单承接、非本单新增）**：`checkin_log` 含 uid2 的 `2026-10-05` 行（streak_day 1）；`checkin_makeup_log` 含 **uid2 `log_id 99`**（`makeup_day 2026-10-05 · result rejected_target_invalid`）与 **uid12 `log_id 102`**（同形）等留痕行 —— 均由**上一单** gate/probe 生产，**本单未再新增**。
3. **R1 成本**：`commission_policy_policy_id_seq` 因 R1 受控复现**永久 35→36**（§6）；无行、无余额变动。
4. **实例**：本单自起 `5792` 唯一实例，**已按精确 PID（20803 / 20424）收尾**，`lsof` 证 `5792-5799` 全空、`5787/5788/5555/5191` 无恙；**未起 5793-5799**；**未用 `pkill -f`/`killall`**。
5. **门套两相位重复跑**对同一实例 `5792` 打 HTTP，属受控只读/幂等面 + `s7` 单次 makeup（幂等重放）——净写 0（见第 1 条）。
6. **`s36-00`** 为离线只读门（零 DB/网络），**无副作用**。
7. **未 `npm install` / 未 commit / 未 push / 未改 `src|frontend|migrations|*.spec.md|OPEN-ITEMS|master-plan`**；未打印任何 token/密钥/连接串。

---

## §9 产物清单（新前缘 `s40b-20261005T113427Z/` · 未覆盖既有件）

**门侧改动（唯一 tracked 改动）**
* `backend-ts/scripts/p8-s7-batt-checkin-gate.ts`（`s7 G9` 数据态感知；`+110 / -8`；`git diff` 可 extract 以 revert）。

**报告**
* `docs/audit/s40-live-instance-evidence.md`（本文件）。

**产物根 `backend-ts/.s40-artifacts/s40b-20261005T113427Z/`**

| 件 | 内容 |
|---|---|
| `run_gates_s40b.sh` | 15 门两相位 runner（base 全指 5792） |
| `before/` · `after/` | 15 门 × 2 相位原始 stdout + `_summary.txt` + `s36-00…json` |
| `instance-5792.stdout` | 实例启动日志（端口 5792） |
| `partII-endpoints-nocred.json` | Part II 无凭证 16 端真响应体 |
| `partII-endpoints-token.json` | Part II 带 token 6 端真响应体 |
| `s40b-http-probe.ts` | Part II 探针（复用逐字） |
| `s40b-r1.ts` · `r1-repro.json` | R1 受控复现探针 + 四读数 |
| `db-snapshot.ts` · `db-snapshot-pre.json` · `db-snapshot-post.json` | 门跑净写对照（18 表 + 6 序列 + 逐行） |
| `probe-net-writes.ts` | 全 34 表「新行 = 0」核对 |
| `probe-tx-savepoint.ts` | SAVEPOINT 语义实测（驱动能力） |
| `probe-cp-shape.ts` | `commission_policy` 表形/触发器/函数现取 |
| `probe-actor-state.ts` | 门 actor 选择 + makeup 数据态分布 |
| `probe-branch-feasibility.ts` | 两分支可行性（`madeUpClean=[]` 证据） |

**既有件（上一单 · 本单只读，未覆盖）**：`backend-ts/.s40-artifacts/s40-20261005T112247Z/`（`run_gates_s40.sh` · `before/`+`after/` · `s32c-endpoints*.json` · `s7-g9-*.json` · `r1-discovery.json` · `s40-r1.ts` · `s40-http-probe.ts` · `db-read.json`）。

---

### 验收自检（AC）

| AC | 结果 |
|---|---|
| 1. 15 门两相位读数齐（含 `s36-00`） | ✅ §3（15×2；`s36-00` = 188/30/30/0 GREEN 两相位同） |
| 2. `s7 G9` 数据态感知收口且判据未放宽（逐条前后 + 判负） | ✅ §5（前后读数 + 5 分支唯一期望 + selftest；分母 59→60 只增） |
| 3. R1 四读数 + 残留 0 | ✅ §6（seq 35→36 · 行 4/4/4 · ERRCODE 23514 · residue 0 · nextval 不可回滚已登记） |
| 4. §7 逐条 `NOT_MEASURED` 不洗白 | ✅ §7（8 条） |
| 5. 零 tracked 改动除允许面 | ✅ 仅 `backend-ts/scripts/p8-s7-batt-checkin-gate.ts`（`git status --porcelain -uno`） |
| 6. 起实例 ⇒ 收尾 `lsof` 验释放 | ✅ §1（20803/20424 精确收；5792-5799 全空；5787/5788/5555/5191 无恙） |
| `npx tsc --noEmit` exit 0 | ✅ `tsconfig.json` EXIT 0 |
| `tsconfig.scripts.json` 新增错 = 0 | ✅ 基线 96 / 现 96（差 0；`p8-s7` 唯一错为既有 `TS2322`，仅行号 563→564 随 import 位移） |
