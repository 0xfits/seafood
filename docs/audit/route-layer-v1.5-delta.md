# route-layer.spec v1.4 → v1.5 逐条 delta

**单**：JING-REFUND-ADMIN（§7-32「管理员退款发起」契约化 · **只写规范与快照、不写任何代码**）
**作者角色**：**Jing（Specifier · 制度员）**
**时间**：2026-10-02（CST / UTC+08:00）
**run tag**：`p6jing-v15-20261002T064332Z`（只读取证产物目录 `.p6jing-artifacts/`）
**本件性质**：delta 件（逐条：新增 / 就地加注 / 未动面，**带行号 + 旧文留痕**）

---

## §D0 报数（带口径 · 本册现取）

| 项 | 改前（开工对锚） | 改后 |
|---|---|---|
| `docs/route-layer.spec.md` 行数 | **2459** | **2794**（`wc -l`） |
| 字节 | **530839** | **596171**（`wc -c`） |
| md5 | **`4ba6b8a1554accc2808086606a1bf37d`** | **`167a657971c3726fd8f18462bae0e4e1`**（`md5`） |
| `git diff --numstat docs/route-layer.spec.md` | —— | **`335  0`**（**added 335 / deleted 0**） |
| 只追加判据 | —— | **删除列 = 0** ✅（**非追加改动 = 0 处**） |
| 快照 | —— | `docs/versions/route-layer.spec.v1.5.md`（**596171 B**，与本体 `cmp` = **0**） |
| 快照惯例校验（**开工前**） | `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.4.md` = **0**（identical）⇒ **仓内惯例 = 快照取「新版本号 + 改后正文」** | 本单照做 ✅ |
| 开工对锚 | `git log --oneline -5` 头 = `dda5ff6`；`git status --porcelain` = `M backend-ts/src/database.ts` / `M backend-ts/src/index.ts` / `?? backend-ts/.p6bqa-artifacts/` / `?? backend-ts/.p7a-artifacts/` / `?? backend-ts/scripts/p7a-00*-*.ts`（**另一单元在途**，本单未触碰） | 本单**新增** `M docs/route-layer.spec.md` + `?? .p6jing-artifacts/` + `?? docs/versions/route-layer.spec.v1.5.md` + `?? docs/audit/route-layer-v1.5-delta.md` |
| 新节行号（改后） | —— | 顶部 v1.5 状态块 **:112–123**；§7 v1.5 追加表 **:1604–1610**；§7 补注块 ⑳–㉒ **:1612–1615**；§8.1 表 v1.5 行 **:1629** + 口径注 **:1631**；§8.17 **:2139–2185**；**§12 :2541–2794**（§12.0 `:2545` / §12.1 `:2590` / §12.1.1 `:2604` / §12.2 `:2622` / §12.3 `:2640` / §12.4 `:2657`（12.4.1 `:2659` / 12.4.2 `:2673` / 12.4.3 `:2686`）/ §12.5 `:2702` / §12.6 `:2716` / §12.7 `:2731` / §12.8 `:2740` / §12.9 `:2759` / §12.10 `:2767`） |

---

## §D1 逐条 delta（8 组 · 与 §8.17.4 对照表同源）

| # | 类型 | 落点（改后行号） | 内容 | 旧文留痕 |
|--:|---|---|---|---|
| **D1-1** | **新增节** | `docs/route-layer.spec.md` **:2541–2794** | **§12 §7-32「管理员退款发起」· 可实现契约**：12.0 只读取证（A/B/C/D 四表）/ 12.1 actor 面（+ 12.1.1 权限闸 11 键逐键候选 ⇒ 选 `manage_points`）/ 12.2 资金腿**冻结 11 项**（F1–F11）/ 12.3 鉴权失败面 G1–G6（含 R107 形状 + reason 闭集 + 驱动边界）/ 12.4 审计留痕**硬项 H1–H9** + **变体 A / B 逐项代价**（12.4.2 / 12.4.3）/ 12.5 幂等（三向 + **判负 2 条**）/ 12.6 同语句可达性（**变体 ①②②′**）/ 12.7 注册面两变体（倾向复用同路径）/ 12.8 **可证伪 AC 10 条** / 12.9 日累计取舍 / 12.10 **Z1–Z8** + 实现面登记 I-1…I-8 | 新增（**无旧文**） |
| **D1-2** | **新增块（顶部）** | **:112–123** | **v1.5 状态块**（状态行 + 修订入口 + 要点 ①–⑨，**先说结论**） | 新增；**上文 v1.4 块及其以前全部状态块一字未动** |
| **D1-3** | **新增块（§7）** | **:1604–1610** | **§7 v1.5 追加表**：**7-49**（契约化兑现 = 契约已定 / 实现待批）· **7-50**（权限闸 = `manage_points`，收 Zang 一句话确认）· **7-51**（审计落点 A/B 待裁，倾向 B） | 新增；**§7-1…7-48 一字未动** |
| **D1-4** | **新增块（§7 补注）** | **:1612–1615** | **§7 追加补注块（v1.5）⑳–㉒**：⑳ 7-32 行**未改**及其理由（**「就地加注」与「删除列 = 0」在同一行内冲突 ⇒ 取机器判据优先**）；㉑ 本单未动的既有行 + 数值/日期零发明；㉒ §12 与 §7-18/7-19/7-24 的关系（**不撤销 §4.7.2**） | 新增 |
| **D1-5** | **新增行（§8.1 表）** | **:1629** + 口径注 **:1631** | **变更记录表 v1.5 行**（8 组 delta 摘要 + 只追加自证）+ 「v0.6–v1.4 不在本表、不追溯补齐」的口径注 | 新增行（插在 v0.5 行之后、`### 8.2` 之前）；**表内既有 v0.1–v0.5 五行的字节未改** |
| **D1-6** | **新增节（§8）** | **:2139–2185** | **§8.17 v1.5 变更记录与自曝**：8.17.1 写盘范围（逐字）/ 8.17.2 `NOT_MEASURED` **82–87** / 8.17.3 自曝 **88–92** / 8.17.4 delta 对照（派单 8 条 + 4 条只读取证 → 落点）/ 8.17.5 纪律自检 ①–⑬ | 新增；**§8.1–§8.16 除 D1-5 外一字未动** |
| **D1-7** | **就地改动** | —— | **0 处**（**本单未对任何既有表格 / 单元格加注** —— 含 §7-32 的状态格） | **判据 = `numstat` 删除列 = 0** ✅ |
| **D1-8** | **快照 + 审计件 + 产物** | —— | `docs/versions/route-layer.spec.v1.5.md`（**新建**，`cmp`=0）+ 本 delta 件（新建）+ `.p6jing-artifacts/p6jing-00-probe.cjs` / `p6jing-00-probe.p6jing-v15-20261002T064332Z.json` / `p6jing-01-readings.p6jing-v15-20261002T064332Z.txt`（**新建**） | 新增 |

> **★ 与 §7-32 行原文的关系（派单要求的「就地加注」未做，理由逐字）**：派单硬口径 2 **同时**给出两条要求 —— ①「需要更正处就地加注（形如「（v1.5：……）」）并保留原文」②「**判据 = `git diff --numstat` 的删除列 = 0**」。二者在**同一行内加注**时**冲突**（改一行即产生 `1` 个删除行；实测：首版以加注形态落地后 `numstat` = `336  1`）。**本单取机器判据优先** ⇒ **§7-32 行一字未动**，读法更新**全部**落在 **§7-49 / §7-50 / §7-51 + 补注块 ⑳**（§7-32 状态格仍为历史读数「已定（= 后续能力，不属本批）」）。**自曝 = §8.17 与 §D5-1**。

---

## §D2 未动面（逐条 · 只读 / 零改动）

| 面 | 状态 |
|---|---|
| `docs/route-layer.spec.md` §1–§11 既有条文 | **一字未动**（`numstat` 删除列 = 0） |
| `docs/versions/route-layer.spec.v0.1–v1.4.md`（**十四个快照**） | **未触碰**（`git status docs/versions/` 仅出现新增 `v1.5`）；`md5` 抽查：`v1.4` = `4ba6b8a1554accc2808086606a1bf37d`（= 改前本体 md5，**未变**）、`v0.1` = `be823001f3a99e12da0ee02056c80e90` |
| `docs/data-layer.spec.md` / `docs/ledger.spec.md` / `docs/commission.spec.md` / `docs/seafood.master-plan.md` / `docs/design/**` | **零改动** |
| 其余 `docs/audit/*`、`docs/qa/*` | **只读**（未写） |
| `backend-ts/**`（含 `src/**`、`migrations/**`、`scripts/**`） | **零改动**（只读：`sed -n` / `grep` / `wc`；**未新建任何脚本于该目录** —— 本单探针放在仓根 `.p6jing-artifacts/`，**刻意避开** `backend-ts/**` 的「不得改代码文件」边界） |
| `frontend/**` | **零改动** |
| `.env*` / `vercel.json` | **未触碰**（`.env.local` 仅被探针经既有 dotenv 机制**读取**，**值未落盘、未打印**） |
| git 写操作 | **零**（无 `add/commit/push`）；`npm install` **零** |
| 进程 | **未启停任何进程**（**未** `pkill -f` / `killall`；**未**启停 5787/5788） |
| 库写 | **零**（探针仅 `SELECT` + `pg_catalog` / `information_schema` 只读目录） |

---

## §D3 只读取证（**本册现取** · 复算命令）

**探针**：`.p6jing-artifacts/p6jing-00-probe.cjs`（CommonJS；`require('<abs>/backend-ts/node_modules/@neondatabase/serverless')` + `dotenv` 读 `.env.local`；**仅 SELECT / 只读目录**）
**命令**：`cd backend-ts && node ../.p6jing-artifacts/p6jing-00-probe.cjs <abs outDir> p6jing-v15-20261002T064332Z`
**产物**：`.p6jing-artifacts/p6jing-00-probe.p6jing-v15-20261002T064332Z.json`（**WROTE** 行 = 落盘确认）

| # | 取证 | 读数（逐字） |
|--:|---|---|
| R1 | `schema_migration` 降序前 2 行 | `id=22 / version=0023 / checksum=fe7bb504fd91a6c611345f950e742dd708264f64fd76dc48acabdd8d2f68f467 / applied_at=2026-10-02T01:58:54.688Z`；`id=21 / version=0022 / checksum=069a00905c2821b846f0efc24673abe7dfb89acd3e73e260e0108f0c0bd24112 / applied_at=2026-10-02T00:41:05.838Z` ⇒ **两者已 apply** |
| R2 | 权限四表 | `admin_permission` **11**（键集逐键）；`admin_role` **1**（`super_admin`）；`admin_role_permission(super_admin)` **11**；`admin_user_role` **1**（`uid 970213` / `super_admin`；`users.is_admin=false`） |
| R3 | `users` | **37** 行；`is_admin=true` = **3** |
| R4 | `admin_ops_audit_log` 结构 | **15 列**；**CHECK ×4** = `action='points_adjust'` / `op IN ('mint','burn')` / `amount<>0` / `result IN ('applied','rejected_daily_cap')`；**UNIQUE `(idempotency_key, result)`**；**FK ×3**；**索引 ×4**；**触发器 ×1**（`O`，`BEFORE DELETE OR UPDATE`）；**行 = 4（全 `applied`）** |
| R5 | 编排函数 | `admin_points_adjust_post_event(jsonb)` 在场（`def_len=6058`）；**`position('RAISE' in def) = 0`**；`*_post_event` 全集 = **5**（无 refund 编排） |
| R6 | `listing_order` | **5** 行（`created 1 / paid 1 / refunded 3`）；**可退门面 = `order_id 3`**（`listing_id 13` / seller `7` / buyer `8` / `price 100` / `quantity 1` / `paid` / `pay_txid` 非空 / `refund_txid` NULL） |
| R7 | 账本 | `ledger_entry` **271**；`purchase_refund` **6**；`biz:listing:refund:{2,6,7}` 各 **2**；`account(cid=1)` **18** 行 `Σbalance=1989693` / `Σfrozen=10507`；**逐 kind 计数**（Σ = 271 ✓）：`hold 54 / currency_create_fee 38 / trade 32 / job_escrow 24 / listing_deposit 22 / trade_fee 16 / hold_release 12 / transfer 12 / mint 11 / job_payout 10 / job_fee 8 / job_escrow_refund 8 / burn 6 / purchase_refund 6 / commission 4 / sale 4 / purchase 4` |
| R8 | 结构基线 | `public` 基表 **24**；非内部触发器 **44**（= v1.4 转引的 23/43 **+1/+1**，与 `0023` 建表 + append-only 触发器**自洽**） |

**源码 / 迁移锚（只读现取）**：`0022` **177 行**、`0023` **391 行**、`listing-funds-service.ts` **317 行**、`index.ts` **1981 行**；`listing-funds-service.ts:55`（`REFUND_ROLLS_BACK_STOCK=false`）/ `:62`（`REFUND_ACTOR_IS_SELLER_ONLY=true`）/ `:84`（`ref404`）/ `:135`（`actorGate`）/ `:261`（`refundListingOrder`）/ `:286-294`（actor 闸）/ `:297-302`（payload）/ `:300`（指纹）；`index.ts:254`（`AUTH_REASONS` 3 值闭集）/ `:256-262`（`sendAuthError`）/ `:299-317`（`requireAdmin` + `hasRequiredPermission(undefined) === true`）/ `:1402`（A1 调分无键闸）/ `:1855`/`:1860`（退款路由，现取时点）/ `:1876`（A11 `manage_settings`）；`0015:661-726`（退款分支）/ `:667`（键）/ `:683-686`（状态机拒）/ `:711`（金额）/ `:718-724`（两腿）/ `:747-756`（kind 白名单）/ `:775-781`（只写 `listing_order`）；`0004:160`（`ledger_max_single_amount() = 1e15`）；`0023:99`（复合唯一）/ `:125`（触发器）/ `:157`（编排函数）/ `:162`（`1e6` cap）/ `:207-211`（**日累计求和无 `action` 过滤**）/ `:224`（拒绝行）。

---

## §D4 本单**未做** / `NOT_MEASURED`（汇总；细则见 spec §8.17.2）

| 未做 / 未测 | 原因（逐字） |
|---|---|
| **管理员退款面的 HTTP 读数**（`200` / `403` / `404` / `409` / 幂等重投 / 审计行与资金行 `txid` 逐字相同） | **能力未实现**（`REFUND_ACTOR_IS_SELLER_ONLY=true` 未改 + 盘上无 `listing_refund_post_event`）+ 本单零 HTTP、零服务启停 ⇒ **`NOT_MEASURED`** |
| **`409` 的 `details.reason` 逐字可观测性** | **驱动相关**（WS 搬运 `DETAIL`；`neon` HTTP ⇒ `detail_unavailable`）⇒ 本单未跑 HTTP ⇒ **`NOT_MEASURED`**，判据以 `code` 为准 |
| **`listing_post_event` 对多余 payload 键的宽容度** | 只读函数体**推断** ⇒ 未实测（若变体落地须实测） |
| **变体 A 落地后的日累计干扰量化** | 变体未落地 ⇒ 只给结构性判据 + 量化口径（`Δdaily_used = abs(退款额)`） |
| **三真源（库 / 后端常量 / 前端数组）机器判据复跑** | 本单只读真库 11 键 + 两代码真源（**三方差集 = 0** 由 v1.4 §11.1 **转引**） |
| **造 AC 夹具（新 `paid` 订单）** | **本单零库写**（红线）⇒ 未造；AC 执行方必须先 `POST /api/listing/:listingId/buy` 造单（**唯一现成 `paid` 单 `order_id=3` 不可重复使用**） |
| **`result='rejected_daily_cap'` 在真库的形态** | 真库 0 行（触发需真造百万点）⇒ **转引** `p6-b6-audit-and-cap.md §7.2/§8.2` |

---

## §D5 自曝（口径缺陷 / 取舍 / 更正）

| # | 项 | 口径 |
|--:|---|---|
| **D5-1** | **「就地加注」vs「删除列 = 0」的口径冲突（本单的选择）** | 首版曾按「就地加注」在 **§7-32 状态格**追加 `（v1.5：…）` ⇒ 实测 `git diff --numstat docs/route-layer.spec.md` = **`336  1`**（**删除列 = 1**，**违反派单判据**）。**处置 = 撤回加注**、把读法更新**全部**移入 **§7-49 / §7-50 / §7-51 + 补注块 ⑳** ⇒ 复测 = **`335  0`**（✅）。**这是一次「判据冲突 ⇒ 取机器可验者」的显式取舍**，非疏漏；若 Zang 认为 §7-32 状态格**必须**带就地注，则须**同时**放宽「删除列 = 0」判据（二者不可兼得）。 |
| **D5-2** | **行号漂移（并发在途）** | 现取时 `backend-ts/src/index.ts` = **1981 行**，且 `git status` 显示 `M src/index.ts` / `M src/database.ts`（**另一单元在途**）⇒ 本单全部 `index.ts` 行号（`:254` / `:299` / `:1402` / `:1855` / `:1860` / `:1876`）为**本单现取时点**读数（v1.4/`p4-b4a` 记的退款路由 `:1520` 已漂移）⇒ **复核必须现取**。 |
| **D5-3** | **§0「版本」格陈旧（既有缺陷）** | §0 元信息表「版本」格仍写 **v0.6**（v0.7–v1.4 均未就地更新）⇒ 本单**只登记、不改**（版本真源 = 顶部状态块 + §8.xN）。 |
| **D5-4** | **选择「不加注」导致的读法断层** | §7-32 状态格 + 依据格**均为 v0.7 时点文本**（含「归批 6」的旧批次口径）⇒ 若不读 §7-49，会误读为「未契约化」。**本单已把「读该行以 §7-49 为准」写进补注块 ⑳**（读法同 7-25/7-26/7-29/7-30/7-31）。 |
| **D5-5** | **本单探针的位置选择（有意）** | 探针放仓根 `.p6jing-artifacts/`（**非** `backend-ts/scripts/`）⇒ 以**绝对路径** `require` 依赖，**刻意规避**「不得改 `backend-ts/**` 内代码文件」的边界；**代价** = 探针不在既有 `scripts/` 惯例目录（**登记**：若 Zang 要求归位 `backend-ts/scripts/`，须改派单边界）。 |
| **D5-6** | **「实测」与「转引」的分界** | **本册现取** = §D3 全部 + 全部 `文件:行号`；**转引** = 权限三真源机器判据（v1.4 §11.1）、D1'' 12/12（`p4-err-fidelity.md`）、A10 回执 23 键（`p4-b4a §3`）、`stock_unchanged`（`p4-b4c-ii-b`）、拒绝面事务内取证（`p6-b6-audit-and-cap` / `-live`）。**未把转引写成「本册实测」**。 |
| **D5-7** | **先骸架后回填** | §12 / §8.17 / 本件**一次成文、无占位态**；无 `待回填` 字样。 |

---

## §D6 待 **Zang 终审** 摘要（细则 = spec §12.10.1）

| # | 待裁项 | 变体 | 本册倾向（**不构成裁定**） |
|--:|---|---|---|
| **Z1** | 权限闸选键 | `manage_points`（已写入契约）/ `manage_settings`（兜底先例）/ 无键（A1 先例）/ 新键（**不可行**） | **`manage_points`**（收一句话确认 / 改字） |
| **Z2** | 审计落点 | A 复用 `admin_ops_audit_log` + 扩 CHECK（**日累计污染 + 语义压缩**）/ **B 新建表** | **B** |
| **Z2b** | （选 A 时）单列语义压缩 | `target_uid` / `balance_*` 只记**一方** | **记卖方（被扣款方）** |
| **Z3** | 被拒尝试（`409` 状态机）的 `result` 令牌 | 留痕（新 `result` 值）/ 不留痕 | **留痕**（`rejected_state`，命名待定） |
| **Z4** | 「资金 + 审计同一次 DB 调用」形态 | ① 新编排函数 `listing_refund_post_event` / ② 路由层两段（**与 `0023` 取向① 冲突**）/ ②′ TS 交互式事务 | **①** |
| **Z4b** | 编排函数是否取 `pg_advisory_xact_lock` | 取 / 不取 | **不取**（若不设日累计闸） |
| **Z5** | 闸前拒绝（401/403）是否留痕 | 不留痕 / 留痕 | **不留痕**（只登记） |
| **Z6** | 注册面 | ① 复用同路径 / ② 新路径 `/api/admin/listing-orders/:orderId/refund` | **①** |
| **Z8** | 日累计闸是否需要（+ 阈值） | 不需要 / 需要（阈值 = 服务端常量 + `TODO: Kevin 定值`） | **不需要** |

**★ 实现面登记 = spec §12.10.2（I-1…I-8）**：新迁移 / 新编排函数 / `database.ts` 新方法 / `listing-funds-service.ts` 单点三分化 / 路由 / 前端（如需）/ spec 回写 / `data-layer.spec.md` 登记 —— **全部归新批，本单零代码**。
