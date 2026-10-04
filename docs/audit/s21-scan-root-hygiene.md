# S21 · 扫面根卫生（变体 Ⅰ 落地）· `p8-s7` 探针命名式显式排除 + 删除移植遗留死件 `src/simple-test.ts`

- **仓库**：`/Users/kevin/bistro/seafood`（Node/TS 后端 + Neon PG18）
- **角色**：Kong（实现方）· **执行**：2026-10-04（CST）
- **本单 = 台账 `B2`**（S20 终审采纳**变体 Ⅰ**：扫面根显式排除探针命名式，**不采纳**变体 Ⅱ 搬迁 72 件）+ S20 §2.4 顺带发现的移植遗留死件 `backend-ts/src/simple-test.ts` 删除。
- **硬口径遵守**：未改 `src/**` 其它件（只删 `simple-test.ts`）✓ · 未改 `migrations/**` / `docs/*.spec.md` / `docs/seafood.master-plan.md`（本报告为新建 `docs/audit/`）✓ · 未 `git add -A` / 未 commit / 未 push（删除亦**未** `git rm`，仅删工作区文件）✓ · 未 `npm install` ✓ · 未碰 `.env*` ✓ · 未启停 `5787/5788` · **未起任何实例、未占 5792–5799**（本单确实无需起服务：三红腿全程为 `fetch failed`，未触达受控实例）✓ · 禁 `pkill -f`/`killall`（未使用）✓ · 原始输出**不用 `.log` 后缀**（一律 `.out`）✓ · 未放宽其它判据 / 未删断言 / 未改 `D6/D7/D8` 期望文件集（六处逐字仍为那六处）✓。
- **改动文件面**：`backend-ts/scripts/p8-s7-batt-checkin-gate.ts`（` M`，`git diff --numstat` = **53 / 3**）+ `backend-ts/src/simple-test.ts`（` D`，工作区删除）+ 本报告 + `backend-ts/.s21-artifacts/` 读数。

---

## §0 对锚（开工现取 · ★ 含会话期中 HEAD 外推登记）

```
$ git log --oneline -3   （开工 · 派单给定锚）
1bff643 chore(gates): S20 门卫生 —— p7b-03 AC10-2 注册点冻结面前推 68→89 … + 14 门扫面根只读盘点与两变体（报告）
81d800f docs: §5.336/v0.336 —— S19 收口 … + 台账 docs/OPEN-ITEMS.md
f8d6fde fix(jobs): S19 participants_count 真源 = job_submission … + 报告

$ git branch --show-current → main
```

### 0.1 ★ 会话期中 HEAD 外推（他方进程 · 如实登记）

本单执行**中途**，工作区外**他方进程**新增一笔**纯 docs** 提交 ⇒ `HEAD` 由 `1bff643` 前推至 `25121f0`：

```
$ git log --oneline -5   （收工现取）
25121f0 docs: §5.337/v0.337 —— S20 收口（常红门前推 68→89 我亲跑 37/37）+ 我终审 B2=变体 Ⅰ … ⇒ 派 S21 + 台账同步   ← ★ 他方进程新增
1bff643 chore(gates): S20 门卫生 …                                                                                    ← 开工锚（派单给定）
81d800f docs: §5.336/v0.336 —— S19 收口 …
```

- `25121f0` **仅动 docs**（`docs/seafood.master-plan.md` + `docs/OPEN-ITEMS.md`，均为**已存在于工作区**的内容入库），**未触碰**本单任何工作文件；`git status`（tracked）收工仅列本单两项（§3.4）。
- 该 docs 提交**不改变**扫面面内容（`docs/OPEN-ITEMS.md` 在本单基线跑门时即已在工作区）⇒ **基线/改后可比**（§2 §3 的 `D7` `spec_text` 桶前后同为 `129` 即证）。
- **自曝**：`HEAD` 外推非本单所为；本单**未** commit / push（§5）。

---

## §1 变体 Ⅰ · 扫面根排除式（逐条登记 + 射程声明）

### 1.1 背景（S20 §2.3 现取结论）

`p8-s7-batt-checkin-gate.ts` 的 `SCAN_ROOTS`（`:312`）= `['backend-ts/src','backend-ts/migrations','backend-ts/scripts','frontend/src','docs']`，而 `D6/D7/D8` 判据是「**代码面**含 `checkin_makeup_fee` 且 kind 数 ≥ 20 / 全闭集编码（≥21）的件 = **恰六处**」（全闭集穷举）⇒ `backend-ts/scripts/`（探针/诊断件主落点，现取 **296** 件）内任何含 ≥21 kind、或以字符串字面量出现 `checkin_makeup_fee` 的**探针/诊断件**都会被算进去 ⇒ **假红**（S15 事故 `p8-s5-00-recon*.ts` 的成因；桶优先级 `kinds>=21 > isArtifact` 令「文件名兜底」被架空）。现取余量极薄：`scripts/` 内已有两件 card 在 **20** kind（`p3m-00-state.ts`、`p4z-b3afix2-01-gen-0020.ts`），另一件 18 且含新 kind（`p8-s9-bttc-gate.ts`）。

### 1.2 排除式（**显式白名单式 · 逐条登记** · 禁用宽泛匹配一刀切）

在**扫描阶段**（`walk(...)` 收集那一步）加排除：`backend-ts/scripts/` 下、**文件名命中下列命名式**者剔除。**不得**排除整个 `scripts/`、**不得**用 `*test*`（本单未用）。

| # | 命名式 id | 正则 | 依据（本仓既有探针命名惯例） | 现取命中（首匹配归属） |
|---|---|---|---|---|
| 1 | `recon` | `/recon/i` | 侦查件 `*recon*`（S20 §2.3 登记 7 件） | **7** |
| 2 | `probe` | `/probe/i` | 探针件 `*probe*`（S20 §2.3 登记 35 件） | **35** |
| 3 | `diagnostic` | `/diagnostic/i` | 诊断件 `*diagnostic*`（诊断专用件） | **0** |
| 4 | `seq` | `/-\d{2}-/` | **前置编号式** `*-00-*`/`*-01-*`…（分步探针/诊断件；S20 现取 `-00-` 46 件） | **209** |
| — | **合计（去重）** | — | 每件按**首个命中**命名式归属 ⇒ 合计 = Σ | **M = 251** |

> ★ **`seq` 取 `-\d{2}-`（既含 `-00-`，亦含 `-01-`/`-02-` 分步件）之裁**：S20 §2.5 变体 Ⅰ 原文即 `/-\d{2}-/`（Zang 已采纳该变体），且本单明确援引「两件 card 在 20 kind」——其中 `p4z-b3afix2-01-gen-0020.ts` 为 `-01-` 型，**仅用字面 `-00-` 覆盖不到它**。故 `seq` = 前置编号**族**（不止 `-00-`）。**该命名式只匹配明确的前置编号分步件，非 `*test*`、非整目录一刀切**。
> ★ **探针产物目录**：`walk` 目录分支同步排除「目录名命中探针命名式」者（沿既有 `.p*-recon`/`.p*-arms` 先例）；现取 `scripts/` 下**无子目录** ⇒ 目录排除计入 **0**（命名式仍逐条登记、防以后新增）。

### 1.3 射程声明（**只作用于 `backend-ts/scripts/` 这一个根**）

排除式实现为 `probeExcludedBy(abs)`：先判 `abs` 是否位于 `backend-ts/scripts/`（`path.relative` 不以 `..` 开头且非绝对）⇒ **不在该根内者 `return null`（绝不排除）**。⇒ `backend-ts/src` / `backend-ts/migrations` / `frontend/src` / `docs` **四根检出面一字不缩**。

**逐根现取（K 分解 · 与门内 fail-loud 一致）**：

| 扫面根 | 收集 N | 排除 M | 参与 K | 排除是否作用于该根 |
|---|---|---|---|---|
| `backend-ts/src` | 20 | 0 | **20** | 否（射程外 · 检出面不缩） |
| `backend-ts/migrations` | 41 | 0 | **41** | 否（射程外） |
| `backend-ts/scripts` | 296 | **251** | **45** | **是（唯一射程内）** |
| `frontend/src` | 144 | 0 | **144** | 否（射程外） |
| `docs` | 345 | 0 | **345** | 否（射程外） |
| **合计** | **846** | **251** | **595** | — |

> 注：`src` 收集 = 20（**删 `simple-test.ts` 后**；删前 21）；`scripts` 参与 45 = 全部**交付/门/库**件（`migrate.ts`/`ns-alloc.ts`/`p*-lib.ts`/`p8-*-gate.ts` 等，**均非探针命名式**）。被排除的 251 件**全部**落在 `scripts/` 内，其余四根 M=`0`。

### 1.4 fail-loud（不得静默 · **M=0 也照印**）

门启动即打印一行，**并写入 artifact**（`report.scan_root_hygiene`）：

```
SCAN_HYGIENE collected(N)=847 excluded_probe(M)=251 participating(K)=596 scope=仅 backend-ts/scripts/（其余四根检出面一字不缩）
```

（`N=847/K=596` 为**删 `simple-test.ts` 前**；删后 `846/595`。`artifact.scan_root_hygiene` 另含逐命名式 `hits` 与**全量 `excluded_files` 清单**。）

---

## §2 负对照（两处 · 无判负 = 本项不成立）

> 变异**只在临时文件**做，跑完全部删除；`git status --porcelain` 证明主仓无残留（§5.3）。

### 2.1 负对照① —— **排除式有效性**：未登记命名式全闭集件放 `scripts/` ⇒ 必须转红

临时件 `backend-ts/scripts/zz-negctl-fullset.ts`（命名 = `zz-negctl-fullset`，**不命中** recon/probe/diagnostic/`-\d{2}-` 任一排除式；内容 = 24 值 `LEDGER_KINDS` 全量 + `checkin_makeup_fee` 字面量）。

| 步骤 | 命令 | total/passed/failed | 红 id | 读数 |
|---|---|---|---|---|
| **放件（红）** | `npx ts-node --transpile-only scripts/p8-s7-batt-checkin-gate.ts` | **59 / 53 / 6** | **`D6,D7,D8`** + G8,G9,G10 | `EXIT=1` · `full_set_21=7`（多出 `scripts/zz-negctl-fullset.ts`）· `N=848 M=251 K=597` |
| **删件（回绿）** | 同上 | **59 / 56 / 3** | G8,G9,G10（仅 HTTP 腿） | `EXIT=1` · `full_set_21=6` · `N=847 M=251 K=596` |

- 红读数取证（`D6`）：`found = [0028,0029,0032,0038,src/ledger.ts, scripts/zz-negctl-fullset.ts, frontend/.../s9-...test.js]`（7 ≠ 期望 6）⇒ **谓词转红**。
- ⇒ 排除式**未放行未登记命名式**：含全闭集但命名不在白名单的件，仍被 `D6/D7/D8` 判为「未登记全闭集」而**转红**；撤件即**回绿**。

### 2.2 负对照② —— **排除式射程**：同内容放 `src/` ⇒ **仍必须转红**

临时件 `backend-ts/src/zz-negctl-fullset.ts`（同①内容，放在 `src` 根）。

| 步骤 | 命令 | total/passed/failed | 红 id | 读数 |
|---|---|---|---|---|
| **放件（红）** | `npx ts-node --transpile-only scripts/p8-s7-batt-checkin-gate.ts` | **59 / 53 / 6** | **`D6,D7,D8`** + G8,G9,G10 | `EXIT=1` · `found` 含 `backend-ts/src/zz-negctl-fullset.ts` · `N=848 K=597` |
| **删件（回绿）** | 同上 | **59 / 56 / 3** | G8,G9,G10 | `EXIT=1` · `found` 复归六处 |

- 红读数取证（`D8`）：`files_with_new_kind_and_full_list = [0028,0029,0032,0038, src/ledger.ts, src/zz-negctl-fullset.ts, frontend/.../s9-...test.js]`（7 ≠ 6）⇒ **转红**。
- ⇒ 排除式**射程仅 `scripts/`**：同内容落 `src/` 根**一字不缩**、照常计入判据 ⇒ 证明排除**没有把 `src` 根一并放过**。

---

## §3 附带同项 · 删除移植遗留死件 `backend-ts/src/simple-test.ts`

### 3.1 独立零引用取证（删前**自己现取**）

文件内容：29 行 · jinli 移植遗留（`process.env.jinli_DATABASE_URL || process.env.DATABASE_URL` 直连 + `neon()` 调用 + `handler` 查 `SELECT NOW()`）。

```
$ grep -rn 'simple-test' backend-ts/src backend-ts/scripts backend-ts/package.json backend-ts/migrations   → 0 命中（EXIT=1）
$ grep -rnE "require\(['\"][^'\"]*simple|from ['\"][^'\"]*simple" src scripts                              → 0 命中
$ grep -rn 'simple-test' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist  （剔除 docs/ 与 .p*-artifacts/）
  → 0 命中（EXIT=1）
```

- **命中面**：仅 `docs/**`（`seafood.master-plan.md` §5.337 / `OPEN-ITEMS.md` B11 / 各 `ledger.spec.v*.md` 的 **R55 历史文本**）与 3 个**既有** `.p3s1-artifacts/*.json`（S20 盘点产物）——**均为文本/产物引用，非代码引用**。
- **零 `import` / `require` / 动态路径 / 测试引用**（含 `package.json` scripts、`tsconfig.json`）⇒ 判为**死件**，按 Zang 裁**删除**（**未**发现任何引用 ⇒ 未触发「停下报回」条件）。

### 3.2 删前 / 删后硬门对照

| 门 | 删前（`simple-test.ts` 在场） | 删后 | 一致？ |
|---|---|---|---|
| `p8-s7-batt-checkin-gate` | `59 / 56 / 3`（红 = G8,G9,G10）· exit 1 | `59 / 56 / 3`（红 = G8,G9,G10）· exit 1 | **✓ 逐字相同** |
| `p8-s5-compliance-gate`（src 扫面根类门） | `117 / 117 / 0` · exit 0 | `117 / 117 / 0` · exit 0 | **✓ 逐字相同** |
| `npx tsc --noEmit` | （`src/**/*` 含该件） | **exit 0** | **✓** |

- `p8-s7` 旁证：扫面收集数 `N` 由 **847 → 846**（该件本在 `src` 扫面根内、命中 `SCAN_EXT`）——证明它**确实曾在检出面**，删除后其它判据**零变化**（它不含 `SCAN_RE` token，本就不入 `D6/D7/D8`）。

### 3.3 出处留痕（git 历史即留档）

```
$ git log --oneline -2 -- backend-ts/src/simple-test.ts
446e6c8 feat: remove Python backend and migrate to TypeScript
```

### 3.4 工作区状态（删后现取）

```
$ git status --porcelain   （tracked 两行）
 M backend-ts/scripts/p8-s7-batt-checkin-gate.ts
 D backend-ts/src/simple-test.ts
```

（删除**未** `git rm`：仅删工作区文件，`simple-test.ts` 保持 tracked-`D` 状态，由派单方入库。）

---

## §4 未做 / NOT_MEASURED（诚实登记）

1. **`p8-s7` 的 HTTP 腿（G8/G9/G10）仍未测**：本单**未起受控实例**（未占 5792–5799）⇒ 三红腿全程 `fetch failed`，`http=1`（首个 `fetch` 抛错）。故本单**只覆盖静态腿（A–F，含 `D6/D7/D8`）**；受控实例真 HTTP 判据 = **NOT_MEASURED**（与派单「本单预期无需起服务」一致）。
2. **仅落变体 Ⅰ 于 `p8-s7` 一门**：S20 §2.2 表内其余**扫 `src` 的低险门**（`p8-s1/s3/s3b/s4/s5`）本单**未加**排除式——S20 判定其风险为「低」、且本单派单聚焦唯一高险门 `p8-s7`。它们对 `src/**` 的假红面**仍在**（`src` 内若新增探针命名式件仍可能命中）⇒ 列为后续项，**本单 NOT_MEASURED**。
3. **`p4z-b3afix2-01-gen-0020.ts` 等 `-01-` 型件已被 `seq` 覆盖**（§1.2）；但**未被 `seq` 覆盖的 scripts 件**（45 件内、无前置编号/探针命名）**仍留在检出面**——本单**未逐一核**其是否会触发 `D6/D7/D8`（现取 `full_set_21=6` 已证当前无一件触发）。
4. **未测** `docs/**` 下未来新增规格件是否会撞 `full_set_21`：`docs` 无排除式（射程外），若某 `docs/*.md` 含完整 kind 枚举，仍会入 `full_set_21` 桶（现取 `spec_text=129`、`full_set_21=6`，不含 docs）⇒ 列为已知面。
5. **`D7` 的诊断性读数（非判据）前后有变**：见 §5.2（`probe_or_artifact` 11→0、`readonly_call_or_subset` 15→14、`hits` 169→157）——**判据 pass/fail 与总数逐条相同**，仅 `actual` 桶明细随「探针不再计入」而变化。

---

## §5 自曝

1. **`HEAD` 会话期中被外推**（`1bff643 → 25121f0`，他方进程纯 docs 提交）：非本单所为，本单**未** commit / push（§0.1）。
2. **`p8-s7` 读数逐条对照（改前 vs 改后）**：

   | 读数 | 改前 | 改后 |
   |---|---|---|
   | summary | `total=59 passed=56 failed=3 pending_apply=0 db=7 http=1` | **同左逐字** |
   | 红 id | `G8,G9,G10` | **同左逐字** |
   | `D7.actual.buckets.full_set_21` | `6` | **6** |
   | `D7.actual.buckets.probe_or_artifact` | `11` | **0** ← 变化（探针/产物件不再计入） |
   | `D7.actual.buckets.readonly_call_or_subset` | `15` | **14** ← 变化 |
   | `D7.actual.hits` | `169` | **157** ← 变化 |
   | `D7` pass | true | **true** |

   ⇒ **总读数（59/56/3）与逐条 pass/fail 完全一致**；变化**仅**出现在 `D7` 的**诊断性桶明细**（本就应有：被排除的探针不再参与扫面），**未改任何判据/期望集**。
   > ★ **本报告自身亦是 `docs/` 扫面面内一件**（`.md` · 命中 `SCAN_RE` · 含 24 值 kind 清单）⇒ **本报告落盘后**复跑 `p8-s7`，`D7.buckets.spec_text` `129 → 130`、`hits` `157 → 158`（本报告归 `spec_text` 桶，`isDocs` 优先 ⇒ **不入** `full_set_21`，`D6/D7/D8` **仍绿**、总读数仍 `59/56/3`）。收工现取复跑即此读数（`p8s7-20261004T122139Z`）。
3. **主仓零残留自证**：两处负对照临时件均**已删除**——`git status --porcelain`（tracked）**仅** ` M p8-s7-batt-checkin-gate.ts` + ` D src/simple-test.ts`；`grep -E 'zz-negctl'` 于 `git status` **零命中**。未跟踪面新增仅：本报告（`??`）+ `backend-ts/.s21-artifacts/`（`??`，读数）+ 本单跑门产生的 run-tagged 门产物 `backend-ts/.p8s7-artifacts/p8s7-<RUN>/`、`backend-ts/.p8s5-artifacts/p8s5-<RUN>/`（**门自身按设计写**，与仓内既有数百个同族产物同类）。
4. **未 `git add -A` / 未 commit / 未 push / 未 `git rm`**：改动与删除均以**工作区未提交态**交付。
5. **排除式「过宽 ⇒ 假绿」风险的处置**：`seq` 命名式现取排除 `scripts/` 内 209 件（占 296 件约 71%）——此为本单**已声明**的射程；**假绿防线** = ① 排除式**只作用于 `scripts/`**（四根检出面不缩，§1.3）；② `scripts/` 内**非探针命名的交付/门/库件（45 件）仍全量扫描**；③ §2.1 负对照证明**未登记命名式的全闭集件仍必红**。**残留盲区**（如实登记）：若有人把真·全闭集编码写进**探针命名式**件（如 `*-probe.ts`），将被静默排除 ⇒ 该盲区**为本变体固有**（S20 §2.5 已登记），本单以 **fail-loud N/M/K 打印 + artifact 全量 `excluded_files` 清单**留痕，便于回溯。
6. **B11 台账语义**：本单删除 `simple-test.ts` ⇒ 台账 `B11` 由「待删」变「已闭环」（本报告 + git 历史为凭）；`B2` 由「变体 Ⅰ 落地中」变「已落地（`p8-s7` 一门）」。台账文件**未改**（由派单方/收口方同步）。

---

## 附 · 产物锚（run-tagged · `backend-ts/.s21-artifacts/`）

| 项 | 路径 |
|---|---|
| 改前基线 stdout | `backend-ts/.s21-artifacts/before-gate.out` |
| 改后 stdout（含 `SCAN_HYGIENE` 行） | `backend-ts/.s21-artifacts/after-gate-20261004T121851Z.out` |
| 负对照①放件转红 | `.s21-artifacts/nc1-scripts-red-20261004T121919Z.out` |
| 负对照①删件回绿 | `.s21-artifacts/nc1-removed-green-20261004T121935Z.out` |
| 负对照②放件转红 | `.s21-artifacts/nc2-src-red-20261004T121955Z.out` |
| 负对照②删件回绿 | `.s21-artifacts/nc2-removed-green-20261004T122008Z.out` |
| 删 `simple-test.ts` 后 `p8-s7` | `.s21-artifacts/after-del-simpletest-s7-20261004T122024Z.out` |
| 删 `simple-test.ts` 后 `p8-s5` | `.s21-artifacts/after-del-simpletest-s5-20261004T122024Z.out` |
| 门自身产物（`.p8s7-artifacts/`，run-tagged） | `p8s7-20261004T121639Z`（改前）/ `…121852Z`（改后）/ `…121920Z`（NC①红）/ `…121936Z`（NC①绿）/ `…121955Z`（NC②红）/ `…122009Z`（NC②绿）/ `…122025Z`（删后） |
| 门自身产物（`.p8s5-artifacts/`） | `p8s5-20261004T121831Z`（删前）/ `…122033Z`（删后） |
| 改动文件 | `backend-ts/scripts/p8-s7-batt-checkin-gate.ts`（` M`，`53/3`，未 commit） |
| 删除文件 | `backend-ts/src/simple-test.ts`（` D`，工作区删除，未 `git rm`） |
| 本报告 | `docs/audit/s21-scan-root-hygiene.md`（`??`，未 commit） |
