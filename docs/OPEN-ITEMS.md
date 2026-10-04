# 远期任务台账（OPEN ITEMS）

> **性质**：living register —— 只登记**未闭环**项；每项带**现取依据**（文件:行 / 读数）+ 代价 + 阻塞条件。闭环后从本表移除，并在 `docs/seafood.master-plan.md` 留痕。
> **维护**：Zang（派单方）。**最后更新**：2026-10-04（S19 收口后汇总；所有「现取」为本表生成时实测）。

---

## A. 需 Kevin 定值 / 定口径（**不阻塞**运行，各有兜底）

| # | 项 | 现取依据 | 现状兜底 | 代价 |
|---|---|---|---|---|
| **A1** | 上市保证金**金额** | `backend-ts/src/currency-service.ts:148` `CURRENCY_LIST_DEPOSIT_FLOOR = 50000`（旁注 `TODO: Kevin 定值`）；主导真源 = `app_config` 键 `listing_deposit_policy`（`AK2`），常量仅 fail-closed 兜底（`database.ts:138`）| 兜底 `50000` 已生效、**不影响运行** | 一个数 + 一次后台写 |
| **A2** | 后台调分**日累计上限** | `backend-ts/src/index.ts:2096` `ADMIN_POINTS_ADJUST_MAX_PER_DAY = 1000000`（旁注 `TODO: Kevin 定值`）；**唯一真值**在 DB 编排函数（`migrations/0023`），常量只管 `details.max` 回填 | `1,000,000 / 日 / 操作人（UTC）` | 一个数 |
| **A3** | `/dashboard` 是否对普通用户放开 | S18 §5.334 C：我裁**不放开**（该页曝光 `totalUsers` / `adminUsers` / `totalPoints` 平台统计）；页面受**路由 `adminOnly` + 组件双闸** | 发布者仍可由 `PublishJobPage` 审核入口直达 `/task/review` | 一句口径（若要放开 ⇒ 需先剥离平台统计面） |
| **A4** | 装饰性切角 / legacy 硬阴影收尾 | `frontend/src/styles.css` 现取 `clip-path: polygon` = **4 处**（+ legacy 硬位移阴影 `.card` 深档 / `.price-tag` / `.gem-pulse`） | 现状保留（审美面，未纳入形状收敛批次） | 审美口径 |

---

## B. 工程债（**我方可自行排期**，无需决策）

| # | 项 | 现取依据 | 代价 / 阻塞 |
|---|---|---|---|
| **B2** | **门扫面根**显式排除探针命名式 | S20 只读盘点（14 门）：唯一**高险门** = `p8-s7-batt-checkin-gate.ts` —— `SCAN_ROOTS`（`:312`）含 `backend-ts/scripts`，而 `D6/D7/D8` 判「含 `checkin_makeup_fee` 且 kind ≥ 20 的文件 = **恰六处**」⇒ `scripts/` 内任何 ≥21 kind 的探针都会**假红**（现取余量极薄：两件卡在 20 kind）；其余门扫 `src/**` 或定向读 = 低/无险 | **已终审选变体 Ⅰ**（扫面根显式排除 + fail-loud 打印「扫面根 N / 排除 M / 参判 K」+ 两处负对照；**检出面不缩**）· **不取变体 Ⅱ**（不搬迁 72 件探针）· **S21 落地中** |
| **B11** | 落 `src` 扫面根的移植遗留**死件** | `backend-ts/src/simple-test.ts`（29 行、**git 已跟踪**、`jinli_DATABASE_URL` 遗留凭据名、**全仓引用 = 0**）—— S20 盘点顺带发现 | 极小 · **S21 同单删除**（含独立零引用取证 + 删后硬门对照） |
| **B3** | `ledger.spec` **v0.13 快照缺失** | 现取 `docs/versions/`：`ledger.spec.v0.12.md` → **（无 v0.13）** → `v0.14.md` | 小，但**必须先现取判定**该版正文是否仍在 git 历史；若**从未入库** ⇒ 与 `data-layer` v0.1 同族（真伪不可独立复核），只能留痕声明 |
| **B4** | 「**已参与 X / 共 N 人**」增强 | `headcount` **不在读模型**（`normalizeTask` 无该字段；只在发布/评审路径 `database.ts:3411 jobHeadcount`） | 中（后端读口回填 + 前端展示；S19 已登记为「一句话可改」可选增强） |
| **B5** | 契约卫生：`sendError` 同族 | 现取 `backend-ts/src/index.ts`：`sendError(` = **50 处**、`sendAuthError` = **4 处**、`fromLedgerError` = **0 处**（§15.5 存量偏离 A–F） | 中；**用户不可见** ⇒ 可推迟 |
| **B6** | 两套取数入口并存 | `frontend/src/auth.js:329 apiErrorMessage` = 全站错误文案真源；另有**独立模块**自带取数/错误链（S17 时代登记「待 P6/P7 合并」） | 中（合并需回归面） |
| **B7** | **10 个死键**退役 | `jobs.apply` / `applyOk` / `accept` / `acceptNote` / `acceptOk` / `applicationId` / `submitNeedApply` / `applyPrompt` / `applyWaiting` / `pick`；J2/J3 恒 `410`、前端**零引用** | 小但**删键会改四语计数基线**（`1059 / 119`）⇒ 须与计数期望**同批改** |
| **B8** | 换轴遗留 ③（`/shard`） | 现取：`frontend/src/styles.css:29` **注释**仍列 `/shard`；`frontend/scripts/p4z-*.mjs` 诊断脚本仍指向 `/shard` | 极小；★ **`docs/route-layer.spec` 内的 64 处 `/shard` 属「旧行不改 + 更正块」留痕口径，不是缺口**（勿误改） |
| **B9** | append-only **真实边界** | `TRUNCATE` **无触发器保护**；`purge-test-data` 走 `DISABLE TRIGGER` 管理员旁路（早期已登记） | 小（一条 `BEFORE TRUNCATE` 触发器），可与「错误码命名整理」同批 |
| **B10** | 生产库 vs 迁移文件**无自动保真判据** | Kevin 2026-09-28 已裁**「不开」**，风险面已全部留痕 | 归档项；若要重启 ⇒ **前置条件 = 先备第二空库** |

---

## C. 例行验收动作（**不是任务**，别当缺口）

- `p8-s7` / `p8-s8` / `p8-s10` / `p8-s11` 的「**受控实例真 HTTP**」腿：本轮现取 4 门红点**全部** = `fetch failed`（无实例）⇒ **环境性**，起 `5792–5799` 区间实例即绿（S19 复核时 4 门 = `56/59`、`70/74`、`48/49`、`86/87`，红点逐条定位为 http 腿）。
- 任何前端/后端交付的 **HTTP 端到端**：若交付方按硬口径未起服务 ⇒ `NOT_MEASURED`，由验收轮决定是否补跑。

---

## D. 本轮已闭环（备查，勿重复开单）

- `participants_count` **真源**：`job_application`（已停写）⇒ `job_submission` 的 `COUNT(DISTINCT worker_uid)`；四语值改「已参与」（S19 ✅ 已上线）。
- 【**常红门**】`p7b-03-offline-gates.ts` `AC10-2` 注册点冻结面 **68 ⇒ 89**：逐 rev 出处表（净 +21）+ 负对照（期望 88 必红）+ 我亲跑 `37/37 · red=[]`（S20 ✅ 已上线）。
- `ProfilePage` 旧链接 `/shard` ⇒ `/exchange`（S19 ✅；产品面 `/shard` 页面链接现取 = **0**）。
- `route-layer.spec` 路由路径回写（S14 更正块 ✅）。
- `p8-s7` 残留红点（C5 / D6-D8）判定为合法前推并具名登记（S12 ✅）。
- 批 8 五片 + P9①–⑤ + 8⑥ 审计台（全部上线 ✅）；任务模型换轴 S0–S18（✅）。
