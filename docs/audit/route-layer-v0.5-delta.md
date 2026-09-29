# route-layer.spec v0.4 → v0.5 · delta 审计件（逐条 delta → 依据锚点 → 改动点）

> **本单** = Unit **Jing-V0.5**（作者角色 = **Jing（Specifier · 制度员）**）；**性质 = 纯规范写作**（零代码改动 / 零库连接 / 零服务启停 / 零 git 写）。
> **本册读数（自报 · 交付时现取）**：`docs/route-layer.spec.md` = **881 行 / 210464 字节 / md5 `7493f410b30de2ff042a3b137eeb0615`**；**改前 = v0.4 = 763 行 / 166747 字节 / md5 `e8b3ceffd98ef82fb37c77c2b13b6108`**（= 父单给我的值，**逐字节一致**）。
> **快照** = `docs/versions/route-layer.spec.v0.5.md`（**本单新建**）⇒ 与本体 **`cmp` = 相同**（自证）。
> **`docs/data-layer.spec.md` 本单未写**（现取 = 1023 行 / md5 `ad657c0a5068e91cb57d935bb34fd86b`，v0.7 含 §18；**未建任何 data-layer 快照**）—— 判定理由见 §D9。

---

## §0 硬口径自证（§5.7 · 逐条）

| 项 | 自证 |
|---|---|
| §5.7 ①（带引号对象加引号） | 全文 `"users"` / `"is_admin"` 等**均加引号**；新写的 `COALESCE(u.is_admin, false) = false` 逐字保留引号 |
| §5.7 ②（退出码不取管道之后） | 全部命令用 `&&` 串联或独立执行；**未**在管道后取退出码 |
| §5.7 ③（本机无 `timeout`） | **未使用** `timeout`/`gtimeout` |
| §5.7 ④（读数异常先怀疑自己） | 首轮扫描**主动怀疑过**「Zang 首批 3 条是否漏项」⇒ 逐 verb 核调用点后确认 **本册多出 5 条**（§D1）；行号与 v0.4 记载不符时**先复算**（§D7 漂移登记） |
| §5.7 ⑤（先骸架后回填） | 本轮无骸架需求（**在既有 763 行册上就地升版**，逐节回填）⇒ **未停在占位态**（可 `grep` 到 §1.8/§1.9/§4.4-13..17/§7-25..27 的正文） |
| §5.7 ⑥（报数带口径） | 所有计数均带命令/口径（§D1 扫描口径块、§D7 行号四分口径） |
| §5.7 ⑦（「实测」必须可 grep 支撑） | 本册「实测」分两类：**本单现取**（文件行数/sha256/`grep` 命中/`git show` 锚点）与**转引**（`p4-b3c-job-funds.md` / `p4-aud-jobkey.md` 读数）**逐处标注** |
| **安全红线** | **未** `pkill -f` / `killall`；**未启停任何进程**；**未 kill 任何 PID** |
| **只读 git** | 只用 `git status --porcelain`（现取 = **空** ⇒ 工作树干净）/ `git log --oneline` / `git show 9d40b17:…` / `git diff 9d40b17 8f2974c -U0` —— **未** `git add/commit/push` |

---

## §D1 ★ delta①：新增 **§1.8「已实现·未注册清单」**（本轮最重要）

**依据 = Zang §5.85 裁定①**（`docs/seafood.master-plan.md:1984`，v0.85 记录）逐字：**「★ 新纪律 + 新交付物：spec 增设「已实现·未注册清单」（路径/服务层落点/为何未注册/由哪批注册；首批 = `POST /api/job/:jobId/{apply,accept}`、`POST /api/listing`）⇒ 交 Jing v0.5（`assets/init` 那类「互推无人认领」的结构性解药）」**。

**改动点**：`## §1` 与 `## §2` 之间**新开 §1.8**（表头**逐字** = 路径 / 服务层落点（`文件:行号`）/ 为何未注册 / 由哪一批注册）+ **准入判据 / 扫描口径 / 差异说明 / 负向排除 / 正向对照 / 同域并案 / 维护责任** 六个块。

**★ 真扫描（不得只抄给我的 3 条）—— 扫描命令与命中数（可复算）**：

- 服务层导出：`grep -nE '^export (async )?function|^export const [a-zA-Z]+ = (async )?\(' src/{job-service,listing-service,job-funds-service,currency-service,admin-service}.ts`
- 已注册路径表：`grep -nE '^app\.(get|post|put|delete|patch)\(' src/index.ts` ⇒ **53 行**
- 交叉核对：逐个 verb 名 `grep -nE '\b<verb>\b' src/index.ts` ⇒ **命中 0 = 未接线**

**★ 实测结果 = 清单 8 条 + 1 附注**：

| # | 路径（未注册） | 服务层落点 | 依据（每行锚点） |
|--:|---|---|---|
| 1 | `POST /api/job` | `src/job-funds-service.ts:149`（`publishJob`） | `index.ts` 对该 verb **0 命中**；`p4-b3c-job-funds.md §1.3` |
| 2 | `POST /api/job/:jobId/apply` | `src/job-service.ts:175`（`applyToJob`） | 0 命中；`p4-b2a-http.md §3:74`（404）；`p4-aud-jobkey.md §2.5`（`/api/job/12/apply` ⇒ 404 `Not found`） |
| 3 | `POST /api/job/:jobId/accept` | `src/job-service.ts:208`（`acceptApplication`） | 0 命中；`p4-b3c-job-funds.md §7 N2`（**F-1**） |
| 4 | `POST /api/job/:jobId/submit` | `src/job-service.ts:125`（`submitWork`） | **已接线**（`index.ts:602`）⇒ 属「新命名未上线、功能由既有路径承载」 |
| 5 | `POST /api/job/:jobId/review` | `src/job-funds-service.ts:218`（`settleJob`）/ `:237`（`refundJob`） | 0 命中；`p4-b3c-job-funds.md §1.3` |
| 6 | `POST /api/job/:jobId/cancel` | `src/job-funds-service.ts:237`（`refundJob`） | 0 命中 |
| 7 | `POST /api/listing` | `src/listing-service.ts:164`（`createListing`） | 0 命中；`p4-b2b-listing-write.md §1.3-1`（404） |
| 8 | `POST\|PATCH /api/listing/:listingId`（编辑/下架） | `src/listing-service.ts:222`（`updateListing`）/ `:286`（`transitionListingStatus`） | **`index.ts` 无 `from './listing-service'` 导入**（本册现取）⇒ 整个商品写口未接线 |
| 附 | `POST /api/admin/commission_policy` | `src/commission.ts:240`（`insertCommissionPolicy`） | **非本轮 5 文件扫描面**（§1.1 既有登记） |

**★ 与父单/Zang 给定 3 条的差异（规则：以本册实测为准并写明差异）**：

- Zang 首批 3 条 = **#2 `apply`、#3 `accept`、#7 `POST /api/listing`** ⇒ **3 条全部命中、逐条被本册清单包含**（**无遗漏、无冲突**）。
- **本册实测多出 5 条**（**#1 `publishJob`、#5 `settleJob`、#6 `refundJob`、#8 的 `updateListing` 与 `transitionListingStatus`**）⇒ **不是「Zang 漏了」，而是首批只点名 3 条**（其逐字为「**首批** = …」）；本册按「**真扫描**」纪律补全并**如实标注差异**。
- **本册**另补三块（Zang 表头未要求）：**准入判据 / 扫描口径 / 负向排除 + 正向对照**，使清单**可复算、可负向排除**；**若与 Zang 意图不符 ⇒ 以 Zang 为准**（登记 **§7-26**；自曝 §8.7.3-20）。

**负向排除（**不得**入表者，均已写入 §1.8）**：12 个 **helper 导出**（`ledgerErrorBody:21`、`sendGone:36`、`sendVerbError:76`、`resolveJobCreateKey:90`、`resolveJobCreateKeyRequired:84`、`resolveListingCreateKey:75`、`resolveCurrencyKey:92`、`pickIdempotencyKeyRaw:107`、`adminVerbError:24`、`canonicalAdminOpsKey:43`、`resolveAdminOpsKey:51`、`findFeeRateKey:99`）；**无 TS 服务层**者（`referral_bind` 直调 DB `0007:241`；`candle_view` 只读）；**正向对照 = 7 个已接线 verb**（`submitWork:125→602`、`verifyJobSubmission:308→1076`、`createCurrencyVerb:194→1171`、`listCurrencyVerb:327→1190`、`adminPermissionSaveVerb:121→899`、`adminPermissionDeleteVerb:177→929`、`adminUserUpdateVerb:211→951`）⇒ **7/7 有注册点**。

**同域并案（§1.8 末块）**：`DatabaseService.markTaskProgressChecked`（`database.ts:1249`）、`rejectPendingTaskProgress`（`:2029`）**无调用方**（`index.ts` 命中 0）⇒ 归批 4 收口（`p4-b3c-job-funds.md §2.3 注`）。

---

## §D2 delta②：新增 **§1.9「批 3b 已落地事实」**（K1–K11）

**依据 = Zang §5.85 A**（批 3b 验收 + 亲验 5 项）+ `docs/audit/p4-b3c-job-funds.md`（263 行 / sha256 `5a17fe1c…` / 9 节）。**改动点** = §1.7 之后新开 §1.9，K1–K11 逐条带锚点。**核心读数**：

- **K1**：`src/job-funds-service.ts` **330 行 / sha256 `7b808634c615e7467bcfe71d51c38d2c9dce1fd1c1f4eababfde781190b3d53d`**（**本单现取**，与 §5.85 的 `7b808634…` **一致**）；`publishJob:149` / `settleJob:218` / `refundJob:237` / `verifyJobSubmission:308` / `resolveJobCreateKeyRequired:84`。
- **K2**：`database.ts` **+3 method** —— `jobPostEvent`（**唯一资金写路径**，`SELECT public.job_post_event($1::jsonb)` @ **`:1665`**）、`resolveReviewTarget`（只读，`:1677`）、`reviewJobSubmission`（`:1723`）= **单条 SQL**：`WITH ev AS (…)`（`:1732-1733`）+ `sub AS (UPDATE public.job_submission …)`（`:1734-1735`）+ 末 `SELECT … submissions_reviewed`（`:1750`）⇒ **「结论位 + 资金同语句」**（**本单现取 `grep` 逐行核实**；与 **Zang §5.85 A ③ 亲读** 一致）。
- **K3**：**注册点 53 → 53**（只改接 `POST /api/tasklist/:jID/verify`，现取 `:1061`）；`src/index.ts` 现 **1216 行**；**未新增迁移**（`migrations/` 仍 19）⇒ `schema_version` 仍 **0020**。
- **K4–K9**：J1/J5/J6 实测读数 + **DL86 两形态** + **逐事件 `Σ(delta+frozen_delta)=0`** + **`ledger_entry` 42→76（Δ34 枚举等式闭合）** + 成功面 11/9 键冻结（锚点见 §1.9 表）。
- **K10**：未测项（6 条）**禁当 0/空**（并落入 §8.7.2-19/20/21）。
- **K11**：**集成缺口 F-1**（`accept` 未注册 ⇒ 批 4 前前端 verify 走不通完整资金链）—— **Zang §5.85 裁定① = 接受现状**，并以 §1.8 的新纪律为结构性解药。

---

## §D3 delta③：两条既有路径**行为 delta 定案** + 回归项

**依据 = Zang §5.85 裁定②** 逐字：**「两条既有路径行为 delta（非数字 `:jID` 400→404；撤 bespoke 400 守卫）⇒ **均批准** + 须登记规格 + 核前端是否依赖旧 400」**。

| # | delta | **改前（可复算锚点）** | **改后** | 本册落点 |
|--:|---|---|---|---|
| Δ1 | 非数字 `:jID` | `400 Invalid jID`（**`git show 9d40b17:backend-ts/src/index.ts:1064-1067`**；`9d40b17` = 批 3b 前一 commit，`grep -c 'Invalid jID'` = **3**） | **`404 LEDGER_REF_NOT_FOUND` + `reason=jID_not_found`**（`R107`；对齐 detail-miss 统一 404 + `cid` 形状闸同族口径） | **§3.1 新增行** + **§1 #49** 依据格 |
| Δ2 | admin 提交的 bespoke 守卫 | `if (taskProgressUser?.is_admin) { return sendError(res, 400, 'Admin task progress items are not reviewed from the dashboard queue'); }`（**`9d40b17:…:1077-1078`**） | **撤除**（① 读口**已结构性排除**：`src/database.ts:1979` 与 `:2024` 的 `COALESCE(u.is_admin, false) = false`；② 与 §3.3-8「错误分支一律 `R107`」冲突） | **§3.1 新增行** + **§8.7.4 对照表** |

**★ 回归项登记（Zang 裁定② 要求）**：**§2.4 S9**（+ **§7-27**）。**本单现取读数**：

- **真源 = 前端调用体**：`frontend/src/pages/DashboardPage.jsx:223-236`（verify 的**唯一**真实调用点，`grep -rn` 现取全仓仅此 1 处 + 单测 `test/unit/dashboard-page.test.jsx:115,140`）—— **读数 = 不对该 `400` 做分支**（成功走 `fetchApiJson`；失败一律 `toast.error(操作失败: ${error.message})`）；`jID` 来源 = 面板队列的 `application_id`（数字）⇒ **前端不会主动发非数字 `jID`**。
- **残留 = `NOT_MEASURED`**：前端 **23 文件 + 单测**未全量扫 ⇒ **批 4 必须全量核**（是否断言旧 `400 Invalid jID` / admin-queue 文案）。

---

## §D4 delta④：§4.4 新增判决 **13–17**（批 3b 口径写死）

依据 = `p4-b3c-job-funds.md §2.2 D1/D2/D4/D5/D6`（**Zang §5.85 A 已采信**）：

| # | 判决 | 要点 |
|--:|---|---|
| **13** | J5/J6 金额**零客户端输入** | `gross = job.reward`（`0013:632`）、`fee` 由 DB `job_settle_plan` 派生 ⇒ §4.4-11/12 的「传 `fee=1` 绕过」在招工面**结构上不存在**（无该入参）；**未引入任何下限常量、未发明任何数值** |
| **14** | J1 的 `create_key` **fail-loud（不派生）** | 真源 `src/job-funds-service.ts:84`；实测缺键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`、坏前缀 ⇒ `400 …_INVALID`；**Zang §5.85 裁定③ 批准** ⇒ 2a 面另案（**§7-25**） |
| **15** | 「审核通过 → 发放」**原子 = 一条 SQL** | `reviewJobSubmission` 的 CTE（`database.ts:1732-1750`）⇒ 结论位与分录**同生同灭** ⇒ **R4 兑现**（连「已审核但没发放」也不可能）；**Zang §5.85 A ③ 亲读** |
| **16** | 路由入口 `:jID` 语义 = **`application_id`**（容错兼收 `job_id`） | 前端读口 `database.ts:1144` / `:1851` 返回 `a.application_id AS "jID"` ⇒ 必须先经 `resolveReviewTarget`（只读）解析到 `job_id` |
| **17** | 成功面**键集冻结** | approve **11 键** / reject **9 键**，与改接前**逐键一致**；唯一新增 = 重放时**顶层** `idempotent_replay:true`（非 `data` 键）⇒ 与 §2 F1 / §3.3-8 不冲突 |

---

## §D5 delta⑤：§4.0 **R1 精化**（两层口径）

**改动点**：R1 原文「**唯一**写路径 = `SELECT ledger_post_event($1::jsonb)`」⇒ 改为**两层**：**① 账本层唯一写路径 = `ledger_post_event`**；**② 业务层唯一入口 = 三个编排函数**（`job_post_event`/`listing_post_event`/`market_post_event`，见 R2）。**理由（锚点）**：批 3b 的服务层经 `public.job_post_event` 入场（`database.ts:1665`），若只写「唯一 = `ledger_post_event`」会与「经 `job_post_event` 入场」**读成矛盾**（实为**同一路径的两层**：编排函数**内部**调 `ledger_post_event`）。**同时**写入**结构保证**：`src/job-funds-service.ts` 唯一 `./ledger` 引用 = `:30` 的**错误映射助手**（**Zang §5.85 A ④ 亲核**）⇒ 「零自拼分录」不是纪律声明。

---

## §D6 delta⑥：§1.1 / §1 #49 / §4.2 / §4.3 / §4.5 / §4.6 / §5.4 同步

| 落点 | 改什么 |
|---|---|
| **§1 #49**（`POST /api/tasklist/:jID/verify`） | 加「**批 3b 已改接**」+ **现取 live 行号 `:1061`** + 服务层与单条 SQL 锚点 + 行为 delta 指向 |
| **§1.1**（10 行） | `POST /api/job` = **批 3b 服务层已落地（`publishJob:149`）、路由随批 4**（原标「批 3」）；`apply`/`accept`/`submit`/`review`/`cancel`/`POST /api/listing` 各补**现取行号**并指向 §1.8；`commission_policy` 行补服务层锚点（`commission.ts:240`） |
| **§1.2** 母约束段 | 补「**§1.8 是本清单的唯一权威**（散落旧记法以 §1.8 为准）」 |
| **§4.2** J1 / J5 / J6 批次格 | 「批 3」⇒ **「批 3b（服务层已落地 / 既有路径已改接）· 路由随批 4」**（J2/J3/J4 的「批 2（service 已实测）」**不动**） |
| **§4.3** 资金四栏 J1/J5/J6 | 各补**批 3b 实测读数**（escrow 2 腿 / DL86 两形态 / refund 同账户 `frozen→balance`） |
| **§4.4-12** 之后 | 接 §D4 的 13–17（**12 一字未改**） |
| **§4.5** 招工发布行 | 补「**缺省 ⇒ fail-loud 不派生**」+ 真源 `job-funds-service.ts:84,149` |
| **§4.6** 批 3 行 | 实交栏改为「批 3a 真收官 + **批 3b 已交付**（§1.9）；**未交付** = P2/P4、M1/M2/M3、A1 与 §1.8 的 8 条」（原文的「FIX-B 仍待」= **v0.4 后已过期**，就地更正） |
| **§5.4** 阶段 3（批 4） | 补「新增路径注册**以 §1.8 为准**（8 条 + 1 附注）、**不得只挑其中几条**」+ `§7-25` 前置 + **优先级 = §1.8 #3（`accept`）** |

---

## §D7 delta⑦：§0 / §0.1 / §0.3 同步（元信息 + 读数）

- **§0 版本行** = **v0.5**；**§0 库行** 补「**批 3b 未新增迁移**（文件数仍 19）⇒ `schema_version` 仍 **0020**」。
- **§0 端点锚口径行**：**现取复核 = 53 行（53 → 53）**，`src/index.ts` 现 **1216 行**；**★ 行号漂移登记**：`POST /api/currency` `:1160 → **:1166**`、`POST /api/currency/:cid/list` `:1179 → **:1185**`（批 3b 改接 verify 区所致）⇒ **§1.5 行号口径由三分升为四分**（v0.1 live / 批 2 末态 / 批 3a 末态 / **批 3b 末态**）。
- **§0.2-9** 行号口径条 ⇒ 改「三分」为「**四分**」。
- **§0.1**：**I6** 补 `job-funds-service.ts`；**I8** 不动；**新增 I9**（批 3b 审计件 + `p4-b3c-job-funds.md` 263 行 / `5a17fe1c…` + Zang §5.85）与 **I10**（`p4-aud-jobkey.md` 246 行 / HEAD `8f2974c` + 产物 + 探针；裁定③ 依据）。
- **§0.3** 新增 4 条读数：**批 3b 注册点 53→53** / **已实现·未注册 = 8 条 + 1 附注** / **`ledger_entry` 42→76（Δ34 枚举等式闭合）** / （承 §0 的**行号漂移**登记）。

---

## §D8 delta⑧：§7 状态列 + §8 变更记录/增补

- **§7 新增 3 项**（**7-1…7-24 一字未动**）：

| # | 项 | 状态 | 裁定/依据（摘要） |
|--:|---|---|---|
| **7-25** | `create_key` 缺失口径（派生兜底 vs fail-loud） | **3b 面已定 · 2a 面待 Zang** | **3b = 已定**（Zang §5.85 裁定③：fail-loud 批准 + 派 FIX-JOBKEY）；**2a = 审计 `p4-aud-jobkey.md` 本单现取已落盘（246 行）⇒ 结论 = 「碰撞不成立」**（派生键 = 自然标识**单射**、不含内容 ⇒ 异实体必不同键〔实测 T1/T2/A1/A2 均落新行〕；同实体异内容 ⇒ **409 响亮拒绝**）；**但改法 = 审计 §4 的 A/B/C 三选项待 Zang 裁定**（审计自述「只取证不裁决」）⇒ **v0.6 定案**；**★ 硬事实**：2a 的 J4 submit 是**前端唯一在用该面写口且从不传键**（`ActiveTaskModal.jsx:50-58`）⇒ 若取 A/C **必须同单改前端** |
| **7-26** | §1.8 清单的**维护责任** | **机制已定 · 责任人待 Zang** | 机制 = Zang §5.85 裁定①；本册建议（**不构成裁定**）：每批复核**强制项**（重跑扫描命令 + 新增/消除项逐条登记；**漏登 ⇒ 复核不通过**）/ 不得以「归同批其它片」结案 / 注册后必须从清单划掉 |
| **7-27** | **前端是否依赖旧 `400`** 的全量核验 | **部分已取证 · 残留 `NOT_MEASURED`** | 见 §D3；批 4 必须全量核 `frontend/src/**` 与单测 |

- **§8.1 变更记录**：新增 **v0.5 行**（8 组 delta 逐条摘要）。
- **§8.7 新增**（**本册 v0.5 增补块**）：**8.7.1 本单声明**（只写 3 个文件 + 安全红线自证 + **为何未写 `data-layer.spec.md`**）；**8.7.2 `NOT_MEASURED` 增补 17–22**（审计自身未测项 / 前端旧 400 全量核验 / `/api/job*` 六条 HTTP 面 / `disputed`·三态币种闸·`job_escrow_missing`·并发 / 401·403 日志归因（批 3b 面）/ **批 3b 报告本体转引未复算**）；**8.7.3 自曝 16–20**（**「批 3b」与「`p4-b3c`」两名一片**〔第三人证：审计 `:191` 内称「批 3c」〕/ §1.8 是现取扫描非转引 / 行号口径与不做未测回填 / `git` 只读用法与改前锚点 / **§1.8 的准入判据是本册口径、非 Zang 原文**）；**8.7.4 v0.4→v0.5 关键 delta 对照表**（10 行，供质检对拍）。

---

## §D9 **★ 为何本单 `docs/data-layer.spec.md` 一字未写**（显式判定，非遗漏）

本单全部 delta 落在**路由 / 服务编排层**（未注册清单 + 两条行为 delta + 批 3b 落地事实 + `create_key` 口径登记 + 元信息/§7 同步）：

1. **`DL86` 的两形态是「实测验证既有条文」**（`p4-b3c §4.1 E5/E8`）⇒ **不是改条文**；
2. `create_key` 口径若最终裁定「2a 也改 fail-loud」，改的是 **`src/job-service.ts` 的编排行为 + §4.5/§4.4 的编排口径**（本册）⇒ **不构成 data-layer 规则变更**；
3. 轮内 delta 4 提到的 `database.ts` **+3 method** 是**服务层新增方法**（不是新表/新列/新 kind/新白名单）⇒ 无 `DL*` 需要回写。

⇒ **「只许追加式」的上限 = 本单一次都不用追加**。**现取自证**：`docs/data-layer.spec.md` = **1023 行 / md5 `ad657c0a5068e91cb57d935bb34fd86b`**（v0.7，含 §18 加注 @ `:1015`）—— **与本单开工时逐字节相同**；**未新建任何 data-layer 快照**。

---

## §D10 交付物与自证

| 交付物 | 读数（交付时现取） |
|---|---|
| `docs/route-layer.spec.md`（就地升 **v0.5**） | **881 行 / 210464 字节 / md5 `7493f410b30de2ff042a3b137eeb0615`**（改前 v0.4 = 763 / 166747 / `e8b3ceffd98ef82fb37c77c2b13b6108`） |
| `docs/versions/route-layer.spec.v0.5.md`（**新建**） | 与本体 **`cmp` = 相同**（`CMP_IDENTICAL_OK`） |
| `docs/audit/route-layer-v0.5-delta.md`（本件） | —— |
| **未动**（自证） | `route-layer.spec.v0.1/v0.2/v0.3/v0.4.md`（四快照）、`data-layer.spec.*`、`ledger.spec.md`、`seafood.master-plan.md`、其它 `docs/audit/*`、`backend-ts/**`、`frontend/**` |

**★ 改前锚点可复算**：两条行为 delta 的「改前」取自 `git show 9d40b17:backend-ts/src/index.ts`（`9d40b17` = 批 3b 的**前一 commit**；`grep -c "Invalid jID"` = **3 → 2**）；`git status --porcelain` **现取 = 空**（工作树干净 ⇒ 批 3b 已提交为 `8f2974c`）。

**★ 事件留痕（口径事故）**：`docs/audit/p4-aud-jobkey.md` 在本单**中途落盘**（开工首次 `ls docs/audit/` **无此文件** ⇒ 本册初稿按「**审计在飞**」写；随后复核 `ls` **见文件**）⇒ 已**就地更正**为**引其读数**（§7-25 / §8.7.2-17 / §8.7.4 / 头部要点 ⑤ 四处），**未**留下「审计在飞」的过期表述。

**★ 纪律自证**：**未改任何代码**（`backend-ts/**` 只读）；**未**启停服务/进程、**未** kill 任何 PID；**未**做任何 SQL（零库连接）；**未** `npm install`；**未**用 `execute_code`；**未** `git add/commit/push`；**未**用 `timeout`（本机无）；**未**改 `docs/seafood.master-plan.md` 与 `ledger.spec` 的 `R1..R109`/33 码。
