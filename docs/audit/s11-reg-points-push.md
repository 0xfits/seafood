# S11 注册点冻结面前推报告 —— `88 → 89`（全仓现取 · **11 门**）+ 逐门复跑

- **单**：S11 注册点冻结面前推（**全仓现取** · 逐处 `88 → 89` · 逐门复跑；**不 commit / 不 push**）
- **执行**：Kong · 2026-10-04（CST）
- **基线**：`f00d5ee`（开工 `git log --oneline -1` 现取，一致）
- **触发**：`REG_POINTS_FROZEN = 88` vs 现取实际 **89**（归因 = S6 新增 `GET /api/job/:jobId/submissions`，见 §1.3）
- **定性**：**合法前推**（非缺陷、非漏测）；**未放宽 / 未删任何判据**（仅前推期望值 + 同步文案 / 注释，历史注释行一律保留）。
- **硬口径**：不 commit / 不 push ✓ · 未起服务 / 未占端口（禁占 `5793–5799`，未启停 `5787/5788`）✓ · 禁 `pkill -f`/`killall` ✓ · 连库仅由 `backend-ts/.env.local` 自动加载（**未复制 / 未回显**）✓ · 未 `npm install` ✓
- **改动文件面**：仅 `backend-ts/scripts/*.ts`（**11 文件**）+ 本报告 `docs/audit/s11-reg-points-push.md`；**未碰** `backend-ts/src/**`（含 `index.ts`）· `frontend/**` · `migrations/**` · `docs/*.spec.md`。

---

## ① 全仓现取 —— 落点清单（`scripts/` ∪ `src/`）

**现取模式**：`REG_POINTS_FROZEN` · `REG_COUNT ===` · `PER_VERB_FROZEN` · `route_registrations ===` · 字面 `88` · `注册点`（`scripts/` ∪ `src/` ∪ `frontend/` 全域）。

### 1.1 真值（两路口径，**均 = 89**）

| 口径 | 命令 / 定义 | 读数 |
|---|---|---|
| ① `grep -c`（容忍前置空白，= 门 `ROUTE_REG_RE` 口径） | `grep -cE '^[[:space:]]*app\.(get\|post\|put\|patch\|delete)\(' src/index.ts` | **89** |
| ① `grep -c` 逐 verb | 同上 `-oE` 后 `sort\|uniq -c` | `get 38 / post 48 / put 0 / patch 1 / delete 2`（和 = **89**） |
| ② 列 0 口径（`R-8-20` 旧列） | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' src/index.ts` | **89** |
| ③ 门自带 `countRoutes`/`REG_COUNT` | `ROUTE_REG_RE = /^[ \t]*app\.(get\|post\|put\|patch\|delete)\(/gm` | **89**（复跑断言转绿，见 §3） |

> 两路口径一致 = **89**。改前门内冻结值 = **88**（`get 37` 起）⇒ 差额 **+1 = get**。

### 1.2 ★ 落点清单（**11 门** = 派单给定 7 门 + 全仓现取补全 4 门）

派单给定「已知 7 门」= `p8-s3/s3b/s4/s5/s9/s10/s11`；**全仓现取另得 4 门同持该冻结面**（均为 `REG_POINTS_FROZEN` + `PER_VERB_FROZEN`）⇒ **经 S6 归因确认同族**，**一并前推**：`p8-s2`（**字面 `REG_COUNT === 88`**，无常量）· `p8-s6` · `p8-s7` · `p8-s8`。

| # | 文件:行（**前推后**行号） | 现形（改前） → 改后 | 类型 | 该门用途判据 |
|---|---|---|---|---|
| 1 | `p8-s2-fee-rebate-gate.ts:72` | `REG_COUNT === 88,` → `=== 89,`（**字面**） | 断言 | `A1`（`readRouteRegistered`） |
| 2 | `p8-s2-fee-rebate-gate.ts:73` | 文案 `注册点 = 88（… 审计台统一读口 +1 = 88）` → `= 89（…+1〔88〕⇒ S6 新增 GET /api/job/:jobId/submissions +1 = 89）` | 断言外显文案 | 同上 |
| 3 | `p8-s3-deposit-gate.ts:68` | `const REG_POINTS_FROZEN = 88;` → `89;` | 常量 | `E1` / `E1b`（负对照） |
| 4 | `p8-s3b-address-gate.ts:65` | 同上 | 常量 | `G1` |
| 5 | `p8-s4-currency-review-gate.ts:63` | 同上 | 常量 | `A1` / `A8`（负对照） / `F1` |
| 6 | `p8-s5-compliance-gate.ts:72` | 同上 | 常量 | `A1` / `A1b` / `A14`（负对照） / `F1` |
| 7 | `p8-s6-site-text-gate.ts:72` | 同上 | 常量 | `A1` / `A2` / `A3` / `A8`（负对照） |
| 8 | `p8-s6-site-text-gate.ts:77` | `PER_VERB_FROZEN = { get: 37, … }` → `get: 38` | 常量 | `A2`（逐 verb 逐字） |
| 9 | `p8-s7-batt-checkin-gate.ts:79` | `REG_POINTS_FROZEN 88 → 89` | 常量 | `A1` / `A2` / `A3` / `A5` |
| 10 | `p8-s7-batt-checkin-gate.ts:80` | `PER_VERB_FROZEN get: 37 → 38` | 常量 | `A2` |
| 11 | `p8-s8-rating-timeliness-gate.ts:64` | `REG_POINTS_FROZEN 88 → 89` | 常量 | `A1` / `A2` / `A3` / `A5` |
| 12 | `p8-s8-rating-timeliness-gate.ts:65` | `PER_VERB_FROZEN get: 37 → 38` | 常量 | `A2` |
| 13 | `p8-s9-bttc-gate.ts:77` | `REG_POINTS_FROZEN 88 → 89` | 常量 | `A1` / `A2` / `A3` / `A5` |
| 14 | `p8-s9-bttc-gate.ts:78` | `PER_VERB_FROZEN get: 37 → 38` | 常量 | `A2` |
| 15 | `p8-s10-invite-reward-gate.ts:86` | `REG_POINTS_FROZEN 88 → 89` | 常量 | `A1` / `A2` / `A3` / `A5` |
| 16 | `p8-s10-invite-reward-gate.ts:87` | `PER_VERB_FROZEN get: 37 → 38` | 常量 | `A2` |
| 17 | `p8-s11-audit-console-gate.ts:97` | `REG_POINTS_FROZEN 88 → 89` | 常量 | `I1` / `I2` / `I4`（负对照） |
| 18 | `p8-s11-audit-console-gate.ts:98` | `PER_VERB_FROZEN get: 37 → 38` | 常量 | `I2` |

- **伴随之文案 / 注释（各门，**保留历史行** · 一律「追加」新行）**：
  - 追加常量注释行（10 门）：`// ★ S11 注册点前推（沿 R-8-22）：注册点 88 → 89（S6 新增 GET /api/job/:jobId/submissions +1；逐 commit 归因 692f622）。`
  - 头注 / 段注（`s6:14` · `s7:16/:143` · `s8:17-18/:109` · `s9:16/:127` · `s10:21/:92` · `s11:28/:318`）：`注册点 88` → `89` · `get 37` → `get 38` · `（和 = 88）` → `89` · `负对照（缩进注入 ⇒ 88）` → `89`。
  - 断言外显文案（`s6:117` · `s7:148` · `s8:114` · `s9:132` · `s11:322`）：进度串尾追加 `⇒ S6 新增 GET /api/job/:jobId/submissions +1〔88→89〕`。
  - `selfTest` 判负说明（`s7:161` · `s8:127` · `s9:143` · `s10:108` · `s11:341`）：`把非 88 条路由…「注册点 = 88」` → `89`。
- **改法**：逐处最小替换 + 计数断言（`str.count(old) == 期望`，越界即 `sys.exit(1)` 中止）⇒ **零误伤、零删行**。`git diff --stat` = **11 文件 · +50 / −40**（净增注释行；无 `src/**` / `frontend/**` / `migrations/**` 命中）。

### 1.3 S6 归因（逐 commit 现取 `git show <c>:backend-ts/src/index.ts | grep -cE '^[[:space:]]*app\.…\('`）

| commit | 阶段 | 注册点 |
|---|---|---|
| `337a5fb` | S2（服务层） | **88** |
| `9d6bc20` | S3（路由层，/apply /accept 下架为 410） | **88** |
| **`692f622`** | **S6（后端补口）** | **89** ← 净 +1 |

- `git show 692f622 -- backend-ts/src/index.ts` 现取新增行 = **`+app.get('/api/job/:jobId/submissions', async (req, res) => {`** ⇒ **恰 +1 个 get**，与现取逐 verb `get 37 → 38` 逐字吻合。
- ⇒ 定性 = **合法前推**（S6 合法新增注册点），**非缺陷、非漏测**；S6/S6b 报告未登记该注册点前推 ⇒ 由本单收口。

### 1.4 非本冻结面 / 射程外的注册点「数字」（**未改** · 如实登记）

| 落点 | 现形 | 说明 |
|---|---|---|
| `p4z-b6audit-01-e2e.ts:280` · `p4z-b6audit-02-idemkey.ts:266` | `out.route_registrations === 67` | **更早 epoch** 的门（P4z 批），**非** `88` 族 ⇒ 不在清单、**未改**（须另单归因） |
| `p7b-03-offline-gates.ts:134` | `regs === 68`（`AC10-2 注册点 = 68 不变`） | 同上（P7b 批） |
| `p4z-b3b-01-restart-http.ts:4` | 注释 `注册点计数 … 仍 = 53` | **注释**，非断言 |
| `p8-*` 的 `registration_points:` 输出字段 | `countRoutes(INDEX_TS)` / 内联正则 | **运行时现算**（非冻结常量）⇒ 自动随真值 = 89，**无需改** |
| **`backend-ts/src/**`** | `audit-console.ts:5` · `index.ts:85` · `index.ts:1539` · `index.ts:2904`：注释「注册点 `87 → 88`」「`85 → 87`」 | **历史注释**（非断言）· **★ 禁改面 `src/**`** ⇒ **未改**（其语义 = 8⑥/P9④ 的历史事件，与 S6 的 `88→89` 无关） |
| `frontend/**` | `i18n-batch-b4a/b4b/b5/violation-closeout.test.jsx`：注释「注册点 +4 ⇔ 4 新路由」 | **叙述性注释**，**无** 88 族注册点断言 ⇒ 不在面内、**未改** |
| `docs/*.spec.md` · `docs/seafood.master-plan.md` | 规范/总纲文字 | **禁改面**（本单允许面仅 `scripts/*.ts` + 本报告） |

> **结论**：`88` 族（`REG_POINTS_FROZEN` / 字面 `88`）落点 = **恰 11 门**（§1.2），无第 12 落点；`src/**` 命中均为**历史注释**（非本冻结面 · 且禁改），`frontend/**` 无断言。

---

## ② 逐处前推 `88 → 89`（改法）

- 逐处 **最小替换** + `count` 断言（越界即中止），**未删任何历史注释行 / 未放宽 / 未删任何判据**：
  - 常量：`REG_POINTS_FROZEN = 88` → `89`（10 门）；`PER_VERB_FROZEN … get: 37` → `get: 38`（6 门）；`REG_COUNT === 88` → `89`（`p8-s2` 字面）。
  - 注释：各门常量上方**追加** 1 行 `// ★ S11 注册点前推（沿 R-8-22）：…`（历史行 `P9④ 85→87` · `8⑥ 87→88` **原样保留**）。
  - 文案：头注 / 段注 / 断言外显串 / `selfTest` 说明同步 `88 → 89`（`get 37 → 38` / `和 = 88 → 89` / `缩进注入 ⇒ 88 → 89`）。
- 负对照（`E1b` / `A8` / `A14` / `A5` / `I4`）以 `REG_POINTS_FROZEN + 1` / `countRoutes(注入) === REG_POINTS_FROZEN + 1` **现算** ⇒ 随常量自动前推；**`selfTest` 的「错值入参」未动**（`75` / `74` / `'x'`，非冻结面）。

---

## ③ 逐门复跑（前推前 vs 前推后）

**命令**：`npx ts-node --transpile-only scripts/<gate>.ts`（cwd = `backend-ts`；env 由 `.env.local` 自动加载）。注：「前」= 编辑前**实测**，「后」= 编辑后**实测**（同一工作树，会话内顺序执行）。

| 门 | 总 / 过 / 红（前） | 总 / 过 / 红（后） | 目标判据（红→绿） | 复跑前后其余红点 |
|---|---|---|---|---|
| `p8-s2-fee-rebate-gate` | 44 / 43 / **1** | 44 / 44 / **0** | `A1` | — |
| `p8-s3-deposit-gate` | 45 / 43 / **2** | 45 / 45 / **0** | `E1` · `E1b` | — |
| `p8-s3b-address-gate` | 38 / 37 / **1** | 38 / 38 / **0** | `G1` | — |
| `p8-s4-currency-review-gate` | 79 / 76 / **3** | 79 / 79 / **0** | `A1` · `A8` · `F1` | — |
| `p8-s5-compliance-gate` | 117 / 113 / **4** | 117 / 117 / **0** | `A1` · `A1b` · `A14` · `F1` | — |
| `p8-s6-site-text-gate` | 64 / 60 / **4** | 64 / 64 / **0** | `A1` · `A2` · `A3` · `A8` | — |
| `p8-s7-batt-checkin-gate` | 59 / 48 / **11** | 59 / 52 / **7** | `A1` · `A2` · `A3` · `A5` | `C5` · `D6` · `D7` · `D8` · `G8` · `G9` · `G10`（§4.B） |
| `p8-s8-rating-timeliness-gate` | 92 / 85 / **7** | 92 / 89 / **3** | `A1` · `A2` · `A3` · `A5` | `H5` · `H6` · `H7`（HTTP · §4.A） |
| `p8-s9-bttc-gate` | 100 / 96 / **4** | 100 / 100 / **0** | `A1` · `A2` · `A3` · `A5` | — |
| `p8-s10-invite-reward-gate` | 49 / 44 / **5** | 49 / 48 / **1** | `A1` · `A2` · `A3` · `A5` | `K8`（HTTP · §4.A） |
| `p8-s11-audit-console-gate` | 87 / 83 / **4** | 87 / 86 / **1** | `I1` · `I2` · `I4` | `K10`（HTTP · §4.A） |

- **逐项解释（FAIL 数变化）**：**每一门恰减 `目标判据数`**（`1/2/1/3/4/4/4/4/4/4/3`），**全部**为**注册点计数族红点由红转绿**——未连带影响任何其它判据（`passed` 增量 = 该门目标数，`total` 不变）。合计 **红点 41 → 15**。
- 静态门（`db=0`）：`s2` · `s3` · `s3b` · `s4` · `s5` · `s6` 全绿。库面门 `s9`（`db=10`）· `s11`（`db=6`）**同单全绿**（含库面 leg）。
- 改动**仅**门脚本冻结值 ⇒ 断言逻辑 / 覆盖面一字未动（`total` 逐门不变 ✓ 是为证）。

---

## ④ 未测项 / 额外红点（如实登记 · **未改**）

### A. HTTP 腿未测（无受控实例；**禁起服务 / 禁占端口**）
| 门 · 判据 | 目标探针 | 实测 actual（后） | 未测 + 原因 |
|---|---|---|---|
| `p8-s10` · `K8` | `GET /api/role-names`(=200) / `GET /api/batt` 无 token(401) ⇄ 有 token(200) | `{"pub":-1,"no_tok_batt":-1,"tok_batt":-1,"err":"fetch failed"}` | 受控实例未起（`P8S10_BASE` 默认 `127.0.0.1:5796` 无监听）；`5796 ∈ 硬口径禁占区 5793–5799` ⇒ **不得为凑绿起服务** |
| `p8-s11` · `K10` | 无 token(401) / 持 `manage_audit`(200) / `app_config`(`400 AUDIT_TABLE_NOT_FOUND`) / 不适参(`400`) / `limit=101`(`400`) / 非白名单(`400`) | `{"no_tok":-1,"ok_page":-1,"app_config":-1,…,"err":"fetch failed"}` | 同上（`P8S11_BASE` 默认 `127.0.0.1:5797` 无监听） |
| `p8-s7` · `G8`/`G9`/`G10` | 4 新口 401⇄200 · 公开面零回归 | `{"err":"fetch failed"}` / `{"status":-1}` | 同上（`P8S7_BASE` 默认 `127.0.0.1:5797`，`http=1`）—— **非本单面**（未改门亦同红） |
| `p8-s8` · `H5`/`H6`/`H7` | 5 新口 401 · 两读口 200 · 三写口 400/404 | `{"err":"fetch failed"}` / `{}` | 同上（`http=1`）—— **非本单面** |

> 说明：`p8-s7`/`p8-s8` 的 HTTP 腿**在改前即为红**（§3「前」列），**非本单所引入**；`lsof` 现取 `5793–5799` **全空**（仅既有 `5787`/`5788` 在听 · **非本单所起 · 未启停**）。

### B. 射程外的额外红点（**非**注册点族 · 改前改后**同红** · **未改**）
- **`p8-s7` · `C5`（`doubleGate`）**：`{"stateConflict_batt":3}` vs 期望 **2** —— 属**另一冻结面（batt 闸 `stateConflict` 处数）**，与注册点无关。改前红、改后红（§3）。
- **`p8-s7` · `D6`/`D7`/`D8`（`kindCloseSet`）**：扫面「全闭集编码**恰五处**」实得 **6** —— 多出 `frontend/src/test/unit/s9-ledger-kind-closure.test.js`（**S9 并行**新增件）⇒ 属**kind 闭集扫面冻结面**（S9 面）滞后，**非本单面**。改前红、改后红。
- 以上红点**均非注册点计数**，**不属**本单现取模式（`REG_POINTS_FROZEN` / 字面 `88`）⇒ **未改**（沿「不得借前推之机放宽 / 删任何判据」）。**须 Zang 另裁**（另派单归因 `C5` · `D6-D8`）。

### C. 边界与硬口径遵守
- 改动面 = 仅 `backend-ts/scripts/*.ts`（**11 文件**）+ 本报告；**未碰** `src/**`（**含 `index.ts` —— 计数全对靠**同族门前推**，**未删 / 未改任何路由**）· `frontend/**` · `migrations/**` · `docs/*.spec.md` · `.env*`。
- `git diff --name-only | grep -E 'src/|frontend/|migrations/'` = **空**（自证）。
- **未 commit / 未 push**；**未起服务 / 未占端口**；**未 `pkill`/`killall`**；**未 `npm install`**；连库仅由 `.env.local` 自动加载。
- 原始输出存 scratch：`~/.hermes/profiles/zang/cache/scratch/s11push/{before,after}-<gate>.txt`（`.txt` 后缀，**非 `.log`**）。

---

## 附 · 复跑取证锚（artifact 目录）

| 门 | 前（before） | 后（after） |
|---|---|---|
| `p8-s2` | `.p8s2-artifacts/p8s2-gate-20261004T001055Z/gate.json` | `.p8s2-artifacts/p8s2-gate-20261004T001302Z/gate.json` |
| `p8-s3` | `.p8s3-artifacts/p8s3-20261004T001056Z/gate.json` | `.p8s3-artifacts/p8s3-20261004T001302Z/gate.json` |
| `p8-s3b` | `.p8s3b-artifacts/p8s3b-20261004T001056Z/gate.json` | `.p8s3b-artifacts/p8s3b-20261004T001303Z/gate.json` |
| `p8-s4` | `.p8s4-artifacts/p8s4-20261004T001057Z/gate.json` | `.p8s4-artifacts/p8s4-20261004T001304Z/gate.json` |
| `p8-s5` | `.p8s5-artifacts/p8s5-20261004T001058Z/gate.json` | `.p8s5-artifacts/p8s5-20261004T001305Z/gate.json` |
| `p8-s6` | `.p8s6-artifacts/p8s6-20261004T001058Z/gate.json` | `.p8s6-artifacts/p8s6-20261004T001305Z/gate.json` |
| `p8-s7` | `.p8s7-artifacts/p8s7-20261004T001059Z/gate.json` | `.p8s7-artifacts/p8s7-20261004T001306Z/gate.json` |
| `p8-s8` | `.p8s8-artifacts/p8s8-20261004T001104Z/gate.json` | `.p8s8-artifacts/p8s8-20261004T001311Z/gate.json` |
| `p8-s9` | `.p8s9-artifacts/p8s9-20261004T001127Z/gate.json` | `.p8s9-artifacts/p8s9-20261004T001328Z/gate.json` |
| `p8-s10` | `.p8s10-artifacts/p8s10-20261004T001146Z/gate.json` | `.p8s10-artifacts/p8s10-20261004T001348Z/gate.json` |
| `p8-s11` | `.p8s11-artifacts/p8s11-20261004T001155Z/gate.json` | `.p8s11-artifacts/p8s11-20261004T001358Z/gate.json` |
