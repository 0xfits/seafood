# 批 8 第二片 8② 独立终审质检 —— 费率配置 + 返佣权重矩阵（读口 + 后台两页）

> **角色** = **Neng（独立质检方）** · **单别** = 8② **独立终审质检** · **被检面钉** = `b082a81`（本地未推；`git rev-parse b082a81` = `b082a81690cea4b62a909f570d3a0d4b23bea106`）。
> **方法**：不采信交付方 / 派单方转引，**逐条现取重取**；**不采信**交付方探针 `p8-s2-01-effective.ts`，L2 由**本单自写探针**独立重取。
> **第一硬约束 `R-8-15`**：`commission_policy` 表 **append-only（不可删/不可改）**，且新政策行以新 `effective_from` **直接成为现行政策** ⇒ **严格禁止在（生产）库跑 HTTP `POST` 写**（跑一发 = 永久改变线上费率/佣金）。⇒ 一切「写」只在 **`withTransaction` + 末尾抛哨兵 ⇒ `catch` ⇒ `ROLLBACK`（无 `COMMIT`）** 内做；HTTP 面只做只读探针。**本单未跑任何 HTTP POST**；跑完后 `commission_policy` 仍 **3 行 / `max(effective_from)` 未前移 / 逐字节同开工基线**。
> **只写范围**：本件 `docs/qa/p8-s2-fee-rebate-review.md` + 本单产物 `backend-ts/.p8s2qa-artifacts/`。**未改**被检代码（变异只在**仓外副本**内且已整体删除）；**未改** `docs/*.spec.md` / `master-plan` / `audit/**` / `versions/**`；**未** `git add/commit/push`；**未** `npm install`；**未**碰/打印 `.env*`；**未**用 `pkill -f`/`killall`；**未**启停 5787/5788；**未**写 `listing_deposit_policy` 键。
> **占位归零**：本件「双下划线占位模式」计数 = **0**（现取 `grep -c 〈双下划线〉 docs/qa/p8-s2-fee-rebate-review.md` ⇒ **0**；本件不引用任何含双下划线的字面串）。

---

## §0 开工锚 + 副本与基线

| 项 | 命令 | 现取读数 |
|---|---|---|
| 仓库 HEAD | `git rev-parse HEAD` | `b082a81690cea4b62a909f570d3a0d4b23bea106`（= `b082a81`） |
| 分支 | `git rev-parse --abbrev-ref HEAD` | `main` |
| 主工作区状态（首） | `git status --porcelain` | **空**（仅本单新报告后出现；`HEAD` 已含全部本片改动，树干净 ⇒ 与 §0.1 交付报告「提交前 M×11」为**不同口径**，见 §L7-7） |
| 固定副本 | `git worktree add --detach <scratch>/qa8s2 b082a81` | `HEAD is now at b082a81` ✓；`node_modules` / `frontend/node_modules` / `backend-ts/.env.local` 三处**软链**（不打印内容） |
| 收口时点 | `date` | `2026-10-02 22:53–22:57 CST` |

**DB 开工基线（只读现取）**：`commission_policy` **恰 3 行**；现行 = `policy_id=3`，`fee_rate_bp=100`，`levels=10`，`weights_bp={3000,2000,1500,1000,800,600,500,300,200,100}`，`effective_from=2026-10-01 19:21:28.285+00`；`max(effective_from)` = 同值（未前移）。
`referral` = `{(parent 4→child 5, depth 1), (parent 5→child 6, depth 2)}` ⇒ 探针取 `worker=6`（链 6→5→4，depth 2）。
`app_config` = **恰 1 行**，`key='system_settings'`（列 = `key/value/updated_by/time_updated`）⇒ **无 `listing_deposit_policy` 键**。

---

## §L1 硬门独立复跑（退出码**管道外**捕获：`{ <cmd> > out 2>&1; echo "EXIT=$?"; }`）

| # | 门 | 命令 | 退出码 | 现取读数 |
|---|---|---|---|---|
| 1 | 类型 | `backend-ts: npx tsc --noEmit` | **0** | 输出 **0 字节**（零诊断） |
| 2 | 离线套件 | `p4z-tr1a-01-offline-tests.ts` | **0** | `total=126 passed=126 failed=0` |
| 3 | `p8-s1` 门 | `p8-s1-app-config-gate.ts` | **0** | `total=24 passed=24 failed=0`（无回归） |
| 4 | 新门 `p8-s2` | `p8-s2-fee-rebate-gate.ts` | **0** | `total=41 passed=41 failed=0` |
| 5 | 前端构建 | `frontend: npm run build` | **0** | `✓ built in 1.59s`；`index-B-JvDbIk.js 338.43 kB`（gzip 98.24）/ `index-BTXSvY-M.css 125.08 kB`（gzip 23.24） |
| 6 | 单测 | `frontend: npm run test:unit` | **0** | `Test Files 31 passed (31)` · `Tests 276 passed (276)` |
| 7 | 七门 | `frontend: node scripts/<gate>.mjs` ×7 | **全 0** | 见下 |

**七门逐门（`EXIT=0` 全部）**：
`p4z-i18nviol-global` `总判：PASS`（locale 作用域节点 **3152** / source 40）· `p6-tr2-i18n-locales` `总判：PASS`（四语拍平键数集合 `{788}`）· `p4z-miscfix-links` `总判：PASS`（残留全部已登记）· `p4z-feperf-safelist` `VERDICT=PASS` · `p7a-03-errmessage-gate` `总判：PASS`（扫描 79 / 受体 6 / 命中 0）· `p7b-errfallback-gate` `总判：PASS`（`D 节点=132 需护栏=0 已本地化=132`）· `p7c-errmsg-machinecode-gate` `总判：PASS`，**★ `链路体制 = 真链`**（`真 import src/auth.js#apiErrorMessage` + 真 i18n 实例）✓
> 产物：`backend-ts/.p8s2qa-artifacts/L1-qa8s2-20261002T225355Z/`（`01-tsc.txt` … `06-unit.txt` / `gates/*.txt` / `offline-tests.json` / `p8s1-gate.json` / `p8s2-gate.json`）。

---

## §L2 ★ 四段真生效独立重取（**本单自写探针** · `withTransaction` + `ROLLBACK`）

**探针** = `qa8s2-l2-effective.ts`（Neng 自写，**不使用**交付方探针；**独立自选**参数：段 A `fee_rate_bp 100→300`、段 B `levels=2 / weights_bp=[7000,3000]`）。受控实例不参与（写段经服务层同路径 `insertCommissionPolicy`）。**现取 27/27 passed（exit 0）** · 产物 `backend-ts/.p8s2qa-artifacts/L2-20261002T145533Z/l2-effective.json`。

### 段 A · `fee_rate_bp`（写 300）

| 段 | 判据（现取） | 读数 |
|---|---|---|
| 改前 | 读口 / DB fn / 服务层 | `bp=100` ⇒ `expect_fee=1000`；`service_fee=1000`；`db_fn_fee=1000`；`net=99000` |
| ① 后台写 | 同写口 `insertCommissionPolicy`（= `POST /api/admin/commission_policy` 同函数） | 返回键集 **8 键**；`returned_bp=300`；`policy_id=10` |
| ② 库内落值 | `public.commission_policy` · 列 `fee_rate_bp` | `{policy_id:10, fee_rate_bp:300, effective_from:2026-10-02 14:55:35.702161+00}` ✓ |
| ③ 业务读口取数 | `getCommissionPolicy()` / `job_settle_plan` | 读口 `bp=300, policy_id=10`；DB fn `bp=300` ✓ |
| ④ 行为随之 | 同一 `gross=100000` 的 `job_fee` | 服务层 `1000→3000`；DB 侧 `1000→3000`；`net 99000→97000`；公式 `(100000×300+5000)/10000 = 3000` 逐值吻合 ✓ |
| **判负** | 「写成功但库列未变 ⇒ 判负」（`A2-db-column-landed`） | 谓词喂 `301` ⇒ 转红（自证 fired=true）✓ |
| **判负** | 「改前后 `job_fee` 相等 ⇒ 判负」（`A4-job_fee-differs`） | 谓词喂 `1000` ⇒ 转红 ✓ |

### 段 B · `weights_bp`（写 `levels=2 / weights=[7000,3000]`）

| 段 | 判据（现取） | 读数 |
|---|---|---|
| 改前 | 政策 / 服务层 | `M=2, W=5000, weights_used=[3000,2000], fee=1000, x_L=[600,400]` |
| ① 后台写 | 同写口（只改 weights/levels） | 返回键集 8 键；`returned_levels=2`；`returned_weights_bp=[7000,3000]`；`sum=10000`；`policy_id=11` |
| ② 库内落值 | 列 `weights_bp / levels` | `{policy_id:11, levels:2, weights_bp:"{7000,3000}"}` ✓ |
| ③ 业务读口取数 | `getCommissionPolicy()` / `job_settle_plan` | 读口 `weights=[7000,3000], levels=2, sum=10000`；DB fn `weights=[7000,3000], W=10000, M=2` ✓ |
| ④ 行为随之 | 各层 `x_L`（同一 `fee=1000`） | `[600,400] → [700,300]`（逐层不等，且 = 最大余数法算值：`1000×7000/10000=700`, `1000×3000/10000=300`）✓ |
| **不变量** | `Σx_L == fee` | `sum_x=1000 == fee=1000` ✓ |
| **不变量** | `-2` 池净额 = 0 | `inflow=1000 / outflow=-1000 / net=0`，`fee_credit_uid=-2` ✓ |
| **判负** | 「写成功但库列未变 ⇒ 判负」（`B2a-db-weights-landed`） | 谓词喂旧权 `{3000,…,100}` ⇒ 转红 ✓ |
| **判负** | 「改前后 `x_L` 逐层相等 ⇒ 判负」（`B4a-xL-differs`） | 谓词喂 `[600,400]` ⇒ 转红 ✓ |
| **判负** | 「`-2` 池不守恒 ⇒ 判负」（`B4c`） | 谓词喂 `-1` ⇒ 转红 ✓ |

### ★ 事务外复取（关键反证）

| 判据 | 现取读数 |
|---|---|
| `commission_policy` 行数 | **`count=3`**（= 开工基线）✓ |
| 政策行**逐字节**同基线 | `rows_identical=true` ✓ |
| `max(effective_from)` 未前移 | `2026-10-01 19:21:28.285+00`（= 基线值）✓ |
| 两段哨兵 | `SEG_A` / `SEG_B`，`committed=false` ✓ |

**`R-8-6` 严守**：返佣行为验收**只**用 DB 直造（`withTransaction` + `insertCommissionPolicy`，与写口同函数）+ 读库（`getCommissionPolicy` / `job_settle_plan` / `planJobSettlement`）；**未为验收新增任何路由**；读口 `GET` **未**承载验收读数。

---

## §L3 新门 + 三处（实为两组六处）变异独立重跑 —— 解「红点标签口径差」

**新门属性**（现取 `p8-s2-fee-rebate-gate.ts`）：`offline:true / db_connections:0 / http_calls:0`；判据总 **41 = A9 + B5 + C7 + D7 + E6 + F7** ⇒ **判据版本 = b082a81 门（此为本片唯一版本）**。
**副本口径**：变异一律在**仓外副本** `/Users/kevin/.hermes/profiles/zang/cache/scratch/qa8s2-mut/<variant>/`（每变体独立；只复制门所读 12 个文件 + `tsconfig.json`；`node_modules` 软链）；主仓**零写入**。产物 `backend-ts/.p8s2qa-artifacts/L3-20261002T225648Z/<variant>/`。

### 甲组：本单自选三处（同类别），并补一处组合（复现「本轮」标签）

| 变体 | 类别 / 落点 | 条数 | 逐字红点标签 + 判据版本 |
|---|---|---|---|
| **m1** | 拆读口键：`FeeRatePage.jsx` 的 `weights_bp` → `weightsBroken` | **40/1** | **`C1` [adminPages]**（`expect: FeeRatePage 引用全部 8 键` · `actual: ["weights_bp"]`）· 门 = b082a81 |
| **m2** | 删一语言键：四语 `adminNav` 删 `weightMatrixDesc` | **39/2** | **`D1-adminNav` + `D2-adminNav-add4`** [fourLangKeys]（`per_lang:[19,19,19,19], equal:true`；缺 `weightMatrixDesc`×4）· 门 = b082a81 |
| **m3** | 注入口径串：`zh` 的 `adminWeightMatrix.intro` 值末追加 `§19` | **40/1** | **`E1` [noEngLeak]**（`hit:"§1"`）· 门 = b082a81 |
| **m4** | 组合三源改：`App.jsx` 路由闸串坏 + `AdminLayout.jsx` 菜单 key 坏 + `FeeRatePage.jsx` 键坏 | **38/3** | **`C1` + `C3` + `C4`** [adminPages]（`feeRoute:false` / `matrixMenu:false`）· 门 = b082a81 |

### 乙组：**另一构造法**（对照，复现「上一轮」标签）

| 变体 | 类别 / 落点（**与甲组不同**） | 条数 | 逐字红点标签 + 判据版本 |
|---|---|---|---|
| **a1** | 拆读口键：`commission.ts` `mapPolicy` 的 `weights_sum_bp` → `weightsSumBp` | **39/2** | **`B2` + `B4`** [readShape8Keys]（键集含 `weightsSumBp`；`reduce` 判据 false）· 门 = b082a81 |
| **a2** | 删一语言键：四语 `adminFeeRate` 删 `noChanges` | **40/1** | **`D1-adminFeeRate`** [fourLangKeys]（`per_lang:[17,17,17,17]`）· 门 = b082a81 |
| **a3** | 注入口径串：`zh` 的 `adminFeeRate.saved` 值末追加 `§19 commission_policy` | **38/3** | **`E1` + `E6` + `F-clean-control`** [noEngLeak/…SelfTest]· 门 = b082a81 |

**复原对照**：未变异副本 **`clean` = 41/41 全绿**（`EXIT=0`）⇒ 判据真源回退必红、复原即绿 ✓。

### 判定

- **`判据标签版本差` = 否**。依据：① 全仓 git 历史中本门**只有 1 个版本**（`git log --all -- backend-ts/scripts/p8-s2-fee-rebate-gate.ts` ⇒ 仅 `b082a81`；**无更早版本、无被删版本**）；② 六处变异**全部在同一个 b082a81 门上**跑出，「上一轮」与「本轮」两套标签**同时被复现** ⇒ 不存在「两版判据」。
- **`变异构造不同` = 是**。依据：两轮**条数完全相同**（`39/2` / `40/1` / `38/3`）而**标签不同**，其差**唯一**随「落点/文件/命名空间」的不同而不同 —— 甲组（页面 / `adminNav` / `intro`）产「本轮」标签；乙组（`commission.ts mapPolicy` / `adminFeeRate` / `saved`）产「上一轮」标签。⇒ **条数同、标签异 = 变异落点不同所致，非判据版本漂移。**
- **判据版本（逐字）**：`b082a81` 的 `p8-s2-fee-rebate-gate.ts`，判据 41（组 A9/B5/C7/D7/E6/F7）。

---

## §L4 交付报告复核（`docs/audit/p8-s2-fee-rebate.md`）

**现取度量**：`wc -l` = **332**；`wc -c` = **28874**（28.9KB，与交付方自报一致）。

**★ `grep -c 〈双下划线占位模式〉` 判明 = 3**（交付方自报 **2**、派单方亲测 **3** ⇒ **以现取 3 为准**）。逐行给出：

| 行 | 逐字内容（节选） | 性质 |
|---|---|---|
| **6** | `> **占位归零**：…「双下划线」占位模式计数 = **0**（现取 grep … ⇒ **0**）` | **正文引用命令行**（该行字面**内嵌**被搜索的命令串本身） |
| **200** | `…〈双下划线〉dirname ⇒ REPO_ROOT = 副本根…` | **正文引用 Node 魔法常量**（非未填节） |
| **332** | `**占位归零自证**：…计数 = **0**（现取 grep … ⇒ **0**）` | **正文引用命令行**（同第 6 行） |

**判定**：3 行**全部**为「正文引用命令行 / 标识符」，**无一行**是未填节 ⇒ **占位（未填）节 = 0**（内容面无缺陷）。**但**：第 6 / 332 行**自称**该 grep 读数「= 0」，而第 6 / 332 行**自身**即含双下划线 ⇒ **交付报告的自证句自相矛盾**（**非阻断**文字瑕疵；更正为「= 3（均为正文引用，未填节 = 0）」即可）。

**抽 6 条读数与产物 / 盘面逐字对拍**（全部一致）：

| # | 交付报告读数 | 本单现取 | 一致 |
|---|---|---|---|
| 1 | §0.2 #1 `tsc` EXIT=0 / 0 字节 | EXIT=0 / 0 字节 | ✓ |
| 2 | §0.2 #2 离线 `126/126`；#4 新门 `41/41`；#6 单测 `31 files / 276` | `126/126` · `41/41` · `31/276` | ✓ |
| 3 | §2 基线 `count=3`、`policy_id=3/ bp=100/ levels=10/ weights={3000,…,100}/ eff=2026-10-01 19:21:28.285+00` | 逐字节同 | ✓ |
| 4 | §3 注册点 `69` / `get28 post38 put0 patch1 delete2` | 同 | ✓ |
| 5 | §4 四语 `adminFeeRate=18 / adminWeightMatrix=21 / adminNav=20` | 同（键集相等=true ×3） | ✓ |
| 6 | §7 HTTP `admin 200 + 8 键` / `401 R107` / `403 reason=NOT_ADMIN` | 逐字同（见 §L6） | ✓ |

（另：交付方产物 `.p8s2-artifacts/p8s2-effective-20261002T144321Z/effective.json` = `24/24`、`post_rollback count:3/rows_identical:true`，与本单 L2 独立读数同向；其 `p8s2-http-…/http.json` = `8/8`。交付方 §6 副本 `…/p8s2-falsify3/` 已不存在 ⇒ 无法逐字节复核其原始变异产物，**由本单自建副本独立复现替代**。）

---

## §L5 面独立核

| 项 | 现取读数 |
|---|---|
| 注册点 | **69**（`^app.(get\|post\|put\|delete\|patch)(` 逐 verb：`get=28 / post=38 / put=0 / patch=1 / delete=2`）✓ |
| 读口路径/闸 | `app.get('/api/admin/commission_policy'` 恰 1 处（`src/index.ts:2036`）；闸 `requireAdmin(req, res, 'manage_settings')`（与写口同键） |
| 取数复用 / 零 SQL 零写 | 读口 handler 内 `getCommissionPolicy(...)`，**零** `SELECT/FROM commission_policy`、**零** `INSERT/UPDATE/DELETE`、**零** `insertCommissionPolicy`（门 A6–A8）✓ |
| 8 键三处同键集 | `CommissionPolicy` 接口 = `mapPolicy` 返回 = **8 键逐字**（`created_by, effective_from, fee_rate_bp, levels, policy_id, time_created, weights_bp, weights_sum_bp`，二者 `sorted()` 全等）；`getCommissionPolicy` `SELECT` = **7 列**（第 8 键 `weights_sum_bp` = 读时 `weights.reduce` 算一次）✓ |
| 后台页 8 字段 | `FeeRatePage.jsx` 引用**全部 8 键**（门 C1 绿）；`ReferralWeightMatrixPage.jsx` 引用矩阵面 **4 键**（`levels/weights_bp/weights_sum_bp/fee_rate_bp`，门 C2 绿）——**有意**不含 `created_by/time_created/policy_id`（§19.5(b) 矩阵面） |
| 两路由两菜单 | `App.jsx` `path="fee-rate"` / `path="weight-matrix"` 均 `requiredPermission="manage_settings"`；`AdminLayout.jsx` `adminNav.feeRate` / `adminNav.weightMatrix` 均闸 `manage_settings` ✓ |
| 零 CJK | 两页（注释剥离后）CJK 行 = **0 / 0**；字节 9686 / 11754 ✓ |
| 四语键齐 | `adminFeeRate` 18/18/18/18、`adminWeightMatrix` 21/21/21/21、`adminNav` 20/20/20/20；**三命名空间 × 四语键集相等 = true** ✓ |
| 六类工程口径泄漏 | 门 E（四语两命名空间全键值正则扫描，**156** 值）⇒ **命中 = 0**（`leak_hits=[]`）✓ |
| `listing_deposit_policy` 未写 | `app_config` **恰 1 键** = `system_settings`；**无** `listing_deposit_policy` ✓ |

---

## §L6 HTTP 只读面（受控实例 5796）

**实例**：`bash -lc 'PORT=5796 nohup npx ts-node --transpile-only src/index.ts & echo $!'`（链 `backend-ts/.env.local`，不打印内容）；`GET /` = **200**；LISTEN PID = **49541**（`*:5796`）。**收尾按精确 PID `kill -TERM 49541`（+ 包装 49522）** ⇒ `ps` 空、`lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` **空**。
**探针** = 本单自写 `qa8s2-l6-http.ts`（**只读**）· **failed=0** · 产物 `.p8s2qa-artifacts/L6-qa8s2-20261002T225355Z/l6-http.json`。

| 面 | 请求 | 现取读数 |
|---|---|---|
| 健康 | `GET /` | `200` |
| 无 token ⇒ **401** | `GET /api/admin/commission_policy` | `401`；顶层键 = `["error"]`；`error` 键 = `["code","details","i18n_key","message"]`（**R107**）；body `AUTH_UNAUTHORIZED` ✓ |
| 非 admin ⇒ **403** | uid=2（`is_admin IS NOT TRUE` 且**无** `admin_user_role` 行） | `403`；`error.code="AUTH_FORBIDDEN"`；**`error.details.reason` 逐字 = `NOT_ADMIN`** ✓ |
| 伪造 token ⇒ 401 | `not-a-real-token` | `401` ✓ |
| admin ⇒ **200** | uid=1 | `200`；顶层 `["data","message","success"]`；`data` = **8 键**；`data={policy_id:"3", fee_rate_bp:100, levels:10, weights_bp:[3000,…,100], effective_from:"2026-10-01 19:21:28.285+00", weights_sum_bp:10000}` |
| 库现取对拍 | HTTP `data` ⇄ DB 现行行 | `http=3/100` ⇄ `db=3/100` ⇒ **同源** ✓ |
| 只读纪律 | 探针前后 `count(*)` | `policy_count_after_probe=3`（**政策表未被触碰**）✓ |

**★ `POST` 面 = `NOT_MEASURED`（逐字原因）**：
> `R-8-15`：`commission_policy` 表 **append-only**（`UPDATE/DELETE` 直接 RAISE）+ 新政策行以新 `effective_from` **直接成为现行政策** ⇒ **真 `POST` 即永久改变线上费率 / 佣金**。**本单绝不跑 HTTP POST 写**；写路径证据由 §L2 **事务内 ROLLBACK 的服务层同路径**承载。

---

## §L7 未验证清单 + 判定（逐项原因 · 禁填 0 / 空）

| # | 未验证项 | 原因（逐字） |
|---|---|---|
| 1 | **HTTP `POST /api/admin/commission_policy` 面** | `NOT_MEASURED` —— `R-8-15`：append-only + 新行即现行政策 ⇒ 真 POST 永久改线上费率（见 §L6） |
| 2 | 读口 HTTP ⇄ 库**逐值**对拍仅 2 列 | 本单探针逐值断言 `policy_id` + `fee_rate_bp`；`levels / weights_bp / weights_sum_bp` 未在 HTTP 面逐值断言（**同源证据**另由 §L2 段 B 的读口对拍 `getCommissionPolicy` 承载） |
| 3 | `is_admin=false` 但**角色行**持 `manage_settings` 的准入形态 | `NOT_MEASURED` —— 探针 403 取材只到「非 admin 且无角色行」的 uid=2；该形态未单独取材 |
| 4 | 前端两页**真浏览器运行时渲染** | `NOT_MEASURED` —— 本片判据为**静态类级门**（源码文本 + 四语键），无 e2e/组件级真渲染 |
| 5 | 读口 `at` 查询参数注入面 | `NOT_MEASURED` —— 路由签名**不含** `at`（只取 DB `now()`），无参数可注入；由 A6 静态面承载 |
| 6 | 交付方 §6 原始变异副本**逐字节**复核 | 该副本 `…/p8s2-falsify3/` **已删除** ⇒ 不可复核；以**本单自建副本**独立复现两轮标签替代（见 §L3） |
| 7 | 交付报告 §0.1 / §10 的 `git status` 口径 | 交付报告锚在**提交前工作树**（`HEAD=d39d441` + `M×11`）；本单钉 **`b082a81` 干净树** ⇒ 两种口径**均已对齐说明**，非缺陷 |

**VERDICT = 通过（PASS）**。硬门 7 项全绿；四段真生效**独立重取 27/27**（含两段判负 + 事务外复取反证）；变异**红回两组六处标签**且复原回绿；报告读数与产物/盘面**逐字一致**。
**非阻断发现（2 项，均为文字/口径）**：① 交付报告 §6/§332「双下划线 = 0」**自指矛盾**（实为 3，且均为正文引用，**未填节 = 0**）；② §0.1 开工锚为**提交前**状态（与钉面 `b082a81` 不同口径，已对齐）。**主读零缺陷、被检代码零改动、生产库零写入。**

---

## §L8 收尾自证（git status 首尾 / 端口 / PID / 逐文件 blob）

**`git status --porcelain` 首 / 尾**：
- **首（开工）**：**空**。
- **尾（收尾）**：`?? backend-ts/.p8s2qa-artifacts/` + `?? docs/qa/p8-s2-fee-rebate-review.md`（**仅本单产物**；L1 跑门产生的默认目录 `.p4-artifacts/p6tr1a-20261002T145356Z` / `.p8s1-artifacts/p8s1-20261002T145357Z` / `.p8s2-artifacts/p8s2-gate-20261002T145358Z` **已复制进本单产物并删除**）。**无副本残留 / 无 `Xbp` / 无 `weightsBroken` / 无 `weightsSumBp`。**

**逐文件 blob == `git rev-parse b082a81:<path>`**（仓外副本内现取，**13/13 OK**）：`backend-ts/src/index.ts` · `backend-ts/src/commission.ts` · `backend-ts/scripts/p8-s2-fee-rebate-gate.ts` · `backend-ts/scripts/p8-s2-01-effective.ts` · `frontend/src/App.jsx` · `frontend/src/components/layout/AdminLayout.jsx` · `frontend/src/pages/admin/FeeRatePage.jsx` · `frontend/src/pages/admin/ReferralWeightMatrixPage.jsx` · `frontend/src/locales/{zh,en,hk,vn}.json` · `docs/audit/p8-s2-fee-rebate.md`；副本 `git diff --stat b082a81` = **空**。

**端口 / 进程**：受控实例 LISTEN PID `49541` ⇒ `kill -TERM` 后 `ps -p 49541` = **gone**（包装 `49522` = gone）；`lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` = **空**。**5787 / 5788 未碰**（现取仍由外部 PID `30475`（`[::1]:5787`）/ `65096`（`*:5788`）持有）。
**副本清理**：`git worktree remove --force <scratch>/qa8s2` 已成；变异沙箱 `<scratch>/qa8s2-mut` **整体 `rm -rf`**。

**收尾核对**：**未** `git add/commit/push`；**未**新增迁移/apply；**未**改 `migrations/**`、`docs/*.spec.md`、`master-plan`、既有 `docs/qa/**`、既有 `docs/audit/**`；**未**启停 5787/5788；**未** `pkill -f`/`killall`；**未**写 `listing_deposit_policy`；`commission_policy` **仍 3 行 / 逐字节同开工基线**。
**占位归零自证**：本件「双下划线占位模式」计数 = **0**（现取 `grep -c 〈双下划线〉 docs/qa/p8-s2-fee-rebate-review.md` ⇒ **0**）。
