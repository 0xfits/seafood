# S12 · `p8-s7` 两处残留红点收口（判定 + 前推 + 全门复跑）

- **单**：S12 收口 —— `p8-s7` 两处残留红点（`C5` / `D6·D7·D8`）判定 + 前推 + 全门复跑（**不 commit / 不 push**）
- **执行**：Kong · 2026-10-04（CST）
- **仓库**：`/Users/kevin/bistro/seafood`
- **基线**：开工 `git log --oneline -1` 现取 = **`3299059`**（与派单一致）。
  - ★ **执行期间外部动作**：会话中途另有并行 commit `a231d11`（`docs: §5.328/v0.328 …本批 15 commit 已上线…`）落于 `3299059` 之上，**仅改 `docs/seafood.master-plan.md`（+26 行）**，`git diff --name-only 3299059 a231d11` **未触及** `p8-s7`/`job-service.ts`/`ledger.ts`/`s9` 镜件/`index.ts` ⇒ **对本单断言面零影响**（§1 全部读数于 `a231d11` 下**复取一致**）。**非本单所提交**（本单未 commit / 未 push）。
- **改动文件面**：仅 `backend-ts/scripts/p8-s7-batt-checkin-gate.ts`（`1 file changed, 14 insertions(+), 8 deletions(-)`）+ 本报告；**未碰** `backend-ts/src/**` · `frontend/**` · `migrations/**` · `docs/*.spec.md` · `.env*`（`git diff --name-only` 现取 = 仅该脚本，见 §6）。
- **硬口径**：不 commit / 不 push ✓ · 未起服务 / 未占端口（禁占 `5793–5799`；未启停 `5787/5788`）✓ · 禁 `pkill -f`/`killall` ✓ · 连库仅由 `backend-ts/.env.local` **自动加载**（未复制 / 未回显）✓ · 未 `npm install` ✓ · **未放宽 / 未删任何判据**（仅改期望值 + 同步文案 + 追加具名登记注释）✓

---

## 0. 结论（一句话）

两处残留红点**均判定为「合法前推」**（非真回归、非口径错）：
① `D6`/`D7`/`D8` —— 代码面「全闭集编码（≥21 值）」实为 **6 处**（非 5），第 6 处 = **S9 新增** `frontend/src/test/unit/s9-ledger-kind-closure.test.js`（内含 24 值镜像常量）⇒ 前推 `FULL_SET_EXPECTED` 五处 → **六处**（具名登记该处）。
② `C5` —— 服务层 `stateConflict('batt','BATT_BELOW_ACCEPT_THRESHOLD')` 映射实为 **3 处**（非 2），第 3 处 = **S2（`R-9-99`）** 把 `batt` 闸移到「提交」时在 `submitWork` **新增**（旧两处按 S2/S3 设计「函数保留不删 · 路由 410 退役」保留）⇒ 前推 `mapCount === 2` → `=== 3`（具名登记三处）。
改后全门复跑：**仅 `p8-s7` 变化**（`59/52/7` → `59/56/3`，目标 4 判据红→绿，零连带）；其余 10 门逐字不变、零回归。

---

## ① 现取实形 + 逐字读数

### 1.1 `D6`/`D7`/`D8`（`kindCloseSet` 全闭集扫面）

**扫的是什么**（现读 `p8-s7:308-346`）：全仓 5 根（`backend-ts/src`·`backend-ts/migrations`·`backend-ts/scripts`·`frontend/src`·`docs`）× 6 后缀（`.ts/.sql/.js/.jsx/.mjs/.md`）递归；文件命中 `SCAN_RE = /ledger_kind_ok|ledger_kind_enum|LEDGER_KINDS|PLATFORM_KIND_WHITELIST|checkin_makeup_fee/` 且 `kindsInText ≥ 21`（24 个 `LEDGER_KINDS` 里以字面量出现者）⇒ 桶 `full_set_21`。`D6`/`D8` 断言该桶**文件清单 == `FULL_SET_EXPECTED`**；`D7` 断言 `FULL_SET_CODE.length === 5 && bucketCounts.full_set_21 === 5`。

**★ 逐字读数（改前，artifact `p8s7-20261004T001721Z`）**：

- `D6` actual：`found` = **6 处** = 期望 5 + **`frontend/src/test/unit/s9-ledger-kind-closure.test.js`**。
- `D7` actual：`buckets = { full_set_21: 6, spec_text: 122, historical_or_superseded: 5, single_kind_usage: 3, probe_or_artifact: 11, readonly_call_or_subset: 15 }`，`hits: 162`。
- `D8` actual：`files_with_new_kind_and_full_list` = **同 6 处**（含 S9 件）。

**具名归因（现取命令）**：

| 证据 | 命令 / 读数 |
|---|---|
| S9 件为新增 | `git cat-file -e 2ad2d11^:frontend/.../s9-ledger-kind-closure.test.js` ⇒ **NOT EXIST**；`git show 2ad2d11 --stat` ⇒ `.../s9-ledger-kind-closure.test.js \| 155 +++++` |
| 该件确为全闭集编码 | 现读该件 `KINDS_MIRROR`（第 34–44 行）= **24 值逐字**（`mint` … `invite_first_task_reward`），`'…'` 字面量去重计数 = 33；命中 `kindsInText` ≥ 21 ✓ |
| 无第 7 处 | `full_set_21` 桶 = **6**，其余命中落在 `spec_text`(122) / `historical_or_superseded`(5) / `readonly_call_or_subset`(15) / `probe_or_artifact`(11) / `single_kind_usage`(3) 五桶，**无越界全闭集** |

### 1.2 `C5`（`doubleGate` · 服务层 `batt` 闸映射处数）

**扫的是什么**（现读 `p8-s7:263`）：`countOf(JOB_SERVICE_TS, /stateConflict\('batt',\s*'BATT_BELOW_ACCEPT_THRESHOLD'/g)` —— 即 `backend-ts/src/job-service.ts` 内 `stateConflict('batt', 'BATT_BELOW_ACCEPT_THRESHOLD'` 的**出现处数**（服务层把 DB 层 `batt_below_threshold` outcome 映射为 `409` 的落点处数）。

**★ 逐字读数（改前）**：`C5` actual = `{"stateConflict_batt":3}`；期望 = **2** ⇒ 红。

**★ 三处逐字（现取 `grep -n`）**：

| # | 落点 | 行 | 状态 |
|---|---|---|---|
| 1 | `submitWork`（case `batt_below_threshold`） | `job-service.ts:157` | **现役**（`index.ts:946` 调 `submitWork`；S2/R-9-99 新增） |
| 2 | `applyToJob`（case `batt_below_threshold`） | `job-service.ts:208` | 历史保留（P9② 落点 A；`@deprecated`；路由 `/apply` 410） |
| 3 | `acceptApplication`（case `batt_below_threshold`） | `job-service.ts:245` | 历史保留（P9② 落点 B；`@deprecated`；路由 `/accept` 410） |

**具名归因（现取命令）**：

| 证据 | 命令 / 读数 |
|---|---|
| 计数 2→3 的引入点 = S2 | `git log -S"stateConflict('batt', 'BATT_BELOW_ACCEPT_THRESHOLD'"` ⇒ `337a5fb`（S2）+ `4c40b47`（P9② 首建 2）；逐 commit 计数 `337a5fb/9d6bc20/692f622/2ad2d11/f00d5ee/3299059` 现取**皆 = 3** |
| 旧两处为「保留不删」 | `index.ts:35` 注：`applyToJob`/`acceptApplication`（服务层 verb **保留不删**，仅不再被本层调用）；`index.ts:36` import 仅有 `submitWork`；`/apply`(`2373`)/`/accept`(`2395`) handler 直 `410`、零表访问 |
| 三处均借既有码 | 均走 `stateConflict` ⇒ `fail(409, 'LEDGER_CURRENCY_INVALID_TRANSITION', …)`（∈ 闭集 33；`C6` 仍绿） |

---

## ② 定性（逐处）

| 处 | 定性 | 依据（判别链） |
|---|---|---|
| **`D6`/`D7`/`D8`** | **合法前推** | 命中数 `5 → 6` 的唯一增量 = **S9 合法新增的守卫镜件**（`frontend/src/test/unit/s9-ledger-kind-closure.test.js`，内含 24 值 `KINDS_MIRROR` 全闭集编码）。该件是**新登记的第 6 处全闭集编码**（非缺陷、非漏测、非探针口径错）。⇒ 前推 `FULL_SET_EXPECTED` + `D7` 计数 + 文案，**具名登记**该处。与派单「疑似因 S9 ⇒ 若确属则合法前推并具名登记」**逐字吻合**。 |
| **`C5`** | **合法前推** | 计数 `2 → 3` 的增量 = **S2（`R-9-99`）把 `batt` 闸从「报名」移到「提交」**时在 `submitWork` **新增**第 3 处映射（现役在链落点）；原 P9② 两处按 S2/S3 设计**保留不删**（`@deprecated` + 路由 410）。三处**均合法**（同一稳定 `reason` + 同一借用的既有族码；`C6` 绿），**无重复、无错位、无死循环** ⇒ 属**落点集合合法扩容**，非真回归。 |

- **非真回归之证**：三处/六处**逐处可命名**、逐处可归因到**已裁定**变更（S2 `R-9-99` / S9 `2ad2d11`），且改后 `p8-s7` **零连带**（`total` 不变 59、`passed` 恰 +4、`failed` 恰 −4，见 §4）。
- **非口径错之辩（如实登记，供复核）**：`C5`/`D6` 皆为**文本计数式定格**：
  - `C5` 计的是 job-service.ts 内映射**处数**（含 `@deprecated` 保留件）——「处数」语义与断言外显「两处 outcome ⇒ …」一致，故计数**即**其口径，非错测；旧值 `2` 系 pre-S2 模型快照，S2 后应随落点集合前推。
  - `D6` 桶判据 `kinds ≥ 21` 把「守卫镜件」一并计入「全闭集编码」——该件**确**含完整 24 值闭集（用于两源对账），计入符合「无未登记全闭集编码」的穷举结论；前推后断言仍为**精确相等**（清单 == 期望），**未放宽为 ≥**。
  - ⇒ 二者断言**仍可判负**（改后 `selfTest D6`/`selfTest D4` 仍在、仍绿；见 §4 说明）。

---

## ③ 前推改动（逐处 · 具名登记）

改法：**仅改期望值 + 同步文案 + 追加具名登记注释**；**未删任何判据、未放宽（无 `≥`/白名单/跳过）**。`git diff --stat` = `14 insertions(+), 8 deletions(-)`（删的行均为「旧期望/旧文案」的替换，非判据删除）。

| # | 落点 | 改前 → 改后 | 类型 |
|---|---|---|---|
| 1 | `p8-s7:263`（`C5` 前） | 追加注释：`// ★ S12 定格前推（沿 S2 · R-9-99）：… 2 → 3 … submitWork:157 / applyToJob:208 / acceptApplication:245` | 具名登记 |
| 2 | `p8-s7:267` | `t('C5', …, mapCount === 2, …)` → `mapCount === 3` | 期望值前推 |
| 3 | `p8-s7:268` | 文案「两处 outcome ⇒ …」 → 「三处 outcome ⇒ …（`submitWork`〔现役·S2〕+ `applyToJob`/`acceptApplication`〔P9② 历史保留〕…）」 | 外显文案 |
| 4 | `p8-s7:351`（`FULL_SET_EXPECTED` 前） | 追加注释：`// ★ S12 扫面定格前推（沿 S9 · 2ad2d11）：… 5 → 6，具名登记该处` | 具名登记 |
| 5 | `p8-s7:359` | `FULL_SET_EXPECTED` 数组 **追加** `'frontend/src/test/unit/s9-ledger-kind-closure.test.js'`（5 → 6 元素） | 期望清单前推 |
| 6 | `p8-s7:402` | `// D6 穷举扫面：… 恰五处 …` → `恰六处 …（★ S12 追加 S9 守卫件）` | 注释 |
| 7 | `p8-s7:404` | `D6` 文案「恰五处 = 0028…/src/ledger.ts」 → 「恰六处 = … + `frontend/.../s9-ledger-kind-closure.test.js`（★ S12 登记…）」 | 外显文案 |
| 8 | `p8-s7:407` | `const classified = FULL_SET_CODE.length === 5 && bucketCounts.full_set_21 === 5` → `=== 6 && === 6` | 期望值前推 |
| 9 | `p8-s7:409` | `D7` 文案「full_set_21 恰 5」 → 「恰 6」 | 外显文案 |
| 10 | `p8-s7:411` | `// D8 …== 恰五处` → `恰六处` | 注释 |
| 11 | `p8-s7:414` | `D8` 文案「= 恰五处」 → 「= 恰六处（含 S9 守卫件）」 | 外显文案 |

- **共用面说明**：`FULL_SET_EXPECTED`（第 5 项）为 `D6` 与 `D8` **共用**期望，一处前推同时覆盖两判据；`D7` 另行硬编码 `=== 5`（第 8 项）故单独前推。
- **未动**：`D` 段其余判据（`D1`–`D5`、`D4b`、`D4c`：24/24/21/23 值 + 冻结族 4 值）与 `selfTest D6`/`selfTest D4` **一字未改**；`C0`–`C4`、`C6` 及全部 A/B/E/F/G 段 **未动**。

---

## ④ 全门复跑（逐门前 / 后）

**命令**：`npx ts-node --transpile-only scripts/p8-<gate>.ts`（cwd = `backend-ts`；env 由 `.env.local` 自动加载）。「前」= 编辑前实测，「后」= 编辑后实测（同一工作树 · 会话内顺序执行）。

| 门 | 总 / 过 / 红（前） | 总 / 过 / 红（后） | Δ | 红点（后） |
|---|---|---|---|---|
| `p8-s2-fee-rebate-gate` | 44 / 44 / **0** | 44 / 44 / **0** | 0 | — |
| `p8-s3-deposit-gate` | 45 / 45 / **0** | 45 / 45 / **0** | 0 | — |
| `p8-s3b-address-gate` | 38 / 38 / **0** | 38 / 38 / **0** | 0 | — |
| `p8-s4-currency-review-gate` | 79 / 79 / **0** | 79 / 79 / **0** | 0 | — |
| `p8-s5-compliance-gate` | 117 / 117 / **0** | 117 / 117 / **0** | 0 | — |
| `p8-s6-site-text-gate` | 64 / 64 / **0** | 64 / 64 / **0** | 0 | — |
| **`p8-s7-batt-checkin-gate`** | 59 / 52 / **7** | 59 / 56 / **3** | **−4 红**（目标 4 判据红→绿） | `G8` · `G9` · `G10`（HTTP 未测） |
| `p8-s8-rating-timeliness-gate` | 92 / 89 / **3** | 92 / 89 / **3** | 0 | `H5` · `H6` · `H7`（HTTP 未测） |
| `p8-s9-bttc-gate` | 100 / 100 / **0** | 100 / 100 / **0** | 0 | — |
| `p8-s10-invite-reward-gate` | 49 / 48 / **1** | 49 / 48 / **1** | 0 | `K8`（HTTP 未测） |
| `p8-s11-audit-console-gate` | 87 / 86 / **1** | 87 / 86 / **1** | 0 | `K10`（HTTP 未测） |
| **合计红点** | **12** | **8** | **−4** | — |

- **`p8-s7` 目标判据红→绿逐条**：`C5`（`2`→`3`）· `D6`（5→6 清单相等）· `D7`（`6 && 6`）· `D8`（6 处清单相等）⇒ 4 条全绿；`total` 不变（59）证**断言逻辑/覆盖面一字未动**。
- **零连带**：其余 **10 门**逐门 `总/过/红` **逐字不变**；合计红点仅 `p8-s7` **−4**。
- **`selfTest` 仍可判负自证**：`p8-s7` 内 `selfTest` 全数保留且绿（含 `D6__selftest`「凭空多出一个全闭集编码文件 ⇒ 谓词转红」、`C2__selftest` 等）——前推后判据**未失判负能力**。

**复跑取证锚（artifact）**：

| 门 | 前（before） | 后（after） |
|---|---|---|
| `p8-s2` | `.p8s2-artifacts/p8s2-gate-20261004T001716Z/gate.json` | `.p8s2-artifacts/p8s2-gate-20261004T001906Z/gate.json` |
| `p8-s3` | `.p8s3-artifacts/p8s3-20261004T001717Z/gate.json` | `.p8s3-artifacts/p8s3-20261004T001907Z/gate.json` |
| `p8-s3b` | `.p8s3b-artifacts/p8s3b-20261004T001717Z/gate.json` | `.p8s3b-artifacts/p8s3b-20261004T001907Z/gate.json` |
| `p8-s4` | `.p8s4-artifacts/p8s4-20261004T001718Z/gate.json` | `.p8s4-artifacts/p8s4-20261004T001908Z/gate.json` |
| `p8-s5` | `.p8s5-artifacts/p8s5-20261004T001719Z/gate.json` | `.p8s5-artifacts/p8s5-20261004T001909Z/gate.json` |
| `p8-s6` | `.p8s6-artifacts/p8s6-20261004T001720Z/gate.json` | `.p8s6-artifacts/p8s6-20261004T001910Z/gate.json` |
| `p8-s7` | `.p8s7-artifacts/p8s7-20261004T001721Z/gate.json` | `.p8s7-artifacts/p8s7-20261004T001910Z/gate.json` |
| `p8-s8` | `.p8s8-artifacts/p8s8-20261004T001727Z/gate.json` | `.p8s8-artifacts/p8s8-20261004T001916Z/gate.json` |
| `p8-s9` | `.p8s9-artifacts/p8s9-20261004T001744Z/gate.json` | `.p8s9-artifacts/p8s9-20261004T001934Z/gate.json` |
| `p8-s10` | `.p8s10-artifacts/p8s10-20261004T001803Z/gate.json` | `.p8s10-artifacts/p8s10-20261004T001953Z/gate.json` |
| `p8-s11` | `.p8s11-artifacts/p8s11-20261004T001813Z/gate.json` | `.p8s11-artifacts/p8s11-20261004T002003Z/gate.json` |

---

## ⑤ 未测项 / 额外红点（如实登记 · **未改**）

### A. HTTP 腿未测（无受控实例；**禁起服务 / 禁占端口**）

| 门 · 判据 | 目标探针 | 实测 actual（后） | 未测 + 原因 |
|---|---|---|---|
| `p8-s7` · `G8`/`G9`/`G10` | 4 新口 401⇄200 · `GET /api/role-names` 公开 200 | `{"no_token":{},"err":"fetch failed"}` / `{"with_token":{},"err":"fetch failed"}` / `{"status":-1}` | `P8S7_BASE` 默认 `127.0.0.1:5797` 无监听；`5797 ∈ 硬口径禁占区 5793–5799` ⇒ **不得为凑绿起服务** |
| `p8-s8` · `H5`/`H6`/`H7` | 5 新口 401 · 两读口 200 · 三写口 400/404 | `{"no_token":{},"err":"fetch failed"}` / `{"read_200":{}}` / `{"write_bad":{}}` | 同上（`p8-s8` 受控实例未起） |
| `p8-s10` · `K8` | `GET /api/role-names`(200) / `GET /api/batt` 无 token(401) ⇄ 有 token(200) | `{"pub":-1,"no_tok_batt":-1,"tok_batt":-1,"err":"fetch failed"}` | 同上（`P8S10_BASE` 默认 `127.0.0.1:5796`） |
| `p8-s11` · `K10` | 无 token(401) / 持 `manage_audit`(200) / `app_config`(400 `AUDIT_TABLE_NOT_FOUND`) / 不适参(400) / `limit=101`(400) / 非白名单(400) | `{"no_tok":-1,"ok_page":-1,"app_config":-1,…,"err":"fetch failed"}` | 同上（`P8S11_BASE` 默认 `127.0.0.1:5797`） |

> **说明**：上列 HTTP 红点在**改前即为红**（§4「前」列），**非本单引入**；改后逐字不变。`lsof` 现取 `5793–5799` 全空（仅既有 `5787`/`5788` 在听 · **非本单所起 · 未启停**）。

### B. 无其它射程外红点

改后 `p8-s7` 残余 3 红**全为 HTTP 未测**（G8/G9/G10）；`C5`/`D6`/`D7`/`D8` 已红→绿，**无新增红点**。

---

## ⑥ 自证 / 边界

| # | 自证项 | 读数（现取） |
|---|---|---|
| ① | 改动面 = 仅脚本 | `git diff --name-only` = **`backend-ts/scripts/p8-s7-batt-checkin-gate.ts`**（唯一）；`grep -E 'src/\|frontend/\|migrations/'` 命中 **空** |
| ② | 未删判据 / 未放宽 | `p8-s7` 改后 `total` = **59**（与改前同）；`selfTest` 全保留且绿；无 `≥`/白名单/跳过新增 |
| ③ | 逐处归因 | `C5` 增量 = `submitWork:157`（S2 `337a5fb`）；`D6` 增量 = S9 镜件（`2ad2d11`）—— 逐处**可命名**（§1） |
| ④ | 未 commit / 未 push | 本单**未** commit / 未 push；工作树仅 1 脚本 modified（+ 本报告 untracked）。★ 会话中途外部 `a231d11`（docs-only）落于基线之上，**非本单所提交**、未触及断言面（见基注） |
| ⑤ | 未起服务 / 未占端口 / 未 `pkill` | 未执行任何 `&`/端口占用/`pkill`/`killall`；`5793–5799` 现取全空 |
| ⑥ | 连库口径 | 仅经 `.env.local` **自动加载**（dotenv）；未 `cat`/未复制/未回显任何 `.env` 内容；未 `npm install` |
| ⑦ | 原始输出 | 存 scratch：`~/.hermes/profiles/zang/cache/scratch/s12/{before,after}-p8-<gate>.txt`（**`.txt`，非 `.log`**） |

**改动文件面（最终）**：
- **改**：`backend-ts/scripts/p8-s7-batt-checkin-gate.ts`（`14 +/8 -`）
- **增**：本报告 `docs/audit/s12-p8s7-residual-closeout.md`
- **未碰**：`backend-ts/src/**`（含 `job-service.ts` / `index.ts` / `database.ts`）· `frontend/**` · `migrations/**` · `docs/*.spec.md` · `.env*`
