# S20 · 门卫生（B1 常红门前推 · B2 门扫面根盘点）

- **仓库**：`/Users/kevin/bistro/seafood`（Node/TS 后端 + Neon PG18）
- **角色**：Kong（实现方）· **执行**：2026-10-04（CST）
- **本单 = 台账 `docs/OPEN-ITEMS.md` B1 + B2 两件**：B1 = `p7b-03-offline-gates.ts` `AC10-2` 注册点冻结面 `68` 前推至现取真值（+ 增量出处表 + 负对照）；B2 = 全部 `p8-*-gate` 扫面根**只读盘点** + 两变体方案（**本单不改 B2 任何代码**）。
- **硬口径遵守**：未改 `backend-ts/src/**` 产品代码 ✓ · 未改 `migrations/**` / `docs/*.spec.md` / `docs/seafood.master-plan.md` ✓ · 未 `git add -A` / 未 commit / 未 push ✓ · 未 `npm install` ✓ · 未碰 `.env*` ✓ · 未启停 `5787/5788` · 未起任何实例（**未占 5792–5799**）✓ · 禁 `pkill -f`/`killall`（未使用）✓ · 原始输出**不用 `.log` 后缀** ✓ · 测试 uid ≥ 900000（本单未建夹具）✓。
- **改动文件面**：仅 `backend-ts/scripts/p7b-03-offline-gates.ts`（B1 一行数值 + 逐行出处注释）+ 本报告 + `.s20-artifacts/` 读数。

---

## §0 对锚（开工现取）

```
$ git log --oneline -3
f8d6fde fix(jobs): S19 participants_count 真源 = job_submission …+ 报告
862994f docs: §5.335/v0.335 —— S19 派单（participants 真源 …）
81d08a8 feat(jobs): S18 发布者可发现性 …+ 报告

$ git rev-parse HEAD      → f8d6fdebab8d38df66d5d5c0bcf3569d5ebfd226
$ git branch --show-current → main

$ git status --porcelain（开工）
 M docs/seafood.master-plan.md          ← ★ 开工时已存在的**他方**改动（非本单）
 ?? 大量 `backend-ts/.p*-artifacts/` 等未跟踪产物
 ?? docs/OPEN-ITEMS.md
```

> ★ **环境观察（自曝）**：开工时 ` M docs/seafood.master-plan.md`，收工时该文件**已回到干净**（`git status` 不再列它）——本单**未碰**该文件；判定为**会话期内他方进程（ctrl 面板/别的会话）的外部改动**，如实登记（§4）。

---

## §1 B1 · 常红门 `AC10-2` 注册点冻结面前推（68 ⇒ 89）

### 1.1 现取真值（两口径一致 = 89）

| 口径 | 命令 | 读数 |
|---|---|---|
| 门口径（无前置空白容忍，= 脚本内 `^app\.(get\|post\|put\|delete\|patch)\(`） | `cd backend-ts && grep -cE "^app\.(get\|post\|put\|delete\|patch)\(" src/index.ts` | **89** |
| S11 门口径（容前置空白） | `grep -cE "^[[:space:]]*app\.(get\|post\|put\|patch\|delete)\(" src/index.ts` | **89** |
| 逐 verb | `grep -oE "^app\.(get\|post\|put\|delete\|patch)\(" src/index.ts \| sort \| uniq -c` | `get 38 / post 48 / patch 1 / delete 2`（`put 0`；和 = **89**） |

冻结值（改前）= **68** ⇒ 差额 **+21**。

### 1.2 ★ rev ⇒ 注册点（逐 commit 现取 · 递增序列）

**现取法**：`for rev in $(git log --reverse --format=%H -- backend-ts/src/index.ts); do git show "$rev:backend-ts/src/index.ts" | grep -cE "^app\.(get|post|put|delete|patch)\("; done`

**冻结面 [68, 89] 窗口（本单前推射程 · 单调非减 · 每步有因）**：

| rev | 注册点 | Δ | 出处（该 rev 对 `index.ts` 净增的注册点） |
|---|---|---|---|
| `09362ad` | 68 | — | 账本读口 `/api/user/ledger`（67→68；**先于冻结行**） |
| `ae46297` | 68 | 0 | 批 7-A 收口（仅改判据语义，无路由增改） |
| **`9805876`** | **68** | 0 | **退款实现**（写死 `AC10-2 = 68`；该单确「零新注册点」）；后续同值 |
| `b4d0d5d` | 68 | 0 | b8-1 app_config 门禁（无路由） |
| `b082a81` | 69 | **+1** | b8-2：`GET /api/admin/commission_policy` |
| `464cfaa` | 69 | 0 | b8-3b（无路由） |
| `0d86ce5` | 71 | **+2** | b8-4：`GET /api/admin/currency` · `POST /api/admin/currency/:cid/review` |
| `3a36ba5` | 75 | **+4** | b8-5：`GET/POST /api/admin/listing` · `GET/POST /api/admin/arbitration` |
| `38648c1` | 76 | **+1** | p9-1：`GET /api/role-names` |
| `4c40b47` | 80 | **+4** | p9-2：`GET /api/batt` · `GET /api/checkin` · `POST /api/checkin` · `POST /api/checkin/makeup` |
| `627032b` | 85 | **+5** | p9-3：`GET /api/rating/summary` · `GET /api/timeliness` · `POST /api/rating` · `POST /api/listing-orders/:orderId/ship` · `POST /api/listing-orders/:orderId/receive` |
| `eb29831` | 87 | **+2** | p9-4：`POST /api/bttc/mint` · `POST /api/bttc/burn` |
| `614ae53` | 88 | **+1** | p8-6：`GET /api/admin/audit/:table` |
| `88ff631` · `337a5fb` | 88 | 0 | 无路由增改 |
| `9d6bc20` | 88 | 0（−2/+2 重写） | S3：`/api/job/:jobId/apply`、`/api/job/:jobId/accept` 下架为 410 —— **同路径重注册**，计数不变 |
| `692f622` | 89 | **+1** | S6：`GET /api/job/:jobId/submissions` |
| `da65f13` · `9bd1df0` | 89 | 0 | S6b / S16（无路由增改） |

**净增** = 1+2+4+1+4+5+2+1+1 = **21**；68 + 21 = **89** ✓（与现取真值逐字吻合；与 S11 报告独立复核的「89 归因 = S6 新增 `/api/job/:jobId/submissions`」一致）。

**增量逐字取证**（`git diff <a> <b> -- backend-ts/src/index.ts` 抽 `+app.(get|post|…)` 行）：
```
b4d0d5d→b082a81 : +app.get('/api/admin/commission_policy', …
464cfaa→0d86ce5 : +app.get('/api/admin/currency', …  +app.post('/api/admin/currency/:cid/review', …
0d86ce5→3a36ba5 : +get('/api/admin/listing') +post('/api/admin/listing/:listingId/takedown')
                   +get('/api/admin/arbitration') +post('/api/admin/arbitration/:jobId')
3a36ba5→38648c1 : +app.get('/api/role-names', …
38648c1→4c40b47 : +get('/api/batt') +get('/api/checkin') +post('/api/checkin') +post('/api/checkin/makeup')
4c40b47→627032b : +get('/api/rating/summary') +get('/api/timeliness') +post('/api/rating')
                   +post('/api/listing-orders/:orderId/ship') +post('/api/listing-orders/:orderId/receive')
627032b→eb29831 : +post('/api/bttc/mint') +post('/api/bttc/burn')
eb29831→614ae53 : +app.get('/api/admin/audit/:table', …
9d6bc20→692f622 : +app.get('/api/job/:jobId/submissions', …
337a5fb→9d6bc20 : −get('/api/job/:jobId/apply',async) +get('/api/job/:jobId/apply',(_req)   （同路径重注册）
                   −get('/api/job/:jobId/accept',async) +get('/api/job/:jobId/accept',(_req)
```

**全历史序列（透明登记）**：自初版 `4`（`cca78e0`）起，序列含若干**早期跳变**，其中**唯一一处递减** = `2b198d4`（`58→49`，提交名 `refactor: remove legacy aliases and speed up homepage`，**有因**）——该点**早于冻结值 68 约 30 个提交**，**不在 [68,89] 前推射程内**。

> **判定**：**不算「有减无增 / 跳变无因」**。本单前推射程 `[68, 89]` 内序列**严格单调非减**、**每一步都有具名提交与逐字路由出处**（上表）；递减仅存在于冻结面之前的早期历史且原因明确。⇒ **不触发「停下报回」**，按现取真值 `89` 前推。

### 1.3 改动（逐行留痕 · 仅一行数值 + 出处注释）

文件：`backend-ts/scripts/p7b-03-offline-gates.ts`（`git diff --numstat` = **10 / 1**，仅此一文件）

```diff
   const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
-  ck.t('AC10-2', '注册点 = 68 不变（本单零新注册点）', regs === 68, `registration_points=${regs}`);
+  // ★ S20 常红门前推（… 只前推数值，判据形态/其它 AC 一字未改）：
+  //   旧值 = 68（写死于 9805876「退款实现」，**当时**确为零新注册点）；现取真值 = 89。
+  //   出处 = 逐 commit 现取 … （68 9805876 → 69 b082a81 → … → 89 692f622，净 +21）
+  ck.t('AC10-2', '注册点 = 89（自 S10 冻结面 68 前推 +21；逐 rev 出处见上方注释）', regs === 89, `registration_points=${regs}`);
```

- **改前**：`regs === 68`（写死；文案「68 不变（本单零新注册点）」）。
- **改后**：`regs === 89`（**只前推数值**）；文案同步为真；追加逐 rev 出处注释。
- **未改**：判据形态（`regs === <值>`）· 未删断言 · `AC10-1 / AC10-3 / AC10-4 / AC10-5 / AC10-6 / AC10-7` 与 `AC-12/13/14` 全部一字未动（见 §1.5 diff）。

### 1.4 负对照（把期望临时改 88 ⇒ 必红；复原 ⇒ 绿）

| 步骤 | 期望值 | 命令 | 读数 |
|---|---|---|---|
| **改前基线** | 68 | `npx ts-node --transpile-only scripts/p7b-03-offline-gates.ts` | `37/37`? → **否**：`{"total":37,"passed":36,"failed":1,"red":["AC10-2"]}` · **EXIT=1** |
| **前推后** | 89 | 同上 | `{"total":37,"passed":37,"failed":0,"red":[]}` · **EXIT=0** |
| **负对照**（临时 `regs === 88`） | 88 | 同上 | `{"total":37,"passed":36,"failed":1,"red":["AC10-2"]}` · **EXIT=1** ✔ 转红 |
| **复原** | 89 | 同上 | `{"total":37,"passed":37,"failed":0,"red":[]}` · **EXIT=0** ✔ 回绿 |

> 负对照证明 `AC10-2` **仍可证伪**（非恒绿）：喂入非 89 值即转红，复原即回绿。

### 1.5 验收读数（可复算）

- `npx ts-node --transpile-only scripts/p7b-03-offline-gates.ts` ⇒ **37/37 · exit 0 · red=[]**（改前 36/37 red=[AC10-2]）。
- `git diff --numstat` ⇒ `10	1	backend-ts/scripts/p7b-03-offline-gates.ts`（仅此文件；逐行 diff 见 §1.3）。
- `git status --porcelain`（tracked）⇒ 仅 ` M backend-ts/scripts/p7b-03-offline-gates.ts`；**`src/**` 零命中**。
- run-tagged 读数：`backend-ts/.s20-artifacts/{p7b-03-after-…, p7b-03-negctl88-…, p7b-03-restored-…}.json`。

---

## §2 B2 · 门扫面根盘点（**只读** · 本单不改代码）

**方法**：源码读 `readFileSync` / `readdirSync` / `walk*` 的目标（给行号）；逐门判「探针/测试件落其扫面根是否会被算进判据」。**本单未运行任何 `p8-*` 门**（含 DB 腿的门有写副作用；B2 只读盘点不实跑）。

### 2.1 各扫面根现取文件数（`.ts/.sql/.js/.jsx/.mjs/.md`）

| 根 | 现取文件数 | 备注 |
|---|---|---|
| `backend-ts/src` | **21** | 含 1 个测试类件 `src/simple-test.ts`（见 2.3） |
| `backend-ts/scripts` | **296** | ★ **探针/诊断件主落点**（recon 7 / probe 35 / `-00-` 46） |
| `backend-ts/migrations` | **41** | 迁移 sql |
| `frontend/src` | **144** | — |
| `docs` | **344** | 含大量 `docs/**` 规格/版本 |

### 2.2 ★ 逐门扫面根现取表 + 风险判定

| # | 门 | 扫面根 / 目标（行号） | 根内文件数 | 探针落此会被算进判据？ | 有/无风险 |
|---|---|---|---|---|---|
| 1 | `p7b-03-offline-gates.ts` | **定向读**：`src/index.ts`(:19)、`src/listing-funds-service.ts`(:20)、`migrations/0024…sql`(:18) | — | **否**（无目录遍历；探针落 `scripts/` 不入任何判据） | **无风险** |
| 2 | `p8-s1-app-config-gate.ts` | `walkTs(backend-ts/src)` 递归 `.ts`（:52-56 定义 · :61-62 调用） | 21 | **是（低）**：`A1/A2/F1` 全 src 计 `INSERT/UPDATE public.app_config`（须**唯一**=`database.ts`）；`G3` 全 src 扫 `normalizeSystemSettings(`（须 0）。探针落 `src/**` 且含此二 token ⇒ **假红** | **有（低）** |
| 3 | `p8-s2-fee-rebate-gate.ts` | **定向读** index/commission/database/locales/前端 5 件（:36-45,104-105） | — | **否**（无遍历） | **无风险** |
| 4 | `p8-s3-deposit-gate.ts` | `walkTs(backend-ts/src)`（:87-99）＋ `readdirSync(migrations)` 计数（:253） | 21 / 41 | **是（低）**：`E3/F1` 全 src 扫 `listing_deposit_refund`（须 0）；`E6` 迁移文件**计数**冻结。探针落 `src/**` 含该 token ⇒ 假红；探针落 `migrations/**` ⇒ 计数假红 | **有（低）** |
| 5 | `p8-s3b-address-gate.ts` | `readdirSync(backend-ts/src)` **非递归** `.ts`（:259-263）＋ `readdirSync(migrations)`（:276） | 21 / 41 | **是（低）**：非递归 ⇒ 仅 `src/` **根目录**探针命中；子目录不扫 | **有（低）** |
| 6 | `p8-s4-currency-review-gate.ts` | `walkTs(backend-ts/src)`（:267-274）＋ 迁移计数（:324,402） | 21 / 41 | **是（低）**：`F5` 全 src 扫 `listing_deposit_refund` | **有（低）** |
| 7 | `p8-s5-02-ownership-gate.ts` | **无文件读**（仅 `import` src 模块） | — | **否** | **无风险** |
| 8 | `p8-s5-compliance-gate.ts` | `walkTs(backend-ts/src)`（:314-321）＋ 迁移计数（:409,565） | 21 / 41 | **是（低）**：`F5` 全 src 扫 `listing_deposit_refund` | **有（低）** |
| 9 | `p8-s6-site-text-gate.ts` | **定向读**：`scripts/p8-s5-compliance-gate.ts`(:85) · `scripts/p8-s2-fee-rebate-gate.ts`(:86) · `frontend/src/test/unit/i18n-batch-b4a.test.jsx`(:87) | — | **否**（定向读三具名文件；探针不动此三件即无碍） | **无风险** |
| 10 | **`p8-s7-batt-checkin-gate.ts`** | `walk` over **`['backend-ts/src','backend-ts/migrations','backend-ts/scripts','frontend/src','docs']`**（:312 · :327）· ext `.ts/.sql/.js/.jsx/.mjs/.md`（:313） | 21/41/**296**/144/344 | **是（高）**：全闭集编码穷举扫面 ⇒ `full_set_21` 桶（`kinds≥21`）＝ `D6/D7/D8` 判据「恰**六**处」；**`backend-ts/scripts` 在扫面根内** | **有（高）** ★ |
| 11 | `p8-s8-rating-timeliness-gate.ts` | **定向读** index/database/2 sql/4 locales（:53-59） | — | **否** | **无风险** |
| 12 | `p8-s9-bttc-gate.ts` | **定向读** index/database/ledger/4 sql/4 locales（:63-72） | — | **否** | **无风险** |
| 13 | `p8-s10-invite-reward-gate.ts` | **定向读** 5 件（:73-78） | — | **否** | **无风险** |
| 14 | `p8-s11-audit-console-gate.ts` | **定向读** index/database/audit-console/reasons/前端 3 件 + 4 locales + 1 sql（:69-75,371,373,376-377） | — | **否** | **无风险** |

**结论**：**唯一高险门 = `p8-s7-batt-checkin-gate.ts`**（唯一把 `backend-ts/scripts` 纳入扫面根者）。这正是台账 B2 所述 S15 事故（`p8-s5-00-recon{1,2,3}.ts` 落 `p8-s7` 扫面根 ⇒ 假红）的成因；S15 只**治标**（移件），**根治（扫面根显式排除探针）未做**。

### 2.3 ★ `p8-s7` 风险量化（现取 · 静态算）

`p8-s7` 的桶优先级（:341-347，**从高到低**）：
```
isDocs → kinds>=21 → (migrations && kinds>=18) → isArtifact → hasNew → readonly
          ↑ full_set_21（D6/D7 判「恰 6」）                      ↑ D8: hasNew && kinds>=20 判「恰 6」
```
> ⚠ **`kinds>=21` 优先于 `isArtifact`** ⇒ 哪怕探针文件名命中 `isArtifact` 正则 `/\/p[0-9][a-z]+-/`（如 `p8-s5-00-recon.ts`），**只要它内含 ≥21 个 kind 字面量，仍会被算进 `full_set_21` ⇒ `D6/D7/D8` 假红**——这就是 S15 事故的机理（文件名兜底被桶优先级架空）。

**当前 `scripts/` 现取（对照阈值）**：

| scripts 文件 | 命中 SCAN_RE 的 kind 数 | 距 `full_set_21`(≥21) | 含 `checkin_makeup_fee` | 当前是否触发 |
|---|---|---|---|---|
| `p4z-b3afix2-01-gen-0020.ts` | **20** | **差 1** | 否 | 未触发（D8 需 ≥20 **且**含新 kind ⇒ 否） |
| `p3m-00-state.ts` | **20** | **差 1** | 否 | 未触发 |
| `p8-s9-bttc-gate.ts` | 18 | 差 3 | **是** | 未触发（D8 需 ≥20） |
| 其余 12 件 | ≤8 | — | — | 未触发 |

- 现取 `scripts/` 命中 `p8-s7` `SCAN_RE` 的文件 = **15 个**；**无一件达到 ≥21** ⇒ 当前 `full_set_21` 桶 `scripts/` 贡献 = **0**（当前不假红）。
- ★ **但余量极薄**：已有 **两件卡在 20**（差 1 即翻 `D6/D7`），另有一件 18 且**含新 kind**（差 2 即翻 `D8`）。**下一个把 `LEDGER_KINDS` 完整枚举抄进 `scripts/` 的探针/诊断件 ⇒ 立即假红 `D6/D7/D8`**。
- 现取 `scripts/` 探针类命名 = `*recon*` **7** · `*probe*` **35** · `*-00-*` **46**（合计去重 **72** 件）——全部落在 `p8-s7` 扫面根内。

### 2.4 ★ `src/**` 扫面根的同类隐患（低险但有活例）

- `backend-ts/src/simple-test.ts` 现取**存在**（29 行，handler 查询 `SELECT NOW()`）——一个**测试类件落在 `src` 扫面根内**。它**当前不含**任何门扫的 token（`app_config` / `listing_deposit_refund` / `normalizeSystemSettings(`），故**当前不假红**；但它是「测试件落扫面根」的**活例**，对 §2.2 中 `p8-s1/s3/s3b/s4/s5`（扫 `src`）构成**潜在**面。

### 2.5 两变体（**不选** · 方案交 Zang 终审）

#### 变体 Ⅰ · 各门扫面根**显式排除**探针/测试命名式

- **改法**：在各门目录遍历入口加**排除式**（沿既有命名惯例，白名单式）：
  - `p8-s7`（`:314-323` `walk`）：`if (/(^|\/)([^\/]*)(recon|probe|diag|fixture)([^\/]*)\.(ts|js|mjs)$/.test(rel) || /-\d{2}-/.test(ent.name)) continue;`（在 `SCAN_EXT` 判定前）。
  - `p8-s1/s3/s4/s5` 的 `walkTs`、`p8-s3b` 的 `readdirSync(src)`：同式排除 `*recon*/*probe*/*diag*/*-00-*/*.test.*`。
- **改动面**（逐文件）：`p8-s7-batt-checkin-gate.ts`(1 处) · `p8-s1-app-config-gate.ts`(1) · `p8-s3-deposit-gate.ts`(1) · `p8-s3b-address-gate.ts`(1) · `p8-s4-currency-review-gate.ts`(1) · `p8-s5-compliance-gate.ts`(1) —— 共 **6 门**，均为**加一行谓词**。
- **代价**：小（6 处 1 行）；但**每门各写一套**排除式 ⇒ 命名约定需**全仓统一**，否则新命名式漏排即复发。
- **风险（★ 排除式写得太宽的漏检面）**：命名式排除是**人名信任**——若**真缺陷**恰好落在一个被排除的命名件里（如有人把「第二处 app_config 写入」写进 `*-probe.ts`，或把真 kind 枚举抄进 `*-00-*.ts`），该门会**静默放行**⇒ 产生**假绿**（比假红更危险）。故排除式必须**窄到只匹配明确的探针/诊断命名**，且**每次新命名式都须回写排除式**。
- **负对照设计（证明排除后仍抓真违规）**：
  1. **正例**：在 `backend-ts/src/zzz_s20_violation.ts`（**不含**被排除命名式）写一条 `INSERT INTO public.app_config` ⇒ `p8-s1.A1` 必须**转红**（证明排除式未误伤正常命名件）。
  2. **边界反例（记录残留风险，不期望绿）**：同上违规内容改名为 `backend-ts/src/zzz_s20_violation-probe.ts` ⇒ 预期**被排除而假绿**——此项**必须留在报告**作为「排除式的已知盲区」，提示 Zang 该变体**不能单独作为根治**。
  3. **探针回归**：把 `p8-s5-00-recon*.ts` 原样放回 `scripts/` ⇒ `p8-s7.D6/D7` 在**排除式下**必须**保持绿**（证明排除确实生效）。★ 该步须**在只读副本/临时工作树**做，勿污染主工作区。

#### 变体 Ⅱ · 探针/诊断脚本**统一移出** `src`/`scripts` 扫面根

- **改法**：新建 `backend-ts/tools/`（或 `.probe/`，沿既有 `.p9s15-archive/` 先例），把 `scripts/` 下**探针/诊断件（`*recon*`/`*probe*`/`*diag*`/`*-00-*` 测试件）** 迁入，并**同步各门路径**。
- **改动面（逐文件）**：① 迁移件 = `scripts/` 下命名的 **72 件**（重命名/移动）＋ 被它们 `import './xxx-lib'` 的相对路径；② **`p8-s7` 扫面根**（`:312` `SCAN_ROOTS`）**不动**（`backend-ts/scripts` 保留，仅因其中不再有探针而安全）；③ 若个别门**定向读**了将被移动的件，须同步其路径（现取：`p8-s6` 读 `scripts/p8-s5-compliance-gate.ts`、`scripts/p8-s2-fee-rebate-gate.ts` —— 此二**不是探针**，**留在 `scripts/`**，无需改）；④ 文档/脚本引用处同步。
- **代价**：**中**（移动 72 件 + 校验无 `import` 断链 + `package.json`/文档引用回写）；一次性。
- **风险**：① **移动面大**，漏改某处 `import`/文档路径 ⇒ 脚本不可运行（可被 `tsc`/`grep` 检出）；② 「探针」判定线需口径（哪些算探针、哪些是**交付脚本**如 `migrate.ts`/`ns-alloc.ts` **必须留**）；③ 与**未跟踪的大量 `scripts/*.ts`**交互——须确认移动面只含**探针**、不误移交付件。
- **负对照设计（证明扫面根仍抓真违规）**：
  1. **移出后回归**：迁移完成、各门复跑 ⇒ `p8-s7` `full_set_21` 仍 = **6**（`D6/D7/D8` 绿）。
  2. **反向注入（证明扫面根未失效）**：**临时**把一个含完整 `LEDGER_KINDS` 的 `zzz-probe.ts` 放回 `backend-ts/scripts/` ⇒ `p8-s7.D6/D7` 必须**转红**（证明门**仍在扫 `scripts/`**、未因移动而放空）；移走 ⇒ 回绿。★ 该注入须**只读副本/临时工作树**执行，勿留主工作区。
  3. **交付件不误移**：`grep -rn "import .* from './<moved>'"` 全仓须为空；`tsc -p tsconfig.json`（`include=["src/**/*"]`）不受影响（`scripts/`/`tools/` 均不在 build 面）。

#### 变体对比（不选，供终审）

| 维度 | 变体 Ⅰ（排除式） | 变体 Ⅱ（移出） |
|---|---|---|
| 改动面 | 6 门各 1 行谓词 | 移动 ~72 件 + 引用回写 |
| 一次性代价 | 小 | 中 |
| 复发风险 | **中**（新命名式须回写；排除式过宽 ⇒ 假绿） | **低**（扫面根本身干净，无需逐门信任人名） |
| 静默假绿风险 | **有**（★ 见 Ⅰ.2 边界反例） | 低（靠「仍抓真违规」负对照兜底） |
| 依赖 | 全仓命名约定统一 | 探针/交付件判定口径 |

---

## §3 未做 / NOT_MEASURED（诚实登记）

1. **未运行任何 `p8-*` 门**：B2 只读盘点，`p8-s7` 等含 DB 腿的门有写副作用（即便 ROLLBACK），本单**未实跑** ⇒ `p8-s7` 的**当前实跑读数**（`D6/D7/D8` 是否红）为 **NOT_MEASURED**；本报告的风险判定基于**源码静态分析 + 阈值计算**（§2.3），非实跑读数。
2. **未改 B2 任何代码**（派单硬口径）：§2.5 两变体**仅方案**，未落任何文件。
3. **未验证 `*.test*` / 未跟踪件是否命中其它扫描器**：现取仅覆盖 `p8-*-gate.ts` 与 `p7b-03`；`frontend/scripts/*.mjs` 等其它扫描器**未测**。
4. **未做 `tsc -p tsconfig.json` 全量编译**：本单仅改 1 行数值 + 注释（`scripts/` 不在 `tsconfig.include`），未实跑 build。
5. **早期全历史序列的唯一递减**（`2b198d4` 58→49）**未逐字核该提交的删行清单**（仅据提交名「remove legacy aliases」判定有因）；其**不在 [68,89] 射程内**，不影响本单前推。

## §4 自曝

1. **`docs/seafood.master-plan.md` 的外部漂移**：开工 ` M`（他方改）→ 收工**回干净**；本单**未碰**。判定为会话期内**他方进程**改动（§0）。已如实登记，未做任何订正。
2. **本单未起任何服务、未占端口**：`p8-s7` 等的「受控实例真 HTTP」腿**未触发**（未起 5792–5799）。故本报告**无** HTTP 腿读数。
3. **「改动面仅 1 文件」自证**：`git diff --numstat` = 单行 `10 1 backend-ts/scripts/p7b-03-offline-gates.ts`；`git status --porcelain`（tracked）仅此一文件；`git status --porcelain | grep 'src/'` **空**。
4. **未 commit / 未 push / 未 `git add -A`**：改动以工作区未提交态交付。
5. **负对照的「88」为临时改值**：仅用于 §1.4 一次性证伪，**已复原为 89**（§1.4 第 4 步读数即证）。
6. **B1 射程判定（非自证绿）**：我裁定「早期递减（`2b198d4` 58→49）在冻结面之前、有因 ⇒ 不触发停下条件」——此为**判断**，非机器读数，特此标明供 Zang 复核。

---

## 附 · 产物锚

| 项 | 路径 |
|---|---|
| 前推后读数 | `backend-ts/.s20-artifacts/p7b-03-after-20261004T121332Zs20.json` |
| 负对照（期望 88）读数 | `backend-ts/.s20-artifacts/p7b-03-negctl88-20261004T121352Zs20.json` |
| 复原后读数 | `backend-ts/.s20-artifacts/p7b-03-restored-20261004T121411Zs20.json` |
| 门自身产物（`.p7b-artifacts/`，run-tagged） | `p7b-03-offline-gates-20261004T121332Z59xe.json`（绿）等 |
| 改动文件 | `backend-ts/scripts/p7b-03-offline-gates.ts`（` M`，未 commit） |
| 本报告 | `docs/audit/s20-gate-hygiene.md`（`??`，未 commit） |
