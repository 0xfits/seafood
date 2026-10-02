# 批 8（P6 运营后台）启动侦察报告（p8-p6-recon）

> **作者角色** = **Kong（实现方）** · **单别** = 批 8 / P6 运营后台 **第 1 轮只读盘点**（依据 = `docs/seafood.master-plan.md` §5.178 / v0.178，`:1419-1431`）
> **★ 硬口径自证**：本单**严格只读** —— **未改任何代码/迁移/spec/其它 docs**；**唯一写盘 = 本文件**（`docs/audit/p8-p6-recon.md`）；**未** `git add/commit/push`；**未** `npm install`；**未**碰/打印 `.env*`；**未**用 `pkill -f`/`killall`；**未**启停任何端口（5787/5788 未触）；**未**起自建实例；**未**连真库（如需仅允许只读 SQL，本单**未**执行任何 SQL）。
> **所有读数为本单现取**（命令随文给出）；**未测项显式标 `NOT_MEASURED`**（禁填 0 / 禁空）。
> **基线**：`schema_version=0024`（任务给定口径；本单未连库自证 ⇒ 见 §11）。仓库 HEAD = `0ed44a1`（`docs: 批 8 候选清单… + §5.177/v0.177`）。

---

## §0 元信息与基线读数（现取）

| 项 | 命令 | 本单现取读数 |
|---|---|---|
| 路由注册点 | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | **68**（= 冻结基线 **68，未变 ✓**） |
| 逐 verb | `for v in get post put patch delete; do grep -cE "^app\.$v\(" …; done` | get **27** / post **38** / put **0** / patch **1** / delete **2**（= 68；与 spec v1.8 §1.14 `:687` 现取逐 verb 相符） |
| index.ts 行数 | `wc -l backend-ts/src/index.ts` | **2060**（spec v1.8 T2 记 2047 ⇒ 行号已漂移，**注册点数不变**） |
| 前端 admin 页面 | `ls frontend/src/pages/admin/` | **7 个**：Permissions / Points / Rewards / Shards / SystemSettings / Tasks / Users（**无** Commission / Currency / Audit / Deposit 页） |
| migrations | `ls backend-ts/migrations/` | `0001`–`0017` + `0019`–`0024`（**`0018` 无文件**，勿补 ⇒ 与既有口径一致） |
| 后端服务层文件 | `find backend-ts/src -name '*.ts'` | 含 `admin-service.ts` / `auth.ts` / `commission.ts` / `currency-service.ts` / `database.ts` / `index.ts` / `job-*-service.ts` / `ledger*.ts` / `listing-*-service.ts` / `market-service.ts` / `translate-service.ts` 等 17 件 |

> **★★ 注册点 = 68 未变**（本单独立现取，非转抄）：任务给定「若变必报」⇒ **未变**，**无报警项**。

---

## §1 八项三态总表（逐项一句话；详读见 §2–§9）

| # | 条目 | 三态 | 已有 | 缺口 |
|---|---|---|---|---|
| 1 | 费率配置（`commission_policy.fee_rate_bp`） | **半成品** | 写口 `POST /api/admin/commission_policy`（`index.ts:1954`）+ 真写库 `commission.ts:240` + 表约束 | 无后台页；无「改费率 → 业务层真读取生效」端到端读数（运行时读口 `database.ts:2219` 已在） |
| 2 | 返佣权重矩阵（10 级 × 时间权重） | **半成品** | 同 1 写口（`levels`/`weights_bp` 同插）+ 守卫 `commission.ts:166` + 分配算法 `commission.ts:432` | 无后台页/矩阵 UI；「时间权重」= 多版本政策（D12），无版本管理面 |
| 3 | 上市保证金规则（`listing_deposit`/`hold_release`/`hold_forfeit`） | **半成品** | C2 消耗路径落地（`currency-service.ts:329` + `database.ts:listCurrencyWithDeposit`；4 腿入 `-1`）；`0019`/`0020` 已 apply | 金额为代码常量 `50000`（`currency-service.ts:144`，非可配置）；无后台页；`hold_release`/`hold_forfeit` 定义在但 P3 裁定不用 |
| 4 | 自建单位审核（用户可发币 ⇒ 审核闸） | **缺失** | 建币口 `POST /api/currency`（`index.ts:1593`）落地；状态机 `draft/listed/frozen/delisted` 已在（`0001:35`）；`currency_status_log` 表已建（`0017:139`） | **无任何管理员审核闸**（owner 自迁 `draft→listed`）；`currency_status_log` **零写入**（`src/` 无引用）；无后台待审页 |
| 5 | 商品/招工合规审核 | **缺失** | 招工有**结算审核**面（`index.ts:1783`，权限 `review_tasks`）；listing/job 状态机白名单已在 | **无「发布前合规审核」闸**：listing `draft→listed` 由卖方自迁（`index.ts:1880`）、job publish 即 `open` |
| 6 | 用户与权限（`admin_role*` 三表 + 11 键 + `resolveAdminAccess`） | **已有（大半）** | 后端全链 + 种子 `0022`（11 键 + super_admin）+ 7 后台页 + `AdminLayout` + 路由闸 | 前端残留第三真源（`admin-utils.js:3` `ADMIN_ADDRESS` 硬编码）= `R-7E-6` 收敛面；`is_admin` 单键 `user/update` 无角色分配 UI |
| 7 | 资产与流水审计台（须与 `ledger_entry` 逐条对账） | **缺失** | 用户自助读口 `GET /api/user/ledger`（`index.ts:633`，keyset 分页）；审计表 `admin_ops_audit_log`（`0023:64`）+ `admin_refund_audit_log`（`0024:48`）已在 | **无管理面审计读口/页面**；两张审计表 **`src/` 零读取**（仅注释引用 `database.ts:2052`） |
| 8 | `app_config` 管理（含合法键清单 + 写入门禁） | **半成品** | 读写口 `GET/POST /api/admin/settings`（`index.ts:1125/1142`）+ 真读写 `database.ts:2865/2878`；「禁写费率键」闸已在（`index.ts:1155` + `admin-service.ts:99`） | **合法键清单缺失**、**写入门禁缺失**（现为「整块 `system_settings` 单键 upsert」，非逐键白名单）= spec §7-16 登记的批 6 待办 |

**总判定**：八项中 **0 项「全有」**、**4 项「半成品」**（费率 / 权重 / 保证金 / `app_config`）、**1 项「已有大半」**（用户与权限）、**3 项「缺失」**（自建单位审核 / 合规审核 / 审计台）。

---

## §2 条目 1 —— 费率配置（`commission_policy.fee_rate_bp`）

- **路由层**：**已有** `POST /api/admin/commission_policy`，注册于 `backend-ts/src/index.ts:1954-1976`（权限闸 `:1955` = `requireAdmin(req,res,'manage_settings')`；`created_by` 由 token 注入 `:1970`）。**注册点数 68 含此**（现取未变）。**无 GET 政策读口**。
- **实现层**：`backend-ts/src/commission.ts:240` `insertCommissionPolicy` = **真写库**（`INSERT INTO commission_policy …` `:247-256`，`RETURNING`）；守卫 `commission.ts:166` `guardCommissionPolicy`（`fee_rate_bp` 非整数或 ∉[100,500] ⇒ `COMMISSION_REASON.FEE_RATE_OUT_OF_RANGE` `:175-176`）。**无分录**（政策表、非资金表）。
- **运行时唯一真源读取（已在）**：`backend-ts/src/database.ts:2219` `currentFeeRateBp`（**只读** `fee_rate_bp`，`SELECT p.fee_rate_bp::int` `:2226`）；消费方 = `market-service.ts:85` `MARKET_FEE_RATE_SOURCE = 'commission_policy.fee_rate_bp'`（交易所手续费服务端取数）。
- **数据层**：`migrations/0007_referral_and_commission_policy.sql:84` `CREATE TABLE commission_policy`（`fee_rate_bp integer NOT NULL` `:86`）；约束 `:92` `commission_policy_fee_rate_rng CHECK (fee_rate_bp BETWEEN 100 AND 500)`；`effective_from` 唯一 `:97` `commission_policy_effective_uniq`；`created_by` 放宽 `:99`（无 FK，裁定 #9）；触发器 `:110` `trg_commission_policy_append_only`（append-only ⇒ **有 `commission` 行只准前滚**）；种子行 `:161-168`（口径 A：`fee_rate_bp=100`/`levels=10`/`effective_from=1970-01-01`，种 `created_by=0`）。
- **权限**：`manage_settings`（spec §1.11 **Q8** `route-layer.spec.md:567`；Zang §5.92 ②「复用既有权限键、不新造」）。
- **前端**：**无**对应后台页。`frontend/src/pages/admin/SystemSettings.jsx`（300 行）仅含 `siteName/maintenance/pointsPerTask…` 9 字段，**无费率字段**；且 `POST /api/admin/settings` **禁写费率键**（`index.ts:1155` `findFeeRateKey` → `400 FEE_RATE_KEY_NOT_IN_APP_CONFIG`）。
- **spec 面（已有冻结条文）**：`route-layer.spec.md` **§4.4-11**（金额来源硬口径）、**§7-16**（`:1642` 删除自拟费率黑名单、真源唯一改由读取侧纪律）、**§7-23**（`:1649` 机制已落地、数值待 Kevin）、**§1.11 Q8**（`:567`）、**R3 行**（`:1364` 变更佣金政策 = B 类：管理面写 + 运行时只读）、**§4.9**（数值定值）；`commission.spec.md` **§4**（版本化政策 §4.1–4.5）+ `CR23–CR28` + `CR38`。
- **既有测试/门**：后端 `scripts/p2d-00-commission-m-criteria.ts`（M 判据）+ `p2qa-00..15`（政策/分配/守恒）；`docs/qa/p2-commission.md`。**无前台费率页门**。
- **三态结论**：**半成品** —— 写口 + 真写库 + 表约束 + 运行时读取全在；**缺**后台页与「改费率 → 业务层真读取生效」的四段读数页。
- **最小可交付切片**：新增后台「费率」页（只读现行政策 + 插新版表单含 `effective_from`），**复用既有写口**（不新增路由 ⇒ 注册点仍 68）；AC = 后台写 → `commission_policy` 落值 → `database.ts:2219` 读到 → 交易所手续费 `fee` 变化（四段读数）。
- **依赖**：无强依赖；数值口径 §4.9 已定（100–500 bp 区间）。

## §3 条目 2 —— 返佣权重矩阵（10 级 × 时间权重）

- **路由层**：**与 §2 同口** —— `levels`/`weights_bp` 随同一 `POST /api/admin/commission_policy`（`index.ts:1954`）插入；注册点数 68。
- **实现层**：守卫 `commission.ts:166`（`levels` 1–10、`array_length(weights_bp)=levels`、`Σweights_bp ≤ 10000`、`weights_bp[1] ≠ 0`）；分配算法 `commission.ts:432` `splitPool`（**最大余数法**）+ `:386` `mulDivHalfUp` + `:392` `computeFee`；消费方 `:607` `planJobSettlement`。**真写库**同 §2（`INSERT … weights_bp` `:247-256`）。
  - ★ **`commission_payout` 不是表**：裁定 #4 明确**不建**（`0007` 头注 `:29`）；它仅作 `ref_type` 枚举值（`0001_ledger_core.sql:85` / `ledger.ts:165`；`commission.ts:727,729` 以 `refType:'commission_payout'`）。
- **数据层**：`commission_policy.levels smallint NOT NULL` `:87` / `weights_bp smallint[] NOT NULL` `:88`；约束 `:93` `levels_rng CHECK (levels BETWEEN 1 AND 10)`、`:94` `weights_len CHECK (array_length(weights_bp,1)=levels)`、`:95` `weights_nonneg`；触发器 `:153` `trg_commission_policy_weights_guard`（`Σ≤10000` + `Σ≠0` + `weights_bp[1]≠0` ⇒ 拒；`commission.spec §2.3` 明写 `Σweights_bp ≤ 10000` **不可能用 CHECK 表达**、须触发器）。邀请图 `referral` 表 `0007:48-64`（PK `child_uid` / FK `users` ×2 / `no_self` / `depth_rng` / `idx_referral_parent`）+ append-only 触发器 `:75`；「`Σ佣金 == 手续费`」DB 侧后置断言 = `CONSTRAINT TRIGGER trg_ledger_entry_commission_conservation` `:357`。
- **权限**：`manage_settings`（同 §2）。
- **前端**：**无**对应页（无权重矩阵 UI）。
- **spec 面**：`commission.spec.md` **§4**（版本化政策 §4.1 版本选择 / §4.2 不追溯 / §4.4 **默认权重矩阵建议**）、**§6**（池子 / 取整 / 最大余数法）、**§7**（重归一化 D13「按已有层级权重比例再分配」）、**§2.1 DDL 片段**、**§2.3**（`Σ` 只能触发器）；规则 `CR46`/`CR47`/`CR50`。`route-layer.spec.md` **§4.8**（金额来源三分）、**§7-41**（`:1697`「有链 ⇒ `job_fee` 入 `-2`」的 HTTP 级形态 = `NOT_MEASURED`，造链需 `/api/referral/bind`）。
- **既有测试/门**：`scripts/p2d-00-commission-m-criteria.ts`；`scripts/p2qa-02-rounding-renorm.ts` / `p2qa-06-levels10-tail.ts` / `p2qa-13-assert-matrix.ts` / `p2qa-14-replay-guard.ts`；`docs/qa/p2-commission.md`。
- **三态结论**：**半成品** —— 数据层 + 守卫 + 分配算法齐；**缺**后台矩阵 UI 与「10 级 × **时间**权重」的版本管理面。★「时间权重」口径 = **D12 已冻结为「后台可改 + 按生效时间版本化」**（非账龄分档；`commission.spec.md:67` 明写「账龄分档本册不做」）⇒ 实现载体 = `commission_policy.effective_from` + 事件时刻取现行版。
- **最小可交付切片**：后台「权重矩阵」页（10 输入 + 前端实时显示 Σ% + 服务端守卫回显），先只读展示现行政策、再插新版；AC = 插入后 `commission_policy` 落值 + 一次真链结算的腿数/分层金额变化。
- **依赖**：与 §2 同页同口；★ **真链返佣验收的造链前置** = `/api/referral/*` 在读口面**未注册**（本单 `grep referral backend-ts/src/index.ts` = **0 命中**）⇒ 造链需 DB 直造或另开读口（登记给 Zang）。

## §4 条目 3 —— 上市保证金规则（`listing_deposit` / `hold_release` / `hold_forfeit`）

- **路由层**：**无独立保证金端点**。保证金在 C2 `POST /api/currency/:cid/list` 内（`index.ts:1621-1639`，`requireActor` `:1622`）；注册点数 68 含此。
- **实现层**：`currency-service.ts:329` `listCurrencyVerb` —— 保证金值 `:350` `resolveServerAmount(body.deposit_amount ?? body.deposit, 'deposit_amount', CURRENCY_LIST_DEPOSIT_FLOOR)`；下限常量 `:144` `CURRENCY_LIST_DEPOSIT_FLOOR = 50000`（**代码常量，非可配置**）；真写库 `database.ts:1668` `listCurrencyWithDeposit`（**4 腿全在 `balance`**：上市费 `currency_create_fee`×2 + 保证金 `listing_deposit`×2，贷方 = `uid=-1`；`frozen` 零变动）。回执 `deposit_consumed`/`deposit_credit_uid:'-1'`/`deposit_refundable:false`（`currency-service.ts:435-442`）。
- **数据层**：`currency` 列 `deposit_amount`/`deposit_cid`/`listed_at`（`0001_ledger_core.sql:23-26`）；`CONSTRAINT currency_deposit_guard CHECK (deposit_amount >= 0)` `:36`；`currency_status_enum` `:35`。资金面：`ledger.ts:178` `HOLD_KINDS = ['hold','hold_release','job_escrow','job_escrow_refund']`（**`listing_deposit` 已移除**）；`:550` `-1` credit 白名单**含 `listing_deposit`**；`:154` kind 关闭集（20）含 `hold_release`/`hold_forfeit`；`:554` `-3` 白名单含 `hold_forfeit`。迁移：`0019_listing_deposit_platform_credit.sql`（加法扩展 `-1` credit 白名单）+ `0020_ledger_post_event_hold_family_drop_listing_deposit.sql`（从 `ledger_post_event` 函数体 hold 家族 IN 列表摘除）**均已 apply**（spec §1.7 H1 记录 `schema_version=0020`）。
- **权限**：`requireActor` + 服务层 owner 闸（非 owner ⇒ `403 AUTH_FORBIDDEN + ACTOR_NOT_ALLOWED`，`currency-service.ts:403-410`）；**无 admin 权限闸**。
- **前端**：**无**（无建币/上市页；本单 `grep -rn "/api/currency" frontend/src` = **1 命中，且为注释** `PublishJobPage.jsx:14`「币种读口未注册」）。
- **spec 面**：`route-layer.spec.md` **§7-3**（`:1629` `listing_deposit` = 上市即消耗 → 贷 `-1`；不可退/无退还 kind/无罚没）、**§7-22**（`:1648` 退市/罚没 = P3 **无此动作**）、**§7-23**（`:1649`）、**§4.2 C1/C2**、**§4.4-11/§4.4-12**、**§4.9**（保证金 = **50,000**，Kevin 2026-09-30 定值）；`ledger.spec.md` **§13.2**（`-1` credit 白名单）、`DL67`/`DL88`/`DL91`（`hold_forfeit` P3 不启用）；`0017:81` 表注释（费率/权威口径）。
- **既有测试/门**：`scripts/p4z-b3a-*` / `p4z-b3afix*` / `p4z-b3b-*`（建币/上市资金）；`docs/audit/p4-b3a-currency-funds.md`、`p4-b3b-currency-funds-fix.md`。
- **三态结论**：**半成品** —— C2 消耗路径 + 两迁移已落地；**缺**金额可配置（现为常量 50000）、后台页；`hold_release`/`hold_forfeit` 定义在但**按 `§7-22` 裁定 P3 无对应动作**（非缺口）。
- **最小可交付切片**：把保证金 50000 **改为「后台可配置 + 常量兜底」**（承接 §7-23「机制先落地、数值待 Kevin」；载体 = 新 `app_config` 键 vs `currency.deposit_amount` 既有语义**待定格**）；AC = 后台改保证金 → C2 收款腿金额变化（真链）。
- **依赖**：**§9（`app_config` 管理 / 门禁）** —— 不得从 `app_config` 硬造键名（Zang §5.82 7-16）。

## §5 条目 4 —— 自建单位审核（用户可发币 ⇒ 审核闸）

- **路由层**：建币口 `POST /api/currency`（`index.ts:1593-1619`，`requireActor`）**已注册**；上市口 `POST /api/currency/:cid/list`（`:1621`）。**无审核端点、无待审读口**。
- **实现层**：`currency-service.ts:196` `createCurrencyVerb` ⇒ 建出 `status='draft'`（`:302`）；上市 = **同一 owner 自迁** `draft→listed`（`:329` `listCurrencyVerb`，服务层仅校 owner）。**无任何管理员审核闸**。
- **数据层**：`currency_status_enum CHECK (status IN ('draft','listed','frozen','delisted'))`（`0001:35`）；`currency_status_log` 表**已建**（`0017_platform_config.sql:139-152`，7 列 + append-only 触发器 `:236-239`）—— ★ **但本单 `grep -rn 'currency_status_log' backend-ts/src` = 0 命中 ⇒ 该表零写入**（无路由/服务层写它）。（`market-service`/`0016` 只读 `currency.status`，`0016:951/977`。）
- **权限**：**无**（建币仅 `requireActor`；上市由 owner 自迁）。
- **前端**：**无**后台审核页；亦无建币页。
- **spec 面**：`data-layer.spec.md` **DL73**（`currency_status_log`）+ `0017 §C`；`route-layer.spec.md` **§7-17**（`:1643` 币种状态闸的**落点** —— **仍待 Zang**）；治理项（`data-layer.spec` / master-plan v0.54 登记）：「`currency.status` 变更与 `currency_status_log` 写入的一致性，**DB 层无法强制** ⇒ **路由层硬约束**」。
- **既有测试/门**：**无专用审核门**；资金面有 `p4z-b3a`/`p4z-b3b`。
- **三态结论**：**缺失** —— 建币口与状态机在，但**审核闸 / `currency_status_log` 写入 / 后台待审页三者全缺**。
- **最小可交付切片**：① 先落 `currency_status_log` 写入（DB 触发器或路由层）；② 后台「待审单位」**只读**列表。★ **审核闸本体（owner 自迁 ⇒ 改需 admin 批准）会变更 C2 语义 ⇒ 须 Zang 裁定，不得自选**。
- **依赖**：**§7（用户与权限：需 admin 权限键 + 闸）**。

## §6 条目 5 —— 商品/招工合规审核

- **路由层**：商品写口 `POST /api/listing`（`index.ts:1825`）/ `POST /api/listing/:listingId`（`:1852`，编辑）/ `PATCH /api/listing/:listingId`（`:1880`，状态迁移）；招工写口 `POST /api/job`（`:1679`）/ `/apply`（`:1708`）/ `/accept`（`:1730`）/ `/submit`（`:1755`）/ **`/review`（`:1783`）** / `/cancel`（`:1807`）。**无「发布前合规审核」端点**。
- **实现层**：`listing-service.ts:164` `createListing`（建出 `draft`；`0015:124` `status … DEFAULT 'draft'`）⇒ 上架由**卖方自迁** `transitionListingStatus`（`listing-service.ts:286`，`PATCH /api/listing/:listingId`）。招工 `job-funds-service.ts` `publishJob` ⇒ **入库即 `open`**（`0013:537` `VALUES (…,'open',…)`），**托管即生效、无审核闸**。★ 既有 `POST /api/job/:jobId/review`（`:1783`）是**结算审核**（`approved` ⇒ `settleJob` / 否则 `refundJob`），**非发布前合规审核**。
- **数据层**：`public.listing_status_transition_ok`（`0015_listing.sql:83`，`draft→{listed}` / `listed→{delisted,frozen}` / `frozen→{listed}` `:87-95`）+ 触发器 `trg_listing_status_guard`（`:372`）；`public.job_status_transition_ok`（`0013_job.sql:60`）+ 触发器 `trg_job_status_guard`（`:222`）。两者均**不要求审核位**（卖方/雇主自迁即可）。
- **权限**：listing 写口 = `requireActor`（**无 admin 闸**）；招工 review/cancel = `requireAdmin(req,res,'review_tasks')`（`:1784` / `:1808`）；`/accept` 等 = `requireActor`。
- **前端**：`frontend/src/pages/listings/*`、`jobs/*`（发布/详情/审核页）；**无合规审核页**（`JobsReviewPage` 为结算审核面）。
- **spec 面**：`route-layer.spec.md` **§4.2**（J1–J6 / P1–P4 事件行与 actor）；`data-layer.spec.md` **DL51**（`job_status_transition_ok`）/ **DL60**（listing 状态白名单）。
- **既有测试/门**：`docs/qa/p3-0013-job-review.md` / `p3-0014-job-flow-review.md` / `p3-0015-listing-review.md`（状态机/资金）。
- **三态结论**：**缺失** —— 无「发布前合规审核」面（listing 由卖方自迁上架、job 发布即 `open`）。
- **最小可交付切片**：引入上架审核态（`listing`/`job` 发布 ⇒ 新增「待审」态、**仅 admin 可 approve 入 listed/open**）；**须 Zang 裁**（新状态 = 改 DB 状态机白名单，属破坏性迁移面）。
- **依赖**：**§7（用户与权限：`review_tasks` 权限键已存在 ⇒ 复用）**。

## §7 条目 6 —— 用户与权限（`admin_role*` 三表 + 十一权限键 + `resolveAdminAccess`）

- **路由层**：`GET /api/admin/me`（`index.ts:1119`）、`GET /api/admin/permissions`（`:1180`，`manage_permissions`）、`POST /api/admin/permissions/save`（`:1199`）、`POST /api/admin/permissions/delete`（`:1229`）、`POST /api/admin/user/update`（`:1251`，`manage_users`）、`GET /api/user/all`（`:1315`）、`GET /api/user/stats`（`:1333`）。注册点数 68 含全部。
- **实现层**：`database.ts:2740` `resolveAdminAccess`（**唯一真源** = `users.is_admin` OR `EXISTS(admin_user_role.uid)`，`:2745-2750`；★ 真源 `isAdminAddress` **已从后端移除** `:2741-2744`）、`listPermissionGroups`（`:2756`）、`savePermissionGroup`（`:2762`，单事务重建 `admin_role*`）、`hasAdminRoleRow`/`getPermissionsForUser`（`:2748` 调用）。闸助手 `index.ts:299` `requireAdmin(req,res,requiredPermission?)`。管理员动词 `admin-service.ts`：`adminPermissionSaveVerb:121` / `adminPermissionDeleteVerb:177` / `adminUserUpdateVerb:211`。**均真写库**。
- **数据层**：`0017_platform_config.sql`：`admin_role`（`:93`，PK `role_key`）、`admin_permission`（`:104`，PK `permission_key`）、`admin_role_permission`（`:112`，PK(role_key,permission_key) + 双 FK）、`admin_user_role`（`:125`，PK(uid,role_key) + FK `users`/`admin_role`）；守卫触发器 `trg_admin_role_key_immutable`（`:217`）/ `trg_admin_role_permission_key_immutable`（`:227`）。种子 `0022_admin_permission_seed.sql`：**11 权限键**（`:50-62`）+ **`super_admin` 1 行**（`:68`）+ `super_admin × 11`（`:76-88`）+ 原持有人 `admin_user_role` 1 行（`:96-99`）+ apply-time 自检（`:112-176`）。
- **权限**：**十一键闭集** = `database.ts:11-23` `ALL_ADMIN_PERMISSIONS`（`dashboard_access` / `manage_tasks` / `publish_tasks` / `manage_rewards` / `publish_prizes` / `read_users` / `manage_users` / `manage_points` / `manage_permissions` / `manage_settings` / `review_tasks`）；`requireAdmin` 已用键：`manage_settings`（`:1126/1143/1955`）、`manage_permissions`（`:1181/1200/1230`）、`manage_users`（`:1252`）、`review_tasks`（`:1350/1365/1381/1784/1808`）、**无键**（默认仅 `can_access_admin`）`points/adjust`（`:1473`）/ `user/all`（`:1318`）/ `user/stats`（`:1334`）/ `assets/init`。
- **前端**：`App.jsx:134` `ProtectedRoute`（`adminOnly` + `requiredPermission`）；后台 7 路由 `App.jsx:236-243`；`components/layout/AdminLayout.jsx`（230 行）；`admin-utils.js:66` `hasAdminPermission`。★ **残留第三真源**：`admin-utils.js:3` `ADMIN_ADDRESS = '0x59f9…'` + `isAdminUser`（`:7-14`）+ `fetchAdminAccess` 的 catch 回退（**硬编码 11 键 + 硬编码地址**）—— 对应批 8 A 小项 **`R-7E-6`「keys 收敛」**（后端已收敛、前端未收敛）。
- **spec 面**：`route-layer.spec.md` **§7-8**（`:1634` 权限键真源放代码侧 `ALL_ADMIN_PERMISSIONS`，Zang §5.77 修正）、**§7-49…§7-58**（`:1735-1763` 管理员退款契约、权限闸选键、审计落点等）、**§6**（单一真源）；`data-layer.spec.md` **DL72**（`admin_role*` 四表）/ **DL78**（uid FK）；`0017` 列契约 + `0022`。
- **既有测试/门**：`frontend/src/test/unit/admin-utils.test.js`、`app-routes.test.jsx`、`dashboard-page.test.jsx`；`docs/audit/p6-b6-perm-seed.md`。
- **三态结论**：**已有（大半）** —— 后端全链 + 种子 + 7 后台页 + 路由闸齐；**半成品点** = ① 前端硬编码地址/11 键残留（`R-7E-6`）；② `admin_user_role` 无独立分配 UI（角色分配走 `permissions/save` 的 `user_ids`）。
- **最小可交付切片**：**`R-7E-6` keys 收敛**（前端 `isAdminUser`/`fetchAdminAccess` 去硬编码地址与 11 键枚举，改由 `/api/admin/me` 单一真源 + 已知兜底）。**依据 = master-plan §5.178 A（已并入批 8 第一批）**。
- **依赖**：**无**（其余条目的权限闸均依赖本条，故宜先做）。

## §8 条目 7 —— 资产与流水审计台（须与 `ledger_entry` 逐条对账）

- **路由层**：**唯一流水读口 = `GET /api/user/ledger`**（`index.ts:633-758`，`requireActor`，keyset 分页 `?kind=&cid=&before_txid=&limit=`），**只读本人**。**无管理面审计读口**（本单 `grep 'admin.*ledger\|admin/ledger'` = 0）。
- **实现层**：`index.ts:633` handler（`account`/`ledger_entry` 派生、`deposit` 只读）；前端 `ledger-api.js:32` `fetchMyLedger`。**审计表零读取**：`admin_ops_audit_log`（`0023`）与 `admin_refund_audit_log`（`0024`）在 `backend-ts/src` **无任何 `SELECT`**（本单仅 `database.ts:2052` **注释**提及）。
- **数据层**：`ledger_entry`（内核，唯一分录真源）；审计表 `admin_ops_audit_log`（`0023_admin_points_audit_daily_cap.sql:64`，append-only 触发器 `:125`，`CHECK action='points_adjust'` `:86`、`result IN ('applied','rejected_daily_cap')` `:89`、`UNIQUE(idempotency_key,result)` `:99`、索引 `actor_day` `:133` / `target` `:135`）；`admin_refund_audit_log`（`0024_admin_refund_audit.sql:48`，append-only 触发器 `:100`）；编排函数 `listing_refund_post_event`（`0024:132`）。
- **权限**：**无**（审计读口不存在）；`/api/user/ledger` = `requireActor`（本人）。
- **前端**：`pages/ProfilePage.jsx`（「流水」面板，`:376-411`）+ `pages/market/MarketPage.jsx`（「账本流水」面板，`?kind=transfer`）；**无管理面审计台页**。
- **spec 面**：`route-layer.spec.md` **§7-51**（`:1737` 审计落点：复用 `admin_ops_audit_log` vs 新表）、**§7-53**（`:1749`「**审计面分裂**（两张审计表）⇒ **待 P6 审计台立项时定**」是否合并）、**§7-52**（`:1748` A1 无键 `requireAdmin` 面与新契约不一致）、**§7-55**（`:1751` 闸前拒绝不留痕 + 本仓不落 access log）、**§7-58**（`:1763` 回执键集）；`ledger.spec.md`（对账口径 / `DL*`）。
- **既有测试/门**：`docs/qa/p7-a-ledger-read-review.md`；`frontend/src/test/unit/p7a-ledger-error-i18n.test.js`；`scripts/` 内 ledger 只读探针（`p1j-read.ts` 等）。
- **三态结论**：**缺失** —— 管理面读口与页面全无；**两张审计表已在但零读取**。
- **最小可交付切片**：新增**只读** `GET /api/admin/audit/*`（并联/合并两审计表 + 按 actor/target/日筛选）+ 后台审计台页 + **与 `ledger_entry` 逐条对账 SQL**（AC 硬判据②「零差异」）。★ **须先裁 §7-53**（两表合并/并联）。
- **依赖**：**§7（用户与权限：审计读口需 admin 权限键 + 闸）**。

## §9 条目 8 —— `app_config` 管理（含合法键清单 + 写入门禁）

- **路由层**：`GET /api/admin/settings`（`index.ts:1125`，`manage_settings`）、`POST /api/admin/settings`（`:1142`）；`POST /api/admin/settings/reset`（`:1176`，**已 410**）。注册点数 68 含前二者。
- **实现层**：`database.ts:2865` `getSystemSettings`（**只读单键** `key='system_settings'`，`SELECT value … WHERE key='system_settings'`）、`:2878` `saveSystemSettings`（`INSERT … ON CONFLICT(key) DO UPDATE`，写整块 JSON）。**「禁写费率键」闸已在**：`index.ts:1155` `findFeeRateKey(body)` ⇒ `400 FEE_RATE_KEY_NOT_IN_APP_CONFIG`（键模式集 = `admin-service.ts:99`）。
- **数据层**：`0017_platform_config.sql:69` `CREATE TABLE app_config`（`key text PK` `:74`、`value jsonb NOT NULL` `:71`、`CONSTRAINT app_config_value_is_container CHECK (jsonb_typeof(value) IN ('object','array'))` `:77`、`updated_by bigint NOT NULL` **无 FK**）；守卫函数/触发器 `platform_config_key_immutable` / `platform_config_touch_updated`（spec §7 `:1592`）。★ **无键名枚举**（`0017` 全文件仅 `:81` 表注释提费率：真源在 `commission_policy.fee_rate_bp`、旧键保留不删 —— spec §7-16 实证）。
- **权限**：`manage_settings`。
- **前端**：`pages/admin/SystemSettings.jsx`（300 行，静态 9 字段表单，真接 `GET/POST /api/admin/settings`；「重置」按钮已删 `:152`）。
- **spec 面**：`route-layer.spec.md` **§7-16**（`:1642` **★「`app_config` 合法键清单 / 写入门禁」明确登记归「批 6 配置面规格」**，现状**无键名枚举**「硬造即自拟」）、**§1 #32/#33**（`:299/:300`）、`data-layer.spec.md` **DL71**（`app_config` 逐列）、`0017:81` 表注释。
- **既有测试/门**：**无专用门**（`SystemSettings` 无 unit；`frontend/src/test/unit` 无 settings 专项）。
- **三态结论**：**半成品** —— 读写口 + 真写库 + 费率键拒绝在；**缺「合法键清单」与「写入门禁」**（现为整块单键 upsert）。★ 此项 = **其余配置面（费率/保证金）的地基**。
- **最小可交付切片**：定义 `app_config` **合法键清单**（真源 = 代码常量或迁移种子）+ **写入门禁**（未知键 ⇒ 400）；AC = 后台写 → `app_config` 落值 → 业务层读取生效（四段读数）。承接 §7-16 / §7-23。
- **依赖**：**无**（地基项，宜最先做）。

## §10 最小可交付切片建议与依赖图

### §10.1 批 8 三条硬判据（**每片必带**；依据 = master-plan §5.178 D `:1431`）

1. **真链路生效**（四段读数）：后台写 → 库落值 → 业务层读 → **行为变**（**不得只验「后台能存」**）。
2. **审计台对账**：与 `ledger_entry` 逐条对得上（给对账 SQL + **零差异**）。
3. **门与判负**：每片自带类级门 + 仓外副本判负 + 零污染。

### §10.2 依赖图（本单现取口径）

```
[无依赖·地基]                         [无依赖]
 §9 app_config 管理+门禁  ──┐          §7 用户与权限
 （合法键清单/写入门禁）     │          （R-7E-6 keys 收敛）
        │                   │                 │
        ├──> §4 保证金「可配置+常量兜底」      ├──> §5 自建单位审核（需 admin 闸）
        └──> （将来）费率/保证金改从 config 取   ├──> §6 合规审核（复用 review_tasks）
                                                 └──> §8 审计台（需 admin 读口 + 先裁 §7-53）

[独立] §2 费率配置 + §3 返佣权重矩阵（同一写口/同一页，彼此同批）
```

### §10.3 推荐切片顺序（★ 与 master-plan §5.178 C 的「初始假设」对照 + recon 验证）

| 序 | 切片 | 与 Zang 初始假设（§5.178 C）关系 | recon 结论 |
|---|---|---|---|
| 1 | **§9 `app_config` 管理 + 合法键清单/写入门禁** | 一致（假设①，地基） | ✓ 验证成立：确为其余配置面地基（费率/保证金「可配置」的载体） |
| 2 | **§7 `R-7E-6` keys 收敛**（前端去硬编码地址/11 键） | 一致（A 小项并入第一批） | ✓ 验证成立：`admin-utils.js:3` 硬编码仍在 |
| 3 | **§2 费率配置**（复用既有写口 + 新后台页） | 一致（假设②） | ✓ 写口已在、只缺页 |
| 4 | **§3 返佣权重矩阵**（与 §2 同页） | 一致（假设③） | ✓ 同表同口；★ 造链前置 `/api/referral/*` 未注册（须登记） |
| 5 | **§5 自建单位审核** | 一致（假设④，R3 风险面） | ✓ 缺口最大（审核闸/状态日志写入/后台页三者全缺） |
| 6 | **§6 商品/招工合规审核** | 一致（假设⑤） | ✓ 无发布前审核面 |
| 7 | **§8 资产与流水审计台** | 一致（假设⑦） | ✓ 两审计表已在但零读取；★ **须先裁 §7-53**（两表合并/并联） |
| 8 | **§4 上市保证金规则「可配置」** | 一致（假设⑧，放末） | ✓ 依赖 §9 载体；★ 载体定格（新 config 键 vs `currency.deposit_amount`）须 Zang/Kevin 定 |

> **★ recon 对初始假设的唯一修正**：假设序 ⑥（用户与权限）「**可能已大半具备**」**成立**（本单证 = 后端全链 + 种子 + 7 页齐）；⇒ **用户与权限不必作为独立「配置切片」**，降为 **`R-7E-6` 收敛 + 权限闸复用**（其余七项的前置）。

## §11 未测项与原因（**禁填 0 / 禁空**）

| # | 未测项 | 原因 |
|---|---|---|
| 1 | `schema_version=0024` / `schema_migration` 计数 / 迁移 checksum 的**现取自证** | 本单**未连真库**（硬口径：本单无需真库连接）⇒ **转引任务给定口径 0024**，标 `NOT_MEASURED` |
| 2 | `POST /api/admin/commission_policy` 的**端到端 HTTP 读数**（写→读回同值） | 需起实例/连库 ⇒ **本单严格只读、未起任何实例** ⇒ `NOT_MEASURED` |
| 3 | 「费率改动 → 交易所手续费变化」的**真链路读数** | 同上（需真链）⇒ `NOT_MEASURED` |
| 4 | 「保证金改动 → C2 收款腿金额变化」的真链路读数 | 同上 ⇒ `NOT_MEASURED` |
| 5 | 两张审计表（`admin_ops_audit_log` / `admin_refund_audit_log`）在**真库的行数/内容** | 未连库 ⇒ `NOT_MEASURED` |
| 6 | `0023` 日累计闸 / `0024` 退款审计的**现行运行态** | 未连库、未跑 ⇒ `NOT_MEASURED` |
| 7 | `admin_user_role` 真库行数（`0022` 自述：真库 1 行 / 重建库 0 行） | 未连库 ⇒ **转引不采信** `NOT_MEASURED` |
| 8 | `/api/referral/*` 未注册对「真链返佣验收」的**实际影响** | 未跑 HTTP ⇒ `NOT_MEASURED`（登记：造链需 DB 直造或新开读口） |
| 9 | 前端 `SystemSettings.jsx` **全 300 行**是否对 `app_config` 其它键有隐式写入 | 本单只点读关键行，未逐行通读 ⇒ `NOT_MEASURED`（结论「无合法键清单」不受影响） |
| 10 | `tsc --noEmit` / 各套件 / 门脚本的**现跑读数** | 本单硬口径**不 `npm install`、不跑套件** ⇒ `NOT_MEASURED` |
| 11 | 各 admin 页（7 个）的**逐行实现质量**（真接线 vs 静态） | 本单只读端点引用（`grep fetch`）⇒ 逐行质量 `NOT_MEASURED`（端点面已取证） |

## §12 命令与读数附录（逐条现取）

| 项 | 命令 | 读数 |
|---|---|---|
| 注册点总数 | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | **68**（**冻结基线 68 未变 ✓**） |
| 逐 verb | `for v in get post put patch delete; do grep -cE "^app\.$v\(" backend-ts/src/index.ts; done` | 27 / 38 / 0 / 1 / 2 |
| index.ts 行数 | `wc -l backend-ts/src/index.ts` | **2060** |
| admin 页面 | `ls frontend/src/pages/admin/` | 7 件（Permissions/Points/Rewards/Shards/SystemSettings/Tasks/Users） |
| migrations | `ls backend-ts/migrations/` | `0001`–`0017` + `0019`–`0024`（无 `0018`） |
| 费率写口 | `grep -n 'admin/commission_policy' index.ts` | `:1954`（闸 `:1955` `manage_settings`） |
| 费率守卫 | `grep -n 'guardCommissionPolicy\|insertCommissionPolicy' commission.ts` | `:166` / `:240` |
| 费率运行时读 | `grep -n 'fee_rate_bp' database.ts` | `:2219` 注释 / `:2226` `SELECT p.fee_rate_bp::int` |
| `commission_policy` DDL | `sed -n '84,100p' migrations/0007…sql` | `:84` 表 / `:86` `fee_rate_bp` / `:92` 费率 CHECK / `:93` levels / `:94` weights_len / `:97` effective_uniq |
| 权重守卫触发器 | `grep -n 'trg_commission_policy_weights_guard' 0007` | `:153` |
| `commission_payout` | `grep -rn 'commission_payout' migrations/0007 src` | 非表（裁定 #4 不建）；仅 ref_type 枚举（`0001:85`/`ledger.ts:165`） |
| 保证金下限 | `grep -n 'CURRENCY_LIST_DEPOSIT_FLOOR' currency-service.ts` | `:144` = `50000` |
| 保证金写库 | `grep -n 'listCurrencyWithDeposit' database.ts` | `:1668` |
| `HOLD_KINDS` | `grep -n 'HOLD_KINDS' ledger.ts` | `:178` = 4 项（无 `listing_deposit`） |
| `currency_status_log` 写入 | `grep -rn 'currency_status_log' src` | **0 命中** ⇒ 表零写入 |
| 审计表读取 | `grep -rn 'admin_ops_audit_log\|admin_refund_audit_log' src` | 仅 `database.ts:2052` **注释** ⇒ 无读口 |
| 十一键闭集 | `sed -n '11,23p' database.ts` | 11 键 `ALL_ADMIN_PERMISSIONS` |
| 种子 | `grep -n 'INSERT INTO public.admin_permission' 0022…sql` | `:50`（11 键 `:51-61`） |
| `resolveAdminAccess` | `grep -n 'resolveAdminAccess' database.ts` | `:2740` |
| `requireAdmin` | `grep -n 'const requireAdmin' index.ts` | `:299` |
| `app_config` DDL | `grep -n 'CREATE TABLE IF NOT EXISTS public.app_config' 0017…sql` | `:69`（`:74` PK / `:77` container CHECK） |
| 后台设置读写 | `grep -n 'getSystemSettings\|saveSystemSettings' database.ts` | `:2865` / `:2878` |
| 禁写费率键 | `grep -n 'FEE_RATE_KEY_NOT_IN_APP_CONFIG' index.ts` | `:1159`（闸 `:1155` `findFeeRateKey`） |
| 前端 `/api/currency` | `grep -rn '/api/currency' frontend/src` | 1 命中（注释 `PublishJobPage.jsx:14`） |
| 前端硬编码地址 | `sed -n '1,14p' frontend/src/admin-utils.js` | `:3` `ADMIN_ADDRESS` + `:7` `isAdminUser` |
| referral 路由 | `grep -n 'referral' index.ts` | **0 命中**（未注册） |

---

> **本单自证**：**唯一写盘 = `docs/audit/p8-p6-recon.md`**；**未改任何代码 / 迁移 / spec / 其它 docs**；**未 `git add/commit/push`**；**未 `npm install`**；**未碰 `.env*`**；**未 `pkill -f`/`killall`**；**未启停任何端口**；**未起自建实例**；**未连库、未执行任何 SQL**；**未跑任何套件**。所有「已有」结论均带 `文件:行` 现取锚点；所有未取证项标 `NOT_MEASURED`（§11）。
