# 批 8 第二片 8② 二收口 —— 费率 / 返佣权重矩阵（读口 + 后台两页）

> **作者角色** = **Kong（实现方）** · **单别** = 批 8 第二片 **8②**（`commission_policy` 读口 + 费率页 / 返佣权重矩阵页）· **本件 = 8② 二收口**（改后全量硬门复跑 + 报告落盘回填 + HTTP 只读探针 + 收尾）。
> **契约真源**：`docs/route-layer.spec.md` **v2.4 §19**（§19.2 读口契约 / §19.4 真生效四段判据 / §19.5 后台页四语面）。
> 本件所有读数为本单现取；未测项标 `NOT_MEASURED`（禁填 0 / 禁空）。
> **占位归零**：本件「双下划线」占位模式计数 = **0**（现取 `grep -c '__' docs/audit/p8-s2-fee-rebate.md` ⇒ **0**）。
> **硬口径自证**：本单**未**新增 / apply 迁移；**未**删 / 改 `commission_policy` 既有行；**未**碰 `migrations/**`、任何 `docs/*.spec.md`、`master-plan`、既有 `docs/qa/**`、既有 `docs/audit/**`（除本件）；**未** `git add/commit/push`；**未** `npm install`；**未**碰 / 打印 `.env*`；**未**用 `pkill -f` / `killall`；**未**启停 5787/5788；受控实例只用 **5796**（链 `backend-ts/.env.local`，不打印内容），收尾按**精确 PID** `kill -TERM` + `lsof` 空读数；**未**写入 `listing_deposit_policy` 键。

---

## §0 开工锚 + 改后全量硬门复跑

### 0.1 开工锚（现取）

| 项 | 命令 | 现取读数 |
|---|---|---|
| 仓库 HEAD | `git rev-parse HEAD` | `d39d441c575dc1ec6da95d95a7d7b0f59c5156b1` |
| 分支 | `git rev-parse --abbrev-ref HEAD` | `main` |
| 主工作区 `git status --porcelain`（首） | `git status --porcelain` | `M`×11（本单：`backend-ts/src/index.ts` / `frontend/src/App.jsx` / `frontend/src/components/layout/AdminLayout.jsx` / 四语 `locales/*.json` / 四个 `i18n-*.test.jsx`）+ 未跟踪（本单探针 / 门 ×5 / 新两页；既有产物 `.p4-artifacts/p6tr1a-20261002T143525Z/` / `.p8s1-artifacts/p8s1-20261002T143526Z/` / `.p8s2-artifacts/`） |
| 收口时点 | `date "+%Y-%m-%d %H:%M:%S %Z"` | `2026-10-02 22:51:29 CST` |

### 0.2 ★ 改后全量硬门复跑（退出码一律**管道外**捕获）

| # | 门 | 命令 | 退出码 | 读数 |
|---|---|---|---|---|
| 1 | **类型** | `cd backend-ts && npx tsc --noEmit` | **0** | 输出 **0 字节**（零诊断） |
| 2 | **离线套件** | `npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts` | **0** | **`total=126 passed=126 failed=0`** · 产物 `.p4-artifacts/p6tr1a-20261002T144653Z/offline-tests.json` |
| 3 | **`p8-s1` 门** | `npx ts-node --transpile-only scripts/p8-s1-app-config-gate.ts` | **0** | **`total=24 passed=24 failed=0`**（**无回归**）· 产物 `.p8s1-artifacts/p8s1-20261002T144655Z/gate.json` |
| 4 | **★ 新门 `p8-s2`** | `npx ts-node --transpile-only scripts/p8-s2-fee-rebate-gate.ts` | **0** | **`total=41 passed=41 failed=0`** · 产物 `.p8s2-artifacts/p8s2-gate-20261002T145125Z/gate.json` |
| 5 | **前端构建** | `cd frontend && npm run build` | **0** | `✓ built in 1.60s`；`dist/assets/index-B-JvDbIk.js 338.43 kB`（gzip 98.24 kB）/ `index-BTXSvY-M.css 125.08 kB`（gzip 23.24 kB） |
| 6 | **单测** | `cd frontend && npm run test:unit` | **0** | **`Test Files 31 passed (31)` · `Tests 276 passed (276)`** · Duration 4.01s |
| 7 | **七门** | `node scripts/<gate>.mjs` ×7 | **全 0** | 见 0.3 |

> 退出码捕获方式（逐字）：`{ <cmd> > <out> 2>&1; echo "EXIT=$?"; }` —— **管道不参与**（禁 `cmd | tail` 吞码）。
> `p4z-feperf-safelist` 依赖 `dist/` ⇒ **已在 #5 build 之后**跑。

### 0.3 七门逐门读数（`EXIT=0` 全部）

| 门 | 读数（现取摘要） |
|---|---|
| `p4z-i18nviol-global` | `总判：PASS`（locale 裸命中 0 + source 裸命中 0；类级作用域 = **65** 源文件；**形态命中 = 0** / 显式豁免 **0/0** / **类级残余（活体）= 0**；locale 叶子 = **3152** / source 节点 = 40） |
| `p6-tr2-i18n-locales` | `总判：PASS`（四语 `top=105 flat=788` 键集相等；`新接文件守卫=PASS`；六页逐页 `??命中=0 经i18n-content=yes`） |
| `p4z-miscfix-links` | `总判：PASS（残留全部已登记）`（扫描 **79** 源文件 / 命中行 **1** / **未登记残留 = 0**） |
| `p4z-feperf-safelist` | `VERDICT=PASS`（`dist/assets/index-BTXSvY-M.css` 125079 B；`safelist_missing_in_dist=[]` / `dynamic_missing_in_dist=[]` / `micro_legacy_literal_in_css=false`） |
| `p7a-03-errmessage-gate` | `总判：PASS`（扫描文件 **79** / 受体 **6** / **命中 0** / 基线 0） |
| `p7b-errfallback-gate` | `总判：PASS`（`D 节点=132 需护栏=0 已本地化=132`；`G 键不可用=0/132`；`A=PASS`） |
| `p7c-errmsg-machinecode-gate` | `总判：PASS`；**★ `链路体制 = 真链`**（`D 类级违例=0/16` / `F 反例违例=0/16` / `G 机读码出现次数=0/36 违例=0`） |

---

## §1 交付物清单

**代码（唯一写者范围 · 现取 `git diff --stat`）**：

| 文件 | 改动 | 内容 |
|---|---|---|
| `backend-ts/src/index.ts` | `+27` | 新增读口 `GET /api/admin/commission_policy`（闸 `manage_settings`；取数复用 `getCommissionPolicy`；R107 出口；读口内零 SQL / 零写路径）；导入改 `{ getCommissionPolicy, insertCommissionPolicy }` |
| `frontend/src/pages/admin/FeeRatePage.jsx` | 新增（未跟踪） | 费率页（8 字段面 + i18n） |
| `frontend/src/pages/admin/ReferralWeightMatrixPage.jsx` | 新增（未跟踪） | 返佣权重矩阵页（矩阵 4 键 + i18n） |
| `frontend/src/App.jsx` | `+5` | 两条路由 `fee-rate` / `weight-matrix`，闸 `manage_settings` |
| `frontend/src/components/layout/AdminLayout.jsx` | `+16` | 两条菜单（`adminNav.feeRate` / `adminNav.weightMatrix`），闸 `manage_settings` |
| `frontend/src/locales/{zh,en,hk,vn}.json` | 各 `+49` | 四语新增 `adminFeeRate`(18) / `adminWeightMatrix`(21) / `adminNav`(+4) |
| `frontend/src/test/unit/i18n-*.test.jsx` ×4 | 断言同步 | 既有 i18n 单测键数 / 键集 / 节点期望随 +4 / +43 更新（见 §8 期望订正） |

**探针 / 门（未跟踪）**：`backend-ts/scripts/p8-s2-fee-rebate-gate.ts`（类级门，41 判据）、`p8-s2-01-effective.ts`（真生效四段探针）、`p8-s2-02-http-readonly.ts`（HTTP 只读探针）、`p8-s2-00-probe.ts` / `p8-s2-00b-probe.ts`（现取探针）。

**本件**：`docs/audit/p8-s2-fee-rebate.md`。

**产物**：`.p8s2-artifacts/p8s2-effective-20261002T144321Z/effective.json`（24/24）、`.p8s2-artifacts/p8s2-gate-20261002T145125Z/gate.json`（41/41）、`.p8s2-artifacts/p8s2-http-20261002T144915Z/http.json`（8/8）、`.p4-artifacts/p6tr1a-20261002T144653Z/offline-tests.json`（126/126）、`.p8s1-artifacts/p8s1-20261002T144655Z/gate.json`（24/24）。

---

## §2 ★ 四段真生效逐段读数（`R-8-15` 事务内 ROLLBACK · run `20261002T144321Z` · 24/24）

受控实例 = **5796**（链 `backend-ts/.env.local`，**不打印内容**）；真库 = Neon（`Using Neon PostgreSQL for Seafood API routes`）。**四段** = ①后台写 → ②库内落值（给表 / 列）→ ③业务读口取数（给 `文件:行`）→ ④行为随之（改前 / 改后）。

**基线（开工 · 只读）**：`commission_policy` 现取 **3 行**；现行 = `policy_id=3`，`fee_rate_bp=100`，`levels=10`，`weights_bp={3000,2000,1500,1000,800,600,500,300,200,100}`，`effective_from=2026-10-01 19:21:28.285+00`。

### 2.1 段 A · `fee_rate_bp`（§19.4(b)）—— `job_fee` **1000 → 2500**

| # | 段 | 判据 | 逐段读数（现取） |
|---|---|---|---|
| — | 改前 | 读口 / DB 同核 / 服务层 | 读口 `{policy_id:"3", fee_rate_bp:100, weights_bp:[3000,…,100]}`；`job_settle_plan` `{fee:"1000", layers:[{L1,x:"600"},{L2,x:"400"}]}`；`planJobSettlement` `{fee:"1000", net:"99000", layer_x:[{L1,"600"},{L2,"400"}]}` |
| ① | **后台写** | 服务层同写口 `insertCommissionPolicy`（`POST /api/admin/commission_policy` 同路径） | `{fee_rate_bp_returned:250, policy_id:"8", returned_keys:8 键}` |
| ② | **库内落值** | `public.commission_policy` · 列 `fee_rate_bp` / `effective_from` | `{policy_id:"8", fee_rate_bp:250, effective_from:"2026-10-02 14:43:24.864893+00"}` |
| ③ | **业务读口取数** | 锚 1 = `src/commission.ts:201` `getCommissionPolicy`；锚 2 = `migrations/0013_job.sql:250` `job_settle_plan` | 读口 `{policy_id:"8", fee_rate_bp:250}`；DB 函数 `{db_fn_fee:"2500", db_fn_fee_rate_bp:250}` |
| ④ | **行为随之** | 同一 `gross=100000` 的 `job_fee` 金额 | `{before_fee:"1000", after_fee:"2500", before_net:"99000", after_net:"97500"}`；公式 `fee=(gross×bp+5000)/10000` ⇒ `{1000, 2500}` ✓ |

**段 A 判负自证**：自证项「`A2-db-fee_rate_bp-landed` 的谓词」（喂 `251`）⇒ 转红 ✓；「`A4-job_fee-amount-differs` 的谓词」（喂 `"1000"`）⇒ 转红 ✓。

### 2.2 段 B · `weights_bp`（§19.4(c)）—— `x_L` **[600,400] → [625,375]**

| # | 段 | 判据 | 逐段读数（现取） |
|---|---|---|---|
| — | 改前 | 政策 / 服务层 | `{M:2, W:"5000", weights:[3000,2000], layer_x:[{L1,"600"},{L2,"400"}]}` |
| ① | **后台写** | 服务层同写口（只改 `weights` / `levels`） | `{returned_levels:3, returned_weights_bp:[5000,3000,2000], returned_weights_sum_bp:10000}` |
| ② | **库内落值** | `public.commission_policy` · 列 `weights_bp` / `levels` | `{policy_id:"9", levels:3, weights_bp:"{5000,3000,2000}", effective_from:"2026-10-02 14:43:27.437845+00"}` |
| ③ | **业务读口取数** | 锚 1 = `src/commission.ts:432` `splitPool`（← `:645` `planJobSettlement`）；锚 2 = `migrations/0013_job.sql:336-360` | 读口 `{weights_bp:[5000,3000,2000], levels:3, weights_sum_bp:10000}`；DB 函数 `{W:"8000", weights_bp:[5000,3000]}` |
| ④ | **行为随之** | 同一 `fee=1000` 的各层 `x_L` | `before.layer_x=["600","400"]` → `after.layer_x=["625","375"]`（逐层不等 ✓） |

**段 B 不变量（逐条现取）**：

| 不变量 | 判据 | 现取读数 |
|---|---|---|
| **`Σx_L == fee`** | 各层分配额之和 == 佣金池 `fee` | `{sum_x:"1000", fee:"1000", db_sum_x:"1000", db_fee:"1000"}` ✓ |
| **`-2` 池净额 = 0** | `job_fee` 入 `-2` 腿 + `commission` 各层 `-2` 腿 = 0 | `{fee_credit_uid:"-2", pool_inflow:"1000", pool_outflow:"-1000", pool_net:"0"}` ✓ |

**段 B 判负自证**：自证项「`B2-db-weights_bp-landed` 谓词」（喂旧权 `{3000,…,100}`）⇒ 转红 ✓；「`B4-xL-differs` 谓词」（喂 `["600","400"]`）⇒ 转红 ✓；「`B4-pool-minus2-conserved` 谓词」（喂 `"-1"`）⇒ 转红 ✓。

### 2.3 `R-8-15` 逐字执行与**事务外复取**

- **逐字执行**：两段各自在自己 `withTransaction` 内完成（服务层写路径 `insertCommissionPolicy` 与 `POST /api/admin/commission_policy` **同一函数**），写后**读回**、判完 **抛 `RollbackSentinel`** ⇒ `withTransaction` 走 `catch` ⇒ **`ROLLBACK`（绝不 COMMIT）**。**未跑任何 HTTP POST**（逐字见探针头注 `R-8-15`）。
- **事务外复取（回滚自证）**：

| 判据 | 现取读数 |
|---|---|
| `commission_policy` 行数 | **`count=3`**（与开工基线同）✓ |
| 政策行**逐字节**同基线 | `rows_identical=true` ✓ |
| `max(effective_from)` 未前移 | `2026-10-01 19:21:28.285+00`（= 基线首行值）✓ |

> 24 判据 = 段 A 9（改前 1 + 写形状 1 + 落值 1 + 读口 2 + 行为 3 + 自证 2 中的…）与段 B 12 与回滚 3 之合计 —— **24/24 passed**（逐条见 `.p8s2-artifacts/p8s2-effective-20261002T144321Z/effective.json`）。

---

## §3 注册点现取与读口契约

| 项 | 命令 | 现取读数 |
|---|---|---|
| 注册点总数 | `grep -cE '^app\.(get\|post\|put\|patch\|delete)\(' backend-ts/src/index.ts` | **69**（v1.8 的 68 ⇒ 本读口 **+1**，§1.14 增量登记） |
| 逐 verb | 同式分 verb | **GET=28 / POST=38 / PUT=0 / PATCH=1 / DELETE=2** |
| 读口注册恰 1 处 | — | ✓（`GET /api/admin/commission_policy`） |
| 写口仍在同路径 | — | ✓（`POST /api/admin/commission_policy` 恰 1 处；同族先例 = `GET\|POST /api/admin/settings`） |
| 读口闸 | — | `requireAdmin(req, res, 'manage_settings')`（与写口**同键**，11 键内，`R-8-1` **零新增权限键**） |
| 取数口径 | — | **复用** `getCommissionPolicy`（`src/commission.ts:201`）；读口 handler 内 **零 SQL / 零写路径** |
| 出口形状 | — | R107：成功 `{success,message,data}`；`data` = **形态 A** = `CommissionPolicy` 恰 **8 键**本体 |

**`data` 8 键（逐字冻结）**：`created_by` / `effective_from` / `fee_rate_bp` / `levels` / `policy_id` / `time_created` / `weights_bp` / `weights_sum_bp`（第 8 键 `weights_sum_bp` = **读时算一次** `weights.reduce(...)`，非存储列；`SELECT` 7 列）。三处同键集：`CommissionPolicy` 接口 / `mapPolicy` / `getCommissionPolicy` SELECT。

---

## §4 后台页改动面与 8 字段 + 四语键（18 / 21 / 20）

**后台页（2 件 · 新增）**：

| 页 | 字段面（⊆ 8 键） | 路由 / 菜单 | 闸 |
|---|---|---|---|
| `FeeRatePage.jsx` | **全部 8 键** 引用 | `path="fee-rate"` ⇄ `adminNav.feeRate` | `manage_settings` |
| `ReferralWeightMatrixPage.jsx` | `levels` / `weights_bp` / `weights_sum_bp` / `fee_rate_bp` | `path="weight-matrix"` ⇄ `adminNav.weightMatrix` | `manage_settings` |

**四语键（现取）**：

| 命名空间 | zh | en | hk | vn | 键集相等 |
|---|---|---|---|---|---|
| `adminFeeRate` | 18 | 18 | 18 | 18 | ✓ |
| `adminWeightMatrix` | 21 | 21 | 21 | 21 | ✓ |
| `adminNav` | 20 | 20 | 20 | 20 | ✓ |

**本片 `adminNav` +4 键**：`feeRate` / `feeRateDesc` / `weightMatrix` / `weightMatrixDesc`（四语均齐；`en` 现值 `feeRate="Fee Rates"` / `weightMatrix="Weight Matrix"`）。

---

## §5 ★ 新门 `p8-s2-fee-rebate-gate` 判据清单（41/41）

**门属性**：`offline: true` · `db_connections: 0` · `http_calls: 0`（**零 DB / 零网络 / 零 HTTP**）。**判据总 41 = A 9 + B 5 + C 7 + D 7 + E 6 + F 7**。

| 组 | 条目 | 判据 | 现取 |
|---|---|---|---|
| **A · 读口注册**（9） | A1 | 注册点 = **69** | `69` ✓ |
| | A2 / A3 | 读口 / 写口**各恰 1 处** | ✓ |
| | A4 / A5 | 读口 / 写口闸 = `manage_settings` | ✓ |
| | A6 | 读口取数 = **复用** `getCommissionPolicy` | ✓ |
| | A7 | 读口 handler 内**零 SQL** | ✓ |
| | A8 | 读口**只读纪律**（零 `INSERT/UPDATE/DELETE`） | ✓ |
| | A9 | 响应 = 形态 A（`sendSuccess(res, policy, …)`） | ✓ |
| **B · 读口 8 键**（5） | B1 | `CommissionPolicy` 接口 = 冻结 8 键 | ✓ |
| | B2 | `mapPolicy` 返回键集 = 冻结 8 键 | ✓ |
| | B3 | `SELECT` 列 = 7 列 | ✓ |
| | B4 | `weights_sum_bp` = `weights.reduce(...)` | ✓ |
| | B5 | §19.5(a)/(b) 页面用字段 ⊆ 8 键 | ✓ |
| **C · 后台页**（7） | C1 / C2 | 两页字段面齐 | ✓ |
| | C3 / C4 | 两条路由 / 两条菜单 + 闸 = `manage_settings` | ✓ |
| | C5 | 两页（注释剥离后）**零 CJK** | ✓ |
| | C6 | 前端守卫常量 = `src/commission.ts` 守卫**逐值相等** | ✓ |
| | C7 | 两页无占位符 / TODO / 空壳 | ✓ |
| **D · 四语键**（7） | D1×3 | `adminFeeRate`(18) / `adminWeightMatrix`(21) / `adminNav`(20) 四语键集相等 | ✓ |
| | D2 | `adminNav` 四语均含 +4 键 | ✓ |
| | D3 | 两命名空间**逐键非空串** | ✓ |
| | D4 | `en` / `vn` 两命名空间**零 CJK** | ✓ |
| | D5 | `hk` 为繁体（抽查 2 条） | ✓ |
| **E · 六类工程口径泄漏 = 0**（6） | E1–E6 | ①章节/条号 ②HTTP 状态码 ③接口路径/方法 ④内部批次名 ⑤机读码/裸键 ⑥表名/列名/函数名 ⇒ 命中 = 0 | `leak_hits=[]`（扫描 **156** 值）✓ |
| **F · 门自证（负对照，7）** | E1–E6 自证项 | 六类各注入一例 ⇒ 扫描器**必须转红** | 六条全 `fired=true` ✓ |
| | F-clean-control | 反向负对照：干净文案（`adminFeeRate.saved` / `adminWeightMatrix.colShare`）**零命中** | ✓ |

`readings`（现取）：`registration_points=69` · `registration_by_verb={get:28,post:38,put:0,patch:1,delete:2}` · `locale_ns_key_counts` 四语均 `{adminFeeRate:18, adminWeightMatrix:21, adminNav:20}` · `leak_scan_values=156` · `leak_hits=[]`。

---

## §6 ★ 仓外副本三处变异（逐字红读数 + 复原）

**副本位置（仓外 · `NOT` 在仓库树内）**：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p8s2-falsify3/<variant>/`（只复制门所读的 11 个文件：`backend-ts/src/{index.ts,commission.ts}` + 门脚本 + `frontend/src/{App.jsx,components/layout/AdminLayout.jsx,pages/admin/{FeeRatePage,ReferralWeightMatrixPage}.jsx,locales/{zh,en,hk,vn}.json}`；`__dirname` ⇒ `REPO_ROOT` = 副本根；`node_modules` 无需软链——门只 `import fs/path`）。产物落**副本自有** `.p8s2-artifacts/`。

**变异① · 删 `adminNav` 键 ⇒ `39/2`** —— 落点：副本**四语** `adminNav` 删 `weightMatrixDesc`。
```
RED D1-adminNav [fourLangKeys]
    expect: `adminNav` 四语齐备且键集相等、键数 = 20（现值）
    actual: {"per_lang":[19,19,19,19],"equal":true,"zh_keys":19}
RED D2-adminNav-add4 [fourLangKeys]
    expect: `adminNav` 四语均含本片 +4 键（feeRate / feeRateDesc / weightMatrix / weightMatrixDesc）
    actual: [["weightMatrixDesc"],["weightMatrixDesc"],["weightMatrixDesc"],["weightMatrixDesc"]]
```
⇒ `total=41 passed=39 failed=2` ✓

**变异② · 注入章节号 ⇒ `40/1`** —— 落点：副本 `zh` 的 `adminWeightMatrix.intro` **值末追加 `§19`**（改值、不增键）。
```
RED E1 [noEngLeak]
    expect: 禁泄漏 ① 本册章节号 / 条号 ⇒ 命中 = 0
    actual: [{"id":"E1","hit":"§1","value":"本页按层级维护返佣权重矩阵：层级数即行数，逐层权重即每行数值；保存后即时成为新的生效版本。§19"}]
```
⇒ `total=41 passed=40 failed=1` ✓（**反例对照**：若注入 `adminFeeRate.saved` 值，则 **`F-clean-control` 同时转红** ⇒ 40/2，故本变异改注 `intro` —— 证明 `F-clean-control` 的取样键是**独立**判据。）

**变异③ · 三处源改 ⇒ `38/3`** —— 落点：(a) `App.jsx` 的 `fee-rate` 路由闸串改坏；(b) `AdminLayout.jsx` 的 `adminNav.weightMatrix` 菜单项 key 改坏；(c) `FeeRatePage.jsx` 的 `weights_bp` 全改 `weightsXbp`。
```
RED C1 [adminPages]  expect: FeeRatePage.jsx 引用全部 8 键（页面字段面齐）   actual: ["weights_bp"]
RED C3 [adminPages]  expect: App.jsx 两条路由且闸 = manage_settings        actual: {"feeRoute":false,"matrixRoute":true}
RED C4 [adminPages]  expect: AdminLayout.jsx 两条菜单且闸 = manage_settings actual: {"feeMenu":true,"matrixMenu":false}
```
⇒ `total=41 passed=38 failed=3` ✓

> **复原**：三处变异副本已**整体删除**（`rm -rf`；`ls -d .../p8s2-falsify*` ⇒ 无匹配）；**主仓门复跑 = `41/41`**（`.p8s2-artifacts/p8s2-gate-20261002T145125Z/gate.json`）⇒ **判据真源回退必红、复原即绿** ✓。主仓 `git status` **无副本残留**（见 §10）。

---

## §7 HTTP 只读探针（`R-8-15`：只读，绝不跑 POST 写）

**探针** = `scripts/p8-s2-02-http-readonly.ts`（`P8S2_BASE=http://127.0.0.1:5796`，受控实例 5796）· **run `20261002T144915Z` · 8/8 passed（exit 0）** · 产物 `.p8s2-artifacts/p8s2-http-20261002T144915Z/http.json`。

| 面 | 请求 | 现取读数 |
|---|---|---|
| 健康 | `GET /` | `200` |
| **admin 200** | `GET /api/admin/commission_policy`（admin token，uid=1） | `200`；`top_keys=["data","message","success"]`；`success=true`；`data_keys` = **8 键**（`created_by,effective_from,fee_rate_bp,levels,policy_id,time_created,weights_bp,weights_sum_bp`）；`data={policy_id:"3", fee_rate_bp:100, levels:10, weights_bp:[3000,…,100], effective_from:"2026-10-01 19:21:28.285+00", weights_sum_bp:10000}` |
| **库现取对拍** | HTTP `data` ⇄ DB 现行行 | 同源：`http={policy_id:"3", fee_rate_bp:100, levels:10}` ⇄ `db={policy_id:"3", fee_rate_bp:100, levels:10}` ✓ |
| **无 token ⇒ 401** | `GET`（无头） | `401`；body `{"error":{"code":"AUTH_UNAUTHORIZED","message":"AUTH_UNAUTHORIZED","i18n_key":"auth.err.AUTH_UNAUTHORIZED","details":{}}}`；**R107 键集**：顶层恰 `["error"]`、`error` 键恰 `["code","details","i18n_key","message"]` ✓ |
| **非 admin ⇒ 403** | `GET`（uid=2 非管理员 token） | `403`；body `{"error":{"code":"AUTH_FORBIDDEN","message":"AUTH_FORBIDDEN","i18n_key":"auth.err.AUTH_FORBIDDEN","details":{"reason":"NOT_ADMIN"}}}` ⇒ **`reason` 逐字 = `NOT_ADMIN`** ✓ |
| **伪造 token ⇒ 401** | `GET`（`not-a-real-token`） | `401` ✓ |
| **只读纪律** | 探针前后 `count(*)` | `policy_count_after_probe=3`（**政策表未被触碰**）✓ |

**★ `POST` 面 = `NOT_MEASURED`（逐字原因）**：
> `R-8-15`：`commission_policy` 表 **append-only**（`0007:102-112`，`trg_commission_policy_append_only` 对 UPDATE / DELETE 直接 RAISE）+ 新政策行以新 `effective_from` **直接成为现行政策** ⇒ 真 `POST` 即**永久改变线上费率 / 佣金**（不可删、不可改）。写段改由 `scripts/p8-s2-01-effective.ts` 在**事务内 ROLLBACK** 完成（服务层同路径 `withTransaction` + `insertCommissionPolicy`）。**本单绝不跑 HTTP POST 写。**

---

## §8 期望订正（逐字登记）

**★ `B8S2_ADDED_TO_ADMINNAV = 4`（本片给既有 `adminNav` 的增量）—— 具名常量 + 理由**：
- **落点**：`frontend/src/test/unit/i18n-batch-b4a.test.jsx` 新增 `const B8S2_ADDED_TO_ADMINNAV = 4`，并入派生式 `NEW_KEY_TOTAL = B4A_ADDED + B4B_ADDED_TO_ADMINCOMMON + B8S2_ADDED_TO_ADMINNAV`。
- **理由**：`adminNav` 的**期望键数**是「**基线 + 本片增量**」的派生量，**不得**直接写死魔数 20 —— 提为**具名常量**后：① 8② 给 `adminNav` 追加的正是 **4 键**（`feeRate` / `feeRateDesc` / `weightMatrix` / `weightMatrixDesc`，两条菜单 + 两条路由面文案）；② 历史锚点（`B4A_ADDED=144` / `B4B_ADDED_TO_ADMINCOMMON=19`）**不改**，只**单列本片 delta** ⇒ 防「顺手改大期望值」掩盖键名事故；③ 常量**可枚举、可判负**（键数漂移即在单测内自显）。

**逐条期望订正（改前 → 改后）**：

| # | 面 | 改前（逐字） | 改后（逐字 · 本片实装） | 依据 |
|---|---|---|---|---|
| 1 | `i18n-batch-b4a.test.jsx` `NEW_NS` | `adminNav: 16` | `adminNav: 20` | 8② 给 `adminNav` +4 键 |
| 2 | `i18n-batch-b4a.test.jsx` 拍平 / 顶层期望 | `{ top: 103, flat: 745 }` | `{ top: 105, flat: 788 }` | 新增顶层 `adminFeeRate`(+18) / `adminWeightMatrix`(+21) / `adminNav`(+4) ⇒ 拍平 **+43**（745⇒788）/ 顶层 **+2**（103⇒105） |
| 3 | `i18n-batch-b4a.test.jsx` `NEW_KEY_TOTAL` | `B4A_ADDED + B4B_ADDED_TO_ADMINCOMMON` | `… + B8S2_ADDED_TO_ADMINNAV` | 见上（具名常量） |
| 4 | `i18n-batch-b4b.test.jsx` 断言 + `AC③` 期望串 | `top=103 flat=745` | `top=105 flat=788` | 同 #2 |
| 5 | `i18n-batch-b5.test.jsx` 断言（2 处）+ 用例名 | `top=103 / flat=745` | `top=105 / flat=788` | 同 #2 |
| 6 | `i18n-violation-closeout.test.jsx` `作用域命中节点数` | `2980`（745 × 4） | **`3152`**（788 × 4） | locale 拍平键 +43 |
| 7 | `i18n-violation-closeout.test.jsx` 四语拍平键数断言 | `745` | `788` | 同 #6 |
| 8 | 门 `p8-s2-fee-rebate-gate` 注册点期望 | （v1.8）`68` | **`69`** | §19.2(b) 读口 +1（§1.14 增量登记） |

> **规范侧无待同步**：本片 `§19` 已在 `route-layer.spec` v2.4 冻结；**本单严守只读纪律，未改任何 `docs/*.spec.md`**。

---

## §9 自曝（口径边界 / 未测项 · 禁填 0 / 禁空）

**判据强度（★ 已登记）**：
1. **四段真生效探针的「判负」= 谓词自证（弱于 `§19.4(d)-⑥`）**：`p8-s2-01-effective.ts` 的 6 条 `…selftest` 项做的是「把**故意错值**喂给**判据谓词** ⇒ 谓词必须返回 false」，即**证明谓词非空转**；它**不是** `§19.4(d)-⑥` 意义上的「**变异真源**（把被测实现改坏）⇒ 门必红」。**两者强度不同**：谓词自证能证「比较器会判错」，**不能证**「被测链路真的接在判据上」。**本单如实登记此强度差**（正因如此，§6 另做**仓外副本三处真变异**，用类级门 39/2 · 40/1 · 38/3 补足「真源变异必红」的证据面）。**已登记为口径边界，不声称等价。**

**未测项（逐项原因 · 禁填 0 / 空）**：
2. **HTTP `POST /api/admin/commission_policy` 面 = `NOT_MEASURED`** —— 原因（逐字）：`R-8-15`，见 §7（append-only + 新行即现行政策 ⇒ 真 POST 永久改线上费率）。写路径证据由**事务内 ROLLBACK 的服务层同路径**（§2.1/§2.2 ①段）承载。
3. **读口 HTTP ↔ 库对拍只断言 `policy_id` + `fee_rate_bp`** —— `GET-matches-db-current` 判据比较的两列即此二者；同响应里的 `levels` / `weights_bp` / `weights_sum_bp` **未逐值断言**（`NOT_MEASURED`，原因：探针判据只覆盖两列；`levels`/`weights_bp` 的现取一致性另由 §2 段 B 的读口对拍（同源 `getCommissionPolicy`）覆盖）。
4. **「经角色行持 `manage_settings`、`is_admin=false`」的管理员路径未测** —— 403 面只实测了「非管理员（uid=2）⇒ 403 `NOT_ADMIN`」；**`is_admin=false` 但角色行持权的 admin 形态**（`NOT_MEASURED`，原因：探针 403 取材只取「非 admin 且无角色行」的 uid=2；该形态的准入判定与 `p7b` 的 actor 分流同源，本读口未单独取材）。
5. **`GET` 面 `at` 查询参数**（`CR4`：`at` **不得**暴露为对外查询参数）**未测** —— `NOT_MEASURED`，原因：读口契约里 `at` **不出现在**路由签名（只取「当前生效政策」`T=DB now()`），无参数可注入；判据由 A6（复用 `getCommissionPolicy`）静态面承载。
6. **前端两页的运行时渲染（真浏览器）未测** —— `NOT_MEASURED`，原因：本片判据面为**静态类级门**（C1–C7 源码文本 + 四语键），无 e2e/组件级真渲染实测；页面**零 CJK**、无占位符、守卫常量逐值相等已由门覆盖。

---

## §10 收尾自证（git status / 端口 / PID）

**端口 / 进程**：

| 项 | 读数 |
|---|---|
| 受控实例 LISTEN PID（5796） | `38597` ⇒ `kill -TERM` 后 `ps -p 38597` = **gone**；启动包装 PID `38578` = **gone** |
| 5796–5799 `lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` | **空（0 行）** |
| 5787 / 5788 | **未碰**（本单未启停；现取仍由外部 PID `30475`（`[::1]:5787`）/ `65096`（`*:5788`）持有） |

**`git status --porcelain`（首 ≠ 尾 对拍）**：
- **首（开工）**：`M`×11（`index.ts` / `App.jsx` / `AdminLayout.jsx` / 四语 `locales/*.json` / 四个 `i18n-*.test.jsx`）+ 未跟踪（探针/门 ×5 / 两页 / 既有产物三目录）。
- **尾（收尾）**：`M`×**11**（**同一 11 件**，无增减）+ 未跟踪**新增 3 项** = 本件 `docs/audit/p8-s2-fee-rebate.md` + 本单产物 `.p4-artifacts/p6tr1a-20261002T144653Z/` / `.p8s1-artifacts/p8s1-20261002T144655Z/`。**无副本残留 / 无 `Xbp` / 无 `settingsX`**（`git status | grep -iE 'falsify|Xbp|settingsX'` ⇒ 空）。

```text
 M backend-ts/src/index.ts
 M frontend/src/App.jsx
 M frontend/src/components/layout/AdminLayout.jsx
 M frontend/src/locales/en.json
 M frontend/src/locales/hk.json
 M frontend/src/locales/zh.json
 M frontend/src/locales/vn.json
 M frontend/src/test/unit/i18n-batch-b4a.test.jsx
 M frontend/src/test/unit/i18n-batch-b4b.test.jsx
 M frontend/src/test/unit/i18n-batch-b5.test.jsx
 M frontend/src/test/unit/i18n-violation-closeout.test.jsx
?? backend-ts/.p4-artifacts/p6tr1a-20261002T143525Z/
?? backend-ts/.p4-artifacts/p6tr1a-20261002T144653Z/
?? backend-ts/.p8s1-artifacts/p8s1-20261002T143526Z/
?? backend-ts/.p8s1-artifacts/p8s1-20261002T144655Z/
?? backend-ts/.p8s2-artifacts/
?? backend-ts/scripts/p8-s2-00-probe.ts
?? backend-ts/scripts/p8-s2-00b-probe.ts
?? backend-ts/scripts/p8-s2-01-effective.ts
?? backend-ts/scripts/p8-s2-02-http-readonly.ts
?? backend-ts/scripts/p8-s2-fee-rebate-gate.ts
?? docs/audit/p8-s2-fee-rebate.md
?? frontend/src/pages/admin/FeeRatePage.jsx
?? frontend/src/pages/admin/ReferralWeightMatrixPage.jsx
```

**收尾核对**：**未** `git add/commit/push`；**未** 新增迁移 / apply；**未** 触碰 `migrations/**`、`docs/*.spec.md`、`master-plan`、既有 `docs/qa/**`、既有 `docs/audit/**`（除本件）；**未** 启停 5787/5788；**未** `pkill -f` / `killall`；受控实例只用 **5796**，**按精确 PID `kill -TERM`**，`lsof:5796-5799` **空读数**。

**占位归零自证**：本件「双下划线」占位模式计数 = **0**（现取 `grep -c '__' docs/audit/p8-s2-fee-rebate.md` ⇒ **0**）。
