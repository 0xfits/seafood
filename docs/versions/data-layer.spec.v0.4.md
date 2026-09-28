# 海鲜市场 · P3 数据层口径（Data Layer Spec）

> **文档状态**：**v0.4**（2026-09-28；**Zang 终审落地四项**：① **§6.1 迁移编号**一次性重排 —— `0013` **已应用**（`schema_version=0013` / 13/13 `skipped` / `public` 表 9 / `job` 14 列）且实际文件 `0013_job.sql` = **`job` 单表** ⇒ `job_application` / `job_submission` 顺延 **`0014_job_flow.sql`**，四柱顺延（`listing`⇒`0015` / `market`⇒`0016` / `platform_config`⇒`0017` / 原 `0017`⇒`0018`），**此后编号不得再动**（`DL47`）；② **`DL52①` 的 `23514` 就地加注**（**原文不删**）= v0.1 旧写法，已被 `DL51` 的 C5 裁定取代 ⇒ `LD011` ⇒ **409** + `reason=JOB_STATE_INVALID`，`0013_job.sql` 已按此实现并验收；③ **新增 `DL155`**（§17.4：`src/db.ts:252#getSchemaVersion` 未限定 `public.`，与 `DL151` 不一致 ⇒ **待收紧**，**不阻塞 `0013` 验收**）；④ 版本头 / §15 / §14 索引区间（⇒ **`DL1..DL155`**）同步。**不改 C1–C9 实体口径、不重排 `DL` 编号、不改 `DL1`–`DL154` 正文**）· 〔v0.3 = 2026-09-28；**v0.2 聚焦复核「需修」M1–M5 全项小修 + 补 `R109` 交叉引用 + 关闭 §12.2-11/-12（记录 Zang 两条裁定）+ O1（订单簿路由形态）定性落位**；**不改 C1–C9 实体口径、不重排编号**）· 〔v0.2 = 2026-09-28：**全量回写 Zang 九项终审裁定 C1–C9** —— 按 `DL43` **一次改完**，受影响处 §4 / §5 / §6 / §8 / §10 / §11 / §12 同版内全部更新，见 §15 变更记录）· 编号域 **`DL1`…`DL155`**（v0.1 = `DL1`…`DL139`；**只增不重排**，`DL140`–`DL153` 为 v0.2 新增、`DL154` 为 v0.3 新增、`DL155` 为 v0.4 新增）· 与 `ledger.spec` 的 `R` 域、`commission.spec` 的 `CR` 域**并列、不重叠**
> **改前快照（v0.4）**：`docs/versions/data-layer.spec.v0.3.md`（**220752 B**，md5 **`0a8e228dcbc1dcb517a378ca46dee79c`**；`cp -n` 建，**已用 `git show d10c66a:docs/data-layer.spec.md | cmp - docs/versions/data-layer.spec.v0.3.md` 逐字节自证** ⇒ **退出码 0**、与入库版 `d10c66a` **完全相同** ⇒ **v0.3 快照可独立复核**）。
> **改前快照（v0.3，历版留痕）**：`docs/versions/data-layer.spec.v0.2.md`（**210787 B**，md5 **`cfeae444d0633591c17b7271ee549a24`**；**已用 `git show 4ad0de4:docs/data-layer.spec.md | cmp -` 逐字节自证**与入库版 `4ad0de4` **完全相同** ⇒ **v0.2 快照可独立复核**）。
> **改前快照（v0.2，历版留痕）**：`docs/versions/data-layer.spec.v0.1.md`（156970 B，md5 `6f89f444d5df0351e84bdfce9621e3b1`）—— **v0.2 未覆盖它**（按 `DL134`「自 v0.2 起每次修订必须留改前快照」）。**本册凡被终审推翻/收窄之处，一律就地保留「▸ **v0.1 旧写法**：…」行**，审阅者可看到改前说什么。
> **制定者**：Jing（制度员） | **裁定者**：Zang（终审，本次已裁 C1–C9） / Kevin（产品口径） | **上位册**：`docs/ledger.spec.md` **v0.12**（含新增 `R109` / 扩写 `R79`）、`docs/commission.spec.md` **v0.2**（本节册**不修改**上位册任何条款；冲突时以上位册为准并回改本节册）
> **开工锚**：仓库 HEAD = `dbccd89 fix(router): 拆显式语言壳，修中文子页被可选语言段吞掉`（**v0.1 起草时**的 `git log --oneline -1`）· **v0.1 交付锚** = `fab9d32` · **v0.2 开工/交付锚** = **`37c368d`** · **v0.3 开工锚** = **`9641d5b`**（`master-plan v0.44: §5.40 v0.2 复核 verdict=需修(M1-M5) + 裁定 M3 与 O1 + 派 v0.3`）· **v0.4 开工锚** = **`9080772`**（`0013_job.sql` 已应用入库：`schema_version=0013` / 13-13 `skipped` / 11-11 用例；改前版 = **`d10c66a`** = v0.3 交付）（`master-plan v0.37: 5.32 P3 数据层规范 v0.1 终审（C1-C9 九项裁定）+ 5.33 两条库级发现`）；v0.1 落笔期间的仓内变更登记见 **§16 / DL136**
> **输入（只读）**：`docs/audit/p3-route-inventory.md` / `.json`（55 条条目审计，HEAD `45c27d8`）、`docs/seafood.master-plan.md` **§5.28 / §5.29 / §5.31 / §5.32（Zang 终审 C1–C9）/ §5.33（两条库级发现）/ §5.38（两项待裁项裁定）/ §5.40（v0.2 复核 + M3/O1 裁定）/ D18–D20**、`backend-ts/src/index.ts`、`backend-ts/src/database.ts`、`backend-ts/migrations/0001`–`0012`。**v0.2 另做了一次只读库探针**（见 §17，`SELECT` only，未写库）；**v0.3 未连库**（M3 读数为 Zang 只读亲裁，证据件见 §17.2）。
> **产物范围**：**唯一产物 = 本文件**。本册**不写任何 SQL 文件**、**不改** `migrations/**` / `backend-ts/src/**` / `frontend/**`、**不动** `ledger.spec.md` / `commission.spec.md` / `seafood.master-plan.md` / `docs/audit/*`（后两者只读）、**不 commit**、**不启停 5787/5788**。

---

## 目录

- [§0 元信息、适用范围与阅读约定](#0-元信息适用范围与阅读约定)
- [§1 目标数据层总则](#1-目标数据层总则)
- [§2 数据层分层与写路径](#2-数据层分层与写路径)
- [§3 旧 → 新映射（逐表 / 逐列 / 逐路由）](#3-旧--新映射逐表--逐列--逐路由)
- [§4 对审计 `mapping_proposal` 的逐条表态（55 条）](#4-对审计-mapping_proposal-的逐条表态55-条)
- [§5 争议项（单列 · 交 Zang 终审）](#5-争议项单列--交-zang-终审)
- [§6 四柱数据模型提案（新表 + 迁移编号）](#6-四柱数据模型提案新表--迁移编号)
- [§7 业务动作 → `kind` 全量映射 + 扩展请求](#7-业务动作--kind-全量映射--扩展请求)
- [§8 幂等键约定](#8-幂等键约定)
- [§9 鉴权与身份](#9-鉴权与身份)
- [§10 路由重组（55 条：保留 / 重写 / 删除）](#10-路由重组55-条保留--重写--删除)
- [§11 错误码映射（不新增码）](#11-错误码映射不新增码)
- [§11.3 AUTH 域码登记表（v0.2 新增 · C4/C6）](#113-auth-域码登记表v02-新增--c4c6)
- [§12 待裁决项清单](#12-待裁决项清单)
- [§13 已知盲区与未核实清单](#13-已知盲区与未核实清单)
- [§14 规则总索引 DL1..DL155](#14-规则总索引-dl1dl155)
- [§15 变更记录](#15-变更记录)
- [§16 v0.1 落笔期间登记：仓内已发生的事实（就地更正）](#16-v01-落笔期间登记仓内已发生的事实就地更正)
- [§17 v0.2 新增：两条库级事实（跨 schema 同名表 / 政策表回归判据）](#17-v02-新增两条库级事实跨-schema-同名表--政策表回归判据)

---

## §0 元信息、适用范围与阅读约定

### 0.1 本册覆盖什么

P3「业务模块」阶段的**数据层口径**：唯一真源与禁令、旧 → 新映射、审计提案的规范级判定、四柱的数据模型提案（只提案、不落 SQL）、幂等键约定、鉴权与身份、路由重组、错误码映射、待裁决项与盲区。

### 0.2 本册**不**覆盖什么（避免被当成本册遗漏）

| 不覆盖项 | 归属 |
|---|---|
| 账本内核的表契约 / `kind` 关闭集 / 幂等协议 / 错误码关闭集 | `docs/ledger.spec.md` **v0.11**（上位册，**不做任何改写**） |
| 邀请图 / 佣金政策 / 十级分配算法 / 判据 M1–M9 | `docs/commission.spec.md` **v0.2**（上位册，**不做任何改写**） |
| 迁移 SQL 的实现（列类型细节、触发器函数体） | Kong（实现方）；本册**只给 DDL 口径与形状** |
| 前端页面 / i18n / 视觉 token | P7 视觉 spec；本册只给路由与响应形状 |
| 分期排期与验收 AC | `docs/seafood.master-plan.md` §6（本册只做「P3 开 / 不开」的路由级判定） |

### 0.3 阅读约定

1. 每条规则一个编号：`编号 | 口径 | 落点建议 | 连带影响 | 状态`。状态取值：**【已冻结】**（引自上位册或 Kevin 已拍板 D1–D20，不得自行改动）/ **【本册裁定】**（Jing 依上位册推导，Zang 可一句话推翻）/ **【待裁决】**（本册**不自行选定**，进 §12）/ **【已裁定 · Zang 终审 v0.2】**（v0.2 新增，见下条）。
2. `§n.m` 指本册章节；`R` / `CR` / `D` / `LD` 分别指 `ledger.spec` 规则号 / `commission.spec` 规则号 / `master-plan` 决策号 / **本册**规则号。
3. 本册**不引用任何未经自核的事实**；凡推断必标「**推断，待核实**」并进 §13。
4. 本册全部数字以**现取自仓库**为准，不转抄他册结论；与他册读数不一致处**当场登记差异**（不静默改人）。
5. **v0.2 状态取值新增【已裁定 · Zang 终审 v0.2】**（本册争议项 `C1`–`C9` 的终审结论）。**凡 v0.2 裁定覆盖了 v0.1 的【本册裁定】/【待裁决】，被覆盖处就地保留一条「▸ **v0.1 旧写法**：…」**（审阅者可看到改前说什么）；`C6` 一项**推翻**了 v0.1 倾向（v0.1 倾向借 `403 LEDGER_HOLD_NOT_ALLOWED` ⇒ 终审改为 `AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED`），其余八项采纳或部分收窄。
6. **v0.2 的编号纪律**：`DL` 编号**只增不重排** —— 回写是对既有规则的**内容更新**（就地改，附「v0.1 旧写法」行）；确需新增规则一律**从 `DL140` 起向后追加**（本轮追加 `DL140`–`DL153`）。

### 0.4 与上位册的**七条点名张力**（登记，不在本册单方面解决）

| # | 张力 | 上位册出处 | 本册处置 |
|---|---|---|---|
| 1 | `ledger.spec` §7.2 要求「业务行 + 分录同一事务」，而 D10/§7.1 的写路径是**单条** `SELECT ledger_post_event($1::jsonb)`（函数内**不能**写业务表） | `ledger.spec` §7.2 #6/#7/#8/#9/#11/#12；`commission.spec` §5.6 | 进 **§5-C1**（争议项）+ **DL17 / DL18** 给本册可执行提案 ⇒ **✅ v0.2 已裁：采纳提案 A**（新增业务编排函数；四条硬约束见 §5-C1 / `DL141`–`DL144`） |
| 2 | `master-plan` §6 P5 的交付物写 `candle` 表，而本册主张 **K 线用视图**（避免第二真源） | `master-plan` §6 P5 | 进 **§5-C9**（争议项）+ **DL66** ⇒ **✅ v0.2 已裁：采纳视图**（`candle_view`；升级到物化视图/落表的门槛见 `DL150`） |
| 3 | `master-plan` §6 P3 交付物写「落 `commission_payout`」，而 §5.20 #4 已裁定**不建该表** | `master-plan` §6 P3 vs §5.20 #4 | 本册按**裁定**执行（§6 P3 的措辞由 Zang 回改，本册不动他册） |
| 4 | `master-plan` §6 P5 AC 写「保证金冻结 / 退还 / 罚没三态可验」，而 D7/v0.3 已裁定保证金**消耗不可退、不存在罚没标的物** | `master-plan` §6 P5 vs `ledger.spec` §19.8.B | 同上：按**裁定**执行；本册在 §3 映射表内标注该措辞作废 |
| 5 | 审计 §4.4/§5.1 把管理员写成「**审核方**」，而 D5 已裁定「**雇主自审 + 平台仲裁兜底**」 | D5 vs 审计 §5.2 #1 | 进 **§5-C7**（争议项）+ **DL106** ⇒ **✅ v0.2 已裁：雇主审**（管理员**不**审、只做仲裁；**驳回审计的「管理员审」**——那是推断、无用户原文依据，而 `D5` 已冻结） |
| 6 | 审计 §6.2 写「**25 条** POST/PUT/PATCH/DELETE」，而逐行计数 = **26 条**（24 `POST` + 2 `DELETE`，无 PUT/PATCH） | 审计 §6.2 vs `backend-ts/src/index.ts`（`grep -c 'app\.post('` = 24、`app\.delete(` = 2） | **本册以总表为准 = 26**，差异登记于 **§13-5**（属审计笔误，不影响其结论） |
| 7 | `ledger.spec` §14.3 纪律 ①「借用**不改变** §14.1 各码自身触发条件」 vs 本册为**业务状态机**借 `409 LEDGER_CURRENCY_INVALID_TRANSITION` | `ledger.spec` §14.3 纪律 ① | 进 **§5-C5 / §5-C6**（争议项）+ **DL118** ⇒ **✅ v0.2 已裁**：`C5` 采纳借码（并登记「**码名语义窄化**」为**已知债**，`DL148`）；`C6` **推翻本册倾向**，改走 **`AUTH_FORBIDDEN`(403)** 非账本域码（`DL147`） |

---

## §1 目标数据层总则

### 1.1 唯一真源（单一事实来源）

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL1** | **唯一真源 = `users(uid, evm, bio, is_admin, time_reg, time_login_last)` ＋ 账本内核（`currency` / `account` / `ledger_entry` / `ledger_owner` ＋ DB 函数 `ledger_post_event(jsonb)`）。** 任何「用户有多少积分」的答案**只能**由 `account`（快照）或 `ledger_entry`（流水）派生；不得在任何其他表、缓存、前端状态里存**可花的**数值作为真源。 | 服务层所有余额读走 `account` / `ledger_entry`；响应体里的余额一律标注来源与 `cid` | 与 P1/P2 已闭环内核自洽；本条是全部后续条款的母条款 | 【已冻结】（`ledger.spec` §13.1 / §0.2 + D18） |
| **DL2** | **邀请关系与佣金政策的真源 = `referral` / `commission_policy`；佣金发放的真源 = `ledger_entry`（`kind='commission'` + `ref_type='commission_payout'` + `ref_id`=同一 `job_id`）。****不建 `commission_payout` 表**（§5.20 #4）。 | `GET /api/referral/*` 只读这三处；报表一律 SQL 聚合，不做物化缓存 | 审计台与用户可见面**同一真源**，避免「后台数字与用户账单不一致」 | 【已冻结】（`commission.spec` CR14 / CR36；`ledger.spec` §7.2 #8 v0.8 块） |
| **DL3** | **业务表不得持有余额列**：`job` / `listing` / `listing_order` / `market_order` / `market_trade` 一律**不得**出现 `balance` / `points` / `coins` / `frozen_amount` 这类「可花数值」列。业务表只允许持有**业务事实**（金额作为「约定的价格 / 酬金额」，是输入参数而非余额）与**账本引用**（`escrow_txid` / `pay_txid` / `refund_txid`，`bigint`，指向 `ledger_entry.txid`）。 | 四柱新表的列清单（§6） | 这是「旧 `asset.points` 悖论」不再复发的结构性保证；业务金额与账本金额的一致由**同一事务 / 同一幂等键**保证，而不是靠两处同步 | 【本册裁定】 |
| **DL4** | **`account.frozen` 是聚合投影**（R36）：在冻归属的真源在业务表（招工托管额 / 挂单未成交量）。⇒ 业务表**必须**能回答「某 `(uid, cid)` 当前在冻多少」，否则对账判据 5（冻结归属守恒）永远无法落地。 | `job.status ∈ {open, accepted, submitted}` 时的在冻额 = `job.reward`；`market_order.status ∈ {open, partial}` 时 = `(amount − amount_filled) × price`（买单）/ `(amount − amount_filled)`（卖单） | P3 起判据 5 **必须有 SQL**（`ledger.spec` §11.1 #5 现为「待业务表落地后补」） | 【已冻结】（R36 + `ledger.spec` §11.1 #5） |

### 1.2 三条硬禁令

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL5** | **禁止任何绕过账本的余额写。** 具体禁止清单：① 直接 `INSERT/UPDATE/DELETE account`（**唯一**合法写者 = `ledger_post_event` 内部）；② 在任何新表里存余额；③ 应用层「先改业务表金额、再补账」的形态；④ 用 `reversal` 以外的任何方式修改历史分录（R73/R76）。**违反即实现缺陷**（`500` 缺陷桶，R108 告警）。 | code review 硬项；`src/db.ts` 只暴露读余额 + `postEvent`，不暴露 `account` 写 | 与 `trg_account_guard` 形成「应用层规约 + DB 层触发器」双闸（R65/R74） | 【已冻结】（R65/R73/R74 + D18 方案 A） |
| **DL6** | **禁止运行时 DDL。** 请求路径上**不得**出现 `CREATE TABLE` / `ALTER TABLE` / `CREATE INDEX` / `DROP`，**无论读或写**；`ensureSupportSchema()`（`backend-ts/src/database.ts:269`，12 处调用）与 `ensureLegacyTableNames()` **必须整体删除**，不得改造保留。 | Step 1（Kong，D19）；删除后 `database.ts` 归档废弃（D18 方案 A） | 审计实证：一个**公开 GET** 就造出 9 张表并使真库 8 → 17（审计 §0.2）⇒ 这是「读不该写」的实证，不是理论风险 | 【已冻结】（D18 + D19） |
| **DL140** | **（v0.2 写入 —— v0.1 漏写的那条）禁运行时 DDL 的验收必须用「类级断言」，不得用「实例级 grep」。** 判据形态：对 **`backend-ts/src/` 全树**扫描 DDL 模式集 —— `CREATE TABLE` ｜ `ALTER TABLE` ｜ `DROP TABLE` ｜ `RENAME TO` ｜ `CREATE INDEX` / `ALTER INDEX` / `DROP INDEX` ｜ `TRUNCATE` ｜ `CREATE [OR REPLACE] FUNCTION` ｜ `DO $$` —— **除「迁移执行器」外必须全部 0 命中**（迁移执行器 = 只读 `backend-ts/migrations/**.sql` 并写 `schema_migration` 的那个模块，其**唯一**豁免须在白名单里具名登记）。**具名符号的 grep（如 `grep ensureSupportSchema`）属「实例级」，不得作为验收依据、不得单独出「已摘除」的结论。** | 质检脚本（**run-tagged、永不写固定文件名**）；Kong 的 Step 1 / Step 1b 交付判据 | **实测教训（本仓已发生）**：只 grep「被改的那个符号」会**漏掉同族孪生路径** —— `ensureSupportSchema` 被摘后，`ensureLegacyTableNames` 体内的 `DO $$` + 两处条件 `RENAME TO` 仍在（`DL137`）⇒ 用「表数没变」当「读不写」的证是**假证**。类级断言覆盖「同族但未具名」的形态。 | **【已裁定 · Zang 终审 v0.2】**（v0.1 未写入本条 ⇒ v0.2 补写） |
| **DL7** | **schema 只由迁移变更**：新增表 / 加列 / 加索引 / 加约束**必须**走 `backend-ts/migrations/<NNNN>_<name>.sql` 并写 `schema_migration` 行；本册提案的首个新迁移号 = **`0013`**（§6）。`0001`–`0012` **不得改动**（checksum 冻结）；改函数体一律 `CREATE OR REPLACE` ＋ **新迁移**（`0009` 即此法的先例）。 | migrations 命名 `<NNNN>_<snake_case>.sql`（对齐 0001–0012 风格） | 「先在库里试、再补迁移」的路径被永久关闭；库与迁移链的一致性成为验收项 | 【已冻结】（`ledger.spec` R77 / `commission.spec` CR73） |

### 1.3 库状态一致性

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL8** | **库状态必须等于迁移链状态**：`information_schema.tables` 的表集合 == 迁移链定义集合 ∪ {`schema_migration`}。当前**已知漂移** = 审计期间被懒 DDL 造出的 **9 张 0 行表**（`app_config` / `permission_group` / `prize` / `prize_item` / `shard` / `shard_transfer` / `market_order` / `market_trade` / `task_progress`）＋ 可能的 `chest` 系列残留（§13-1）。 | D19：先摘掉运行时 DDL（DL6）**再** `DROP` 这 9 张表，使库回到 == `0012` 的干净状态 | ⚠️ 顺序**不可颠倒**：先 `DROP` 后摘 DDL ⇒ 下一次访问会原样重建（审计 §0.2 的机制） | 【已冻结】（D19） |
| **DL9** | **被 `DROP` 的 `app_config` / `permission_group` 若要保留，必须先由 migration 正式建回来**（本册提案见 §6「0016」）。**禁止**依赖懒 DDL 把它们「建回来」。 | `0016_platform_config.sql` | 「后台设置 / 权限分组」是四柱之外仍被需要的两块（`master-plan` §4 判为**保留**）⇒ 必须先有迁移定义再用 | 【本册裁定】 |
| **DL10** | **不得 `DROP` 任何账本表或 `referral` / `commission_policy`**：`ledger_entry` / `account` / `currency` / `ledger_owner` / `referral` / `commission_policy` / `users` 是**已落账真源**，`DROP` 属越界（R77）。测试数据清理只能走**行级** purge（D20 的既有 purge 路径，`append-only` ⇒ 需临时 `DISABLE TRIGGER USER`，须登记原因与时长）。 | `scripts/purge-test-data.ts`（既有）；D20 | `ledger.spec` §9.2 已诚实登记「`DISABLE TRIGGER USER` 是管理员旁路」⇒ 走它必须留痕 | 【已冻结】（R77/R78 + D20） |
**（v0.2 对 §1.3 的两条增补 —— 正文在 §17，此处只给「指针 + 触发条件」，以守 §14 的单一真源纪律：一条规则只有一处正文）**

- **禁裸表名（`DL151`，正文 §17.1）**：新数据层的**所有 SQL 必须显式限定 `public.`**。`account` 同时存在于 `public`（账本账户，7 列）与 `neon_auth`（13 列 = OAuth 会话列）⇒ 裸 `account` 的解析结果**依赖 `search_path`**，是**静默错答案**。同族 = **硬 1**（裸 `user` 被解析成 `current_user`）。
- **政策表回归判据（`DL152`，正文 §17.2）**：任何时刻 `commission_policy` 的 `max(effective_from)` 行，其 `fee_rate_bp` / `levels` / `weights_bp` **必须**等于预期组合（当前 = `100` / `10` / `{3000,2000,1500,1000,800,600,500,300,200,100}`）；**P3 测试夹具不得向生产政策表追加生效版本**。

### 1.4 命名、身份与测试数据

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL11** | **新代码一律 `snake_case` 无引号列名**（R22）；**引用 legacy 带引号驼峰列名（`"uID"` / `"EVM"` / `"bID"` / `"jID"`）一律禁止**。P3 新代码里出现任一 legacy 列名 = 直接判负。 | 全仓 `grep -n '"uID"\|"EVM"' backend-ts/src` 应随 Step 1 **归零** | 审计根因 R1：`users` 真列是 `uid`/`evm`，代码用 `"uID"`（57 处）/`"EVM"`（4 处）⇒ **411 个用户一条都读不出来**，且异常被吞成 401 | 【已冻结】（R22 + 审计 §2-R1） |
| **DL12** | **真实用户 `uid` 恒 `> 0`**（R98）；平台保留 uid = `0` / `−1`（平台收入）/ `−2`（佣金池）/ `−3`（罚没），**用户请求不得命中**（R100）。平台账户的 kind 白名单见 R101（**仅 `−3` 允许 `transfer` 出账**）。 | 路由守卫 `assertUserUid()`；`details.field` 指出是哪个字段 | 这是「用户把佣金池当收款人」这类经济漏洞的第一道闸 | 【已冻结】（R98/R100/R101） |
| **DL13** | **业务表可以 FK 到 `users(uid)`**（R21 的范围限定；§5.20 #6）—— 账本表**不建** FK（其 uid 含合成负值）。四柱新表的每一列 uid **必须** FK 到 `users(uid)`。 | §6 各表 DDL 片段 | 「脏 uid 静默沉淀 ⇒ 佣金永远发不出去」由 FK 结构性挡掉 | 【已冻结】（R21 v0.8 范围限定 + CR12） |
| **DL14** | **测试数据 uid 固定 `≥ 900000`**、自建币 `symbol` 前缀固定、跑完清理（硬 4）。**禁止**占用 `1–899999` 区间做探针（那是真实用户区；库里现有 411 条测试残差占 `949001–961826`，见 D20）。 | 质检脚本常量 | 避免「测试数据污染真实编号空间」类事故复发 | 【已冻结】（`master-plan` §5.7 硬 4） |
| **DL15** | **`users.uid` 由 DB identity 分配**（`users_uid_seq`，bigint，从 1 起）。**禁止**应用层 `MAX(uid)+n` 分配（旧 `database.ts:410` 的做法）——它并发下必然重号，且与 `users_pk` 冲突时报错不可读。 | 注册路径只 `INSERT ... RETURNING uid` | 旧实现在此点位会与 identity 抢同一序列，属**必须删除**的死代码 | 【本册裁定】 |
| **DL16** | **`users.evm` 不可改**（唯一身份凭据）：`users_evm_uniq` + `idx_users_evm_lower` 已保证唯一；后台 `POST /api/admin/user/update` **不得**接受 `evm` 字段（§10 #41）。 | 路由入参白名单 | 改 `evm` = 换号，会连带 `referral` 的终身绑定语义失效 | 【本册裁定】 |

## §2 数据层分层与写路径

### 2.1 分层形态（D18 方案 A：薄的新数据层）

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL17** | **数据层分四层**：**L0 连接层**（`src/db.ts`：`DATABASE_URL` / `DATABASE_URL_UNPOOLED` 两条串的只读/写用途，R56）→ **L1 账本封装**（`src/ledger.ts`：组装 payload + 调 `ledger_post_event` + 错误映射）→ **L2 域服务**（`src/job.ts` / `src/listing.ts` / `src/market.ts` / `src/referral.ts`，本册提案的模块名，Kong 可改名）→ **L3 路由**（`src/routes/*.ts`，`index.ts` 只做装配）。旧 `src/database.ts` **归档废弃、不再新增功能**（D18）。 | `backend-ts/src/{db,ledger,commission,job,listing,market,referral}.ts` + `src/routes/` | 审计 40 条 `column_missing` **全部**源于旧 `database.ts` 的查询层 ⇒ 不换掉它就换不掉根因 | 【本册裁定】（承载 D18） |
| **DL18** | **一个业务事件的账务部分 = 恰好一条语句** `SELECT ledger_post_event($1::jsonb)`（D10/§7.1）；应用层**不得**再包 `BEGIN…COMMIT`，**不得**拆成多次调用（CR29）。多语句事务**只允许**用于非账本写路径。 | L1 的 `postEvent()` 是唯一账本写入口 | 与 `0012` 的写路径阶段序对齐（DL19） | 【已冻结】（D10 + `ledger.spec` §7.1 v0.11 + CR29） |
| **DL19** | **不得依赖写路径的「先 SELECT 再 INSERT」**：重放判定由 DB 内只读前置闸（C4.5）＋ `ON CONFLICT` 探针承担（R51）；应用层**禁止**写「先查余额/先查键在不在、再决定是否提交」的形态（R63 禁止跨事务检查-使用）。 | L2 不做余额预校验以外的判断；预校验只用于 UX | 审计 §4.4 的 401 假象、双扣风险都出自这类写法 | 【已冻结】（R51 v0.11 / R63） |

### 2.2 业务表与账本事件的原子性（**v0.2 已裁：`C1` 采纳提案 A**）

> **✅ v0.2 终端裁定（逐字回写）**：`C1` **采纳提案 A：新增「业务编排函数」**（`job_post_event` 等；同一条语句内「派生分录 → 调 `ledger_post_event` → 回写引用列」），**不改 `ledger_post_event` 函数体**。**四条硬约束 = `DL141` / `DL142` / `DL143` / `DL144`**（下方表内逐条）。
> ▸ **v0.1 旧写法**：本节标题为「业务表与账本事件的原子性（**本册提案 · 争议项 C1**）」，两方案并列、**待 Zang 终审**；`DL20` 的状态列写【本册裁定 · **争议项 C1**：属**写路径形态扩展**，须 Zang 终审】。

`ledger_post_event` 是**单条语句的 PL/pgSQL 函数**，函数内**不能**写业务表（`commission.spec` §2.1 / CR14 已就 `commission_payout` 裁定过同一件事）。而 `ledger.spec` §7.2 #6/#7/#8/#9/#11/#12 要求「业务行 + 分录同一事务」。二者**在 P3 会正面相遇**（招工发布＝写 `job` 行 + `job_escrow` 分录；挂单＝写 `market_order` + `hold`）。

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL20** | **✅ 已裁：采纳「提案 A」= 新增「业务编排函数」** `biz_post_event(<biz_sql_state>)` —— 由**新迁移**（§6 的 `0013`）`CREATE FUNCTION`，在**同一条语句**内依次做「① 锁业务行（`FOR UPDATE`，**按 `DL141` 全序**）② 从业务行派生分录集合 ③ **调用既有 `ledger_post_event($1::jsonb)`** ④ 回写业务行的账本引用列」；**它不修改 `ledger_post_event` 函数体**（CR81 的禁令只针对「改函数体」，`CREATE FUNCTION` 新函数不在禁令内）。**四条硬约束** = `DL141`（加锁全序）／`DL142`（只由迁移创建、体内禁 DDL）／`DL143`（必带幂等键 + `ref_id` 落引用列）／`DL144`（重放语义对齐 `R51`/`R52`）。<br>▸ **v0.1 旧写法**：「**提案 A（本册推荐）**：新增一个「业务编排函数」…」＋状态列【**本册裁定 · 争议项 C1**：属写路径形态扩展，**须 Zang 终审**】。 | `0013` 的 `job_post_event` / `0014` 的 `listing_post_event` / `0015` 的 `market_post_event` 三个包装函数 | 收益：恢复「业务行 + 分录同一事务」的上位册要求，且**仍然是一位往返**（D10 不破）。代价：业务状态机的一部分落到 PL/pgSQL（D10 已接受「可维护性下移」这一代价） | **【已裁定 · Zang 终审 v0.2】**（C1 采纳 A） |
| **DL21** | **提案 B（备选）—— v0.2 终审后**未采纳**，降为「历史备选」**：接受「业务行与分录**不在同一事务**」，改由**业务行状态机 + 同一幂等键可重放**兜住：① 先落业务行（`status='pending_*'`）② 再落账本事件（键 = 业务派生键）③ 成功后回写业务行 `status` + `txid` 列；④ 失败靠**同键重试**（R52① 重放）自动收敛，**永不双扣**。**v0.2 处置：C1 已采纳 A ⇒ 不得据本条实现**；若将来 A 的编排函数在实测中不可行，须**新裁定**才能启用 B。<br>▸ **v0.1 旧写法**：「**提案 B（备选，不推荐，若 C1 被否）**…」＋状态列【本册裁定（备选） · 同属争议项 C1】。 | L2 的 `withBizEvent()` 状态机包装（**v0.2 不建**） | ⚠️ **诚实代价**（若将来启用 B）：出现「已托管、业务行未标记」的**可见中间态**（上限 = 一次请求的生命周期内），需要一条**对账判据**（§11 判据 5 的扩展）把它判出来；**不得**把它说成「原子」 | **【已裁定 · Zang 终审 v0.2：未采纳】** |
| **DL22** | **三条硬约束（A/B 皆适用）**：① 业务行的状态变更**必须**与其账本引用列（`escrow_txid` / `pay_txid` / `refund_txid`）在**同一次写**内完成（不得分两次提交）；② 业务行**必须**有列记录「已落账的事件键」（`ledger_event_keys text[]` 或等价的 `settle_key text`），用于**对账**与**重放自证**；③ 重放同一幂等键**不得**重复改业务行状态（幂等键是业务的，不只是账本的）—— **v0.2 已由 `DL144` 逐字钉死**（同键同指纹 ⇒ 200 重放，**不**重写业务行）。 | §6 各表列清单 | 「账本重放成功、业务状态被改两次」是这类双写最常见的缺陷；③ 直接把它封死 | 【本册裁定】（v0.2：C1 已裁且采纳 A ⇒ ①②③ 全部生效，③ 由 `DL144` 加严） |
| **DL141** | **（v0.2 新增 · C1 硬约束 ①）加锁全序定为「业务行（按主键升序） → `currency`（按 `cid` 升序） → `account`（按 `uid` 升序）」，且全部编排函数统一。** ① **全部编排函数统一**（`job_post_event` / `listing_post_event` / `market_post_event` **不得各自为政**）；② 编排函数**必须**在调 `ledger_post_event` **之前**已持有**业务行锁**（`SELECT ... FOR UPDATE`）；③ **禁止**「先锁 `account` 再锁业务行」的逆序形态 —— `ledger_post_event` 内部会锁 `account`，逆序即 **AB-BA 死锁**。 | 三个编排函数体；code review 硬项 | R79 已有「全序加锁」方向，本条把它**收敛为唯一序列**并点名「业务行必须先于 `account`」——这是采纳提案 A 后**新增**、提案 A 原文未写的约束 | **【已裁定 · Zang 终审 v0.2】**（C1 硬约束 ①；**交叉引用**：`ledger.spec` **R79**（加锁全序，逐字一致）+ **R109**①（同一事务）） |
| **DL142** | **（v0.2 新增 · C1 硬约束 ②）业务编排函数只由迁移创建；函数体内禁止任何 DDL。** ① ``CREATE [OR REPLACE] FUNCTION``（编排函数）**只允许**出现在 `backend-ts/migrations/*.sql`，**运行时不得创建/替换**（与 `DL6` / `DL140` 同族）；② 编排函数体内**不得**出现 `CREATE` / `ALTER` / `DROP` / `TRUNCATE` / `DO $$`（编排走**数据**路径，schema 只由迁移改，`DL7`）。 | 三个编排函数；`DL140` 的模式集扫描**必须覆盖函数体**（不只看顶层模块） | 「顺手在函数里 `CREATE TEMP TABLE` / `CREATE INDEX`」是运行时 DDL 的**第三种形态**（前两种：`ensureSupportSchema` 的裸 DDL、`ensureLegacyTableNames` 的条件 `RENAME TO`，`DL137`）⇒ 在编排函数里先堵死 | **【已裁定 · Zang 终审 v0.2】**（C1 硬约束 ②；**交叉引用**：`ledger.spec` **R109**②（函数内禁 DDL、只由迁移创建）） |
| **DL143** | **（v0.2 新增 · C1 硬约束 ③）编排函数的每一次调用必须带幂等键，并把 `ref_id` 落到账本的引用列。** ① 键形态与作用域遵守 §8（`cli:` 创建类 / `biz:` 业务类，`DL94`）；② 编排函数**必须**把本次事件的 `ref_type` + `ref_id` **显式**传给 `ledger_post_event`（**禁止**空 `ref_id`、**禁止**把业务单号塞进 `memo`，R18 / `DL83`）；③ 编排函数**必须**把本次事件的**根键**写回业务行的 `ledger_event_keys`（`DL22②` / `DL100`）。 | 三个编排函数；`ledger_entry.ref_type/ref_id` + 业务行的 `ledger_event_keys` | 没有 ③，「业务行说结算了、账本没有」**无法判负**（`DL100` 的判据靠它成立）；没有 ②，「相关流水」查询（`idx_ledger_ref`）失效 | **【已裁定 · Zang 终审 v0.2】**（C1 硬约束 ③；**交叉引用**：`ledger.spec` **R109**③④（幂等键 / `ref_id` 落引用列）） |
| **DL144** | **（v0.2 新增 · C1 硬约束 ④）编排函数的幂等重放语义必须与 `R51`/`R52` 一致：同键同指纹 ⇒ `200` 重放，且**不**重写业务行。** ① 同键同指纹 ⇒ 返回账上既有结果（`{idempotent_replay:true, txid, …}`，`DL98`）+ **不得**再次改业务行状态 + **不得**追加 `ledger_event_keys` 项；② 同键异指纹 ⇒ `409 LEDGER_IDEMPOTENCY_CONFLICT`（不执行、不改数据）；③ 编排函数**不得**自造一套「业务侧幂等」判定与账本侧分叉（分叉点 = 「账本回了重放、业务行却被改第二次」）。 | 三个编排函数 + L2 响应包装层 | 把 `DL22③` 提升为**可判负**的验收项；判负用例见 **`DL149`** | **【已裁定 · Zang 终审 v0.2】**（C1 硬约束 ④；**交叉引用**：`ledger.spec` **R109**③（幂等重放语义与 `R51`/`R52` 一致）；`R51`/`R52` 为重放母规） |

### 2.3 读路径

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL23** | **读路径绝不产生写副作用**（含 DDL、含懒开户、含 `upsert*`）。旧面反例（审计 §2-R5）：`GET /api/market/:bID/{orderbook,trades}` 执行 DDL；`GET /api/user/asset/:uID` 内部 `upsertAsset()`（未认证访客可给任意 uid 建行）。**新面一律不得复现**。 | 读服务的函数签名**不允许**出现写动词 | 这是「读不该写」的规约化表述；已在 DL6 与 §1.1 交叉 | 【本册裁定】（审计 §2-R5 实证） |
| **DL24** | **余额读一律带 `cid`**：`GET /api/user` / `/api/user/points` 必须显式接受 `cid`（可空 ⇒ 返回全部持仓，分页）；**禁止**返回「一个未标明币种的数字」当作「积分」（`$` 与自建单位是不同东西，R3）。 | 响应形状 `{ cid, symbol, decimals, balance, frozen }` | 前端 `DashJ` 已泛化为 `CurrencyGlyph`（`master-plan` §4）⇒ 多币种展示本就要求带 `cid` | 【本册裁定】 |
| **DL25** | **流水分页必须 keyset**（R95）：`before_txid` 游标，响应回传 `next_before_txid`；**禁止** `OFFSET`。 | `/api/user/ledger` | 旧面无此路由（0 条触达账本）；P3 必须新增，否则「我的账单」不存在 | 【已冻结】（R95） |

## §3 旧 → 新映射（逐表 / 逐列 / 逐路由）

> 说明：审计 `docs/audit/p3-route-inventory.md` §5 的 `mapping_proposal` 是**提案**；本节给出**映射事实**，逐条判定在 **§4**，路由保留/重写/删除在 **§10**。旧库/旧代码表名的带引号写法（`"users"` / `"uID"`）在本节一律以**代码原文**引用，新名一律 `snake_case`。

### 3.1 逐表映射

| # | 旧表（旧代码引用） | 真库是否存在（审计读数） | 新归属 | 处置 | 理由 |
|---|---|---|---|---|---|
| 1 | `users`（旧代码写 `"users"."uID"` / `"EVM"`） | 存在（**8 张基表之一**，411 行测试残差） | `users(uid,evm,bio,is_admin,time_reg,time_login_last)` | **保留，仅列名对齐** | 真列已是 `snake_case`（`0002`）；事故是**引用**错，不是表错（审计 §2-R1） |
| 2 | `asset`（`"uID"`,`points`） | **不存在，且永不创建**（只有 `ALTER TABLE IF EXISTS`） | 无（**整体废弃**） | **废弃 → 余额改由 `account` / `ledger_entry` 派生** | `ledger.spec` §13.1「第二套账」禁令；`GET /api/user/asset/:uID` 实测 500 的根因 |
| 3 | `task` | **不存在，且永不创建** | `job`（招工单，**0013**） | **重新建模，不复用旧表名** | 招工的业务语义（托管 / 申请人 / 交付审核）与旧 `task` 不同；且 `task` 在新库从未存在 ⇒ 「重命名」是伪命题 |
| 4 | `task_progress`（旧代码 `journey` → `task_progress`） | 懒 DDL 建出（0 行）、**不在迁移中** | `job_application`（报名）+ `job_submission`（提交/审核） | **拆分重建** | 旧表把「报名」与「提交」揉在一行；新模型两条链（`job_escrow` 归属 / 审核结果）需要分别可查 |
| 5 | `prize` | 懒 DDL 建出（0 行）、不在迁移中 | `listing`（商品，**0014**） | **重新建模** | 旧语义 = 平台发奖（`points` 由后台定）；新语义 = **用户用 `$` 标价**（产品背景柱②） |
| 6 | `prize_item`（旧代码 `gift` → `prize_item`） | 懒 DDL 建出（0 行） | `listing_order`（商品购买/交付记录，**0014**） | **重新建模** | 旧「领取物」没有买家付款动作；新模型**必须有买家与付款分录**（`purchase`/`sale`） |
| 7 | `shard` | 懒 DDL 建出（0 行） | `currency`（`cid` 维度）+ `account`（持仓） | **重构并入**（不建 `shard` 表） | `master-plan` §4 已裁「`shard`/`shard_transfer` 重构并入通用 `account`/`ledger_entry`」；`dashJ` = `currency.owner_uid > 0` 的一个单位（R3） |
| 8 | `shard_transfer` | 懒 DDL 建出（0 行） | `ledger_entry`（`kind='transfer'` / `'trade'`） | **重构并入** | 旧表就是「碎片转让流水」 ⇒ 与账本流水**同构**，保留它等于造第二套流水 |
| 9 | `market_order` | 懒 DDL 建出（0 行） | `market_order`（**0015**） | **同名重建**（旧表同名但列/类型不可信） | 表名在 `ref_type` 白名单内（R18）；旧表是懒建的空壳 |
| 10 | `market_trade` | 懒 DDL 建出（0 行） | `market_trade`（**0015**） | **同名重建** | 同上；成交必须是 `trade` + `trade_fee` 分录的**业务载体**（判据 8 靠 `ref_type/ref_id`） |
| 11 | `chest` / `chest_stats` 系列 | 旧库有、新库**无**（不在懒 DDL 的 9 张里） | 无 | **废弃** | 宝箱开奖 = 平台发奖，与「管理员不再发布内容、余额必经双分录」冲突（见 §4 #27 驳回） |
| 12 | `app_config` | 懒 DDL 建出（0 行） | `app_config`（**0016** 正式落盘） | **保留，须由迁移建回** | 平台设置仍是后台需要的一块（`master-plan` §4 判「保留」）；⚠️ **费率真源自 P2 起是 `commission_policy.fee_rate_bp`**，`app_config` 的费率键**不再参与计费**（§5.20 #3） |
| 13 | `permission_group` | 懒 DDL 建出（0 行） | `admin_permission` / `admin_role`（**0016** 提案） | **重建** | 旧表语义 = 权限分组；新口径需要「管理员 = 搭平台 + 审核/仲裁」的权限位（§9.3） |
| 14 | `account` / `ledger_entry` / `ledger_owner` / `currency` / `referral` / `commission_policy` / `schema_migration` | 存在（迁移 `0001`–`0012`） | 同名 | **保留（唯一真源）** | DL1 / DL2；**不得改动**（DL7） |

### 3.2 逐列映射（旧列 → 新列，只列有语义映射的）

| 旧列（代码原文） | 新列 | 语义变化 | 处置 |
|---|---|---|---|
| `users."uID"` | `users.uid`（`bigint`） | **仅大小写/引号**（`0002` 已收敛类型） | 全仓引用改写；禁止保留带引号写法（DL11） |
| `users."EVM"` | `users.evm`（`text`） | 仅大小写 | 同上；比较统一 `lower(evm)` 走 `idx_users_evm_lower` |
| `asset.points` | 无 | **语义摧毁**：旧「一个整数 = 积分」→ 新「`(uid,cid)` 上的 `balance`/`frozen`」 | 废弃列；所有读点改账本派生（DL1） |
| `asset."uID"` | 无 | 同上 | 同上 |
| `task."tID"` / `task.title` / `task.points` | `job.job_id` / `job.title` / `job.reward`(`+ job.cid`) | **`points` → `reward` + 必带 `cid`**（酬金以某单位计价） | 重新建模 |
| `task_progress."jID"` / `.status` | `job_application.application_id` / `.status` 与 `job_submission.review_status` | 一列状态 → 两条链 | 拆分重建 |
| `prize."bID"` / `.points` | `listing.listing_id` / `.price`(`+ listing.cid`) | **平台定价 → 用户标价**，且必带 `cid` | 重新建模 |
| `prize_item."gID"` / `.status` | `listing_order.order_id` / `.status` | 「被领取」→「被购买（有付款分录）」 | 重新建模 |
| `shard."sID"` / `.amount` | `currency.cid` + `account.balance` | 「碎片数量」→「某单位余额」 | 重构并入 |
| `shard_transfer."fromUID"/"toUID"/.amount` | `ledger_entry(uid, delta, kind='transfer'/'trade', txid)` | 「转让记录」→「不可变分录」 | 重构并入 |
| `market_order."bID"`（被当**品牌 id** 用） | `market_order.base_cid` + `quote_cid` | **语义纠正**：`bID` 在旧代码既是「品牌」又是「箱」，新面一律 `cid` 对 | 重新建模（对照 §5-C2 的命名争议） |
| `permission_group.name` / `.permissions` | `admin_role.role_key` / `admin_permission.permission_key` | 权限位集合重定义（删 `publish_*`） | 重建（§9.3） |

### 3.3 逐路由映射（按族群；逐条判定见 §4 与 §10）

| 族群 | 旧路由（审计编号） | 新归属 | 新路由（提案） |
|---|---|---|---|
| 平台基础 / 中间件 | #1–#3（`USE`）、#4 `/`、#55 404 兜底 | 平台基础 | 原样保留（改文案/版本探针） |
| 运维探针 | #5 `/health` | 平台运维 | `GET /health`（`schema_version` 读 `schema_migration` 最大值） |
| 开发桩 | #6 `/api/test/data` | 无 | **删除** |
| 身份 | #7 register、#8 challenge、#9 verify、#10 login | 邀请返佣 / 身份 | `POST /api/auth/challenge`、`POST /api/auth/verify`（register/login **删除**；邀请绑定移到 ④） |
| 账户 | #15 `/api/user`、#16 profile、#17 asset | 平台基础（账户） | `GET /api/user`、`POST /api/user/profile`、`GET /api/user/points`、**新增** `GET /api/user/ledger` |
| ①招工 | #12 `/api/task/all`、#13 `/api/task/:tID`、#18 `/api/home`、#20 `/api/task-progress`、#21 `/:jID`、#22 submit、#23 claim、#42–#44 admin/task/*、#50–#52 tasklist/* | ①招工 | `GET /api/job`、`GET /api/job/:jobId`、`POST /api/job`、`POST /api/job/:jobId/apply`、`POST /api/job/:jobId/accept`、`POST /api/job/:jobId/submit`、`POST /api/job/:jobId/review`、`POST /api/job/:jobId/settle`、`POST /api/job/:jobId/cancel`、`GET /api/job/mine`；`/api/admin/task/*` **删除** |
| ②商品 | #11 `/api/prize/all`、#14 `/api/prize/:bID`、#19 `/api/prize-item`、#45–#47 admin/prize/* | ②商品 | `GET /api/listing`、`GET /api/listing/:listingId`、`POST /api/listing`、`POST /api/listing/:listingId/buy`、`POST /api/listing/order/:orderId/refund`、`GET /api/listing/order/mine`；`/api/admin/prize/*` **删除** |
| ③积分交易所 | #24 `/api/shard`、#25 `/api/shard/transfer`、#26 `/api/shard/redeem`、#27 `/api/chest/:bID/open`、#28–#31 `/api/order*`、#32 orderbook、#33 trades | ③积分交易所 | `GET /api/market`、`GET /api/market/:baseCid/orderbook`、`GET /api/market/:baseCid/trades`、`POST /api/market/order`、`DELETE /api/market/order/:orderId`；`shard*` / `chest` **删除**（能力并入 `account`/`ledger_entry` 读口） |
| ④邀请返佣（**旧面 0 入口**） | 无（#7 register 是旧入口） | ④邀请返佣 | `POST /api/referral/bind`、`GET /api/referral/mine`、`GET /api/referral/earnings`、`GET /api/referral/policy`（只读） |
| 后台管理 | #34 admin/me、#35–#37 settings*、#38–#40 permissions*、#41 user/update、#48 user/all、#49 user/stats、#53 assets/init、#54 points/adjust | 后台管理 | 保留 7 条（重写）、删除 3 条（#37 reset / #53 assets/init / #54 points/adjust 见 §4）、#54 若保留则改走 `mint`/`burn` |
| 交易所/单位上市（新能力） | 无 | ③积分交易所 | `POST /api/currency`（创建单位）、`POST /api/currency/:cid/list`（上市缴 `listing_fee` + `listing_deposit`）、`GET /api/currency`、`GET /api/market/:baseCid/candles` |

### 3.4 逐表映射的三条规约

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL26** | **旧表名一律不得复活**：`asset` / `task` / `task_progress` / `prize` / `prize_item` / `shard` / `shard_transfer` / `chest*` **不得**出现在任何新迁移、新代码、新路由里（**含只读引用**）。 | code review + `grep` 判负项 | 让「旧语义渗回新面」这件事在机器层不可发生 | 【本册裁定】 |
| **DL27** | **新表名必须落在既有 `ref_type` 白名单内或复用既有值**：`ledger_ref_type_enum` 的关闭集 = `job` / `listing` / `listing_order` / `market_order` / `market_trade` / `currency` / `commission_payout` / `system`。⇒ 商品表必须叫 **`listing`**、订单表必须叫 **`listing_order`**（**不是** `commodity` / `goods` / `product`）—— 否则需要改 `0001` 的约束 = 动已应用迁移（DL7 禁止）。 | §6 表名；`0014` | 这是**本册驳回审计「改名 commodity」提案的机械理由**（§4 #11 / §5-C2）：`ref_type` 是**已被约束冻结**的关闭集 | 【本册裁定 · 关联争议项 C2】 |
| **DL28** | **旧 → 新映射必须逐列可判负**：每张被重建的表都要有一条「旧列引用归零」判据（`grep -c '"uID"\|"EVM"\|"bID"\|"jID"\|"gID"\|"sID"' backend-ts/src` = 0）。 | 质检脚本 | 审计已证明「一处列名错 = 40 条路由死」；把判负做成一行 grep 是成本最低的回归闸 | 【本册裁定】 |
| **DL29** | **映射表里凡标「重构并入」者，不得留下影子表**：`shard`/`shard_transfer` 的能力**全部**由 `currency`+`account`+`ledger_entry` 承担；**禁止**为了「迁移方便」保留一张 `shard_legacy` 类过渡表。 | §6「不新建表清单」 | 影子表 = 第二真源 = DL1 的破口 | 【本册裁定】 |
| **DL30** | **旧 `GET /api/home` 的「聚合三合一」不得照搬**：新 `/api/home` 只允许返回**读派生**的聚合（招工列表 + 我的余额），**不得**在服务端把余额镜像进聚合响应后由前端当状态缓存。 | §10 #18 | 前端缓存余额 = 事实上的第二真源（DL1） | 【本册裁定】 |
| **DL31** | **旧 `POST /api/auth/*` 的「顺手开户 / 顺手建 asset 行」全部作废**：登录路径**只**允许 `users` 的 `INSERT ... ON CONFLICT (evm) DO UPDATE`（时间戳列）——**不得**在登录时开 `account` 行（开户是 0/0 的 DB 函数职责，R75/CR35）。 | §10 #9 / #10 | 旧 `verify` 里含 asset 初始化 ⇒ 登录 = 写余额的破口 | 【本册裁定】 |
| **DL32** | **旧 `upsertAsset()` 语义的替代**：任何「确保账户存在」的需求一律交由 DB 侧（`ledger_post_event` 的 C4 段 `INSERT ... ON CONFLICT DO NOTHING`，CR35）；应用层**不得**实现「懒开户」。 | §10 #17 | 与 DL23（读不写）同一条纪律的两个面 | 【已冻结】（CR35 + R75） |
| **DL33** | **（v0.2 改口径 · C2）路由路径的参数命名 = camelCase 资源名**：`uID`→`uid`、`bID`→`baseCid`、`tID`→`jobId`、`jID`→`jobId` / `applicationId`、`oID`→`orderId`、商品 `bID`→`listingId`（**路径参数一律 camelCase**，R22 允许路由层映射；**不得**再出现 `uID`/`bID`/`sID`/`tID`/`jID`/`oID` 这类旧命名）；**DB 列名一律 snake_case**（`base_cid`）—— 权威消歧条 = **`DL145`**。<br>▸ **v0.1 旧写法**：「路由路径的参数命名**一律 `snake_case` 化的资源名**：`uID`→`uid`、`bID`→**`base_cid`**、`tID`→`jobId`…」（把**路径参数**写成 `snake_case`，与 §4 的 `:baseCid` 及 §12.2 的 `listingId` **三处自相矛盾**）。 | §10 新路由列 | 旧命名是「一物多名」事故源（`bID` 既指品牌又指箱）；v0.2 把「**路径 camel / 列 snake**」写死以消歧 | **【已裁定 · Zang 终审 v0.2】**（C2） |
| **DL145** | **（v0.2 新增 · C2 命名风格消歧，权威条）同一概念在三个出现面的写法写死**：① **URL 路径参数 = camelCase**（`:baseCid` / `:jobId` / `:orderId` / `:listingId` / `:applicationId` / `:submissionId`）；② **DB 列名 = snake_case**（`base_cid` / `job_id` / `order_id` / `listing_id`）；③ **query 字符串键** = v0.1 §10 已写的 snake_case（`?base_cid=&quote_cid=`）—— 裁定**未点名** query 键，本册**保持既有写法不动**，改则须**新裁定**。④ **可机械映射**：任一 camelCase 路径参数到其 snake_case 列名的转换**唯一确定**（无例外表）。**表名沿用 `listing` / `listing_order`**（`DL27` 的 `ref_type` 白名单理由不变）。 | §6 表列清单 / §8.3 键表 / §10 新路由列 / §11.2 码表；code review 硬项 | 「同一参数在路径写 camel、在库写 snake」若不留一条权威条，就会重演 v0.1 §4↔§12.2 的**两处写法不一**（本条的立项理由） | **【已裁定 · Zang 终审 v0.2】**（C2） |

## §4 对审计 `mapping_proposal` 的逐条表态（55 条）

> **判定词汇（写死，避免「表态」被读成「同意」）**：
> **采纳** = 提案的**方向与落点**均予认可，本册**不修正**任何字段；
> **修正** = **方向认可、落点或字段须改**（本册给出改法；实现按本册改法走）；
> **驳回** = **不予认可**，本册给出**删除 / 另立**的处置。
> **凡本册判定与审计提案字面不一致者**，一律在本表「本册判定」列写明差异点，**争议项**另在 **§5** 单列。

### 4.1 55 条逐条判定

| # | method | path | 审计提案（摘要） | 本册判定 | 差异点 / 理由（本册口径） |
|---|---|---|---|---|---|
| 1 | `USE` | helmet | 保留（无业务语义） | **采纳** | — |
| 2 | `USE` | cors | 保留（无业务语义） | **采纳** | 白名单须收敛到 5787/5788 + 正式域，不得 `*`（与 cookie/Bearer 共存时的安全默认） |
| 3 | `USE` | express.json | 保留（无业务语义） | **采纳** | 须同时挂 `Idempotency-Key` 读取中间件（§8） |
| 4 | `GET` | `/` | 保留；改为新站清单/版本探针 | **采纳** | 响应**不得**再出现 `Backend ready` / `Seafood TypeScript` 这类 jinli 残留文案（§5.26 #1 待 Kevin 给品牌口径） |
| 5 | `GET` | `/health` | 保留；`schema_version` 指向新迁移链 | **修正** | 修正点：`schema_version` **必须**现读 `schema_migration` 的 `max(version)`，**禁止**硬编码常量（硬编码在 `0013+` 之后必然撒谎）；且探针**不得**触达任何业务表（现存实现已触 `schema_migration`，合规） |
| 6 | `GET` | `/api/test/data` | 删除（legacy_unmapped） | **采纳** | 开发桩不得进生产面 |
| 7 | `POST` | `/api/auth/register` | 删除；注册并入钱包签名 + 邀请绑定 | **采纳** | 采用；但**落点修正**见 #10（`login` 别名不保留）与 ④（绑定落 `POST /api/referral/bind`） |
| 8 | `POST` | `/api/auth/challenge` | 保留，重写为对新 `users(uid,evm)` 读写 | **采纳** | `challenge` 本身**不触 DB**（内存/无状态）⇒ 「重写」只要求签名域与 `evm` 规范化（`lower(evm)`） |
| 9 | `POST` | `/api/auth/verify` | 重写：`users` upsert + 余额改由账本派生（废弃 asset） | **修正** | 修正点（DL31）：登录**只**允许写 `users`；**禁止**顺手开 `account` 行 / 写任何分录；首次登录的邀请绑定**必须**走 #7 的绑定接口（独立幂等面） |
| 10 | `POST` | `/api/auth/login` | 同 verify；建议保留别名但共用新实现 | **驳回** | **驳回**「保留别名」：同一实现两条路径 = 两套幂等指纹面 = 客户端重试语义分叉；**删除 `login`**，只留 `verify`（`master-plan` D3 只要求「钱包签名登录」一条路径） |
| 11 | `GET` | `/api/prize/all` | 新 commodity（用户用 `$` 标价） | **修正** | 方向认可；**表名/路径改为 `listing`**（DL27 的 `ref_type` 白名单理由，见 §5-C2）：`GET /api/listing`；**✅ v0.2 裁定（C2）：以 `listing` / `listing_order` 为准，驳回改名 `commodity`**（`DL27` / `DL145`；`DL34` 的「审计提案不得当已生效口径」在此再次适用） |
| 12 | `GET` | `/api/task/all` | 新任务表（招工单）；或复用 `task` 表重命名 `job` | **修正** | 采纳「新表」、**驳回「复用/重命名旧 `task`」**（旧表在新库**从未存在**，且旧列语义不符）：新建 `job`，路由 `GET /api/job` |
| 13 | `GET` | `/api/task/:tID` | 同上 | **修正** | `GET /api/job/:jobId`；`tID` 命名作废（DL33）。**读口必须校验「可见性」**（`open` 公开 / 其余仅当事双方）；**✅ v0.2（C2）**：`:jobId` 即**路径参数 camelCase** 口径，由 `DL145` 定案 |
| 14 | `GET` | `/api/prize/:bID` | 新 commodity | **修正** | `GET /api/listing/:listingId`；旧 `bID` 命名作废；**✅ v0.2（C2）**：`:listingId`（**路径参数 camelCase**），`DL145` 定案 |
| 15 | `GET` | `/api/user` | 重写：points 由账本聚合 | **修正** | 再进一步（DL24）：**必须带 `cid`**，返回 `{cid,symbol,decimals,balance,frozen}` 集合；**禁止**单个裸数字 |
| 16 | `POST` | `/api/user/profile` | 重写为写 `users.bio`（列名大小写修复） | **采纳** | — |
| 17 | `GET` | `/api/user/asset/:uID` | 废弃 asset 表；改 `/api/user/points`（账本派生） | **修正** | 路径改 `GET /api/user/points`；**并删除全部 `upsertAsset()` 写副作用**（审计 §2-R5）；参数 `uID` → `uid`（仅管理员可查他人，见 §9.2） |
| 18 | `GET` | `/api/home` | 重写：招工列表 + 商品列表 + 我的积分 | **修正** | P3 只出「招工列表 + 我的余额」；商品/交易所在各自阶段追加（避免 P3 造空壳字段）；余额为**读派生**（DL30） |
| 19 | `GET` | `/api/prize-item` | 商品持有/交付记录 | **修正** | 落点为 `listing_order`：`GET /api/listing/order/mine`（含买卖双侧视角）；「持有」概念在商品柱不存在（付款即交付语义，P4 spec 定争议与交付细节） |
| 20 | `GET` | `/api/task-progress` | 招工报名/提交/审核流水 | **修正** | 拆两条：`job_application`（报名）与 `job_submission`（提交/审核）；路由 `GET /api/job/:jobId/applications`、`GET /api/job/:jobId/submissions` |
| 21 | `GET` | `/api/task-progress/:jID` | 同上 | **修正** | `jID` → `applicationId`：`GET /api/job/application/:applicationId` |
| 22 | `POST` | `/api/task-progress/:identifier/submit` | 同上 | **修正** | 「交付提交」独立为 `POST /api/job/:jobId/submit`（幂等键 `biz:job:submit:<jobId>`）；`identifier`（可数字可串）这条**双语义参数**作废 |
| 23 | `POST` | `/api/task-progress/claim/:jID` | 同上 | **修正** | **语义拆分**（本册重点表态）：旧 `claim` 是「领取奖励」；招工柱需要的是「① 申请接单 `apply`」与「② 雇主选定 `accept`」两个动作 —— 二者**账务语义完全不同**（前者无分录、后者锁定打工人） |
| 24 | `GET` | `/api/shard` | 交易所持仓；碎片改为 `currency.cid` 维度 | **修正** | 采纳「`cid` 维度」，**驳回「持仓表」**：持仓 = `account`（DL1）；读口改 `GET /api/user/points`（同一读口复用于四柱），**不建** `/api/shard` |
| 25 | `GET` | `/api/shard/transfer` | 同上 | **修正** | 转让流水 = `ledger_entry` 派生：`GET /api/user/ledger?kind=transfer`；**不建** `/api/shard/transfer` |
| 26 | `POST` | `/api/shard/redeem` | 同上 | **驳回** | 旧「碎片兑换」在 `cid` 模型里无对应语义：碎片（自建单位）之间的交换 = **交易所成交**（`trade`）或 `transfer`；**另立**独立「兑换」入口会造一套与交易所并行的汇率口径 ⇒ 删除 |
| 27 | `POST` | `/api/chest/:bID/open` | 同上（归 ③） | **驳回** | 宝箱开奖 = 平台凭空调入余额的入口 ⇒ 与 DL5（必经双分录）与「管理员不再发布内容」正面冲突；**删除**。将来若做，须走 `mint`/`purchase` 且**单独裁定** |
| 28 | `GET` | `/api/order` | 挂单/撮合迁到账本双分录 | **修正** | 方向认可；读口改 `GET /api/market/order/mine`（我的挂单）+ `GET /api/market/:baseCid/orderbook`（公开）；**P3 不开，排 P5**（§10 表内「P3 开」列 = 否） |
| 29 | `POST` | `/api/order` | 同上 | **修正** | `POST /api/market/order`；**挂单冻结复用 `hold`**（R43），`ref_type='market_order'` |
| 30 | `DELETE` | `/api/order` | 同上 | **驳回** | **删除**该条目：`DELETE` 带 body 的取消语义在 CDN/代理层不可靠（且旧实现正是「按 body 删」）；撤单**只**允许 `DELETE /api/market/order/:orderId`（#31） |
| 31 | `DELETE` | `/api/order/:oID` | 同上 | **修正** | `DELETE /api/market/order/:orderId`；必须 `hold_release` 解冻（R33/R84：锁行后复查 `status` 与 `amount_filled`） |
| 32 | `GET` | `/api/market/:bID/orderbook` | 挂单/撮合迁到账本 | **修正** | `GET /api/market/:baseCid/orderbook`；**必须先摘掉运行时 DDL**（DL6/DL23，审计 §0.2 实证）；公开读口**禁**任何写；**✅ v0.2（C2）**：`:baseCid`（**路径 camel**）与列 `base_cid`（**snake**）成对，`DL145` 定案 |
| 33 | `GET` | `/api/market/:bID/trades` | 同上 | **修正** | `GET /api/market/:baseCid/trades`；数据源 = `market_trade`（**不可变**），**不得**回读 `market_order` 拼凑；**✅ v0.2（C2）**：同 #32（`:baseCid` / `base_cid` 成对） |
| 34 | `GET` | `/api/admin/me` | 保留（平台运维） | **采纳** | 权限位集合重定义（§9.3），形状改 `{uid, evm, is_admin, permissions[]}` |
| 35 | `GET` | `/api/admin/settings` | 保留（平台运维） | **采纳** | 数据源 = `app_config`（`0016` 落盘）；**响应必须标注「费率不在本表」**（真源 = `commission_policy`，§5.20 #3） |
| 36 | `POST` | `/api/admin/settings` | 保留（平台运维） | **修正** | 修正点：必须带 `ops:<admin_uid>:<action>:<key>` 幂等键（DL36）+ 审计留痕；**禁止**在本入口写费率键（费率走 `commission_policy` 插行，CR23/CR25） |
| 37 | `POST` | `/api/admin/settings/reset` | 保留（平台运维） | **驳回** | **删除**：「一键重置全部设置」是**无审计的批量破坏写**；改为逐项 `POST /api/admin/settings`（每条一键、一条留痕）。若 Kevin 要保留，须补「重置前后快照 + 操作人 + 原因」三项，属新语义；**✅ v0.2 裁定（C3 ②）：确认删除**（终审逐字「`/api/admin/settings/reset` **删除**」） |
| 38 | `GET` | `/api/admin/permissions` | 保留（平台运维） | **采纳** | 数据源改 `0016` 的新权限表（§6 / §9.3） |
| 39 | `POST` | `/api/admin/permissions/save` | 保留（平台运维） | **采纳** | 须 `ops:` 幂等键 + **禁止**把自己降权到无 `manage_permissions`（自锁守卫） |
| 40 | `POST` | `/api/admin/permissions/delete` | 保留（平台运维） | **采纳** | 须校验「该角色下无在用用户」才能删（否则静默失权） |
| 41 | `POST` | `/api/admin/user/update` | 保留（平台运维） | **修正** | 入参白名单收敛（DL16 / §9 的 `DL98`）：**只允许** `is_admin` / 角色分配 / `bio`；**禁止** `evm`、`uid`、**任何余额字段** |
| 42 | `POST` | `/api/admin/task/create` | 下线（管理员不再发 task）；保留审核能力 | **采纳** | **删除**；审核能力落 #50–#52（审核方归属见 §5-C7） |
| 43 | `POST` | `/api/admin/task/update` | 同上 | **采纳** | 删除 |
| 44 | `POST` | `/api/admin/task/delete` | 同上 | **采纳** | 删除 |
| 45 | `POST` | `/api/admin/prize/create` | 新 commodity（用户用 `$` 标价） | **驳回** | **驳回**「改为管理员创建商品」：产品背景「**管理员不再在后台发布 task/reward**」+ `master-plan` §4「`admin/*` 发布 → 废弃」⇒ **删除**；商品发布是**用户**动作（`POST /api/listing`）；**✅ v0.2 裁定（C3 ①）：`/api/admin/prize/*` 整体删除**（逐字确认） |
| 46 | `POST` | `/api/admin/prize/update` | 新 commodity | **驳回** | 同上；删除；**✅ v0.2 裁定（C3 ①）：确认删除**（`/api/admin/prize/*` 整体删除） |
| 47 | `POST` | `/api/admin/prize/delete` | 新 commodity | **驳回** | 同上；删除。**合规下架**属 P6 审核能力（新路由 `/api/admin/listing/:id/takedown`，需单独定义）；**✅ v0.2 裁定（C3 ①）：确认删除**（`/api/admin/prize/*` 整体删除，含本条） |
| 48 | `GET` | `/api/user/all` | 重写为只读运维视图（`users` 新列） | **采纳** | 必须分页 + 只出非敏感列（`bio` / `is_admin` / 时间戳）；**禁止**出 token |
| 49 | `GET` | `/api/user/stats` | 重写（账本口径统计） | **采纳** | 统计口径必须**标注**为「账本派生」（DL1/DL24）；禁止在此处自算余额 |
| 50 | `GET` | `/api/tasklist/pending-verification/count` | 招工提交审核队列（管理员改为审核方） | **修正** | 队列**改由雇主视角**（D5）：`GET /api/job/pending-verification/count`（我的待审提交）；管理员仲裁队列另立（§5-C7）；**✅ v0.2 裁定（C7）：雇主审；`/api/tasklist/*` 归雇主视角**（终审逐字「驳回审计的『管理员审』——那是推断、无用户原文依据，而 `D5` 已冻结」） |
| 51 | `GET` | `/api/tasklist/pending-verification` | 同上 | **修正** | 同上：`GET /api/job/pending-verification`；**✅ v0.2 裁定（C7）**：雇主视角（同 #50） |
| 52 | `POST` | `/api/tasklist/:jID/verify` | 招工提交审核（approve/reject）；管理员由发布方改为审核方 | **修正** | 审核动作改 `POST /api/job/:jobId/review`（**雇主**执行 approve/reject，D5）；**`approve` 即结算**（`job_payout`+`job_fee`+`commission`，键 `biz:job:settle:<jobId>`）；**✅ v0.2 裁定（C7）：确认「雇主审」，驳回审计的「管理员审」**；管理员只做**仲裁**（P6 `/api/admin/arbitration/*`） |
| 53 | `POST` | `/api/admin/assets/init` | 改为账本调整（`ledger_post_event` + 幂等键），废弃 asset | **修正** | 再进一步：**删除**。旧语义 = 「给所有用户初始化 asset 行」；新口径下**账户由 DB 函数按需 0/0 开户**（CR35/R75）⇒ 该入口**没有存在理由**；且审计 §2-R5 记它**缺 `requireAdmin` 守卫** |
| 54 | `POST` | `/api/admin/points/adjust` | 改为账本调整（`ledger_post_event` + 幂等键），废弃 asset | **修正** | 采纳「改走账本」，**必须**限定 kind = `mint` / `burn`（`$` 由平台主体发起，R23/R25），键 `ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq>`；**✅ v0.2 裁定（C3 ③）：保留但锁死** —— 仅 `$`（`cid=1`）/ `ops:` 前缀幂等键 / **必填原因码** / **必须**经 `ledger_post_event`（`mint`\|`burn`）⇒ **禁止**直接 UPDATE `account`；审计台列 **P6**（`DL146`） |
| 55 | `USE` | 404 兜底 | 保留 | **采纳** | 兜底响应形状须与 R107 对齐（`{error:{code,message,i18n_key,details}}`）；**不得**回 HTML（Spa 由前端路由处理） |

### 4.2 判定分布（机读口径）

| 判定 | 条数 | 占比 |
|---|---|---|
| **采纳** | **19** | 34.5% |
| **修正** | **28** | 50.9% |
| **驳回** | **8** | 14.5% |
| 合计 | **55** | 100% |

**驳回的 8 条（集中登记，便于复核）**：#10 `login` 别名 · #26 `shard/redeem` · #27 `chest/open` · #30 `DELETE /api/order` · #37 `settings/reset` · #45 `admin/prize/create` · #46 `admin/prize/update` · #47 `admin/prize/delete`。

**✅ v0.2 复读**：九项终审**未推翻任何「驳回」** —— `#37` / `#45`–`#47` 被 `C3` **明确确认删除**，`#10` / `#26` / `#27` / `#30` 未入九项裁定 ⇒ **维持本册驳回**。⇒ **判定分布不变**（**采纳 19 / 修正 28 / 驳回 8**，合计 55）。**v0.2 对 §4.1 的改动全部是「在既有判定上追加终审确认/命名定案」，没有一条把判定改档。**

### 4.3 对审计 §5.2 六条要点与 §5.3 缺口清单的表态

| 审计要点 | 本册判定 | 理由 |
|---|---|---|
| §5.2 ① 招工：`task`+`task_progress`+`tasklist` 整体映射为「招工单 + 报名/提交/审核」；`/api/admin/task/*` 下线 | **修正后采纳** | 「整体映射」的**粒度**须改（拆 `job_application`/`job_submission`）；「管理员改为审核方」与 D5 冲突 ⇒ **审核方 = 雇主**（§5-C7）；**✅ v0.2（C7）**：终审确认**雇主审**并**驳回审计的「管理员审」** |
| §5.2 ② 商品：`reward/prize` → 新「商品 + 持有/交付」，**建议改名 `commodity`** | **修正（驳回改名）** | 改名 `commodity` 会与 `ref_type` 白名单（`listing`）冲突，须改已应用迁移 ⇒ 用 `listing`（DL27 / §5-C2）；**✅ v0.2（C2）**：终审确认 `listing` / `listing_order`，**驳回改名 `commodity`** |
| §5.2 ③ 交易所：`shard`/`market_*`/`chest` → 新交易所；`dashJ` 用 `currency.cid` 表达；**关键落差：必须走账本双分录** | **采纳**（`chest` 除外） | 「关键落差」判断**完全正确**，是本次审计最有价值的一条；`chest` 无对应（#27 驳回） |
| §5.2 ④ 返佣：机制已实现、0 路由触达；提案新增 `/api/referral/*` | **采纳** | 补充：`POST /api/referral/bind` **不得**写任何分录（CR19 明令）；`earnings` 只读 `ledger_entry`（DL2） |
| §5.2 ⑤ 旧 `asset` 表整体废弃 | **采纳** | 与 DL1/DL5 一致；补：`GET /api/user/asset/:uID` 的 `upsertAsset` 写副作用**必须一起删**（DL32） |
| §5.2 ⑥ 平台基础/后台：`/health`、`challenge`、`settings*`、`permissions*` 保留但重写 | **修正后采纳** | 「保留但重写」对 `settings/reset` 不成立（#37 驳回）；`permissions*` 须以 `0016` 的新权限模型承载（§9.3） |
| §5.3 缺口：「招工 / 商品 / 交易所 / 返佣 / 账本内核**零 HTTP 入口**」 | **采纳，且是 P3 的立项理由** | 本册 §6 的四柱模型提案正是补这四个缺口；账本内核的**读口**（余额 / 流水）必须**先**于四柱写口开（否则四柱无法自证余额） |

### 4.4 判定纪律（本册规则）

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL34** | **审计提案不得被当作已生效口径**：任何实现若引用 `docs/audit/*` 的 `mapping_proposal` 而**未**核对本册 §4 判定，视为**未对齐本册**。 | brief / code review 硬项 | 审计自述「提案，Zang 终审」（审计 §5 标题）⇒ 中间态不可当口径 | 【本册裁定】 |
| **DL35** | **「驳回」= 路由与语义一并删除**，**不得**保留为「兼容期返回 410」的形态（除 Kevin 明确要求）。若确需过渡，只能用 410 + `{error:{code:'LEDGER_REF_NOT_FOUND'}}` 且**登记过期日**。 | §10 的「删除」列 | 旧站有「已 410」的先例（审计对 #7 的描述）⇒ 本册统一为「删干净」，避免长期僵尸入口 | 【本册裁定】 |
| **DL36** | **后台写路由一律带 `ops:` 幂等键**（R49 前缀表）与**操作人留痕**：`ops:<admin_uid>:<action>:<business_id>`。**无键的后台写请求 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`**。 | §8 / §10 后台组 | 后台是「最容易被顺手写成裸 UPDATE」的地方 | 【已冻结】（R49 + R52③） |
| **DL37** | **凡审计提案里出现「或复用以旧表重命名」的措辞，本册一律取「新建表」分支**：`ALTER TABLE ... RENAME` 会牵动 FK/索引/序列名（`0006` 的教训：改表名**不会**自动改 identity 序列名，`commission.spec` §2.4） | migrations 审查 | 旧表在新库多为**不存在或空壳** ⇒ 重命名纯属无收益风险 | 【本册裁定】（`commission.spec` §2.4 教训） |
| **DL38** | **保留类路由的重写必须换掉数据源**：`/health`、`/api/admin/settings*`、`/api/admin/permissions*`、`/api/user/all`、`/api/user/stats` 的查询层**不得**继续引用旧 `database.ts`（DL17）；重写验收 = 「旧查询函数调用数为 0」。 | code review + `grep` | 40 条 `column_missing` 的真根因是查询层，不换查询层 = 没修 | 【本册裁定】 |
| **DL39** | **`GET /api/home` 的「写副作用」不得复现**：旧 `/api/home` 触达 `asset`/`permission_group` 等 9 张表且其中含写路径（审计 §2-R5 的 `upsertAsset`）；新 `/api/home` 必须是**纯读**（DL23）。 | §10 #18 | 首页是最高频入口 ⇒ 一旦有写副作用，影响面最大 | 【本册裁定】 |
| **DL40** | **审计的 6 条 `table_missing` 路由（#11/#12/#13/#14/#17/#21）在新面的处置 = 全部重写**，**不得**为了「让它 200」而建同名的旧表。 | §10 表 | 这正是「在死路由上叠新功能」的诱因；DL26 已在名字层封死 | 【本册裁定】 |
| **DL41** | **判定必须逐条可机读**：本册 §4.1 的 55 行以「审计的 `routes[]` 顺序与 `source` 行号」为唯一键（与审计 JSON 的 `routes[i]` 一一对应，`i` 从 1 起）。质检脚本可按 `i` 对拍本册判定与审计提案是否一致（**不允许漏项、不允许合并**）。 | 质检脚本 | 防「只回应对自己有利的几条」 | 【本册裁定】 |

## §5 争议项（单列 · **v0.2 已由 Zang 终审 C1–C9**）

> **本节是「单列的争议项」**：它们都是**审计未覆盖**或**审计与本册不一致**、且**本册无权单方面定案**的项。每项给「本册倾向 / 备选 / 影响面 / 阻塞什么」四栏，**实现方在裁定前按「本册倾向」实现，但必须留出可切换点**（DL42）。
> **✅ v0.2：九项已全部裁定**（见下表最右列）。**`C6` 一项推翻了本册倾向**；其余八项采纳或部分收窄。**v0.1 的「本册倾向 / 备选」列全部保留**（`DL134` 的留痕义务），审阅者可对照「改前说什么」。**裁定一经回写，实现方不再有可切换点** —— 按裁定实现（`DL42①` 的「待裁（C#）」标注可撤）。
> ▸ **v0.1 旧写法**：本节标题为「争议项（单列 · **交 Zang 终审**）」，表头 6 列（`# | 争议项 | 本册倾向 | 备选 | 影响面 | 阻塞什么`），**无裁定列**。

| # | 争议项 | v0.1 本册倾向（**留痕，已非现行口径**） | v0.1 备选 | 影响面 / 阻塞什么 | **✅ Zang 终审 v0.2 裁定（逐字回写）** |
|---|---|---|---|---|---|
| **C1** | **业务表与账本事件的原子性**：`ledger_post_event` 是单语句函数、函数内不能写业务表，而 `ledger.spec` §7.2 #6/#7/#8/#9/#11/#12 要求「业务行 + 分录同一事务」 | **新增「业务编排函数」**（DL20：`job_post_event` 等，同一条语句内「锁业务行 → 派生分录 → 调 `ledger_post_event` → 回写引用列」）；**不改** `ledger_post_event` 函数体 | DL21 的「业务行状态机 + 同键重放」（接受可见中间态 + 新增对账判据） | 全部**四柱写路由**的事务形态；`0013`–`0015` 三个包装函数的存废；判据 5 的 SQL 形状。**★ 阻塞 P3 全部写路由** | **✅ 采纳提案 A：新增「业务编排函数」**（`job_post_event` 等；同一条语句内「派生分录 → 调 `ledger_post_event` → 回写引用列」），**不改 `ledger_post_event` 函数体**。**四条硬约束**：① **加锁全序定为「业务行（按主键升序） → `currency`（`cid` 升序） → `account`（`uid` 升序）」，且全部编排函数统一**（防死锁；编排函数**必须**在调 `ledger_post_event` **之前**持有业务行锁；**禁止**「先锁 `account` 再锁业务行」）；② 编排函数**只由迁移创建**，函数体内**禁止**任何 DDL；③ 每次调用**必须**带幂等键并把 `ref_id` 落账本引用列；④ 幂等重放语义**必须**与 `R51`/`R52` 一致（同键同指纹 ⇒ 200 重放，**不**重写业务行）。⇒ **落点 `DL20`（改）/ `DL21`（未采纳）/ `DL141`–`DL144`（新增）** |
| **C2** | **表名与路由参数命名**：审计建议商品改名 `commodity`；本册主张 `listing`（`ref_type` 白名单：`listing` / `listing_order` 已是**已应用约束** `ledger_ref_type_enum` 的取值） | **用 `listing` / `listing_order`**；路由参数 `bID`→`baseCid`、`tID`→`jobId`、`oID`→`orderId`（DL27/DL33） | ① 采纳 `commodity` 并**改 `0001` 的 `ledger_ref_type_enum`**（本册认为**不可接受**：动已应用迁移，DL7）；② 保留旧命名（本册认为**不可接受**：一物多名事故源） | `0014` 表名、`ref_type` 取值、全部商品路由、前端调用面。阻塞 `0014` 的 DDL 与商品路由命名（**不阻塞**招工/交易所/返佣） | **✅ 采纳 `listing` / `listing_order`** + 参数规范名。**定命名风格以消歧**：**URL 路径参数用 camelCase**（`baseCid` / `jobId` / `orderId`），**DB 列名用 snake_case**（`base_cid`）—— 「你 v0.1 里 §4 与 §12.2 两处写法不一，**以此为准**」。⇒ **落点 `DL27`（沿用）/ `DL33`（改口径）/ `DL145`（新增，权威消歧条）** |
| **C3** | **后台 12 条的三处边界**：① `/api/admin/prize/*`（#45–#47）该否保留为「管理员发布商品」；② `/api/admin/settings/reset`（#37）该否保留；③ `/api/admin/points/adjust`（#54）**管理员能否调分** | ① **删除**（管理员不再发布商品/招工）；② **删除**（无审计的批量破坏写）；③ **保留但锁死形态**：只能 `mint`/`burn` `$`（`cid=1`）+ `ops:` 键 + 必须填原因码，且入 P6 审计台 | ① 保留为「平台置顶/官方商品」（属**新语义**，须新表列 `is_official`）；② 保留 + 快照/操作人/原因三件套；③ **完全禁止**管理员调分（则 `#54` 也删除） | 后台 12 条中 **5 条**的去留；`master-plan` §4「`admin/*` 废弃」的边界；平台是否保留「发币/调分」权力。阻塞后台路由的 P6 排期（**不阻塞**四柱） | **✅ ① `/api/admin/prize/*` 删除**；**② `/api/admin/settings/reset` 删除**；**③ `/api/admin/points/adjust`（#54）保留但锁死**：仅 `$`（`cid=1`）、`ops:` 前缀幂等键、**必填原因码**、**必须**经 `ledger_post_event`（`mint`/`burn`）⇒ **禁止**直接 UPDATE `account`；审计台列 **P6**。⇒ **落点 §4.1 #37/#45–#47/#54（追加裁定）/ §10.1 同号 / `DL146`（新增）** |
| **C4** | **401 / 403 鉴权失败的响应码域**：§14.1 的 33 码关闭集里**没有** 401 码；本册认为鉴权失败是 **HTTP 层语义**，不属账本错误码管辖 | 401/403 由路由守卫直接返回，响应体用**非账本域**码 `AUTH_UNAUTHORIZED` / `AUTH_FORBIDDEN`（`{error:{code,message,i18n_key}}`，R107 形状），**不进** `LEDGER_*` 表 | ① 返回不带 `code` 的 401（与 R107 形状不一致）；② 借 `LEDGER_HOLD_NOT_ALLOWED`（403）当通用 403（语义错位） | 全部需登录路由的错误面；前端错误分支；R107 的唯一性契约。阻塞 §11 的 401/403 行定稿 | **✅ 采纳**：401/403 由守卫直接返回**非账本域**码 `AUTH_UNAUTHORIZED` / `AUTH_FORBIDDEN`（**形状照 `R107`**），**不进** `LEDGER_*` 表。⇒ **落点 `DL122`（改，v0.1 的「通用体」改为带 `code`）/ §11.2 的 403 列（`LD016` → `AUTH_FORBIDDEN`）/ §11.3（新增登记表）/ `DL147`** |
| **C5** | **业务状态机非法转移的借码**：33 码里唯一 `409` 的「状态机」码是 `LEDGER_CURRENCY_INVALID_TRANSITION`（其触发条件是**币种**状态机，§3.2 白名单） | **借它**（`409`，`integrity` 桶）+ `details.field='job.status'` + `reason=JOB_STATE_INVALID`（工作项：错误码命名整理） | ① 借 `400 LEDGER_AMOUNT_INVALID` + `reason`（**违反 R105**：状态冲突不应是 400）；② 不借码、由业务层抛 409 裸响应（与 R107 冲突） | 全部业务状态机路由（招工 7 个状态、商品 4 个、挂单 5 个）的错误面。阻塞 §11 的「业务状态机」行定稿；**不阻塞**表设计 | **✅ 采纳借码**：`LEDGER_CURRENCY_INVALID_TRANSITION`（**409**，integrity）+ `details.field='job.status'` + `reason=JOB_STATE_INVALID`；**并登记「码名语义窄化」为已知债**（若将来启用专用码，**必须一次到位**：正向 + 反向映射 + bucket，**不得只加正向**）。⇒ **落点 `DL119`（沿用）/ `DL148`（新增已知债）** |
| **C6** | **「已参与但无该动作权限」的 403 借码**：如买家去调卖家的退款 | **借 `LEDGER_HOLD_NOT_ALLOWED`（403）** + `reason=ACTOR_NOT_ALLOWED`（与 C5 同族：借用范围扩展） | ① 一律用 `404 LEDGER_REF_NOT_FOUND`；② 新码（违反「不新增码」） | 招工/商品/交易所的全部「角色化动作」错误面。同 C5 | **⚠️ 推翻本册倾向**：**不用账本码** —— 改用 **C4 建立的 `AUTH_FORBIDDEN`(403) + `reason=ACTOR_NOT_ALLOWED`**。理由：「已参与但无该动作权限」本质是**授权失败**，不是账本错误；C4 已把鉴权/授权划出账本域，应走**同域**；借 `LEDGER_HOLD_NOT_ALLOWED` 会让账本域被业务授权语义**持续侵蚀**。**C4 与 C6 绑定**：两码同域、同形状、**同一张登记表**。⇒ **落点 `DL111`（改）/ `DL119`（改）/ §11.2 的 403 列 / `DL147`** |
| **C7** | **招工审核方归属**：审计 §5.2 与 §5.1 多处写「管理员由发布方改为**审核方**」；而 **D5 已裁「雇主自审 + 平台仲裁兜底」** | **雇主审**（`POST /api/job/:jobId/review`，D5）；管理员只做**仲裁**（争议单，P6 路由 `/api/admin/arbitration/*`）；`/api/tasklist/*` 归**雇主视角** | 按审计：管理员审（与 D5 冲突，须 Kevin 先改 D5） | 招工结算的触发者、#50–#52 的路由归属、后台权限位（`review_tasks` 的语义）。**★ 阻塞招工柱结算路径** | **✅ 采纳本册倾向：雇主审**（`POST /api/job/:jobId/review`，`D5`）；管理员只做**仲裁**（P6 `/api/admin/arbitration/*`）；**`/api/tasklist/*` 归雇主视角**。**驳回审计的「管理员审」**（那是**推断、无用户原文依据**，而 `D5` 已冻结）。⇒ **落点 §4.1 #50–#52 / §10.1 #50–#52 / `DL106` / `DL115`** |
| **C8** | **业务级幂等键列**：业务表是否要一列 `idempotency_key text UNIQUE`（招工/商品/挂单各一），以在 C1 未裁前先自证「同键不双写业务行」 | **要**：`job` / `listing` / `market_order` 各加 `create_key text NOT NULL UNIQUE`（创建键）+ 状态迁移的 `ledger_event_keys text[]`（DL22②） | 只靠账本侧 `ledger_idem_uniq`（业务行**可能**被同键请求写两次） | `0013`–`0015` 的列清单；业务级幂等的判负用例。阻塞 `0013` 的 DDL 定稿 | **✅ 采纳：要**（`job` / `listing` / `market_order` 各加 `create_key text NOT NULL UNIQUE` + 状态迁移 `ledger_event_keys text[]`）；**`create_key` 口径与 `R51`/`R52` 指纹一致**；**必须**给「同键重放**不追加** `ledger_event_keys` 项」的**判负用例**。⇒ **落点 `DL50`/`DL59`/`DL64`/`DL75`（改）/ `DL144`（④ 已含此项）/ `DL149`（新增判负用例）** |
| **C9** | **K 线（`candle`）用表还是视图**：`master-plan` §6 P5 交付物写 `candle` 表；本册主张视图（聚合自 `market_trade`，避免第二真源） | **视图**（`candle_view`，按 `base_cid/quote_cid` + 时间桶聚合，`market_trade` 为唯一真源） | ① 物化视图（`REFRESH MATERIALIZED VIEW`，需刷新策略与陈旧度口径）；② 落表 `candle`（引入第二真源，须定义「与 `market_trade` 对账」判据） | `0015` 的对象清单；P5 的走势图接口与 AC。阻塞 `0015` 定稿（**不阻塞** P3） | **✅ 采纳视图**（`candle_view` 聚合自 `market_trade`）；**物化视图 / 落表仅在性能实测不达标时再升级**，且**须先开 `DL` 规则**（含**刷新策略 / 陈旧度**）。⇒ **落点 `DL66`（改）/ `DL150`（新增升级条件）** |
| **（附加）** | **`kind` 口径缺口**：`platform_withdraw`（`R103` 悬置）与 `listing_deposit_forfeit` | —（v0.1 已在 `DL82` 登记「不启用」；`§12.2-1/2` 给倾向） | — | 平台出账能力；后台 P6 | **✅ 同意 P3 不启用**；但 **`platform_withdraw` 是产品级问题 ⇒ 登记为「待 Kevin 表态」**（**不得**写「Zang 已裁」）。⇒ **落点 `DL82`（沿用）/ `DL153`（新增登记）** |

### 5.1 争议项处理纪律

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL42** | **争议项在裁定前，实现方按「本册倾向」实现，但必须留可切换点**：① 表名 / 列名 / 路由路径这类**外部可见**命名，一旦选错，回改成本高 ⇒ 提案里**必须**标注「待裁（C#）」；② 被标 ★ 的争议项（C1 / C7）**不得**由实现方自选 —— 必须等裁定。 | brief 里的「待裁清单」段；PR 描述 | 「先按审计做、裁完再改」是最贵的路径（审计的 55 条全是活例） | 【本册裁定】 |
| **DL43** | **争议项一经裁定，必须回写本册**（新增版本 `v0.2`+）并同步 `§4 / §6 / §11` 的受影响格；**不得**只在代码注释里留结论。 | §15 变更记录 | 与 `ledger.spec` 的「留痕、不静默重写」同一纪律 | 【本册裁定】 |
| **DL44** | **裁定若推翻本册倾向，回改必须一次性全量**：受影响规则（含 §4 判定、§10 保留/删除、§11 借码表）**同一版**内改完；**禁止**分批改（会造成「同一规则在第 3 章与第 10 章说法不同」）。 | §15 + 版本号只增不复用 | 歧义事故的历史教训：`ledger.spec` §14.3 的 `cid<=0` 歧义（v0.5 事故） | 【本册裁定】 |
| **DL45** | **争议项的阻塞面必须显式标注**：★ = 阻塞 P3 开工；无 ★ = 不阻塞。**未被 ★ 阻塞的工作不得因争议项停下**（本册已把四柱里只有招工是 ★）。 | §5 表「阻塞什么」列 | 防「一个争议项冻住整条流水线」 | 【本册裁定】 |

**✅ v0.2 对 `DL43` / `DL44` 的履约声明**：九项争议（`C1`–`C9`）**已全部裁定并回写本册**（`DL43` 的「必须回写本册并同步 §4/§6/§11 的受影响格」已在**本版一次完成**，非分批）。受影响的格逐处如下：**§4.1** #11/#13/#14/#32/#33/#37/#45/#46/#47/#50/#51/#52/#54（追加裁定）；**§4.3** §5.2 ①② 两行；**§5** 全表（新增裁定列 + v0.1 留痕）；**§6.2/§6.3/§6.4/§6.7**（`DL50`/`DL59`/`DL64`/`DL66`/`DL75`）；**§8.2**（`DL98`/`DL100`→`DL149`）；**§10.1/§10.2**（同号行 + `DL106`/`DL113`/`DL115`/`DL116`/`DL117`）；**§11.1/§11.2/§11.3**（`DL119`/`DL122`/403 列/新增登记表）；**§12.1/§12.2/§12.3**（`C*` 行改【已裁定】+ 新增待裁项）。**据此，`DL42` 的「待裁（C#）」标注可全部撤除**（实现方不再有可切换点）。

## §6 四柱数据模型提案（新表 + 迁移编号）

> **纪律（写死）**：本节**只提案，不写 SQL 文件**；所有 DDL 形状以「列 / 类型 / 约束 / PK / FK / 索引 / 触发器 / 是否 append-only」表述。**任何一条**要落库，都必须由 Kong 在 `0013+` 里实现并经 Neng 质检；本册不代写迁移。
> 命名与约束风格**对齐 `0001`–`0012`**（`snake_case`；约束 `<table>_<subject>_<kind>`；索引 `idx_<table>_<cols>`；触发器 `trg_<table>_<action>`，`commission.spec` §2.4）。

### 6.1 迁移编号总表（提案）

| 迁移 | 名称（提案） | 内容 | 依赖 | 阶段 |
|---|---|---|---|---|
| **`0013`** | `0013_job.sql` | **✅ 已应用**（`schema_version=0013` / 13/13 `skipped` / `public` 表 9 / `job` **14 列**）= **`job` 单表** + 5 触发器（`DL52` 三条 + `DL75③` + `DL79`）+ **业务编排函数 `job_post_event`**（**C1 已裁 · 采纳提案 A**，四条硬约束 `DL141`–`DL144`）。⚠️ **`job_application` / `job_submission` 顺延至 `0014`**（原 §6.1 把两表写在 `0013` 内，**实交付未含**）。<br>▸ **v0.3 旧写法（本行）**：「`job` / `job_application` / `job_submission` + 状态机守卫 + **业务编排函数 `job_post_event`**」（三表口径；因 `0013` **已应用不得改** ⇒ v0.4 顺延） | `0001`–`0012`（不得改） | **P3**（已应用） |
| **`0014`** | `0014_job_flow.sql` | **`job_application` / `job_submission` + 其守卫（`DL54`–`DL56`）** | `0013`（`job` 表与其通用约定） | **P3** |
| **`0015`** | `0015_listing.sql` | `listing` / `listing_order` + 守卫 + `listing_post_event`（**C2 已裁：表名 `listing`/`listing_order`**；C1 已裁） | `0013` 的通用约定 | P4 |
| **`0016`** | `0016_market.sql` | `market_order` / `market_trade` + 撮合串行化所需对象 + `candle_view`（**C9 已裁：视图**）+ `market_post_event` | `0015` | P5 |
| **`0017`** | `0017_platform_config.sql` | `app_config` / `admin_role` / `admin_permission` / `admin_role_permission` / `currency_status_log`（DL9 的落盘） | `0013`–`0016`（顺序可前可后，见 DL47） | P3/P6 |
| **`0018`** | **（不提案）** | 本册**不提议** `0018`：返佣可见面**不建表**（§6.5），账本侧**不加索引**（DL74） | — | — |

> **⚠️ 本重排为一次性定死；`0013` 之后的编号不得再动**（`DL47`）—— 重排依据 ＝ `0013` **已应用**且实际只含 `job`（`job_application` / `job_submission` 未交付）⇒ **四柱顺延**：`0014_job_flow.sql`（招工二、三表）→ `0015_listing.sql`（商品）→ `0016_market.sql`（交易所）→ `0017_platform_config.sql`（平台配置）→ 原 `0017`（不提案）行 ＝ **`0018`**。**此后编号一律不得再动**（`DL47`「一旦应用，编号不得重排」同精神）。

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL46** | **迁移号从 `0013` 起连续分配**，**一迁一主题**（一迁只做一族表 + 其守卫/索引）；**禁止**把四柱塞进一个迁移（回滚与验收单元会失去边界）。 | **`backend-ts/migrations/0013_…`** … `0016_…`（目录见 DL139） | 与 `0001`–`0012` 的一迁一主题风格一致（`0003` 只改约束、`0006` 只改名） | 【本册裁定】 |
| **DL47** | **迁移顺序可调，但编号顺序 = 应用顺序**（`schema_migration` 是线性链）：`0016`（平台配置）**不依赖**四柱，若 P3 先需要后台设置，可**提前**为 `0013`（即重排编号，四柱顺延）。**一旦应用，编号不得重排**（`0009`/`0010` 的先例：函数体覆盖走新迁移，不插号）。 | Kong 排期时一次性定死 | 编号重排 = 验收基线漂移；`commission.spec` CR73「前六个不得改」同精神 | 【本册裁定】 |
| **DL48** | **每个迁移必须自带幂等（`action = skipped` 可重入）与自检（不通过则整体回滚、不写版本行）**：`0010` 已给出范式（`schema_migration` 有行、重跑 `action = "skipped"`；`0009` 有 `DO` 自检块）。 | 每个新迁移 | 迁移幂等是「无 `down` 迁移」纪律（DL49）的**前提** | 【已冻结】（`0010` / `0009` 先例 + CR73） |
| **DL49** | **不写 `down` 迁移**（CR74）：人工回滚四步；**一旦该迁移表内有账本引用行，只准前滚**。 | migrations 目录 | 与 CR74/§12.3 一致 | 【已冻结】（CR74） |

### 6.2 ① 招工（`0013_job.sql`）

**业务链**：发布（托管）→ 申请 → 雇主选定 → 交付提交 → 雇主审核 → 结算（酬金 + 手续费 + 十级返佣）；旁路：取消 / 拒单 / 流单（退回托管）。

```text
job(          job_id PK, employer_uid FK, worker_uid FK NULL, cid FK currency, reward bigint >0,
              title, description, status, create_key text NOT NULL UNIQUE, escrow_txid FK NULL, settle_txid FK NULL,
              ledger_event_keys text[], time_created, time_updated )
job_application( application_id PK, job_id FK job, worker_uid FK users, status, create_key text NOT NULL UNIQUE,
              time_created, time_updated )
job_submission(  submission_id PK, job_id FK job, worker_uid FK users, deliverable text, review_status,
              reviewed_by FK users NULL, reviewed_at NULL, review_memo, create_key text NOT NULL UNIQUE, time_created )
```

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL50** | **`job` 列契约**：`job_id bigint GENERATED BY DEFAULT AS IDENTITY PK`；`employer_uid bigint NOT NULL REFERENCES users(uid)`；`worker_uid bigint NULL REFERENCES users(uid)`；`cid bigint NOT NULL REFERENCES currency(cid)`；`reward bigint NOT NULL CHECK (reward > 0)`（**酬金**，单位 = `cid` 的最小单位）；`status text NOT NULL DEFAULT 'open'`；`create_key text NOT NULL UNIQUE`；`escrow_txid bigint NULL` / `settle_txid bigint NULL`（**不建 FK 到 `ledger_entry`**：账本表不建 FK 是 R21 的方向，反向引用用 `bigint` + 应用层校验 + 对账）；`ledger_event_keys text[] NOT NULL DEFAULT '{}'`；`time_created` / `time_updated timestamptz NOT NULL DEFAULT now()`。**✅ v0.2（C8）：`create_key` 口径与 `R51`/`R52` 的**指纹**一致**（同一 business 字段集合派生、**不含**金额/派生量/时间戳），且**必须**有「同键重放**不追加** `ledger_event_keys` 项」的**判负用例**（`DL149`）。<br>▸ **v0.1 旧写法**：无「指纹一致」与「判负用例」两项要求（状态列 = 【本册裁定 · 关联 C8】，**待裁**）。 | `0013` | `reward` 是**业务约定额**，**不是余额**（DL3）；`cid` 必填对齐 R28 的「招工酬金计价：仅 `listed`」 | **【已裁定 · Zang 终审 v0.2】**（C8） |
| **DL51** | **`job.status` 状态机（白名单，写死）**：`open → accepted → submitted → settled`；旁路 `open → cancelled`、`accepted|submitted → rejected`（拒单/驳回）、`submitted → disputed → settled|cancelled`（仲裁，P6）。其余转移 ⇒ `409`（**C5 已裁：借 `LEDGER_CURRENCY_INVALID_TRANSITION` + `details.field='job.status'` + `reason=JOB_STATE_INVALID`**，已知债见 `DL148`）。**只有 `settled` 与 `cancelled` 是终态**。**评审方 = 雇主**（C7 已裁）。 | `0013` 的 `trg_job_status_guard`（`BEFORE UPDATE`） | 状态机是「谁能在何时触发结算」的唯一依据；与 C7（审核方 = 雇主）强耦合 | **【已裁定 · Zang 终审 v0.2】**（C5 + C7） |
| **DL52** | **`job` 的守卫触发器（三条，缺一不可）**：① **状态转移白名单**（DL51，违反 ⇒ `23514` + `RAISE ... USING ERRCODE`，映射见 §11）**〔v0.4 加注 · 原文不删（留痕纪律 `DL154`）〕：本处 `23514` = **v0.1 旧写法**；已被 `DL51` 的 C5 裁定取代 ⇒ 实现走 `ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION')` ⇒ `LD011` ⇒ **409** + `details.field='job.status'` + `reason=JOB_STATE_INVALID`；`0013_job.sql` 已按此实现并验收（码名语义窄化的已知债与清偿条件见 `DL148`）**；② **账本引用列一次写定**（`escrow_txid` / `settle_txid`：`OLD IS NULL` 时允许写入，`OLD IS NOT NULL` 后**禁止**改动、禁止清空）；③ **`employer_uid` / `cid` / `reward` 在 `status <> 'open'` 后不可变**（防「托管后改价」）。 | `0013` 三个 `BEFORE UPDATE` 守卫（可合并为一个函数三分支，但**判据必须独立可测**） | ②③ 是「同键改价重发 ⇒ 409」在业务侧的对应物（R50 的故意行为） | 【本册裁定】 |
| **DL53** | **`job` 索引（3 个，全部必建）**：`idx_job_status_time (status, time_created DESC)`（列表页 / 待办）、`idx_job_employer (employer_uid, time_created DESC)`、`idx_job_worker (worker_uid, time_created DESC) WHERE worker_uid IS NOT NULL`。**`create_key` 的唯一约束自带索引，不另建**。 | `0013` | 与 R94/R96 的精神一致（索引数受控）；招工列表是 P3 最高频读 | 【本册裁定】 |
| **DL54** | **`job_application` 列契约**：`application_id PK`；`job_id FK job(job_id)`；`worker_uid FK users(uid)`；`status text DEFAULT 'applied'`（`applied` / `withdrawn` / `rejected` / `accepted`）；`create_key text NOT NULL UNIQUE`；`time_created` / `time_updated`。**`UNIQUE (job_id, worker_uid)`**（一人一单只有一条申请；重复申请 ⇒ 同键重放或 `409`）。 | `0013` | 「同一打工人重复申请」必须有确定行为（幂等 ⇒ 200 重放） | 【本册裁定】 |
| **DL55** | **`job_application` 的守卫**：状态白名单 `applied → accepted | rejected | withdrawn`（其余 ⇒ 拒绝）；**同一 `job_id` 最多一条 `accepted`**（用**部分唯一索引** `UNIQUE (job_id) WHERE status = 'accepted'` 结构性保证）。 | `0013` | 「两个打工人同时被选定」是并发必现缺陷；用索引挡 = DB 层可判负 | 【本册裁定】 |
| **DL56** | **`job_submission` 列契约**：`submission_id PK`；`job_id FK`；`worker_uid FK`；`deliverable text NOT NULL`（P3 只做文本/链接，图片上传属 P4/P7）；`review_status text DEFAULT 'pending'`（`pending` / `approved` / `rejected`）；`reviewed_by bigint NULL FK users(uid)`；`reviewed_at timestamptz NULL`；`review_memo text DEFAULT ''`；`create_key text NOT NULL UNIQUE`；`time_created`。**列级不可变守卫**：`deliverable` / `job_id` / `worker_uid` / `create_key` **永不可改**；`review_*` 三列**只允许从 NULL/pending 一次写定**，之后不可改（对齐「审核结论不可改，要改就新提交 + 冲正」）。 | `0013` | 「改审核结论」= 改历史 ⇒ 与 R73/R76 的 append-only 精神冲突；本册用**列级**守卫在可变表上实现同等强度 | 【本册裁定】 |
| **DL57** | **招工的冻结归属（判据 5 的 SQL 依据，DL4）**：对任意 `(uid, cid)`，`account.frozen` 必须等于 `Σ job.reward WHERE employer_uid = uid AND cid = cid AND status IN ('open','accepted','submitted','disputed')`（＋挂单部分，见 DL68）。**该等式是 P3 必须交付的对账判据**。 | 对账脚本（`ledger.spec` §11.1 #5 的 P3 补全） | 没有它，「钱冻住了但业务单不存在」或反之**无法判负** | 【已冻结】（R36 + §11.1 #5） |
| **DL58** | **招工的账本事件与幂等键**（与 §8 一致）：发布托管 `biz:job:escrow:<job_id>`（`job_escrow` 两条）；取消/拒单退回 `biz:job:refund:<job_id>`（`job_escrow_refund`）；验收结算 `biz:job:settle:<job_id>`（`job_payout` + `job_fee` + `commission`，**与 CR57 逐字一致**）。**`job_id` 必须在托管事件落账后才有值** ⇒ 「发布」这一次调用的键用 `cli:<uuid>`（客户端键，§8.2）。 | `0013` 的 `job_post_event`；L2 的 `job.ts` | 「创建键」与「业务键」是两类键，混用会导致「发布重试 = 结算重放」这类灾难 | 【本册裁定】 |

### 6.3 ② 商品（`0014_listing.sql`）

```text
listing(       listing_id PK, seller_uid FK users, cid FK currency, price bigint >0, stock int >=0,
               title, description, media_urls text[], status, create_key text NOT NULL UNIQUE,
               ledger_event_keys text[] NOT NULL DEFAULT '{}', time_created, time_updated )
listing_order( order_id PK, listing_id FK listing, buyer_uid FK users, seller_uid FK users, cid FK currency,
               price bigint >0, quantity int >0, status, create_key text NOT NULL UNIQUE, pay_txid NULL, refund_txid NULL,
               ledger_event_keys text[], time_created, time_updated )
```

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL59** | **`listing` 列契约**：`listing_id PK`；`seller_uid FK users(uid)`；`cid FK currency(cid)`；`price bigint CHECK (> 0)`；`stock int CHECK (>= 0)`（`0` 表示仅剩 0 件，**不允许 NULL 表示无限**）；`status text`（`draft` / `listed` / `delisted` / `frozen`）；`create_key text NOT NULL UNIQUE`；`media_urls text[] NOT NULL DEFAULT '{}'`。**表名 = `listing`**（DL27 / C2；**C2 已裁确认**，`DL145` 定命名风格）。**✅ v0.2（C8）**：`create_key` 与 `R51`/`R52` 指纹一致。<br>▸ **v0.1 旧写法**：无「已裁确认」与指纹要求（状态列 = 【本册裁定 · 关联 C2】）。 | `0014` | 商品与 `listing_fee`（币种上市费）**同名不同义**：`listing_fee` 是**币种**上市费（kind 关闭集内），商品发布**不收费**（本册裁定；若要收费须新裁定，见 §12） | **【已裁定 · Zang 终审 v0.2】**（C2 + C8） |
| **DL60** | **`listing.status` 状态机**：`draft → listed → {delisted | frozen}`，`frozen → listed`，`delisted` 终态。**库存变更只允许 `listed` 状态**；`stock` 递减必须与 `purchase` 分录**同一事件**（C1 的编排函数内），**禁止**「先减库存再付钱」或反之的分离写。 | `0014` 的 `trg_listing_status_guard` + `listing_post_event` | 超卖是商品柱的头号缺陷；「减库存 + 分录同事件」是唯一解 | 【本册裁定】（P4 AC「并发抢购不超卖」） |
| **DL61** | **`listing_order` 列契约**：`order_id PK`；`listing_id FK`；`buyer_uid FK`；`seller_uid FK`（**冗余存一份**：卖家可能在订单后改价/下架，订单必须自洽）；`cid FK`；`price bigint >0`（**下单时的快照价**）；`quantity int >0`；`status`（`created` / `paid` / `refunded` / `cancelled`）；`pay_txid` / `refund_txid bigint NULL`；`create_key text NOT NULL UNIQUE`。 | `0014` | `price`/`quantity` 是**业务快照**而非余额（DL3 允许）；**禁止**出现「订单余额」列 | 【本册裁定】 |
| **DL62** | **商品退款（`purchase_refund`）的口径**：`refund_txid` 一次写定；**库存回滚策略由 P4 spec 定**（回库 / 不复原），但**必须在此处登记为「未定」**并保证「退款分录与 `status='refunded'` 同事件」。 | `0014` + P4 spec | `ledger.spec` §7.2 #10 已点名「回库或销毁由 P4 spec 定」⇒ 本册不越权 | 【本册裁定 · 登记为 P4 待定】 |
| **DL63** | **商品索引**：`idx_listing_status_time (status, time_created DESC)`、`idx_listing_seller (seller_uid, time_created DESC)`、`idx_listing_order_buyer (buyer_uid, time_created DESC)`、`idx_listing_order_listing (listing_id)`。 | `0014` | 列表 / 我买到的 / 我卖出的 三条读路径 | 【本册裁定】 |

### 6.4 ③ 积分交易所（`0015_market.sql`）

```text
market_order(  order_id PK, owner_uid FK users, side, base_cid FK currency, quote_cid FK currency,
               price bigint >0, amount bigint >0, amount_filled bigint >=0, status, create_key text NOT NULL UNIQUE,
               ledger_event_keys text[] NOT NULL DEFAULT '{}',
               time_created, time_updated )   -- CHECK (amount_filled <= amount)
market_trade( trade_id PK, base_cid FK, quote_cid FK, price bigint >0, amount bigint >0,
               buy_order_id FK market_order, sell_order_id FK market_order, taker_uid FK users,
               fee bigint >=0, time_created )   -- append-only
candle_view(   base_cid, quote_cid, bucket_start, open, high, low, close, volume )  -- 视图，非表
```

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL64** | **`market_order` 列契约与挂单冻结**：`quote_cid` **恒 = 1**（`$` 是交易所基础货币，产品背景柱③）但要**显式存列**（未来多基础货币不必改结构）；买卖两侧的冻结语义：**买单冻结 `quote`**（`(amount − amount_filled) × price`，`kind='hold'`）、**卖单冻结 `base`**（`(amount − amount_filled)`，`kind='hold'`），**两组 hold 分录**（R39：不跨币种）。**✅ v0.2（C8）**：`create_key text NOT NULL UNIQUE` + `ledger_event_keys text[]` 已在上方列清单内**定案**（指纹口径同 `DL50`；`DL149` 判负用例同样适用）。 | `0015` + `market_post_event` | R43 已裁「挂单冻结复用 `hold`」⇒ **不新增 `market_hold` kind** | **【已裁定 · Zang 终审 v0.2】**（C8；R43/R39 部分已冻结） |
| **DL65** | **`market_trade` 是 append-only 表**：`BEFORE UPDATE OR DELETE` 触发器无条件 `RAISE`（对齐 R73 的手段选择；诚实边界同 `commission.spec` §2.2：**拦不住 `TRUNCATE` 与 `DISABLE TRIGGER USER`**，故表述为**护栏**）。成交一旦落表，只能靠 `reversal` 冲正**分录**，**不得**改 `market_trade`。 | `0015` 的 `trg_market_trade_append_only` | 成交价/量是行情与审计的基点，可变即失去可信度 | 【本册裁定】 |
| **DL66** | **K 线用视图（✅ C9 已裁）**：`candle_view` 由 `market_trade` 按 `(base_cid, quote_cid, date_trunc('minute'|'hour', time_created))` 聚合（`open` = 桶内首笔、`high/low` = max/min、`close` = 末笔、`volume` = Σ`amount`）。**不落表**。<br>▸ **v0.1 旧写法**：末句为「**不落表**（C9 的**本册倾向**）」，状态列 = 【本册裁定 · 关联 C9】。 | `0015` 的 `CREATE VIEW` | 视图无陈旧度问题；代价 = 大表聚合压力 ⇒ 上线后按需改物化视图（届时**须**先开 `DL` 规则，见 `DL150`） | **【已裁定 · Zang 终审 v0.2】**（C9 采纳视图） |
| **DL150** | **（v0.2 新增 · C9 升级条件）`candle_view` 从「视图」升级到「物化视图 / 落表」的门槛与手续**：① **仅在性能实测不达标时**才升级（须给 run-tagged 的实测读数，**不得**以「感觉会慢」为由）；② 升级**必须先在本册开一条 `DL` 规则**，且该规则**必须**含 **刷新策略**（触发时机 / 频率 / 由谁触发）与 **陈旧度**（最大可接受滞后）两栏；③ 若落**表**（非物化视图），还**必须**定义「与 `market_trade` 对账」判据（`master-plan` §6 P5 AC 已要求「与 `market_trade` 对得上账」）—— 否则引入第二真源（`DL1`）。 | `0015`；P5 的性能实测脚本 | 「先物化再说」会让第二真源**无规则地**落地；本条把它变成**有门槛、有手续**的升级 | **【已裁定 · Zang 终审 v0.2】**（C9） |
| **DL67** | **单位上市（`draft → listed`）不需要新表**：`currency` 已有 `status` / `listed_at` / `deposit_amount` / `deposit_cid`（`0001`）。上市事务的账务 = `currency_create_fee`（若适用）+ `listing_fee` + `listing_deposit`（**消耗、入 `uid = −1`**，R31）。**下架无账务动作**（保证金不退；**不存在罚没**，v0.3 裁定）。 | `GET /api/currency`、`POST /api/currency`、`POST /api/currency/:cid/list` | `master-plan` §6 P5 的「保证金三态可验」**措辞作废**（张力 #4）；本册按 v0.3 裁定 | 【已冻结】（R31 / §19.8.B） |
| **DL68** | **撮合串行化与冻结归属**：同一 `(base_cid, quote_cid)` 的撮合按 R62 串行化（`pg_advisory_xact_lock(hash(币对))`，**P0 未实测项**，§13-3）；判据 5 的挂单部分 = `Σ (amount − amount_filled) × price WHERE side='buy' AND status IN ('open','partial')`（买单）/ `Σ (amount − amount_filled) WHERE side='sell' ...`（卖单）。 | `0015` + 对账脚本 | 判据 5 的完整形态 = 招工（DL57）+ 挂单（本行） | 【本册裁定】（R62 / R94 之外） |
| **DL69** | **交易所的持仓/转让不建新表**（DL29）：持仓 = `account`；转让/成交 = `ledger_entry`；`GET /api/user/points` 与 `GET /api/user/ledger` 是唯一读口。 | 路由层 | 旧 `shard`/`shard_transfer` 的能力 100% 被覆盖 ⇒ 删除它们不丢能力 | 【本册裁定】 |

### 6.5 ④ 邀请返佣可见面（**不建表**）

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL70** | **返佣可见面不新建任何表**：① 「我的邀请人 / 我的下级」读 `referral`（`child_uid` PK + `idx_referral_parent`）；② 「我的佣金收入」读 `ledger_entry WHERE uid = :me AND kind = 'commission'`（走 `idx_ledger_uid_cid_txid`）；③ 「当前费率/权重」读 `commission_policy` 的 `policy(now())`（CR23）；④ 绑定走 `referral_bind()` / 绑定守卫（CR17/CR18/CR86）。**并明确：不为这些读口新增索引**（DL74）。 | `/api/referral/*` 四个只读口 + `POST /api/referral/bind` | 与 DL2 同源：用户看到的佣金 = 账本真值，**不存在「佣金待发放表」** | 【本册裁定 · 关联 CR14/CR19】 |

### 6.6 平台配置（`0016_platform_config.sql`）

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL71** | **`app_config` 重建（DDL 提案）**：`app_config(key text PRIMARY KEY, value jsonb NOT NULL, updated_by bigint NOT NULL, time_updated timestamptz NOT NULL DEFAULT now())` —— **单列 `key/value`**、**无 `privacy` 列**、**禁存任何余额**（DL3）。⚠️ **费率键不在此表权威**（真源 = `commission_policy.fee_rate_bp`，§5.20 #3）：若历史键存在，**保留但标注「不参与计费」**（不得删键，`commission.spec` §4.4）。 | `0016` | 审计判懒 DDL 建出的 `app_config` 为「列类型不可信」（审计 §2-R4）⇒ **必须重建**而非沿用 | 【本册裁定】（承载 D10/D18） |
| **DL72** | **权限模型重建**：`admin_role(role_key text PK, name text, time_created)`；`admin_permission(permission_key text PK, name text)`；`admin_role_permission(role_key FK, permission_key FK, PK(role_key, permission_key))`；`users.is_admin boolean` 保留为**总开关**，角色分配用 `admin_user_role(uid FK users, role_key FK admin_role, PK(uid, role_key))`。**单一真源**：`can_access_admin = users.is_admin OR ∃ role`（旧 `permission_group` 与 `isAdminAddress` 的**双源**必须收敛）。 | `0016` + `/api/admin/permissions*` | 双源会导致「同一个管理员在两处判定结果不同」；审计 §2-R5 已记录旧实现的静默降级 | 【本册裁定 · 关联 C3】 |
| **DL73** | **`currency_status_log` 必须建**（`0016`）：`log_id PK, cid FK currency, from_status, to_status, actor_uid FK users, memo, time_created`。依据 R29：「币种合规冻结 / 解冻**不产生账务分录**，但**必须**写审计记录」——旧无此表，本册补上。**该表 append-only**（触发器同 `referral_append_only` 的手法）。 | `0016` | 「冻结了某个单位却查不到谁冻的」是合规事故；R29 已要求，缺表即违反 | 【已冻结】（R29） |

### 6.7 不变量与通用规约（适用于全部新表）

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL74** | **索引预算**：`ledger_entry` 的二级索引**已达 6 个上限**（R96）⇒ **M1–M9 与四柱的读口一律复用既有索引**（`idx_ledger_uid_cid_txid` / `idx_ledger_kind_time` / `idx_ledger_ref` / `idx_ledger_event_root_key`）；**禁止**为业务读口新增 `ledger_entry` 索引。业务表索引按 §6 各表的清单执行，**新增须说明「为何现有索引不能覆盖」**。 | migrations 审查 | 「账本表要被四柱查询压垮」是本项目最现实的性能风险；解法是**读口设计**（按 `(uid,cid,txid)` 与 `(kind,time)` 两个轴），不是加索引 | 【已冻结】（R96） |
| **DL75** | **每张业务表必须有三件套**：① `create_key text NOT NULL UNIQUE`（创建幂等，**C8 已裁：要**，口径与 `R51`/`R52` **指纹**一致）；② `ledger_event_keys text[] NOT NULL DEFAULT '{}'`（已落账事件键，DL22②）；③ `time_created` / `time_updated`（`time_updated` 由 `BEFORE UPDATE` 触发器统一刷新，**不接受客户端传时间**，R5）。**✅ v0.2（C8）**：三件套从「本册倾向」升为**裁定后的必建项**，并**必须**配「同键重放不追加 `ledger_event_keys` 项」的**判负用例**（`DL149`）。**✅ v0.3（M1）**：全文 `create_key` 约束**统一为 `text NOT NULL UNIQUE`**（对齐 `ledger.spec` **R109④**）；v0.2 曾并存三种写法（§6 清单 `create_key UNIQUE` / `DL64` 的 `text UNIQUE` / 本条与 `DL50` 的 `text NOT NULL UNIQUE`），现**只剩一种可执行口径**。<br>▸ **v0.1 旧写法**：① 标注「创建幂等，**C8**」但 C8 **未裁**（属待裁）；无判负用例要求。 | 全部新表 | 三件套是「业务行可自证、可对账、可重放」的最小集 | **【已裁定 · Zang 终审 v0.2】**（C8） |
| **DL76** | **可变 vs 不可变的选择口径（写死）**：**不可变（append-only 触发器）** = `ledger_entry` / `referral` / `commission_policy` / `market_trade` / `currency_status_log`；**可变（状态机守卫触发器）** = `job` / `job_application` / `job_submission`（列级不可变）/ `listing` / `listing_order` / `market_order`。**禁止**给可变表加「全表 append-only」触发器（那会让状态机无法工作）。 | 各迁移的触发器清单 | 对齐 `ledger.spec` R73（铁律只覆盖账本流水）与 `commission.spec` CR8（两张 P2 表） | 【本册裁定】（R73 / CR8） |
| **DL77** | **每个业务状态机必须有「判负用例」**：人为构造非法转移，断言 **DB 层拒绝**（`23514` 或自定义 SQLSTATE）+ **API 层返回 §11 的借码**。**没有判负用例的绿色状态机用例不算通过**（对齐 R93 / CR79）。 | 质检脚本（run-tagged 落盘） | 状态机是「谁能动钱」的开关，必须可判负 | 【已冻结】（R93 / CR79 的同口径扩展） |
| **DL78** | **新表的 uid 列一律 FK 到 `users(uid)`**（DL13）；**账本引用列（`*_txid`）一律不建 FK**（R21 方向）。**禁止**把 `uid` 建成 `text`（旧库的类型分叉已由 `0002` 消除，不得复活）。 | 各迁移 DDL | 脏 uid 由 FK 挡；txid 由对账巡检查（`ledger_ref_pair` 反查） | 【已冻结】（R21 / `0002`） |
| **DL79** | **`DELETE` 一律不出现在业务表**：业务行的终结 = **状态位**（`cancelled` / `delisted` / `filled`），**不得**物理删除（对齐 R75 的「关户用状态不用删行」精神）。`DELETE FROM job/listing/...` 由守卫触发器拒绝。 | 各迁移 | 物理删除会让「已落账的 `ref_id` 指向不存在的行」（`LEDGER_REF_NOT_FOUND` 的反面） | 【本册裁定】 |
| **DL80** | **新表一律 `snake_case` 无引号、无前缀、非保留字**（`commission.spec` §2.4 的 0006 教训）：**禁止**使用 `user` / `order` / `trade`（PG 保留字或易撞）作**裸**表名 —— 本册的表名（`job` / `listing` / `listing_order` / `market_order` / `market_trade` / `admin_role` …）已避开；**`order` 只作为后缀出现**。 | 命名审查 | `user` 保留字陷阱已实测（`SELECT count(*) FROM user` 静默返回 1） | 【本册裁定】（硬 1 + §2.4） |

## §7 业务动作 → `kind` 全量映射 + 扩展请求

> **母约束**：`kind` 是 **20 个关闭集**（R40），取值 = `burn, commission, currency_create_fee, hold, hold_forfeit, hold_release, job_escrow, job_escrow_refund, job_fee, job_payout, listing_deposit, listing_fee, mint, purchase, purchase_refund, reversal, sale, trade, trade_fee, transfer`。**本册不新增任何 kind**（扩展请求见 §7.2）。

### 7.1 业务动作 → `kind` 映射（四柱 + 平台动作，逐动作）

| 柱 | 业务动作 | `kind`（按分录顺序） | `ref_type` / `ref_id` | 幂等键 | 净增发 |
|---|---|---|---|---|---|
| ①招工 | 发布招工（雇主托管酬金） | `job_escrow` ×2（雇主 `balance −n` / 雇主 `frozen +n`） | `job` / `job_id` | `biz:job:escrow:<job_id>` | 0 |
| ①招工 | 取消 / 拒单 / 流单（退回托管） | `job_escrow_refund` ×2（雇主 `frozen −n` / `balance +n`） | `job` / `job_id` | `biz:job:refund:<job_id>` | 0 |
| ①招工 | 申请接单 / 选定打工人 / 提交交付 | **无分录**（纯业务动作） | — | `biz:job:apply:<job_id>:<worker_uid>` / `biz:job:accept:<job_id>` / `biz:job:submit:<job_id>` | — |
| ①招工 | **验收结算**（雇主 approve） | `job_payout` ×2（雇主 `frozen −net` / 打工人 `balance +net`）→ `job_fee` ×2（雇主 `frozen −fee` / `uid −2` `+fee`）→ `commission` ×2×N（`−2` 出 / 各层受益人入） | `job`（`job_payout`/`job_fee`）、`commission_payout`（`commission`），`ref_id` = 同一 `job_id` | `biz:job:settle:<job_id>`（**逐字对齐 CR57**；派生键 `K#i` 由 DB 派生） | 0 |
| ①招工 | 无邀请人的结算 | 同上，但 `job_fee` 增方 = **`uid −1`**（平台收入） | 同上 | 同上 | 0 |
| ①招工 | 零额手续费（`fee = 0`） | 只有 `job_payout` ×2（**不写 `job_fee`、不触发 `commission`**，R44） | `job` | 同上 | 0 |
| ①招工 | 仲裁强制退单（P6） | `job_escrow_refund` ×2；**若要罚没** ⇒ `hold_forfeit`（需新裁定，§7.2） | `job` | `ops:<admin_uid>:job_arbitrate:<job_id>` | 0 |
| ②商品 | 发布 / 编辑 / 下架商品 | **无分录**（商品发布不收费，DL59） | — | `cli:<uuid>`（创建）/ `biz:listing:<op>:<listing_id>` | — |
| ②商品 | 购买 | `purchase` ×1（买家 `balance −n`）+ `sale` ×1（卖家 `balance +n`） | `listing_order` / `order_id` | `biz:listing:buy:<order_id>` | 0 |
| ②商品 | 退款 | `purchase_refund` ×2（卖家 `balance −n` / 买家 `balance +n`） | `listing_order` / `order_id` | `biz:listing:refund:<order_id>` | 0 |
| ③交易所 | 创建自建单位（`draft`） | `currency_create_fee` ×2（创建者 `balance −f` / `uid −1` `+f`）〔若收此项费用〕 | `currency` / `cid` | `biz:currency:create:<symbol>` | 0 |
| ③交易所 | 单位上市（`draft → listed`） | `listing_fee` ×2 + **`listing_deposit` ×2（消耗、入 `uid −1`，不退）** | `currency` / `cid` | `biz:currency:list:<cid>` | 0 |
| ③交易所 | 单位下架 / 合规冻结（R29） | **无分录**（保证金不退、无罚没）；**必须**写 `currency_status_log` | `currency` / `cid` | `ops:<admin_uid>:currency_status:<cid>:<to_status>` | 0 |
| ③交易所 | 挂单（买单冻结 `quote` / 卖单冻结 `base`） | `hold` ×2（**买/卖各一组**，同一 `cid` 内不跨币种，R39） | `market_order` / `order_id` | `cli:<uuid>`（创建）/ `biz:market:cancel:<order_id>` | 0 |
| ③交易所 | 撤单（全量或部分） | `hold_release` ×2 | `market_order` / `order_id` | `biz:market:cancel:<order_id>` | 0 |
| ③交易所 | 撮合成交 | `trade` **×4**（买方 `−quote`/`+base`，卖方 `−base`/`+quote`）+ `trade_fee` **×2**（taker `balance −f` / `uid −1` `+f`，R47） | `market_trade` / `trade_id` | `biz:market:trade:<taker_order_id>:<fill_no>` | 0 |
| ④返佣 | 邀请绑定 | **无分录**（CR19 明令禁止为绑定造分录） | — | `cli:<uuid>`（幂等靠 `referral_pk`） | — |
| ④返佣 | 佣金发放 | `commission`（**只在结算事件内**，R4：其他场景不得出现） | `commission_payout` / `job_id` | `cm:<job_fee_key>:<level>:<beneficiary_uid>` | 0 |
| ④返佣 | 后台写佣金政策 | **无分录**（INSERT-only 插行，CR8/CR23） | — | `ops:<admin_uid>:commission_policy:<effective_from>` | — |
| 平台 | 管理员调分（`#54`，形态见 C3） | `mint` ×1（`$`：系统 → 目标用户 `balance +n`） | `currency` / `cid` | `ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq>` | **`+n`** |
| 平台 | 管理员扣分 / 销毁 | `burn` ×1（本人 `balance −n`；`$` 由平台发起，R25） | `currency` / `cid` | `ops:<admin_uid>:points_burn:<target_uid>:<cid>:<seq>` | **`−n`** |
| 平台 | 账务纠错 | `reversal`（逐列取反，`reversal_of_txid` 必填） | 同原分录 | `ops:<admin_uid>:reversal:<txid>` | 仅冲正 mint/burn 时非 0 |
| 平台 | 用户间普通转账（转账收款等） | `transfer` ×2 | `system` | `biz:transfer:<uid>:<nonce>` / `cli:<uuid>` | 0 |
| 平台 | 罚没（仅争议场景，**未启用**） | `hold_forfeit` ×2（本人 → `uid −3`） | `job` / `job_id` | `ops:<admin_uid>:forfeit:<job_id>` | 0 |

### 7.2 `kind` 扩展请求（**单列**）

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL81** | **本册请求的 `kind` 扩展 = 0 个。** 四柱（招工 / 商品 / 交易所 / 返佣可见面）与后台动作的**每一个**金额变动动作，都已落在既有 **20 个 kind** 之内（逐动作见 §7.1）。⇒ **不得**因为「语义看起来更贴切」而新增 kind（R40：新增/删除 kind 必须走 migration 改 `ledger_kind_enum` **并**同步 `ledger.spec` §5.1 的减方/增方/净增发三列，两者缺一不可）。 | 实现方；`0003` 是先例（删除 kind 的手段 = 约束替换） | 关闭集是「可审计」与「前端账单文案」的稳定契约 | 【已冻结】（R40） |
| **DL82** | **明确「不启用」的两项**（登记，不请求）：① **`platform_withdraw`（平台收入提取）** —— R103/§15 #3 已裁定「在 Kevin 批准前 `−1` 只进不出」⇒ **P3 不得出现提取按钮**；② **`listing_deposit_forfeit`（强制下架罚款）** —— 已于 v0.3（P1c）删除；「强制下架罚款」是**新语义新 kind**，须单独裁定（`ledger.spec` §5.1 #21 / §19.8.B）。⇒ 本册**不请求**这两项，且**登记为口径缺口**（§12 待裁决）。 | 后台 P6；`ledger.spec` §15 #3 | 这两项都涉及「平台出账」，是**资金口径**而非实现细节 ⇒ 必须 Kevin/Zang 拍板 | 【已冻结】（R103 / §19.8.B） |
| **DL83** | **每个 `kind` 的 `ref_type` 必须登记且落在白名单**（R18）：`kind` 与 `ref_type` 的组合见 §7.1；**禁止**出现「`ref_type` 为空但有 `ref_id`」（`REF_PAIR_MISMATCH`）或把业务单号塞进 `memo`（R18 明令）。 | 事件构造函数 | `memo` **不参与任何逻辑判断**（R19）；「相关流水」查询靠 `idx_ledger_ref` | 【已冻结】（R18/R19） |
| **DL84** | **招工结算事件的 kind 白名单**（对齐 `commission.spec` §5.2）：本事件**只允许** `job_payout` / `job_fee` / `commission`；其余 17 个 kind **不得**出现在同一事件里。**托管事件的 kind 白名单** = `job_escrow`；**退款事件** = `job_escrow_refund`。 | `job_post_event`（C1 提案） | 「一个事件一种账务语义」是可审计的前提 | 【已冻结】（`commission.spec` §5.2/CR31） |
| **DL85** | **商品/交易所事件的 kind 白名单**（本册新增，与 DL84 同口径）：商品购买 = `purchase` + `sale`（**恰好两条**）；退款 = `purchase_refund`（**恰好两条**）；挂单 = `hold` 族；成交 = `trade`（**4 条**）+ `trade_fee`（**2 条**）。**超范围即拒绝**（`LEDGER_UNKNOWN_KIND` 不适用时用事件级组装断言 ⇒ `500` 缺陷类，`COMMISSION_SPLIT_SUM_MISMATCH` 同族）。 | 三个编排函数 | 事件级的显式白名单是「不串味」的保证（招工手续费的 `job_fee` 不会跑到商品事件里） | 【本册裁定】 |
| **DL86** | **`job_fee` 的增方分支**：有可付祖先（`chain_depth ≥ 1`）⇒ `uid −2`（佣金池）；**无邀请人** ⇒ `uid −1`（平台收入，裁定 #11）；`−1` 接纳 `job_fee` 的白名单由 `0008` 扩展。⇒ 编排函数**必须**按链深分两个形态，**不得**统一写 `−2`。 | `job_post_event` + `0008` 既有行为 | 判据 M3-C 的机读依据 | 【已冻结】（裁定 #11 / CR84 / CR85 / `0008`） |
| **DL87** | **`trade_fee` 承担方 = taker**（R47）；**计价与扣除币种恒为 `$`**（`cid = 1`）；**手续费是消耗不是冻结** ⇒ 撤单不退（D7）。 | 撮合服务 | 平台收入的组成口径（判据 7） | 【已冻结】（R47 / D7） |
| **DL88** | **`listing_deposit` 的语义**：**上市即消耗**（`balance → uid −1`），**不可退、无罚没、无退还 kind**（R31 / v0.3）。⇒ 交易所路由**不得**提供「退还保证金」按钮或接口。 | `POST /api/currency/:cid/list` | `master-plan` §6 P5 的「三态」措辞作废（张力 #4） | 【已冻结】（R31 / §19.8.B） |
| **DL89** | **`mint` / `burn` 的使用边界**：`mint` 只允许 ①平台铸 `$`（`owner_uid = 0`，R23）②自建单位 owner 铸**到自己账户**（不得铸给他人，R23）；`burn` 只允许持有人本人（`$` 由平台发起，R25）。**四柱的日常业务动作不得用 `mint`/`burn`**（商品购买不是 mint、招工结算是 `job_payout` 不是 mint）。 | 编排函数 + 后台调分 | 「凭空造币」最容易被写成「mint 一把」；本册把边界写死 | 【已冻结】（R23/R25） |
| **DL90** | **`hold` / `hold_release` 的复用边界**（R43）：交易所挂单复用 `hold`（`ref_type='market_order'`）；**招工托管例外**用 `job_escrow` 专用 kind；商品**不使用** hold（商品无「先冻结再交付」语义，付款即交付）。**禁止**新增 `market_hold` / `product_hold` 之类的 kind（R43 已裁）。 | 三个编排函数 | 冻结原因靠 `ref_type` 读取（R43 的已知代价，前端账单文案需 join 业务表） | 【已冻结】（R43） |
| **DL91** | **`hold_forfeit` 在 P3 **不启用**：罚没的标的物是**在冻资金**，而 P3 招工争议路径（C7）只做「退回托管」（`job_escrow_refund`）。若 Zang 裁定要「违约罚没」，须同时给：罚没比例、去向（`−3`）、申诉与退还路径（R38 要求可退还）⇒ 本册**登记为待裁决**（§12），**不预先启用**。 | 招工争议路径（P6） | R38 要求 `−3` 有「罚没记录 + 退还」入口，P3 无此入口 ⇒ 启用即产生无法退还的钱 | 【本册裁定 · 登记待裁】 |
| **DL92** | **`transfer` 在业务柱的可见面**：用户间转账**不是**四柱的核心动作，但产品背景里 `$` 是交易媒介 ⇒ `transfer` 保留为**通用能力**（键 `biz:transfer:<id>` / `cli:<uuid>`，`ref_type='system'`）；**禁止**用 `transfer` 替代 `purchase`/`sale`/`trade`（那会让「成交额」类统计失效）。 | L2 的 `transfer.ts`；账单页 | R101：仅 `uid −3` 允许以 `transfer` 出账（平台侧） | 【本册裁定】（R101 边界不变） |

## §8 幂等键约定

> **上位册依据**：`ledger.spec` §6（R48–R54）、§6.2 v0.4/v0.10/v0.11 就地落位块、`commission.spec` §5.5 / §10 / CR57 / CR87。**本节不新增协议**，只把四柱的键表与「创建类 / 业务类」的分野写死。

### 8.1 键的四类前缀（沿用 R49，不新增前缀）

| 前缀 | 谁生成 | 用途 | 本册在四柱的用法 |
|---|---|---|---|
| `biz:` | 后端服务层**确定性派生** | 有业务 id 的状态迁移与账务事件 | 招工 escrow/refund/settle/apply/accept/submit；商品 buy/refund；交易所 cancel/trade |
| `cli:` | **前端生成 UUID v4**，经 `Idempotency-Key` 头传入 | **创建类**动作（此刻业务 id 尚未存在） | 发布招工、发布商品、挂单、创建单位、邀请绑定 |
| `cm:` | 分佣器派生 | 分佣 | 由 DB/组装器派生（`cm:<job_fee_key>:<level>:<beneficiary>`），**路由层不得自造** |
| `ops:` | 后台操作 | 运维写 | 后台设置 / 权限 / 调分 / 冲正 / 仲裁 / 币种状态 |

### 8.2 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL93** | **键前缀强制 + 字符集闸（逐字沿用 R49 v0.4 块）**：必须匹配 `^(biz|cm|cli|ops):`；**禁 `#`**（`RESERVED_SEPARATOR`，它是内部派生键 `<key>#<i>` 的分隔符）、**禁控制字符**（含 DEL）；校验顺序固定 `TOO_LONG → PREFIX_REQUIRED → RESERVED_SEPARATOR → CONTROL_CHARACTER`；违规 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_INVALID` + `details.reason`。**该闸作用于每一个 `idempotency_key` 位置**。 | L1/L2 的键构造函数（`normalizeIdempotencyKey` 既有实现即此口径） | 键域与派生键域的**互斥**是 `#` 禁令的全部意义（R51 的 F1 修复） | 【已冻结】（R49 v0.4 块） |
| **DL94** | **创建类用 `cli:`，业务类用 `biz:`，两者不得混用**：① **创建类** = 本次调用**产出**业务主键（`job_id` / `listing_id` / `market_order.order_id` / `cid`）⇒ 只能用 `cli:<uuid-v4>`（客户端键）；② **业务类** = 主键已存在 ⇒ 必须用 `biz:<domain>:<op>:<业务id>` 派生；③ **禁止**用 `cli:` 键去重一个已存在业务 id 的状态迁移（那等于「让客户端决定服务端事实」）。 | 键表（§8.3）；L2 各域服务 | 混用会产生「发布重试 = 结算重放」这类**跨语义重放**（§6 的 DL58 已点出） | 【本册裁定】 |
| **DL95** | **键只能由不可变业务标识派生**（R50）：允许 = 业务单 id、`uid`、`kind`、层级、序号；**禁止** = 金额（`reward` / `price` / `amount` / `gross` / `fee` / `net`）、政策版本、时间戳、任何状态位。⇒ 「同单改价重发」是**同键异指纹 ⇒ 409**（R50 的**故意行为**），**不是**双扣。 | 键构造函数；code review 硬项 | 把金额拼进键是「重复结算」最常见的自伤方式（CR28 同口径） | 【已冻结】（R50 / CR28） |
| **DL96** | **路由层必须强制传 `request_fingerprint`**（R52 已裁：传指纹是**路由层的强制项**，不是服务层的判断项）；**指纹范围 = business 字段集合、不含任何派生量**（CR87，Zang v0.10/v0.3 裁定）：招工 = `job_id` / `employer` / `worker` / `cid` / `gross`；商品 = `order_id` / `buyer` / `seller` / `cid` / `price` / `quantity`；交易所 = `order_id` / `owner` / `side` / `base_cid` / `quote_cid` / `price` / `amount`。**派生量（`fee` / `net` / `x_L` / `W` / `M` / 派生键 / 政策字段）一律不进指纹。** | `fingerprintRequest()` 中间件（R53） | 政策改版后同键重算 ⇒ **走重放**（不 409、不双发）是**正确行为**，不是缺陷（DL43 的登记义务同样适用于此） | 【已冻结】（R52 / R53 / CR87） |
| **DL97** | **写路由必带键、读路由不带键**（R52③）：任何写方法缺键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`；读方法**不得**要求键（读了键也不得触发幂等分支）。**键的传输位置 = `Idempotency-Key` 请求头**（与 R53 的「剔除 `Idempotency-Key`」纪律一致）。 | 路由中间件：写方法统一挂「键必需」守卫 | 旧面 26 条写路由**没有一条**带键（审计未测写方法，但静态可判）⇒ P3 的新写路由必须**从第一条起**就带 | 【已冻结】（R52③ / R53） |
| **DL98** | **重放语义与前端处理**：同键同指纹 ⇒ `200 { idempotent_replay: true, txid, ...账上结果 }`（保证项 = `idempotent_replay` + `txid` + 账上结果，R52 v0.11 块）；同键异指纹 ⇒ `409 LEDGER_IDEMPOTENCY_CONFLICT`（不执行、不改数据）；**前端必须把重放当成功**（R106），**不得**弹「重复提交」。**✅ v0.2（C1 硬约束 ④）**：业务编排函数的重放语义**必须**与本条**逐字一致**（`DL144`），且**额外**要求「重放**不**重写业务行、**不**追加 `ledger_event_keys` 项」（判负用例 = `DL149`）。 | 响应包装层 + 前端 | `extra` 是**诊断字段、非契约**（重放 `{}` 合规）⇒ **禁止**据 `extra` 判成败 | 【已冻结】（R52 v0.11 / R106）；v0.2 经 `DL144` 加严 |
| **DL99** | **不得为「无分录的写」造账本事件占位**：邀请绑定（CR19）、商品发布、纯状态迁移**都不得**写一条 `ledger_entry` 来「借账本的幂等」（那会污染判据 1/3/8）。它们的幂等靠**业务侧**：`referral_pk`（CR19）/ `create_key text NOT NULL UNIQUE`（DL75）/ 业务状态机。 | L2 各域服务 | 「反正账本有幂等」是本场景最容易被诱发的偷懒（CR19 已明令禁止一次） | 【已冻结】（CR19 + DL75） |
| **DL100** | **键的落盘自证**：每个业务事件完成后，把该事件的**根键**写进业务行的 `ledger_event_keys`（DL75②）；对账脚本据此断言「业务行声明的键 = `ledger_entry` 里真实存在的 `event_root_key`」。**该断言是 P3 的判据之一**（防「业务行说结算了、账本没有」）。 | 对账脚本（run-tagged） | 这条把 DL22② 的列变成**可判负**的资产，而不是装饰 | 【本册裁定】 |
| **DL149** | **（v0.2 新增 · C8 判负用例，**必交**）「同键重放**不追加** `ledger_event_keys` 项」必须有一个**判负用例**。** 用例形态（写死三项断言）：① 以同一幂等键 + 同一指纹**第二次**调用同一编排函数；② 断言响应 `idempotent_replay = true` 且 `txid` 与首次**相同**；③ **断言业务行的 `ledger_event_keys` 数组长度与内容与首次调用后**逐字相等**（`array_length` 不变、无新元素）、`status`/`*_txid` 列**未被写第二次**、`ledger_entry` 新增行数 = **0**。**该用例缺一不可交付**（与 `DL77` 的状态机判负用例同族、与 `DL121` 的逃逸扫描同纪律：**run-tagged、永不写固定文件名**）。 | 质检脚本（`0013`–`0016` 各附一条）；PR 验收硬项 | C8 的裁定**逐字**要求「必须给『同键重放不追加 `ledger_event_keys` 项』的判负用例」⇒ 本条把它落成**可执行的验收项**；没有它，`DL22③`/`DL144①` 只是口头承诺 | **【已裁定 · Zang 终审 v0.2】**（C8） |

### 8.3 写路由 → 幂等键全表（逐路由）

| 路由（提案） | 键形态 | 类别 | 指纹 business 字段 | 备注 |
|---|---|---|---|---|
| `POST /api/job`（发布招工） | `cli:<uuid-v4>` | 创建 | `employer` / `cid` / `reward` / `title` | 产出 `job_id`；随后**同一请求内**发托管事件（键 `biz:job:escrow:<job_id>`，§8.4） |
| `POST /api/job/:jobId/apply` | `biz:job:apply:<job_id>:<worker_uid>` | 业务 | `job_id` / `worker_uid` | 无分录（DL99） |
| `POST /api/job/:jobId/accept` | `biz:job:accept:<job_id>` | 业务 | `job_id` / `worker_uid` | 选定打工人；`job_application` 的部分唯一索引兜底（DL55） |
| `POST /api/job/:jobId/submit` | `biz:job:submit:<job_id>` | 业务 | `job_id` / `worker_uid` / `deliverable` | 无分录 |
| `POST /api/job/:jobId/review`（approve） | `biz:job:settle:<job_id>` | 业务+账务 | `job_id` / `employer` / `worker` / `cid` / `gross` | **与 CR57 逐字一致**；`reject` 走 `biz:job:refund:<job_id>` |
| `POST /api/job/:jobId/cancel` | `biz:job:refund:<job_id>` | 业务+账务 | `job_id` | `job_escrow_refund` |
| `POST /api/listing` | `cli:<uuid-v4>` | 创建 | `seller` / `cid` / `price` / `stock` | 无分录 |
| `POST /api/listing/:listingId/buy` | `biz:listing:buy:<order_id>` | 业务+账务 | `order_id` / `buyer` / `seller` / `cid` / `price` / `quantity` | `purchase` + `sale` |
| `POST /api/listing/order/:orderId/refund` | `biz:listing:refund:<order_id>` | 业务+账务 | `order_id` / `buyer` / `seller` / `cid` / `price` / `quantity` | `purchase_refund` |
| `POST /api/market/order` | `cli:<uuid-v4>` | 创建+账务（`hold`） | `owner` / `side` / `base_cid` / `quote_cid` / `price` / `amount` | 产出 `order_id`；冻结与建立挂单同事件 |
| `DELETE /api/market/order/:orderId` | `biz:market:cancel:<order_id>` | 业务+账务（`hold_release`） | `order_id` | 锁行后复查 `status`/`amount_filled`（R84） |
| `POST /api/currency` | `biz:currency:create:<symbol>` | 创建+账务 | `owner` / `symbol` / `decimals` / `supply_cap` | `symbol` 是**不可变标识**（R7）⇒ 可作为派生输入 |
| `POST /api/currency/:cid/list` | `biz:currency:list:<cid>` | 业务+账务 | `cid` / `deposit_amount` | `listing_fee` + `listing_deposit` |
| `POST /api/referral/bind` | `cli:<uuid-v4>` | 创建（无分录） | `child_uid` / `parent_uid` | 幂等靠 `referral_pk`（CR19） |
| `POST /api/admin/settings` | `ops:<admin_uid>:setting:<key>` | 运维写（无分录） | `key` / `value` | 后台写一律 `ops:`（DL36） |
| `POST /api/admin/permissions/save` | `ops:<admin_uid>:permission_save:<role_key>` | 运维写（无分录） | `role_key` / `permissions` | — |
| `POST /api/admin/permissions/delete` | `ops:<admin_uid>:permission_delete:<role_key>` | 运维写（无分录） | `role_key` | — |
| `POST /api/admin/user/update` | `ops:<admin_uid>:user_update:<target_uid>` | 运维写（无分录） | `target_uid` / `is_admin` / `role_key` | 入参白名单见 DL104 |
| `POST /api/admin/points/adjust` | `ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq>` | 运维写（`mint`/`burn`） | `target_uid` / `cid` / `amount` / `reason_code` | ⚠️ 是否允许见 **C3** |
| `POST /api/admin/commission_policy` | `ops:<admin_uid>:commission_policy:<effective_from>` | 运维写（无分录） | `effective_from` / `fee_rate_bp` / `levels` / `weights_bp` | 政策**插行不 UPDATE**（CR8/CR23）；`effective_from` 严格递增（CR25，禁止回填） |
| `POST /api/admin/currency/:cid/status` | `ops:<admin_uid>:currency_status:<cid>:<to_status>` | 运维写（无分录） | `cid` / `to_status` | 必须写 `currency_status_log`（DL73） |
| `POST /api/admin/reversal` | `ops:<admin_uid>:reversal:<txid>` | 运维写（`reversal`） | `txid` / `reason_code` | 一条分录最多被冲正一次（R20）；冲正自身不得再被冲正 |

### 8.4 「一次请求 = 一个还是两个事件」的口径

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL101** | **一次 HTTP 请求最多只产生一个账本事件**；**禁止**在同一请求内串联两个账本事件（如「先建单托管、再顺手结算」）。例外：**创建类**请求允许「先建业务行（`cli:` 键）→ 同请求内落一个账务事件（`biz:` 键派生自新 id）」—— 这仍是**一个**账本事件，只是两个键（创建键 / 账务键）。 | L2 域服务；`POST /api/job`、`POST /api/market/order`、`POST /api/currency` 三处 | 一个请求两个账本事件 = 一次网络抖动下的**半成品**（上半已落账、下半未落） | 【本册裁定】 |
| **DL102** | **创建类请求的两次写（业务行 + 账务事件）必须由同一条语句完成**（C1 的编排函数）；若 C1 被否，则**必须**按 DL21 的两阶段 + 对账判据收敛，**不得**「业务行写成功、账务事件失败后静默返回 200」。 | `job_post_event` / `listing_post_event` / `market_post_event` | 与 DL20/DL21 同一件事的两面 | 【本册裁定 · 关联 C1】 |

## §9 鉴权与身份

> 现状（起草时 `git log -1` = `dbccd89`；**交付时 HEAD = `fab9d32`** —— 见 §16/DL136）取自 `backend-ts/src/index.ts:82–160` 与 `backend-ts/src/auth.ts` 的**只读**阅读。

### 9.1 `requireActor` / `requireAdmin` 的语义（含一处**必须修**的缺陷）

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL103** | **`requireActor(req,res)` 语义（保留，语义写死）**：① 读 `Authorization: Bearer <token>`；② `verifySessionToken(token)` 得 `{uID, evm}`；③ 按 **`uid`**（`users.uid`）查用户，查不到再按 `evm` 兜底；④ 仍无 ⇒ `401`；⑤ 得 `ActorContext = { session, user, adminAccess }`。**新面必须用新的列名（`uid`/`evm`），不得再用 `"uID"`/`"EVM"`。** | `src/auth.ts` + 路由中间件 | 旧实现（审计 §4.4）因列名错而**抛异常被 catch 吞成 401** ⇒ 「拿着合法 token 也永远登不进去」，且**真实故障伪装成未登录** | 【本册裁定】（审计 §2-R1 的修复落点） |
| **DL104** | **`POST /api/admin/user/update` 的入参白名单（写死）**：**只允许** `target_uid` / `is_admin` / `role_key` / `bio`；**明确禁止** `evm`（DL16）、`uid`（不可改身份主键）、**任何余额或积分类字段**（DL5/DL12）。余额类参数的请求一律 `400`（借码见 §11）。 | 路由入参校验；`ops:` 键（DL36） | 旧实现（审计 §2-R5 记录的 `getAllUsers` 静默降级同族）里「顺手改余额」是最典型的越权形态 | 【本册裁定】 |
| **DL105** | **`requireAdmin(req,res,requiredPermission?)` 语义（保留，语义写死）**：① 先 `requireActor`（无 actor ⇒ `401`）；② `can_access_admin = false` ⇒ `403`；③ `is_admin = true` ⇒ **放行**（总开关）；④ 否则必须命中 `requiredPermission`（数组 = OR 语义）⇒ 未命中 `403`。**✅ v0.2（C4/C6）**：本条的 `401` / `403` 响应体**必须**是 **`AUTH_UNAUTHORIZED` / `AUTH_FORBIDDEN`**（`DL147`，形状照 `R107`），**不得**带任何 `LEDGER_*` 码。<br>▸ **v0.1 旧写法**：无此句（`401`/`403` 的形状由 `DL122` 的「通用体」兜，而 `DL122` 在 v0.2 已改）。 | 路由中间件；权限位见 DL106 | 「无 `requiredPermission` 的 admin 路由」= 「任何 admin 都能调」（现役 #48/#49/#53/#54 即此形态）⇒ 新面**必须**显式给权限位 | 【本册裁定】（v0.2 由 C4/C6 补形状） |
| **DL106** | **权限位集合重定义（删发布方、增审核/仲裁方）**：**保留** `manage_settings` / `manage_permissions` / `manage_users` / `manage_rewards`（改语义为「商品合规」）/ `review_tasks`（改语义为「纠纷仲裁」）；**删除** `publish_tasks` / `publish_prizes`（管理员**不再发布**招工/商品，产品背景 + `master-plan` §4 + D5）；**新增** `audit_ledger`（流水审计台）/ `manage_currency`（单位上市审核）/ `manage_commission_policy`（写佣金政策，与 `manage_settings` **分离**）。**人读含义：管理员 = 搭平台 + 审核/仲裁方。****✅ v0.2（C7 已裁）**：招工的**审核方 = 雇主**（**管理员不审**，`/api/tasklist/*` 归雇主视角）；`review_tasks` 的语义**收敛为「纠纷仲裁」**，**不得**读作「替雇主验收」；管理员仲裁入口 = P6 `/api/admin/arbitration/*`。<br>▸ **v0.1 旧写法**：无此句（状态列 = 【本册裁定 · 关联 C3/C7】，C7 **未裁**）。 | `0016` 的权限表 + `/api/admin/me` 返回的 `permissions[]` | 权限位不删 ⇒ 旧「发布」能力会以「权限还在」为名复活 | **【已裁定 · Zang 终审 v0.2】**（C3 + C7） |
| **DL107** | **`evm` 是唯一钱包身份**：`challenge`（随机串 + 过期，无 DB 写）→ 客户端签名 → `verify`（校验签名 ⇒ `users` upsert：`INSERT ... ON CONFLICT (evm) DO UPDATE SET time_login_last = now() RETURNING uid`）。**`evm` 规范化 = `lower(evm)`**（对齐 `idx_users_evm_lower` 与 `users_evm_uniq`）；`evm` 写入后**不可改**（DL16）。 | `POST /api/auth/challenge` / `POST /api/auth/verify` | ⚠️ `verify` **不得**写任何账务（DL31）；`time_reg` 只在 INSERT 时写，`time_login_last` 每次登录取 `now()` | 【本册裁定 · 关联审计 #8/#9】 |
| **DL108** | **`uid` 生成策略**：`users.uid` = `bigint`，由 `users_uid_seq`（identity，从 1 起）分配；**`INSERT` 时不得指定 `uid`**；**不得**由应用层计算；**不得**分配 `≤ 0`（R98：`LEDGER_RESERVED_UID`）。**测试数据 uid ≥ 900000**（DL14）。 | 注册路径；质检脚本 | 旧实现（`database.ts:410`）的 `MAX(uid)+rn` 必须删除（DL15） | 【已冻结】（R98 + `0002` + 硬 4） |
| **DL109** | **禁止「静默降级」：写/读路径的 DB 故障必须抛，不得 catch 成业务错误**。具体：① `resolveActor` 的内部异常必须区分「凭据无效」（`401`）与「DB 不可用/列不存在」（`500`/`503`，`reason` 带诊断）；② 查询层**禁止** `try { ... } catch { return [] }`（旧 `getAllUsers()` 即此形态 ⇒ 对外返回 `200 {"total":0}` 宣称成功，审计 §2-R5 实证）；③ 静默降级一律视为**缺陷**（`defect` 桶 + R108 告警）。 | `src/auth.ts` / 各 L2 服务；code review 硬项 | 「看起来成功其实什么都没做」是本项目已发生的**真实事故类别** | 【本册裁定】（审计 §2-R5） |
| **DL110** | **平台账户守卫**：任何写路由**必须** `requireActor` 且校验请求涉及的 uid（含 body 中的 `to_uid` / `target_uid`）均 `> 0`（R100）；命中保留区间 `0 / −1 / −2 / −3` ⇒ `400 LEDGER_RESERVED_UID`。平台账户的**唯一写入方 = 账本函数的 kind 白名单**（R101）。 | 路由中间件 `assertUserUid()`（既有实现即此口径） | 「把佣金池当收款人」的经济漏洞由此封死；平台的运维写必须走 `ops:` 键 + 管理员权限 | 【已冻结】（R100/R101） |

### 9.2 身份与四柱的交叉（读口可见性）

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL111** | **读口可见性口径（本册裁定，逐柱一致）**：① **公开** = 招工列表（`status='open'`）/ 商品列表（`status='listed'`）/ 交易所行情（orderbook / trades / candles）——**不返回任何 uid 之外的隐私字段**（页面可展示昵称位留 P7）；② **仅当事双方** = 招工详情（非 `open`）/ 我的报名与提交 / 订单详情 / 退款；③ **仅本人** = 余额 / 流水 / 佣金收入 / 我的邀请关系；④ **仅管理员** = `/api/admin/*`。**越权一律返回 `404 LEDGER_REF_NOT_FOUND`**（不泄露存在性），**除**「已参与但无该动作权限」用 **`AUTH_FORBIDDEN`(403) + `reason=ACTOR_NOT_ALLOWED`**（**C6 已裁：非账本域码**，`DL147`）。<br>▸ **v0.1 旧写法**：末句为「**除**「已参与但无该动作权限」用 **C6 的 `403`**」（C6 当时**未裁**；倾向是借 `LEDGER_HOLD_NOT_ALLOWED`，**已被终审推翻**）。 | L3 路由守卫；逐路由在 §10 标注 | 「谁的详情可见」不写死 ⇒ 每个路由各自发挥（旧面 `/api/user/asset/:uID` 就允许**任意 uid 查询**） | **【已裁定 · Zang 终审 v0.2】**（C6） |
| **DL112** | **`GET /api/user/points` 的 `uid` 参数**：**默认只能查自己**（省略参数 = 自己）；查他人**仅管理员**（`audit_ledger`），且必须走审计语义（返回 `{cid, balance, frozen}` 而不含隐私）。**禁止**非管理员按 `uid` 遍历他人余额（旧 `/api/user/asset/:uID` 的隐私面）。 | `/api/user/points` | 与 DL111③ 一致 | 【本册裁定】 |

## §10 路由重组（55 条：保留 / 重写 / 删除）

> 判定口径与 §4 同（**采纳 / 修正 / 驳回**是本册对**审计提案**的态度；**保留 / 重写 / 删除**是本册对**路由本体**的处置）。**「删除」= 该条目不出现在 P3 的新面上**；旧实现随旧后端整体退役（`backend-ts/src/index.ts` 的 55 条是**旧面清单**，不是新面的蓝图）。
> **新面底色**：`index.ts` 的 55 条里 **26 条写方法**（含 1 条 `USE` 中间件与 1 条 404 兜底），**没有一条**带 `Idempotency-Key`（§8 的 DL97）；**P3 的新写路由必须从第一条起带键**，这是本册与新面之间最硬的一条差异。

### 10.1 逐条判定（55 条）

| # | 方法 / 路径 | 判定 | 新落点（提案） | 阶段 |
|---|---|---|---|---|
| 1 | `USE` helmet | **保留** | 新面全局中间件（同序：helmet → cors → json） | P3 |
| 2 | `USE` cors | **保留** | 同上；**新增**允许 `Idempotency-Key` 请求头（DL97 的传输位置） | P3 |
| 3 | `USE` express.json | **保留** | 同上 | P3 |
| 4 | `GET /` | **重写** | 新站清单 + `schema_version` 探针（无业务语义） | P3 |
| 5 | `GET /health` | **保留** | `healthCheck()` 读 `schema_migration.version`（**已 200 / `0012`**，实测） | P3 |
| 6 | `GET /api/test/data` | **删除** | 开发桩；无新产品对应物 | — |
| 7 | `POST /api/auth/register` | **删除** | 已 `410`；注册 = 钱包签名 + `referral_bind()` | — |
| 8 | `POST /api/auth/challenge` | **保留（重写实现）** | 内存 nonce；**不写 DB**（DL107） | P3 |
| 9 | `POST /api/auth/verify` | **重写** | `users(uid,evm)` upsert；**删 `asset` 初始化**（DL31/DL12）；唯一合法注册路径 | **P3** |
| 10 | `POST /api/auth/login` | **保留（别名）** | 共用 #9 实现（旧面是 `req.url` 重派发）；**不作为新面主入口** | P3 |
| 11 | `GET /api/prize/all` | **删除（重写为商品列表）** | `GET /api/listing`（`status='listed'`，用户 `$` 标价） | P4 |
| 12 | `GET /api/task/all` | **重写** | `GET /api/job`（招工列表） | **P3** |
| 13 | `GET /api/task/:tID` | **重写** | `GET /api/job/:jobId`；**参数名 `tID` → `jobId`**（C2） | **P3** |
| 14 | `GET /api/prize/:bID` | **删除（重写为商品详情）** | `GET /api/listing/:listingId`；**`bID` → `listingId`** | P4 |
| 15 | `GET /api/user` | **重写** | 当前 actor 账户概览；`points` 由账本聚合（`account`），**不读 `asset`** | **P3** |
| 16 | `POST /api/user/profile` | **重写** | 只写 `users.bio`（列名大小写修复）；`Idempotency-Key` 必带 | **P3** |
| 17 | `GET /api/user/asset/:uID` | **删除** | 能力被 `GET /api/user/points` 覆盖（DL112：**默认只能查自己**） | — |
| 18 | `GET /api/home` | **重写** | 首页聚合 = 招工列表 + 我的积分（商品位随 P4 接） | **P3** |
| 19 | `GET /api/prize-item` | **删除（重写为交付记录）** | `GET /api/listing/order`（我买到的 / 我卖出的） | P4 |
| 20 | `GET /api/task-progress` | **重写** | `GET /api/job/mine`（我的报名/提交/审核流水） | **P3** |
| 21 | `GET /api/task-progress/:jID` | **重写** | `GET /api/job/:jobId/application`（当事双方可见，DL111②） | **P3** |
| 22 | `POST /api/task-progress/:identifier/submit` | **重写** | `POST /api/job/:jobId/submit`（**`identifier` 歧义必须消除**：统一用 `jobId`） | **P3** |
| 23 | `POST /api/task-progress/claim/:jID` | **重写** | `POST /api/job/:jobId/apply`（键 `biz:job:apply:<job_id>:<worker_uid>`） | **P3** |
| 24 | `GET /api/shard` | **删除** | 交易所持仓 = `account`（DL69）；`dashJ` 作为 `cid` 维度 ⇒ `GET /api/currency` | P5 |
| 25 | `GET /api/shard/transfer` | **删除** | 转让流水 = `GET /api/user/ledger`（`kind IN ('trade','transfer')`） | P5 |
| 26 | `POST /api/shard/redeem` | **删除** | 兑换 = 交易所成交（`trade` 四分录）；**无「碎片兑换」这个独立动作** | P5 |
| 27 | `POST /api/chest/:bID/open` | **删除** | 开箱是旧站游戏化玩法，**四柱无对应物**（若要保留需新产品裁定，见 §12） | — |
| 28 | `GET /api/order` | **重写** | `GET /api/market/orders`（我的挂单，含 `amount_filled`） | P5 |
| 29 | `POST /api/order` | **重写** | `POST /api/market/order`（买单冻结 `quote` / 卖单冻结 `base`，`hold`；键 `cli:`） | P5 |
| 30 | `DELETE /api/order` | **删除** | 无 `oID` 的批量撤单**语义不明**（撤回谁的哪一单？）⇒ 只保留 #31 | — |
| 31 | `DELETE /api/order/:oID` | **重写** | `DELETE /api/market/order/:orderId`（`hold_release`；锁行后复查，R84） | P5 |
| 32 | `GET /api/market/:bID/orderbook` | **重写** | **`GET /api/market/:baseCid/orderbook`**（**`bID` → `baseCid`**，C2；**✅ v0.3 O1 定性：路径形为唯一权威形态**）；**▸ v0.2 旧写法（已废弃）**：`GET /api/market/orderbook?base_cid=&quote_cid=`（**query 形，不得复活**） | P5 |
| 33 | `GET /api/market/:bID/trades` | **重写** | **`GET /api/market/:baseCid/trades`**（同一 C2 改名；**✅ v0.3 O1 定性：路径形为唯一权威形态**）；**▸ v0.2 旧写法（已废弃）**：`GET /api/market/trades?base_cid=&quote_cid=`（**query 形，不得复活**） | P5 |
| 34 | `GET /api/admin/me` | **保留** | `requireAdmin` + 新权限位（DL106） | **P3** |
| 35 | `GET /api/admin/settings` | **保留** | 读 `app_config`（DL71）；**费率键标注「不参与计费」** | **P3** |
| 36 | `POST /api/admin/settings` | **重写（收窄）** | 只写 `app_config` 白名单键；**禁止**写费率/余额（DL33/DL3） | **P3** |
| 37 | `POST /api/admin/settings/reset` | **删除** | 「一键重置配置」= 无审计的批量破坏；**无对应物**（C3）；**✅ v0.2（C3 ②）：确认删除** | — |
| 38 | `GET /api/admin/permissions` | **保留** | 读 `admin_role` / `admin_permission`（DL72） | P6 |
| 39 | `POST /api/admin/permissions/save` | **重写** | 写 `admin_role_permission`（键 `ops:`）；权限位用 DL106 的新集合 | P6 |
| 40 | `POST /api/admin/permissions/delete` | **重写** | 同上（删除角色 → 权限映射）；**禁止**删除 `is_admin = true` 的账号的 `manage_users` | P6 |
| 41 | `POST /api/admin/user/update` | **更正** | 入参白名单 `target_uid`/`is_admin`/`role_key`/`bio`（DL104）；**禁止** `evm` 与余额 | **P3** |
| 42 | `POST /api/admin/task/create` | **删除** | **管理员不再发布招工**（产品背景）；能力移交用户端 `POST /api/job` | — |
| 43 | `POST /api/admin/task/update` | **删除** | 同上；**保留审核能力** ⇐ 落到 #52 的重写面 | — |
| 44 | `POST /api/admin/task/delete` | **删除** | 同上；业务行以状态位终结（DL79），不做物理删除 | — |
| 45 | `POST /api/admin/prize/create` | **删除** | **管理员不再发布商品**；能力移交用户端 `POST /api/listing`（P4）；**✅ v0.2（C3 ①）：确认删除** | — |
| 46 | `POST /api/admin/prize/update` | **删除** | 同上（商品合规用 `frozen` 状态位，不靠编辑）；**✅ v0.2（C3 ①）：确认删除** | — |
| 47 | `POST /api/admin/prize/delete` | **删除** | 同上；**禁止**物理删除（DL79）；**✅ v0.2（C3 ①）：确认删除**；合规下架另立 P6 `/api/admin/listing/:id/takedown`（待定义） | — |
| 48 | `GET /api/user/all` | **保留（重写实现）** | 只读运维视图：`uid`/`evm`/`is_admin`/`time_reg`/`time_login_last`；**不含余额**（DL3）；静默降级必须修（DL109） | **P3** |
| 49 | `GET /api/user/stats` | **重写** | 账本口径统计（判据 7 的读面）；**不再读 `asset`** | **P3** |
| 50 | `GET /api/tasklist/pending-verification/count` | **重写** | **雇主视角**（**C7 已裁：审核方 = 雇主，管理员不审**）：我的待审提交计数；管理员仲裁队列另立 P6 | **P3** |
| 51 | `GET /api/tasklist/pending-verification` | **重写** | **雇主视角**（`job_submission` 中属「我的招工」且 `review_status='pending'`）；**✅ v0.2（C7）** | **P3** |
| 52 | `POST /api/tasklist/:jID/verify` | **重写（范围收敛）** | **C7 已裁：`review` 由雇主执行**（结算触发者 = 雇主）；**`review_tasks` 权限位**的语义 = 「**平台仲裁**」，**不是**「替雇主验收」；参数 `jID` → `submissionId` | P6（争议路径） |
| 53 | `POST /api/admin/assets/init` | **删除** | `asset` 表整体废弃（§3.1 #4）；**且旧实现无 `requireAdmin` 守卫 + 静默降级**（审计 §2-R5）⇒ 无对应物；余额初始化改由账本 `mint`（`ops:` 键） | — |
| 54 | `POST /api/admin/points/adjust` | **重写** | 走 `ledger_post_event`（`mint`/`burn`，`ops:` 键）；**✅ v0.2（C3 ③）：确认保留但锁死**（仅 `$` `cid=1` / `ops:` 前缀键 / **必填原因码** / 禁直写 `account`；`DL146`）；审计台列 **P6** | **P3**（写口）+ **P6**（审计台） |
| 55 | `USE` catch-all 404 | **保留** | 新面 404 JSON 兜底；**必须**与 `LEDGER_REF_NOT_FOUND` 的 `404` 语义区分（DL111） | P3 |

> **✅ v0.3（O1 定性落位 · Zang `master-plan` §5.40）**：交易所行情读口**以路径形为唯一权威形态** —— `GET /api/market/:baseCid/orderbook`、`GET /api/market/:baseCid/trades`（依据 = **实存路由即路径形** + **C2「路径参数 camelCase」**，且 `§4.1 #32/#33` 原本就是路径形）。**§10.1 #32/#33 的 query 形（`?base_cid=&quote_cid=`）登记为 v0.1 旧写法、废弃，不得复活**。若需**非 `$` 计价对**（`quote_cid ≠ 1`），走**路径双段扩展** `GET /api/market/:baseCid/:quoteCid/orderbook`（**不得**复活 query 形）。**`DL145③`（query 键命名）保持不动**，仅对**真正带 query 的路由**适用。

### 10.2 判定汇总与 P3 开口径

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL113** | **判定汇总（机读）**：**保留 10 条**（#1–3 / #5 / #8 / #10 / #34 / #35 / #38 / #55）、**重写 26 条**（#4 / #9 / #12 / #13 / #15 / #16 / #18 / #20–23 / #28 / #29 / #31–33 / #36 / #39–41 / #49–52 / #54 … 见逐条列）、**删除 19 条**（#6 / #7 / #11 / #14 / #17 / #19 / #24–27 / #30 / #37 / #42–47 / #53）。**删除的 19 条里，13 条是「管理员发布 task/prize」（#42–47）+ 旧积分/碎片/开箱（#24–27、#53）= 产品背景已废止的能力**。 | 本册 §10.1 | 「删除」不等于「能力消失」：用户端接管的写路由见 §8.3 键表 | 【本册裁定】 |
| **DL114** | **24 条写方法的专门表态**（这是本册对审计「未实测写方法」的补位）：① **必须带 `Idempotency-Key`**（DL97）—— 无例外；② **必须 `requireActor`**（唯一例外：`#7` 已删；`#53` 已删，因为它**没有守卫**）；③ **必须走 `ledger_post_event`**，**禁止**任何直接余额写（DL5/DL12）；④ **管理员写必须 `requireAdmin` + 显式权限位**（DL105；旧面 #48/#49/#53/#54 无权限位）。**任一条不满足 ⇒ 该路由不得合并**。 | 新面路由层；code review 硬项 | 旧面「26 条写方法」= **0 条合规**（无键、部分无守卫）⇒ 新面是重写而非搬迁 | 【本册裁定】 |
| **DL115** | **后台 12 条管理路由的去留（单列表态）**：#34 #35 #38 保留读；#36 收窄写；#39 #40 #41 重写；**#37 删除**；#42–47 **删除（6 条）**；#53 **删除**；**#54 重写且锁死（`DL146`，C3 ③ 已裁）**。⇒ **管理员从「发布方」转为「仲裁 + 运维方」**（**C7 已裁：审核方 = 雇主，管理员只做仲裁**）：后台**不再有**任何「发布招工 / 发布商品」入口（产品背景 + `master-plan` §4 + D5）。<br>▸ **v0.1 旧写法**：末段写「管理员从「发布方」转为「**审核/仲裁** + 运维方」」，且 #54 标「重写且**待裁**」（C3 当时未裁）。 | 后台 P3/P6 两个批次 | 后台的**新增**面：权限、佣金政策、币种状态、冲正、审计台（§8.3 键表后半段） | **【已裁定 · Zang 终审 v0.2】**（C3 + C7） |
| **DL146** | **（v0.2 新增 · C3 ③）#54 `/api/admin/points/adjust` 的「锁死条件」（五条缺一不可）**：① **币种限于 `$`**（`cid = 1`）—— 不得对其他币种调分；② **幂等键必须带 `ops:` 前缀**（`ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq>`，`DL36`）；③ **必须填原因码**（`reason_code` **必填**，缺失 ⇒ `400`）；④ **必须经 `ledger_post_event`**（`mint` / `burn`）⇒ **禁止**直接 `UPDATE account`（`DL5` / `DL12`）；⑤ **必须进审计台**，列 **P6**（P3 只开写口，审计台能力在 P6）。**违反任一条 ⇒ 该路由不得合并。** | 后台段（`0013`+）；`audit_ledger` 权限位（`DL106`） | 裁定逐字：「**保留但锁死**：仅 `$`（`cid=1`）、`ops:` 前缀幂等键、**必填原因码**、**必须**经 `ledger_post_event`（`mint`/`burn`）⇒ **禁止**直接 UPDATE `account`；审计台列 **P6**」 | **【已裁定 · Zang 终审 v0.2】**（C3 ③） |
| **DL116** | **P3 应开的路由（本册建议的最小集）**：**平台基础** #1 #2 #3 #4 #5 #55（6）；**身份** #8 #9 #10（3）；**账户** #15 #16 #18（3）；**招工读** #12 #13 #20 #21（4）；**招工写** `POST /api/job`（发布）+ `/accept` + `/review`(approve/reject) + `/cancel` + #22 `/submit` + #23 `/apply`（8）；**后台** #34 #35 #36 #41 #48 #49 #50 #51（8）；**返佣可见** `GET /api/referral/*`（4）+ `POST /api/referral/bind`（1）。⇒ **合计 37 条**（旧面复用 32 条 + 新增 `referral` 5 条），**招工柱 + 身份 + 后台只读**是 P3 的全部范围。**商品（P4）/ 交易所（P5）/ 仲裁与权限写（P6）不在 P3**。 | `master-plan` §6 的 P3 段 | 「P3 一次做完四柱」是**不可行**的（四柱依赖三个迁移）；本册把 P3 收紧到「招工可闭环 + 返佣可见」 | 【本册裁定】 |
| **DL117** | **P3 的开工前置（★ 阻塞）—— v0.2 已把三项裁定项清掉**：① **`C1` 裁定 —— ✅ v0.2 已清**（编排函数，`DL20` / `DL141`–`DL144`）；② **`0013` 迁移落地**（`job*` 三表 + 守卫 + 索引 + `job_post_event`）—— **仍未清**；③ **`C3` 裁定 —— ✅ v0.2 已清**（#54 保留但锁死，`DL146`）；④ **`C5`/`C6` 借码裁定 —— ✅ v0.2 已清**（`DL122` / `DL147` / `DL148`）；⑤ `0008` 的 `−1` 白名单核对（`job_fee` 无邀请人分支，`DL86`）—— **仍未清**。⇒ **v0.2 后 P3 的开工前置 = 2 项（全为实现项：② 与 ⑤）**；`DL130` 的「P3 前必清 5 项」**已因本轮终审而清空裁定项**。<br>▸ **v0.1 旧写法**：「① **C1 裁定**…③ **C3 裁定**…④ **C5/C6 借码裁定**…**以上五项未清，P3 不得开工**」（三项裁定项当时**未清**）。 | Kong 排期；Zang 裁定 | v0.1 的「这五项里三项是裁定项」在 v0.2 已成为「**三项裁定项已清、剩两项实现项**」 | **【已裁定 · Zang 终审 v0.2】**（C1/C3/C5/C6 已裁；② ⑤ 待实现） |
| **DL118** | **旧代码的隐式能力必须显式登记**：旧面 `#27`（`chest/open` 开箱）**没有**任何新产品对应物，本册**删除**并登记为「能力减项」（见 §12.2 第 6 项）；旧面 `#44`（`task/delete`）删除是**唯一**「放弃物理删除能力」的地方（DL79 的同向）。**登记义务**：任何被删能力，若产品后续要恢复，必须**先**在本册开一条 `DL` 而不是直接写代码。 | 变更流程（§15） | 防止「删了又悄悄加回」 | 【本册裁定】 |

## §11 错误码映射（**不新增码**）

> **母约束（写死）**：`ledger.spec` §14.1 的 **33 码关闭集**（`LEDGER_INSUFFICIENT_BALANCE` … `LEDGER_RECONCILE_MISMATCH`）**不增不减**。任何「感觉需要一个新码」的场景，一律 = **借既有码 + `details.reason` 区分**（v0.5/v0.6 已为同一手法留痕：`LEDGER_AMOUNT_INVALID` 被兼用作「参数形状非法」码，靠 `details.field` / `details.reason ∈ {NOT_DECIMAL_INTEGER, NOT_STRING, OUT_OF_BIGINT_RANGE, MISSING}` 区分）。

### 11.1 三条纪律

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL119** | **不新增码**：本册为四柱新增的**业务**错误（如「招工状态不允许此操作」「非报名人不得提交」「商品库存不足」「挂单价越界」）**一律**映射到既有码：状态类 ⇒ `LEDGER_CURRENCY_INVALID_TRANSITION`（`409`，**C5 已裁**，已知债见 `DL148`）；**无权类 ⇒ `AUTH_FORBIDDEN`（`403`，**非账本域码** —— **C6 已裁，推翻本册倾向**；**不再**借 `LEDGER_HOLD_NOT_ALLOWED`）**；不存在类 ⇒ `LEDGER_REF_NOT_FOUND`（`404`）；数值类 ⇒ `LEDGER_AMOUNT_INVALID` / `LEDGER_AMOUNT_NOT_POSITIVE`（`400`）。**`reason` 串一般用固定小写下划线命名**（`not_job_worker` / `listing_stock_insufficient` / `market_price_out_of_range` …）；**但状态机「非法转移」的 `reason` 以裁定逐字为准 = `JOB_STATE_INVALID`**（C5 / `DL51`）—— **▸ v0.2 旧写法**作小写形态 `job_state_transition_invalid`；**v0.3（M2）起一律用 `JOB_STATE_INVALID`**（实现方**不得**用小写形态），并**登记在本册 §11.2 / §11.3 表内**（reason 是新造的自由串，**不是**新码 ⇒ 允许，但**必须进表**）。<br>▸ **v0.1 旧写法**：「无权类 ⇒ **`LEDGER_HOLD_NOT_ALLOWED`（`403`，C6）**」＋状态列【本册裁定 · 关联 C5/C6】（两项当时均**未裁**）。 | L3 路由 → L2 → L1 的错误翻译层 | 「新增码」会打破 `bucket ↔ 状态类` 的冻结映射与前端文案表；「新增 reason」成本为零 | **【已裁定 · Zang 终审 v0.2】**（C5 + C6） |
| **DL148** | **（v0.2 新增 · C5「已知债」登记）「码名语义窄化」= 已知债。** `LEDGER_CURRENCY_INVALID_TRANSITION` 的**码名**只提 `currency`，而 v0.2 把它借给**全部业务状态机**（招工 `job.status` / 商品 `listing.status` / 挂单 `market_order.status`）⇒ **码名比其实际触发范围窄**（`ledger.spec` §14.3 纪律 ①「借用不改变各码自身触发条件」在此被**已知债**吸收，**不**视为违约，但**必须**登记）。**清偿条件（写死）**：① 若将来为业务状态机**启用专用码**，**必须一次到位** —— **正向映射 + 反向映射 + bucket 三样同时给**（先例 = `0009_ledger_error_reverse_map_complete.sql`），**不得只加正向**；② 在专用码到位前，**不得**再把本码借给**非状态机**语义（防窄化继续扩散）。 | `ledger.spec` §14.1 / §14.3 的下一次修订；错误码正向/反向映射表 | 「只加正向、不加反向」是本项目已实测的**缺口族**（`0009` 的迁移名就是修它）；本债把它写成**有条件的清偿路径**而非「以后再说」 | **【已裁定 · Zang 终审 v0.2】**（C5） |
| **DL120** | **逐路由的码面必须与 §11.2 表逐字一致**：实现方**不得**自选「更贴切」的码；**禁**把业务错误一律写成 `500`（这会污染 `defect` 桶与告警，R108）；**禁**把 `500` 级缺陷伪装成 `400`（`null_status_defect = 0` 是 v0.9 的闭合读数）。 | code review 硬项 + 往返脚本的桶校验 | 桶错了 ⇒ 「告警不响」或「告警乱响」两种事故都发生 | 【已冻结】（§14.3 v0.9/v0.10） |
| **DL121** | **未映射原始 SQLSTATE 一律不得逃逸**：抛到响应层的任何错误都必须是 33 码之一（或 `200` 良性类）；**新表的守卫触发器必须 `RAISE ... USING ERRCODE = '23514'` 并让 L1 映射成既有码**（v0.6 的「按类修 + 逃逸扫描」要求同样适用于 `0013+` 的业务守卫）。**每个新迁移必须附一条「逃逸扫描」用例**（`raw_sqlstate_escapes = 0` / `unmapped = 0` / `missing_status = 0`），**run-tagged、永不写固定文件名**。 | `0013`–`0016` 的质检脚本 | 「业务守卫抛裸 `23514`」会成为新的 D-02 类缺陷（写路径已灭、业务路径漏网） | 【已冻结】（v0.6 增补块 (A) / §16 #12） |

### 11.2 逐路由错误码映射（新面写路由 + 读路由）

| 路由（新面） | `200` 良性 | `400` | `403` | `404` | `409` | `423` | `500` | `503` | 业务 `reason`（新造串，登记于此） |
|---|---|---|---|---|---|---|---|---|---|
| `POST /api/auth/verify` | — | `LD017` | — | — | — | — | — | — | — |
| `POST /api/user/profile` | `LD003` | `LD006` | — | — | `LD004` | — | — | — | — |
| `POST /api/job`（发布+托管） | `LD003` | `LD005` `LD006` `LD018` `LD022` | — | `LD023` | `LD001` `LD008` `LD004` | `LD009` | — | — | — |
| `POST /api/job/:jobId/apply` | `LD003` | `LD005` `LD006` | `AUTH_FORBIDDEN` | `LD023` | `LD011` `LD004` | — | — | — | `JOB_STATE_INVALID` / `not_open_job` / `self_application_not_allowed` |
| `POST /api/job/:jobId/accept` | `LD003` | `LD005` `LD006` | `AUTH_FORBIDDEN` | `LD023` | `LD011` `LD004` | — | — | — | `not_job_employer` / `JOB_STATE_INVALID` / `application_already_accepted` |
| `POST /api/job/:jobId/submit` | `LD003` | `LD005` `LD006` `LD017` | `AUTH_FORBIDDEN` | `LD023` | `LD011` `LD004` | — | — | — | `not_job_worker` / `JOB_STATE_INVALID` / `submission_already_reviewed` |
| `POST /api/job/:jobId/review`（approve） | `LD003` | `LD005` `LD006` `LD017` | — | `LD023` | `LD001` `LD002` `LD004` `LD008` `LD011` | `LD009` | `LD025`（借：事件组装断言失败） `LD029` `LD030` `LD031` `LD032` | `LD026` `LD027` `LD028` | `JOB_STATE_INVALID` / `reviewer_not_employer` / `commission_split_sum_mismatch` / `policy_weights_all_zero` |
| `POST /api/job/:jobId/cancel` | `LD003` | `LD005` `LD006` | `AUTH_FORBIDDEN` | `LD023` | `LD001` `LD002` `LD004` `LD011` | — | `LD031` | `LD025`–`LD028` | `JOB_STATE_INVALID` / `not_job_employer` |
| `GET /api/job` / `/api/job/:jobId` | — | `LD017`（`jobId` 形状） | — | `LD023` | — | — | — | — | — |
| `GET /api/user` / `/api/user/points` | — | `LD017` `LD022`（`uid` 形状/保留） | — | `LD021`（未开户） `LD007` | — | — | — | — | — |
| `POST /api/listing`（发布商品，P4） | `LD003` | `LD005` `LD006` `LD018` | — | `LD023` | `LD004` `LD008` | — | — | — | `listing_price_invalid` |
| `POST /api/listing/:listingId/buy` | `LD003` | `LD005` `LD006` `LD018` `LD020` | `AUTH_FORBIDDEN` | `LD023` | `LD001` `LD004` `LD008` `LD011` | `LD009` | `LD025`（借：事件组装断言）`LD031` | `LD025`–`LD028` | `listing_stock_insufficient` / `listing_not_listed` / `self_purchase_not_allowed` |
| `POST /api/listing/order/:orderId/refund` | `LD003` | `LD005` `LD006` | `AUTH_FORBIDDEN` | `LD023` | `LD001` `LD004` `LD011` | — | `LD031` | `LD025`–`LD028` | `order_not_refundable` / `not_order_buyer` |
| `POST /api/currency` | `LD003` | `LD005` `LD006` `LD019` | `AUTH_FORBIDDEN` | `LD023` | `LD004` `LD012` `LD014` | — | — | — | `decimals_out_of_range` |
| `POST /api/currency/:cid/list` | `LD003` | `LD005` `LD006` `LD018` | `AUTH_FORBIDDEN` | `LD007` `LD023` | `LD001` `LD004` `LD011` | `LD009` | `LD025`（借）`LD031` | `LD025`–`LD028` | `currency_state_transition_invalid` / `not_currency_owner` |
| `POST /api/market/order` | `LD003` | `LD005` `LD006` `LD018` `LD022` | `AUTH_FORBIDDEN` | `LD007` `LD023` | `LD001` `LD004` `LD008` | `LD009` | — | — | `market_price_out_of_range` / `market_amount_out_of_range` / `base_quote_same_currency` |
| `DELETE /api/market/order/:orderId` | `LD003` | `LD005` `LD006` | `AUTH_FORBIDDEN` | `LD023` | `LD002` `LD004` `LD011` | — | `LD031` | `LD025`–`LD028` | `order_not_cancellable` / `not_order_owner` |
| `POST /api/market/match`（成交，P5） | `LD003` | `LD005` `LD006` | — | `LD023` | `LD001` `LD002` `LD004` `LD008` `LD011` | — | `LD025`（借）`LD029` `LD030` `LD031` | `LD026` `LD027` `LD028` | `trade_conservation_violation` |
| `GET /api/market/:baseCid/orderbook` / `/trades` / `/candles`（**✅ v0.3 O1：路径形；query 形已废弃**） | — | `LD017` | — | `LD007` | — | — | — | — | — |
| `POST /api/referral/bind` | `LD003` | `LD005` `LD006` `LD022` | — | `LD023` | `LD004` | — | — | — | ⚠️ 绑定守卫违反的码名 **待核实**（§13-5） |
| `GET /api/referral/*`（四个只读口） | — | `LD017` | — | `LD021` | — | — | — | — | — |
| `POST /api/admin/settings` / `/permissions/save` / `/permissions/delete` / `/user/update` | `LD003` | `LD005` `LD006` `LD017` | `AUTH_FORBIDDEN`（`reason` 见 §11.3） | `LD023` | `LD004` | — | — | — | — |
| `POST /api/admin/points/adjust` | `LD003` | `LD005` `LD006` `LD017` `LD018` `LD022` | `AUTH_FORBIDDEN` | `LD021` | `LD001` `LD004` `LD014` | `LD009` | — | `LD025`–`LD028` | `points_adjust_amount_invalid` / `reason_code_missing`（C3 ③ 必填原因码） |
| `POST /api/admin/commission_policy` | `LD003` | `LD005` `LD006` `LD017` | — | — | `LD004` `LD032`（`W=0` 写入档） | — | `LD032`（`POLICY_WEIGHTS_ALL_ZERO` 运行档） | — | `policy_effective_from_not_increasing`（`409`+`LD011` 借码）/ `POLICY_WEIGHTS_ALL_ZERO` |
| `POST /api/admin/currency/:cid/status` | `LD003` | `LD005` `LD006` | — | `LD007` | `LD004` `LD011` | — | — | — | `currency_status_transition_invalid` |
| `POST /api/admin/reversal` | `LD003` | `LD005` `LD006` `LD017` | — | `LD023` | `LD004` `LD011` | — | `LD029` `LD030` `LD031` | `LD025`–`LD028` | `already_reversed` / `reversal_of_reversal` |

**✅ v0.2 对本表的三处改动的说明（审阅者请先读）**：① **`403` 列的 `LD015` / `LD016` 已全部改为 `AUTH_FORBIDDEN`**（C6 已裁：业务授权失败走**非账本域码**）—— 受影响行 = `apply` / `accept` / `submit` / `cancel` / `listing buy` / `listing refund` / `currency` / `currency list` / `market order` / `market delete` / `admin/*` 组 / `points/adjust`；② 上表 `401` **列本就不存在**（表头无 `401` 列）—— `401` 的行级口径见 **`DL122` 与 §11.3**；③ `points/adjust` 的 `400` `reason` 增列 `reason_code_missing`（C3 ③ 必填原因码）。**`LD015` / `LD016` 仍属 `ledger.spec` §14.1 的 33 码关闭集，但新面业务路由不再返回它们**（它们保留给**账本层**授权语义，如 `ledger_post_event` 内的铸币权/冻结权判定）。

**✅ v0.3（M2）对本表的一处改动的说明**：本表「业务 `reason`」列原 v0.2 写作小写形态 `job_state_transition_invalid`，**v0.3 起统一为裁定逐字 `JOB_STATE_INVALID`**（C5 / `DL51`；`DL119` 有 v0.2 旧写法留痕）⇒ **实现方一律用 `JOB_STATE_INVALID`，全文只有这一种可执行口径**。

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL123** | **`LEDGER_INSUFFICIENT_BALANCE` / `LEDGER_INSUFFICIENT_FROZEN` 的选择口径**：可用余额不足 ⇒ `LD001`（`409`）；**冻结操作**（撤单、结算拆分手续费）导致在冻不足 ⇒ `LD002`（`409`）。**禁止**用 `400` 表达「钱不够」（那是**业务状态冲突**，不是入参形状）。 | L2 各域服务 | 「余额不足 = 400」是前端最爱犯的错；`409` 才能让前端正确提示「去充值」 | 【已冻结】（§14.1 #1/#2 + R105） |
| **DL124** | **`404` 的三种来源必须可区分**：① 记账主体不存在 ⇒ `LD021 LEDGER_ACCOUNT_NOT_FOUND`；② 币种不存在 ⇒ `LD007 LEDGER_CURRENCY_NOT_FOUND`（含 `cid <= 0` 与负数，**v0.5 裁定**）；③ 业务对象不存在 / 越权隐藏 ⇒ `LD023 LEDGER_REF_NOT_FOUND`（**`details.ref_type` + `details.ref_id` 必填**）。**禁止**把三类混成一个 `404` 文案。 | L3/L2 错误翻译层 | DL111 的「不泄露存在性」靠 ③ 实现 | 【已冻结】（§14.3 + v0.5 + R105） |
| **DL125** | **平台/保留 uid 与计价币种前置闸**：请求涉及 `uid ∈ {0,−1,−2,−3}`（除账本白名单场景）⇒ `LD022`（`400`）；**招工酬金只允许 `listed` 单位**（R28）⇒ 用 `draft`/`frozen`/`delisted` 计价 ⇒ `LD008`（`409`）/`LD009`（`423`）/`LD010`（`409`）。**这两道闸必须在路由层先跑**（不要等 DB 抛）。 | 路由中间件 + L2 | 前置闸让错误可读；DB 闸是最后一道（两者都要有） | 【已冻结】（R28 / R98 / §14.1 #22） |
| **DL126** | **`500` 类码只允许由「不变式被破坏」触发**（`LD025` 借作事件组装断言 / `LD029` 负余额 / `LD030` append-only / `LD031` 账户守卫 / `LD032` 政策不变式）—— **且必须告警**（R108）。业务状态机的非法转移**不得**用 `500`（那是 `409` + 借码）。 | L1/L2；告警规则 | 「把业务错误写成 500」会让缺陷告警失去信噪比 | 【已冻结】（R108 + §14.3 v0.10） |
| **DL122** | **鉴权/授权失败的响应码（✅ v0.2 改口径 · C4 已裁）**：① `401` = 无/坏 token ⇒ **`AUTH_UNAUTHORIZED`**；② `403` = 有 actor 但无管理员访问权 / 权限位不命中 ⇒ **`AUTH_FORBIDDEN`**；③ `403` = 「已参与但无该动作权限」（C6）⇒ **`AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED`**。**响应形状照 `R107`**（`{error:{code,message,i18n_key,details}}`），**不带任何 `LEDGER_*` 码**、**不进账本码表**。⇒ 码/桶/形状/reason 全表见 **§11.3**。<br>▸ **v0.1 旧写法**：「响应体用**通用体**（`{success:false, message:'Unauthorized' \| 'Forbidden'}`，与旧面一致），**不带** `LEDGER_*` 码」＋状态列【本册裁定 · 关联 C4】（C4 当时**未裁**，本册**正请求 Zang 终审**）。⚠️ **v0.1 的通用体无 `code` 字段 ⇒ 与 `R107` 形状不一致**，已被终审改为**带 `code`**。 | `src/auth.ts` 响应体；前端错误分支；§11.3 登记表 | 旧面实测 `GET /api/user/all` 无 token ⇒ `401 {"success":false,"message":"Unauthorized"}`（**无 `code`** ⇒ 前端只能按字符串匹配）；v0.2 后前端按 `code` 分支，且 **`AUTH_*` 与 `LEDGER_*` 分域可辨** | **【已裁定 · Zang 终审 v0.2】**（C4 + C6） |
| **DL147** | **（v0.2 新增 · C4 + C6 的登记表）`AUTH_*` **只允许两条**：`AUTH_UNAUTHORIZED`（`401`）/ `AUTH_FORBIDDEN`（`403`）。** ① **码集关闭**（新增 AUTH 码须**新裁定**）；② **形状照 `R107`**（`code` / `message` / `i18n_key` / `details` 四件）；③ **`reason` 一律进 §11.3.2 表**（`ACTOR_NOT_ALLOWED` / `NOT_ADMIN` / `PERMISSION_NOT_GRANTED`），**未登记的 `reason` 不得出现在响应里**；④ **`AUTH_*` 不进 `LEDGER_*`**（`ledger.spec` §14.1 的 33 码关闭集**不增不减**，`DL119`）；⑤ **C4 与 C6 同域同表**：C6 的「已参与但无该动作权限」**不得**被实现为账本码 —— **明确禁止**再借 `LEDGER_HOLD_NOT_ALLOWED`。 | §11.3 登记表；`src/auth.ts`；各业务路由的角色守卫；前端错误分支 | C6 的裁定理由逐字：「借 `LEDGER_HOLD_NOT_ALLOWED` 会让账本域被业务授权语义**持续侵蚀**」⇒ 本条是**防侵蚀**的结构性闸 | **【已裁定 · Zang 终审 v0.2】**（C4 + C6） |

### 11.3 AUTH 域码登记表（**v0.2 新增 · C4 + C6 绑定**）

> **母约束（C4 逐字裁定）**：401/403 由守卫**直接返回**「**非账本域**码 `AUTH_UNAUTHORIZED` / `AUTH_FORBIDDEN`（**形状照 `R107`**）」，**不进** `LEDGER_*` 表 ⇒ `ledger.spec` §14.1 的 **33 码关闭集不增不减**（§11 的「不新增码」母约束**不破**）。
> **C4 与 C6 绑定（逐字）**：「C4 已把鉴权/授权划出账本域，应走**同域**」⇒ **两码同域、同形状、同一张登记表**（即本节）。

#### 11.3.1 AUTH 码关闭集（**恰好 2 条**）

| 码 | HTTP | 桶 | 触发条件 | `i18n_key`（**具体值**，v0.3 补） | 响应形状（照 `R107`） | 归属守卫 |
|---|---|---|---|---|---|
| **`AUTH_UNAUTHORIZED`** | `401` | **`auth`**（**新桶；非账本桶**） | ① 无 `Authorization` 头；② token 无效/过期；③ `resolveActor` 判为「**凭据无效**」—— **≠** DB 故障（DB 故障必须抛 `500`/`503`，`DL109`） | **`auth.err.AUTH_UNAUTHORIZED`**（**需新增键**；命名依据见本节末注） | `{"error":{"code":"AUTH_UNAUTHORIZED","message":<str>,"i18n_key":<str>,"details":{...}}}` | `requireActor`（`DL103③④`） |
| **`AUTH_FORBIDDEN`** | `403` | **`auth`** | ① 有 actor 但 `can_access_admin = false`（`DL105②`）；② admin 但未命中 `requiredPermission`（`DL105④`）；③ **「已参与但无该动作权限」**（**C6 已裁**，`DL111`） | **`auth.err.AUTH_FORBIDDEN`**（**需新增键**；命名依据见本节末注） | `{"error":{"code":"AUTH_FORBIDDEN","message":<str>,"i18n_key":<str>,"details":{"reason":<见 11.3.2>}}}` | `requireAdmin` / 各业务路由的角色守卫 |

> **⚠️ v0.3（M4）`i18n_key` 命名依据（实测，不发明）**：`frontend/src/locales/{zh,en,hk,vn}.json` 与 `frontend/src/i18n.js` **现无任何 auth/error 类键**（实测 `grep -rn 'unauthorized\|forbidden' frontend/src/locales/` = **0 命中**；前端 locale 为**扁平 camelCase 无点号**风格，如 `sessionExpired` / `pleaseLogin`）⇒ **无既有键可直接沿用**，故**登记「需新增键」**。建议值按**仓内唯一既有错误键生成规律**定名：`backend-ts/src/ledger-errors.ts:219` = **`ledger.err.${code}`** ⇒ AUTH 域取 **`auth.err.AUTH_UNAUTHORIZED` / `auth.err.AUTH_FORBIDDEN`**（与 `LEDGER_*` 的 `ledger.err.` 前缀**分域可辨**，不发明新风格）。**前端落地须在四语 locale 各加对应条目**（`i18n_key` 为契约值；呈现层具体键名由前端定）。

#### 11.3.2 `reason` 码表（`AUTH_FORBIDDEN` 的 `details.reason`，**登记于此，未登记不得出现在响应里**）

| `reason` | 含义 | 落点 |
|---|---|---|
| **`ACTOR_NOT_ALLOWED`** | **C6 逐字**：「**已参与但无该动作权限**」（例：买家去调卖家的退款、非报名人去 `submit`、非雇主去 `accept`、非挂单人撤单） | `DL111` / §11.2 的 `403` 列 / `DL147⑤` |
| **`NOT_ADMIN`** | 有 actor 但 `can_access_admin = false`（含「非管理员访问 `/api/admin/*`」） | `DL105②` |
| **`PERMISSION_NOT_GRANTED`** | 是 admin 但未命中该路由要求的 `requiredPermission` | `DL105④` |
| **`reason_code_missing`**（*例外登记*） | **不属 403**：`#54` 调分缺必填原因码 ⇒ **`400`**（C3 ③ / `DL146③`）；列在此处仅为**集中可查**，**不得**与 `AUTH_FORBIDDEN` 混用 | §11.2 `points/adjust` 行 |

#### 11.3.3 与账本域的关系（**写死三条**）

1. **`AUTH_*` 不进 `LEDGER_*`**：不写入 `ledger.spec` §14.1 的 33 码关闭集；**不参与** `bucket ↔ 状态类` 的冻结映射与前端账本文案表。
2. **账本域没有 `401`**：33 码里无 401 ⇒ 「未登录」在账本域**无法表达** —— 这正是 C4 另立 AUTH 域的理由。
3. **`LD015` / `LD016` 的归位**：两条 `403` 账本码**保留**给**账本层**授权语义（`ledger_post_event` 内的铸币权/冻结权判定）；**新面业务路由不再返回它们**（§11.2 的 `403` 列已**全部**改为 `AUTH_FORBIDDEN`，**逐行可见**）。

> ▸ **v0.1 旧写法**：**本节不存在** —— v0.1 的 §11 只有 §11.1（三条纪律）与 §11.2（逐路由表），**401/403 的形状**被压在 `DL122` 的一句「通用体」里，且**未立 AUTH 码域**（C4 当时未裁、本册倾向「不借账本码但也不给 `code`」）。

## §12 待裁决项清单

> **本节 = 「必须由 Zang 终审 / Kevin 一句话」的清单**。§12.1 是**争议项**（本册无权单方定案的强分歧）；§12.2 是**其余待裁项**（本册已给倾向，但需追认或需产品输入）。**§12.3 给「谁裁、裁什么、卡什么」三栏**（对接 `master-plan` §5.28 的「待 Kevin 一句话」形态）。

### 12.1 争议项（**单列**，详见 §5）—— **v0.2 已全部裁定**

> **✅ v0.2：`C1`–`C9` 九项已由 Zang 终审完毕**（详见 **§5** 的裁定列）。**本表保留 v0.1 的「本册倾向」列**（`DL134` 留痕），最右列写**终审结论 + 阻塞是否解除**。**裁定后 §12.1 的「阻塞」列自 v0.2 起已无 ★ 项**（`DL130` 的 P3 前必清 5 项已清）。

| # | 争议项 | v0.1 本册倾向（一行，**留痕**） | v0.1 阻塞 | **✅ Zang 终审 v0.2 / 阻塞是否解除** |
|---|---|---|---|---|
| **C1** | 业务表 ↔ 账本事件的原子性：新增「业务编排函数」 vs 两阶段 + 对账 | **提案 A**：新增 `*_post_event`（`CREATE FUNCTION`，不改 `ledger_post_event` 函数体） | **★ P3 全部 8 条招工写路由** | **已裁 · 采纳提案 A** ⇒ **★ 解除**（`DL20` / `DL141`–`DL144`） |
| **C2** | 表名与路由参数命名（`listing` vs `commodity`；`bID`/`jID`/`tID` → 规范名） | **`listing`** + 参数全改规范名（`base_cid` / `listingId` / `jobId`） | 商品柱（P4）与交易所（P5）的路由签名 | **已裁 · `listing` / `listing_order` + 路径 camelCase（`baseCid`/`jobId`/`orderId`）/ 列 snake_case** ⇒ **解除**（`DL27` / `DL33` / `DL145`） |
| **C3** | 后台边界：`#54` 调分是否保留、`admin/prize/*` 是否全删、`settings/reset` 是否删 | **全删 `prize/*` + `reset`；`#54` 保留但强约束（`ops:` 键 + `mint`/`burn` + 审计）** | **#54 与后台 P3 批次** | **已裁**：①② 删除 ✅（与原倾向一致）；③ `#54` **保留但锁死**（仅 `$` / `ops:` 键 / 必填原因码 / 必经 `ledger_post_event` / 审计台 P6）⇒ **解除**（`DL146`） |
| **C4** | 鉴权失败（401/403）是否借账本码 | **不借**（通用体；`LD015`/`LD016` 留给账本层） | §11.2 表的 `403` 列 | **已裁 · 采纳**：立 **AUTH 域码** `AUTH_UNAUTHORIZED` / `AUTH_FORBIDDEN`（形状照 `R107`），**不进** `LEDGER_*` ⇒ **解除**（§11.3 / `DL122` / `DL147`） |
| **C5** | 业务状态机非法转移借 `409 LD011` 的范围 | **借**（+ `reason` 区分），**不新增码** | §11 全部写路由 | **已裁 · 采纳借码** + 登记「**码名语义窄化**」为**已知债** ⇒ **解除**（`DL148`） |
| **C6** | 「已参与但无该动作权限」借 `403 LD016` 的范围 | **借**（+ `reason` 区分）；未参与者 ⇒ `404 LD023` | §11 全部写路由 + DL111 | **⚠️ 已裁 · 推翻本册倾向**：改走 **`AUTH_FORBIDDEN`(403) + `reason=ACTOR_NOT_ALLOWED`**（**非账本域**）；**C4/C6 绑定同表** ⇒ **解除**（§11.3 / `DL147`） |
| **C7** | 审核方归属：雇主自审 vs 平台仲裁 | **双轨**：P3 雇主 approve 触发结算；平台 `review_tasks` = **异常/争议**路径（**不得**替雇主验收） | 招工柱 P3/P6 的分界 | **已裁 · 采纳：雇主审**；管理员只做**仲裁**（P6）；**驳回审计的「管理员审」** ⇒ **解除**（`DL106` / `DL115` / §10.1 #50–#52） |
| **C8** | 业务表是否加「业务级幂等列」(`create_key` / `ledger_event_keys`) | **加**（DL75 三件套） | §6 全部新表 DDL | **已裁 · 采纳：要** + **`create_key` 与 `R51`/`R52` 指纹一致** + **必须给判负用例** ⇒ **解除**（`DL50` / `DL75` / `DL149`） |
| **C9** | K 线：视图 vs 物化视图/表 | **视图**（`candle_view`） | 交易所柱 P5 | **已裁 · 采纳视图**；升级须**先开 DL 规则**（刷新策略/陈旧度）⇒ **解除**（`DL66` / `DL150`） |
| **（附加）** | `kind` 缺口：`platform_withdraw` / `listing_deposit_forfeit` | P3 不启用 | 平台出账能力 | **已裁（部分）**：**同意 P3 不启用**；但 `platform_withdraw` 是**产品级**问题 ⇒ **待 Kevin**（**不得**写「Zang 已裁」，`DL153`） |

### 12.2 其余待裁项（本册已给倾向，需追认或需产品输入）

| # | 待裁项 | 本册倾向 | 裁定者 | 卡什么 |
|---|---|---|---|---|
| 1 | **`platform_withdraw`（平台收入提取）何时启用** | **P3/P6 不启用**（R103 悬置：「在 Kevin 批准前 `−1` 只进不出」）；**✅ v0.2（Zang）：同意 P3 不启用，并明示这是**产品级**问题 ⇒ 归 Kevin 表态**（不得写「Zang 已裁」，见 `DL153`） | **Kevin** | 后台任何「提取/结算到站外」入口 |
| 2 | **`hold_forfeit` / 强制下架罚款是否启用**（含违约金比例、去向 `−3`、退还路径） | **不启用**（DL91/DL82） | Zang（+ Kevin 若涉资金） | 招工争议路径（P6） |
| 3 | **商品发布是否收费**（本册裁定**不收费**；若收费须新裁定 ⇐ 会占 `listing_fee` 的语义） | 不收费 | Kevin | 商品柱 P4 |
| 4 | **商品退款是否回库**（`ledger.spec` §7.2 #10 明写「由 P4 spec 定」） | 本册**不越权**，登记为 P4 待定（DL62） | P4 spec | 商品退款（P4） |
| 5 | **`app_config` 是否保留费率类历史键**（真源 = `commission_policy`，§5.20 #3） | **保留键但不参与计费**（不得删键） | Zang | 后台 settings（P3） |
| 6 | **开箱（旧 `POST /api/chest/:bID/open`）能力是否恢复** | **不恢复**（DL118 登记为能力减项） | Kevin | — |
| 7 | **`DELETE /api/order`（无 id 批量撤单）的语义**（本册按「语义不明」删除） | **删除**（只保留带 `oID` 的撤单） | 无（若前端在用则 Kevin 确认） | 交易所柱 P5 |
| 8 | **旧 `#12/#13` 的列表排序与分页**（旧面分页语义未审计） | P3 统一 keyset（DL25 口径） | 实现方 | 招工列表 |
| 9 | **`ensureLegacyTableNames` 的去留**（条件 RENAME `gift→prize_item` / `journey→task_progress`，`master-plan` §5.30 明标「未处置」） | **删除**（见 §16 的 `DL137`） | Kong 排期 + Zang 认可 | P3 Step 2/3 的 `database.ts` 归档 |
| 10 | **411 条测试残差（D20）的清理时点** | P3 **写真实用户之前**清（`master-plan` D20 已定） | Kevin（已定） | P3 首次真实写入 |
| **11** | **`neon_auth` schema 与本产品的关系**：`neon_auth` 有 **9 张表**（`account`/`invitation`/`jwks`/`member`/`organization`/`project_config`/`session`/`user`/`verification`，v0.2 只读实测，见 §17.1）—— **本产品是否用 Neon Auth 做登录？** | **✅ v0.3 已裁（Zang · `master-plan` §5.38②）：不启用 Neon Auth。** 登录 = **EVM 钱包签名（`challenge`/`verify`）+ `users.uid`/`evm`**（`DL107`）；`neon_auth`（**9 张表**）**物理存在但不属本仓** ⇒ 新数据层**必须显式限定 `public.`、完全绕开**（`DL151`），登记「**存在但未使用**」；**保留**「`neon_auth.user` 与 `public.users` 近名」属**硬 1（裸 `user`）同族**的警示。**若将来启用 Neon Auth ⇒ 须另立规范**（不得就地开口）。〔v0.2 旧倾向：本册倾向「不用」，待 Zang 终审〕 | **Zang**（**已裁 · 2026-09-28**） | **已解除** —— P3 鉴权面按 EVM 钱包签名落地；`DL151` 的「必须限定 `public.`」升为强制项 |
| **12** | **政策表费率列名**：Zang 裁定与 `master-plan` §5.33 原文写 **`fee_bp`**，而**库内实列名 = `fee_rate_bp`**（v0.2 只读实测，见 §17.2）⇒ 回归判据按哪个名字写？ | **✅ v0.3 已裁（Zang · `master-plan` §5.38①）：以库内实列名 `fee_rate_bp` 为准。** 铁证 = 仓内迁移 `0007`（`:11`/`:86`/`:92`/`:161` **逐处皆 `fee_rate_bp`、全文无 `fee_bp`**）+ `§5.20 #3` 亦作 `fee_rate_bp` ⇒ **`fee_bp` 系简写/笔误，不得进判据**；**`DL152` 按 `fee_rate_bp` 写 = 正确，不改**。〔v0.2 旧倾向：按库内实列名，待 Zang 确认〕 | **Zang（已裁 · 2026-09-28）** | **已解除** —— 回归判据按 `fee_rate_bp` 写死 |

### 12.3 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL127** | **待裁项的字段固定**：每条必须有「项 / 本册倾向 / 裁定者 / 卡什么」四栏（§12.1/§12.2 即此形体）；**禁止**出现「待裁」但无倾向的条目（那等于把工作推回去）。 | 本节 | 与 `master-plan`「待 Kevin 一句话」的形态对齐 | 【本册裁定】 |
| **DL128** | **裁定必须回写本册**：任何 C/D 项被裁后，**同一版**内把 §5/§12 的状态从【待裁】改为【已冻结】并附裁定者与日期；**禁止**在代码里实现一个未回写的裁定（那会让本册与实现分叉）。 | §14/§15 + `master-plan` §5 | 与 DL44 的「一次性全量回改」同源 | 【本册裁定】 |
| **DL129** | **「悬置」不是「否决」**：`platform_withdraw` 类的悬置项，其规则是「**不得实现入口**」，**不是**「永不做」；启用须**新裁定** + 本册新 `DL`。 | 后台 P6 | 防止「反正悬置」被读成「可以做」 | 【本册裁定】（R103） |
| **DL130** | **P3 开工前必须清零的裁定项 = 5 项**：`C1`（编排函数）、`C3`（后台调分）、`C4`（鉴权码域）、`C5`（409 借码）、`C6`（403 借码）。其余裁定项**不阻塞 P3 第一单**（与 DL117 同）。**✅ v0.2：这 5 项已全部裁定**（`C1` 采纳 A / `C3` #54 锁死 / `C4` 立 AUTH 域 / `C5` 借码+已知债 / `C6` 改 AUTH_FORBIDDEN）⇒ **v0.2 起本条的「必清裁定项」= 0**，P3 的剩余前置转为**实现项**（`DL117②` `0013` 落地 + `DL117⑤` `0008` 白名单核对）。<br>▸ **v0.1 旧写法**：只有前段（5 项**待清**），状态列 = 【本册裁定】。 | 派单前 checklist | 「先把 5 项裁掉，再派 P3 第一单」是 v0.1 对本册流程的唯一硬要求 ⇒ **v0.2 已满足** | **【已裁定 · Zang 终审 v0.2】**（C1/C3/C4/C5/C6 全裁） |

---

## §13 已知盲区与未核实清单

> **纪律（先声明，再列项）**：本节每一条都**显式标注「推断，待核实」**。**未被本节标注为已核实的内容，一律以「已核实」对待** —— 反之，本节列出的项**不得**被下游引用为事实。

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL131** | **「推断，待核实」的标注义务**：本册凡属推断的陈述（表结构猜测、旧列语义、行为推测）**必须**在正文就地标注 `（推断，待核实）` 或收进本节；**禁止**把推断写成断言。**违者**：下游据其写迁移 = 用猜测建库。 | 本册自身 + 后续修订 | 与 `master-plan` §5.30 的新纪律同源（「不得把截断的工具输出当作完整事实」） | 【本册裁定】 |
| **DL132** | **盲区清单（B1–B12）见 §13.1**；**每条盲区必须给「谁可以核实、怎么核实」**（否则它会永久留在纸上）。 | §13.1 的「核实手段」列 | 「登记了但没人核」= 变相的事实断言 | 【本册裁定】 |
| **DL133** | **盲区不得被用来「延后判断」**：若某盲区**阻塞**某条迁移，则该盲区**必须**先升级为 §12 的待裁/待核项（带裁定者）；**禁止**「先按推断建表、以后再说」。 | 派单前 checklist | 与 DL127 同向 | 【本册裁定】 |

### 13.1 盲区清单

| # | 盲区（推断，待核实） | 影响什么 | 核实手段 |
|---|---|---|---|
| **B1** | **撮合的串行化手段未实测**：本册沿用 R62 的 `pg_advisory_xact_lock(hash(币对))`，但 `ledger.spec` §16 把它列为 **P0 未实测项** ⇒ 并发两只买单抢同一笔卖单的行为**未经实测**。 | `DL68`（挂单冻结归属/判据 5 的挂单部分） | P5 前跑一次双并发撮合探针（run-tagged） |
| **B2** | **`migrations/` 的目录位置**：本册开工时先按 `migrations/**` 写，实测在 **`backend-ts/migrations/`**（`0001`–`0012`，12 个文件）⇒ 已在 §16 更正；**`0013+` 的落点须复核**。 | §6.1 全部路径 | `ls backend-ts/migrations/`（已核，见 §16） |
| **B3** | **旧 `task_progress.jID` 与 `tID` 的语义**：审计同时引用两者（`jID` 出现在 `listPendingVerification` 的列清单）⇒ 推断 `tID` = 招工单、`jID` = 报名/提交记录。**未经 schema 核实**（旧基建库不可读）。 | §3.2 #6/`job_application` 的 PK 对应 | 找旧基建库 schema（或 jinli 仓的建表脚本）对读 |
| **B4** | **旧 `prize.bID` 的语义**：审计把它与 `shard.bID` / `market/:bID` 共用 ⇒ 推断 `bID` = 「品牌/商品 id」（brand id），并在交易所路径里**复用成币对**。**两个语义共用一个列名是推断**。 | C2 的改名清单（`bID → base_cid`） | 同上 |
| **B5** | **`referral_bind()` 守卫被违反时的码名**：本册 §11.2 该格留空 = **未核实**（`commission.spec` 的绑定守卫（CR16/CR86）是否返 `LD0xx` 未在账本表内名列）。 | `POST /api/referral/bind` 的码面 | 读 `commission.spec` §3.3 ④′ 与 `0010` 的 `RAISE` 语句 |
| **B6** | **`app_config` 的原列形状**：审计判其「列类型不可信」（懒 DDL 建出）；**且该表已被 D19 的 `DROP` 移除** ⇒ 不存在历史形状可比对。 | DL71（本册直接要求重新 `CREATE`） | 无（已无表可核；按本册 DDL 提案重建） |
| **B7** | **`permission_group.readonly` 的语义**：审计的列清单里有该列，**语义未核实**（推断 = 「系统内置组不可删」）。 | DL72（本册**不复用**该表，改三维权限模型） | 无（表已 DROP） |
| **B8** | **旧 `#54` 调分是否写过审计/日志**：旧实现调 `upsertAsset`（`asset` 表），**是否留痕未核实**。 | C3（#54 的保留条件里「必须审计」这条的基线） | 读旧 `adjustPoints` 实现 |
| **B9** | **前端对旧路由的依赖面未核**：本册**未读** `frontend/**` 与 `apps/web` 的调用清单 ⇒ 「删除某路由是否立刻打红前端」**未核实**（例：`chest/open` 是否真无入口）。 | §10 的 19 条「删除」判定 | `grep -rn "/api/" frontend/` 的调用清单 |
| **B10** | **平台 `$` 的 `cid = 1` 是否已 seed**：本册多处按「`$` = `cid 1`」写（DL64/DL87），**未核 `currency` 表的 seed 行**（本册不连库）。 | 交易所基础货币、`trade_fee` 币种 | 只读查询 `SELECT cid,symbol,status FROM currency` |
| **B11** | **26 条写方法的运行时行为未实测**：审计只发 GET（read-only audit）⇒ §10 对写路由的判定是**静态推断**（含「旧实现是否有守卫」这类结论）。 | §10/DL114 | P3 Step 2/3 的写路径探针 |
| **B12** | **`index.ts` 之外是否还有路由装配点**：本册只读 `index.ts`（55 条）+ `auth.ts`；`backend-ts/src/` 的其余文件（`ledger.ts` / `commission.ts` / `database.ts` 的查询层）**未逐行读**。 | DL17 的 L0–L3 分层落点 | `ls backend-ts/src/` + 逐文件 function 清单 |

### 13.2 **v0.2 只读探针**：本次实测（`SELECT` only，**未写库**）

> **为什么在这里**：`master-plan` 硬 3「派单里的『运行时真值』必须当场现取，不得从文档转抄」。v0.2 因两条库级事实（`master-plan` §5.33）而**实际连库读了 5 组只读查询**，读数如下 —— 它们把 §13.1 的 **B10 关闭**、并为 §17 的两个新 `DL` 提供**一手依据**。
> **探针位置**：`backend-ts/.env.local` 的 `DATABASE_URL`（**只读**；连接串**未**落入本册，也**未**打印）；驱动 = 仓库内既有 `@neondatabase/serverless@0.6` 的 `neon()` HTTP 单语句模式。**⚠️ 诚实边界**：该 HTTP 驱动在**快速连续调用**下出现过 `fetch failed`（**本次第 2 轮重跑即复现 3/5 查询失败**）⇒ **探针结论以「同一轮内成功返回的那几条」为准**，失败的项**不得**用前一轮的旧值假装成功（本轮已按此纪律处理）。

| # | 读数（v0.2 实测） | 用来关掉/支撑什么 |
|---|---|---|
| P1 | **`public` 的基表恰好 8 张**：`account` / `commission_policy` / `currency` / `ledger_entry` / `ledger_owner` / `referral` / `schema_migration` / `users` | **`DL8` / `DL138` 复核通过**（库 == `0012` 目标集；9 张懒表**确已不在**） |
| P2 | **`schema_migration` 的 `max(version) = 0012`** | **`DL7` / `DL139` 复核**（迁移链停在 `0012` ⇒ `0013` 是下一个号，**未被占用**） |
| P3 | **`account` 同名片**：`public.account` = **7 列**（`uid,cid,balance,frozen,version,time_created,time_updated`）；`neon_auth.account` = **13 列**（`id,accountId,providerId,userId,accessToken,refreshToken,idToken,accessTokenExpiresAt,refreshTokenExpiresAt,scope,password,createdAt,updatedAt`） | **§17.1 / `DL151` 的一手依据**（跨 schema 同名表**为真事实**） |
| P4 | **`neon_auth` 共 9 张表**：`account` / `invitation` / `jwks` / `member` / `organization` / `project_config` / `session` / `user` / `verification` | **§12.2-11 待裁项**；另注：`neon_auth.user` 与 `public.users` **不同名但近名**（`user`/`users` 的裸名陷阱同族，**硬 1**） |
| P5 | **`currency`：`cid = 1` ⇒ `symbol = '$'`、`status = 'listed'`、`owner_uid = 0`**（共 100 行；其后为测试币，`owner_uid ≥ 900001`） | **关掉 `B10`**（原「未核 `currency` 的 seed 行」）⇒ `$` = `cid 1` **且已 `listed`**，可作交易所基础货币与计价币种（`DL64` / `DL87`）成立 |
| P6 | **`users` 共 411 行** | **复核 D20 / `DL14` 的「411 条测试残差」**（数字一致） |
| P7 | **`public` 的 FK 约束共 5 条** | 供 §6 的「新表 uid 列必须 FK / `*_txid` 不建 FK」（`DL13` / `DL78`）做基线比对 |

> **仍未核**（**不得**读作已核）：`commission_policy.fee_rate_bp` 的**列名**与裁定原文 `fee_bp` 的差异已登记（§12.2-12 / `DL152`）；旧基库 schema（B3/B4）**仍不可读**；前端调用面（B9）**仍未扫**。

---

## §14 规则总索引 DL1..DL155

> **形态说明**：本节给**区间索引 + 主题反查**（**不逐条复制正文**，避免同一句话在册内出现两次 ⇒ 违反「单一真源」）。
> **规则总数 = 155 条**（`DL1`–`DL155`，**连续无空洞**）；**账本错误码（`LEDGER_*`）新增 = 0**（§11，33 码关闭集不增不减）；**新增 AUTH 域码 = 2 条**（`AUTH_UNAUTHORIZED` / `AUTH_FORBIDDEN`，**非账本域**，§11.3 / `DL147`）；**`kind` 扩展请求 = 0**（§7.2）。核对命令：`grep -c '^| \*\*DL[0-9]' docs/data-layer.spec.md` ⇒ 应等于 `155`（§14 本表不含 `DL**` 前缀行，故不干扰计数）。
> **✅ v0.2 的编号变更（只增不重排）**：v0.1 = `DL1`–`DL139`；v0.2 **追加 `DL140`–`DL153`（14 条）** ⇒ **153**。**✅ v0.3**：**追加 `DL154`（1 条）** ⇒ **154**；`DL1`–`DL153` **一条未动、未重排**。**v0.1 的 1–139 号一个未动、一个未删、一个未重排**（回写是对既有规则的**内容更新**，就地改 + 「v0.1 旧写法」留痕）。 **✅ v0.4**：**追加 `DL155`（1 条）** ⇒ **155**；`DL1`–`DL154` **一条未动、未重排**。⚠️ **v0.4 的编号变更只在「迁移号」域**（§6.1：`0014_job_flow.sql` 及其后四柱顺延，`DL47`）；**`DL` 规则号域只增不重排**，两者**不是同一件事**，不得混读。

| 区间 | 章节 | 主题 |
|---|---|---|
| `DL1`–`DL10` | §1.1–§1.3 | 唯一真源、三条禁令（禁余额直写 / 禁运行时 DDL / 禁业务表存余额） |
| `DL11`–`DL16` | §1.4 | 命名、身份（`uid`/`evm`）、测试数据、管理员 |
| `DL17`–`DL25` | §2.1–§2.3 | L0–L3 分层、单语句事件、读路径（keyset / 带 `cid` / 无副作用） |
| `DL20`–`DL22` | §2.2 | **C1 争议项**：业务编排函数 / 两阶段 / 两条硬约束 |
| `DL26`–`DL33` | §3 | 旧→新：表 / 列 / 路由族群映射 |
| `DL34`–`DL41` | §4 | 对审计 `mapping_proposal` 的逐条判定口径 |
| `DL42`–`DL45` | §5 | 争议项的处理机制（可切换点、回写、阻塞标注） |
| `DL46`–`DL49` | §6.1 | 迁移编号总表与迁移纪律（幂等 / 无 `down`） |
| `DL50`–`DL58` | §6.2 | **①招工**：`job` / `job_application` / `job_submission` + 冻结判据 + 键 |
| `DL59`–`DL63` | §6.3 | **②商品**：`listing` / `listing_order`（P4） |
| `DL64`–`DL69` | §6.4 | **③积分交易所**：`market_order` / `market_trade` / `candle_view`（P5） |
| `DL70` | §6.5 | **④返佣可见面**：不建表 |
| `DL71`–`DL73` | §6.6 | 平台配置：`app_config` / 权限模型 / `currency_status_log` |
| `DL74`–`DL80` | §6.7 | 通用规约：索引预算、三件套、可变/不可变、命名、禁 `DELETE` |
| `DL81`–`DL92` | §7 | 业务动作 → `kind` 映射（20 关闭集）+ 0 扩展请求 |
| `DL93`–`DL100` | §8.2 | 幂等键：前缀、创建/业务分野、指纹、重放 |
| `DL101`–`DL102` | §8.4 | 一次请求一个事件、创建类两次写 |
| `DL103`–`DL112` | §9 | `requireActor`/`requireAdmin`、权限位、`evm`、`uid` 生成、可见性 |
| `DL113`–`DL118` | §10 | 55 条路由的保留/重写/删除、P3 开口径、开工前置 |
| `DL119`–`DL126` | §11 | 错误码：不新增码、逐路由映射、`404` 三类、`500` 边界 |
| `DL127`–`DL130` | §12.3 | 待裁项机制、裁定回写、悬置语义、P3 前必清 5 项 |
| `DL131`–`DL133` | §13 | 盲区登记义务、核实手段、不得延后判断 |
| `DL134`–`DL135` | §15 | 版本纪律（快照 / 向后追加） |
| `DL136`–`DL139` | §16 | 落笔期间的仓内变更登记（HEAD 推进、`ensureLegacyTableNames`、懒表已 DROP、迁移目录） |
| **`DL140`** | **§1.2** | **（v0.2 补写）禁运行时 DDL 的验收 = 类级断言（全树扫模式集），不得用实例级 grep** |
| **`DL141`–`DL144`** | **§2.2** | **（v0.2 新增）C1 四条硬约束**：① 加锁全序（业务行→currency→account）／② 编排函数只由迁移创建 + 体内禁 DDL／③ 必带幂等键 + `ref_id` 落引用列／④ 重放语义对齐 `R51`/`R52` |
| **`DL145`** | **§3.4** | **（v0.2 新增）C2 命名风格权威消歧条**（路径参数 camelCase / DB 列 snake_case / query 键不动） |
| **`DL146`** | **§10.2** | **（v0.2 新增）C3 ③：`#54` 调分的「锁死条件」五条** |
| **`DL147`** | **§11.3** | **（v0.2 新增）C4+C6 AUTH 域码登记表**（2 码 + 3 个 `reason`；**不进 `LEDGER_*`**） |
| **`DL148`** | **§11.1** | **（v0.2 新增）C5「码名语义窄化」已知债 + 清偿条件（正向/反向/bucket 一次到位）** |
| **`DL149`** | **§8.2** | **（v0.2 新增）C8 判负用例：同键重放不追加 `ledger_event_keys` 项（三条断言）** |
| **`DL150`** | **§6.4** | **（v0.2 新增）C9 升级条件：`candle_view` → 物化视图/落表的门槛与手续** |
| **`DL151`** | **§17.1** | **（v0.2 新增 · 库级事实①）所有 SQL 必须显式限定 `public.`，禁裸表名（跨 schema 同名表）**（§1.3 有指针） |
| **`DL152`** | **§17.2** | **（v0.2 新增 · 库级事实②）政策表回归判据 + P3 夹具不得向生产政策表追加生效版本**（§1.3 有指针） |
| **`DL153`** | **§17.3** | **（v0.2 新增）`kind` 口径缺口登记**（`platform_withdraw` **待 Kevin**；`listing_deposit_forfeit` P3 不启用） |
| **`DL154`** | **§15** | **（v0.3 新增 · M5）留痕为节录式（非原文照录）；原文出处 = `docs/versions/data-layer.spec.v0.1.md`（已入库）** |
| **`DL155`** | **§17.4** | **（v0.4 新增）`src/db.ts#getSchemaVersion`（`:252`）未限定 `public.` ⇒ 与 `DL151` 字面口径不一致；登记为「待收紧项」（下一接路由的单处理），不阻塞 `0013` 验收** |

**主题反查（高频）**：
- 「谁能写余额」→ `DL5`（禁直写）+ `DL12`（保留 uid）+ `DL18`（唯一入口）+ `DL110`（路由守卫）。
- 「钱冻住了对不对」→ `DL4` + `DL57`（招工）+ `DL68`（挂单）+ `DL100`（键自证）。
- 「这笔动作算什么 kind」→ §7.1 表（逐动作）。
- 「这条路由该不该留」→ §10.1 表（逐条 55）。
- 「报什么错、什么状态码」→ §11.2 表（逐路由）；**401/403 另见 `DL122` + §11.3（AUTH 域码登记表）**。
- 「还没定的事有哪些」→ §12（**9 条争议已全裁** + **12 条待裁**，其中 **#11/#12 已于 v0.3 关闭**）+ §13（12 条盲区，**B10 已由 §13.2 关闭**）。
- 「v0.2 / v0.3 / v0.4 改了什么、旧写法是什么」→ **§15 变更记录** + 全册每一处的「▸ **v0.1/v0.3 旧写法**」行；**新增的 16 条** = `DL140`–`DL155`（v0.2 的 14 条 + v0.3 的 1 条 + v0.4 的 1 条；见上表末段）。
- 「跨 schema / 裸表名」→ `DL151` + §17.1；「政策表被测试夹具污染」→ `DL152` + §17.2；「裸表名**现存违规点**（`getSchemaVersion` 待收紧）」→ `DL155` + §17.4。
- 「迁移号为什么从 `0014` 顺延到 `0018`」→ **§6.1 表 + 表后说明**（`DL47`：**一次性定死**，`0013` 之后不得再动）；「`DL52①` 的 `23514` 还算数吗」→ **否**，见 `DL52①` 的 **v0.4 加注** + `DL51`（C5 借码 ⇒ `LD011` ⇒ **409**）。
- 「留痕是原文照录还是节录」→ `DL154`（**节录式**；原文出处 = 已入库的 v0.1 快照）；「订单簿读口什么形态」→ **路径形唯一权威** `GET /api/market/:baseCid/orderbook`（§10.1 #32/#33 的 query 形已废弃，O1）。

---

## §15 变更记录

| 版本 | 日期 | 作者 | 说明 |
|---|---|---|---|
| **v0.1** | **2026-09-28** | **Jing（制度员）** | **首版**（`master-plan` §5.29 派单的 Step 2 交付物）。**无改前快照**（首版，按任务约定不建版本快照）。内容：§0 元信息与范围；§1 唯一真源与三条禁令；§2 L0–L3 分层与写路径（含 **C1 争议项**）；§3 旧→新逐表/逐列/逐路由映射；§4 对审计 `mapping_proposal` 55 条的逐条判定（采纳/修正/驳回 + 理由）；§5 **争议项单列 C1–C9**；§6 四柱数据模型提案（`0013`–`0016`，**只提案不落 SQL**）+ 每笔动作的 `kind`；§7 `kind` 全量映射与 **0 扩展请求**；§8 幂等键约定 + 逐路由键表；§9 鉴权/身份/`uid` 生成；§10 **55 条路由的保留/重写/删除** + P3 开口径；§11 **逐路由错误码映射（不新增码）**；§12 待裁决项（9 争议 + 10 待裁）；§13 盲区 B1–B12；§14 索引（`DL1`–`DL139`，139 条）。(+§16 落笔期间的仓内变更登记)。**未写任何 SQL 文件 / 未改 `migrations/**` / 未改 `backend-ts/src/**` / 未改 `frontend/**` / 未改上位三册 / 未 commit。** |
| **v0.2** | **2026-09-28** | **Jing（制度员）** | **全量回写 Zang 九项终审裁定（`C1`–`C9`）+ 两条库级事实（`master-plan` §5.32 / §5.33）**。**改前快照 = `docs/versions/data-layer.spec.v0.1.md`（156970 B，md5 `6f89f444d5df0351e84bdfce9621e3b1`；`cp -n` 建，**未覆盖**任何已有文件）**。**编号**：`DL1`–`DL139` **一条未动**（就地内容更新 + 「▸ v0.1 旧写法」留痕）；**新增 `DL140`–`DL153`（14 条）** ⇒ **总数 153**。**受影响的格（同一版内一次改完，`DL43`/`DL44`）**：§0.3（新增状态取值与编号纪律）、§0.4（张力 1/2/5/7 加已裁结论）、§1.2（补写 **`DL140`**）、§1.3（两条增补的**指针 + 触发条件**，正文在 §17.1/§17.2 ⇒ 一条规则只有一处正文，`grep` 计数不受扰）、§2.2（`DL20` 改、`DL21` 降为未采纳、`DL22` 加固、新增 **`DL141`–`DL144`**）、§3.4（`DL33` 改口径 + 新增 **`DL145`**）、§4.1（#11/#13/#14/#32/#33/#37/#45/#46/#47/#50/#51/#52/#54 追加裁定）、§4.2（加 v0.2 复读：「判定分布不变」）、§4.3（§5.2 ①② 两行）、§5（**全表重写：新增裁定列 + v0.1 倾向/备选留痕**；含追加的 `kind` 缺口行）、§5.1（加 `DL43`/`DL44` 履约声明）、§6.1（`0013`–`0015` 标已裁）、§6.2–§6.4/§6.7（`DL50`/`DL51`/`DL59`/`DL64`/`DL66`/`DL75` 改 + 新增 **`DL150`**）、§8.2（`DL98` 加严 + 新增 **`DL149`**）、§9.1–§9.2（`DL105`/`DL106`/`DL111` 改）、§10.1（#37/#45/#46/#47/#50/#51/#52/#54；**#50 原「管理员=审核方」与 C7 相反，已就地改正**）、§10.2（`DL115`/`DL117` 改 + 新增 **`DL146`**）、§11.1（`DL119` 改 + 新增 **`DL148`**）、§11.2（**`403` 列 12 行的 `LD015`/`LD016` 全部改为 `AUTH_FORBIDDEN`** + 加改动说明）、§11.2 后（`DL122` 改 + 新增 **`DL147`** + **新增 §11.3 AUTH 域码登记表**）、§12.1（**全表重写：9 项裁定 + 阻塞解除**）、§12.2（新增待裁项 **11 `neon_auth`** / **12 费率列名**）、§12.3（`DL130` 改）、§13.1（联 B10 等）+ **新增 §13.2（v0.2 只读探针 P1–P7）**、§14（**区间改 `DL1..DL153`** + 加 14 条索引行 + 主题反查加两行）、§15（本行 + `DL134` 补实际快照读数）、**新增 §17（两条库级事实 + `DL151`/`DL152`/`DL153`）**。**范围纪律**：**只写本文件**；**未**碰 `docs/ledger.spec.md`（另一单在改）/ `backend-ts/**` / `frontend/**` / `migrations/**`（只提案编号，**未写 SQL**）/ `docs/seafood.master-plan.md` / `docs/audit/**`（只读）/ `docs/qa/**`；**未 commit / 未 push**；**未启停 5787/5788**。**库操作**：§13.2 的探针**全部只读 `SELECT`**（`backend-ts/.env.local` 的连接串**未落入本册**）。 |
| **v0.3** | **2026-09-28** | **Jing（制度员）** | **v0.2 聚焦复核「需修」全项小修（Neng 报告 `docs/qa/data-layer.spec-v02-review.md` 161 行，verdict=需修 M1–M5 全低危）+ 四项裁定落位**。**改前快照 = `docs/versions/data-layer.spec.v0.2.md`（**210787 B**，md5 **`cfeae444d0633591c17b7271ee549a24`**；`cp -n` 建，`git show 4ad0de4:docs/data-layer.spec.md | cmp -` **逐字节相同**）。**编号**：`DL1`–`DL153` **一条未动、未重排**；**新增 `DL154`（1 条）** ⇒ **总数 154**。**八项**：**M1** §6.3/§6.4 列清单补 `ledger_event_keys text[] NOT NULL DEFAULT '{}'`（`listing` / `market_order`，向 `DL64`「已定案」与 `DL75` 三件套对齐）+ `create_key` 全线统一 `text NOT NULL UNIQUE`（对齐 `ledger.spec` R109④，消除三种写法）；**M2** `reason` 统一为裁定逐字 `JOB_STATE_INVALID`（§11.2 五行 + `DL119`；v0.2 小写形态留痕）；**M3** `DL152` 修正夹具 `policy_id` **2–19 → 20–37** + 补证据指针（Zang run-tagged 件）+ 新增类型事实 `weights_bp smallint[]`；**M4** §11.3.1 增 `i18n_key` 具体值列（前端无既有键 ⇒ 登记「需新增键」+ 建议值，风格对齐 `backend-ts/src/ledger-errors.ts:219` 的 `ledger.err.<code>`）；**M5** 新增 `DL154` 明写「节录式、非原文照录；原文出处 = v0.1 快照（已入库）」；**R109 交叉引用** = `DL141`–`DL144`（`DL141` 兼补 `R79`）+ 上位册改指 `ledger.spec v0.12`；**§12.2-11/-12 关闭**（记录 Zang 两条裁定：不启用 Neon Auth / 费率列名以 `fee_rate_bp` 为准）；**O1 定性**（路径形 `GET /api/market/:baseCid/orderbook` 为唯一权威，§10.1 #32/#33 query 形登记 v0.1 旧写法废弃；`DL145③` 不动）。**范围纪律**：只写本文件 + `docs/versions/data-layer.spec.v0.2.md` + `docs/audit/p3-data-layer-v03.md`；**未**碰 `docs/ledger.spec.md` / `docs/qa/**` / `docs/seafood.master-plan.md` / `docs/versions/data-layer.spec.v0.1.md` / `backend-ts/**` / `frontend/**`；**未** commit / add / push。**库操作**：v0.3 **零库操作**（M3 读数由 Zang 提供）。 |
| **v0.4** | **2026-09-28** | **Jing（制度员）** | **Zang 终审落地四项（起因：`0013` 实交付 = `job` 单表，而 §6.1 原定三表；`0013` **已应用不得改** ⇒ 两表顺延）**。**改前快照 = `docs/versions/data-layer.spec.v0.3.md`（**220752 B**，md5 **`0a8e228dcbc1dcb517a378ca46dee79c`**；`cp -n` 建，`git show d10c66a:docs/data-layer.spec.md | cmp -` ⇒ **退出码 0、逐字节相同**）。**编号纪律**：`DL1`–`DL154` **一条未动、未重排**（**正文原样**，本次**不含**任何 `DL` 正文改写）；**新增 `DL155`（1 条）** ⇒ **总数 155**。**四项**：**① §6.1 迁移编号表一次性重排** —— `0013` 行标注 **已应用**（`schema_version=0013` / 13/13 `skipped` / `public` 表 9 / `job` **14 列**）+ 实际文件 `0013_job.sql` = **`job` 单表**，并在同行明写「**`job_application` / `job_submission` 顺延至 `0014`**」（v0.3 三表口径就地留痕）；**新增 `0014` 行 = `0014_job_flow.sql`**（`job_application` / `job_submission` + 其守卫 `DL54`–`DL56`，期 **P3**）；原 `0014_listing.sql` ⇒ **`0015`**、原 `0015_market.sql` ⇒ **`0016`**、原 `0016_platform_config.sql` ⇒ **`0017`**、原 `0017`（不提案）行 ⇒ **`0018`**（连带依赖列同步：`0016`←`0015`、`0017`←`0013`–`0016`）；表后加说明「**本重排一次性定死；`0013` 之后的编号不得再动（`DL47`）**」；**② `DL52①` 的 `23514` 就地加注**（**原文不删**，编号/留痕纪律 `DL154`）：`23514` = **v0.1 旧写法**，已被 `DL51` 的 C5 裁定取代 ⇒ 实现走 `ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION')` ⇒ `LD011` ⇒ **409** + `details.field='job.status'` + `reason=JOB_STATE_INVALID`；`0013_job.sql` 已按此实现并验收；**③ 新增 `DL155`**（**§17.4**：`src/db.ts:252#getSchemaVersion` 现读未限定 `public.`，与 `DL151` 字面口径不一致 ⇒ 登记为**待收紧项**，下一接路由的单处理，**不阻塞 `0013` 验收**）；**④ 版本与索引同步**（版本头 ⇒ **v0.4**；本节本行；§14 标题 ⇒ **`DL1..DL155`** + 规则总数 **155** + 新增 `DL155` 索引行 + 主题反查新增两条；目录 §14 条目同步）。**范围纪律**：只写 `docs/data-layer.spec.md` + `docs/versions/data-layer.spec.v0.3.md` + `docs/audit/p3-data-layer-v04.md`；**未**碰 `docs/ledger.spec.md` / `docs/qa/**` / `docs/versions/data-layer.spec.v0.1.md` / `.v0.2.md` / `docs/seafood.master-plan.md` / `backend-ts/**`（`db.ts:252` 仅**只读** `grep` 复核）/ `frontend/**`；**未** commit / add / push。**库操作**：**零库操作**（`0013` 的验收读数由 Zang 提供；本版未连库、未跑探针）。**未做（明确登记）**：§6.3 / §6.4 / §6.6 的**节标题文件名**（`0014_listing.sql` / `0015_market.sql` / `0016_platform_config.sql`）与册内若干**正文引用**（`DL9` / `DL27` / `DL149` / `DL121` 等的 `0014`/`0015`/`0016` 字样）**未随本重排改**（本次授权范围仅 §6.1 表 + 表后说明）⇒ 逐处行号见 `docs/audit/p3-data-layer-v04.md`「未做项」。 |

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL134** | **版本号只增不复用；自 v0.2 起每次修订必须留改前快照**（`docs/versions/data-layer.spec.v<X.Y>.md` + md5），并在本表登记「改了什么、为什么」；**v0.1 例外**（首版无改前版 ⇒ 无快照，符合任务约定）。**✅ v0.2 已履约**：改前快照 = `docs/versions/data-layer.spec.v0.1.md`（**156970 B**，md5 **`6f89f444d5df0351e84bdfce9621e3b1`**；`cp -n` ⇒ **若目标已存在则不覆盖**，本次**未**覆盖任何文件）；**每一处被改的口径都就地保留了「▸ v0.1 旧写法」行**（本册 v0.2 共 **30+ 处**）。**快照已存在的处理**：若 `docs/versions/data-layer.spec.v<X.Y>.md` **已存在**，**不得覆盖**，应**如实报告**并另择名（本节即此纪律）。 | 本表 + `docs/versions/` | 与 `ledger.spec` / `commission.spec` 的版本纪律一致（其 §18 每版都留 md5 与行数） | 【本册裁定】（v0.2 已履约） |
| **DL135** | **章节编号一律向后追加，不重排**（新增内容一律成为新 `§n`；同名章节只做就地增补并标注版本块）——**唯一的例外**是本册 v0.1 自身的 §16（它登记的是「落笔期间仓内已发生的事实」，不属于新增规范）。 | 后续修订 | 重排编号会让所有跨册引用失效（`ledger.spec` 的「新增一律向后追加」纪律） | 【本册裁定】 |
| **DL154** | **（v0.3 新增 · M5 从轻裁定）留痕体制 = 节录式，非原文照录；原文出处 = `docs/versions/data-layer.spec.v0.1.md`（已入库）。** 本册自 v0.2 起对**被就地改写的旧条文**（`DL20/21/22/33/50/51/59/64/66/75/98/105/106/111/115/117/119/122/130/134` 共 **20 条**）保留的「▸ **v0.1 旧写法**：…」行属**节录式**（含省略号、**非**逐字照录）⇒ 下游**不得**据节录文本回推 v0.1 原文；**要原文时取已入库的 v0.1 快照** `docs/versions/data-layer.spec.v0.1.md`（156970 B，md5 `6f89f444d5df0351e84bdfce9621e3b1`，由 `4ad0de4` 入库）。**v0.3 起**每次修订同样留**改前快照**（`DL134`）⇒ 每版原文**随时可取**（这正是 M5「从轻」的理由：快照在库，「全文照录」边际价值低）。 | `docs/versions/**`；本册各「▸ 旧写法」行 | 「节录」与「原文照录」是两种不同强度的留痕（`ledger.spec` v0.12 用原文照录）；不区分会让审阅者按「照录」预期回查而落空 | **【本册裁定】**（v0.3 · M5） |

---

## §16 v0.1 落笔期间登记：仓内已发生的事实（**就地更正**）

> **为什么有这一节**：本册 §1–§13 是**按 P3 Step 1 之前的状态**起草的（派单时 HEAD = `dbccd89`）；落笔期间 HEAD 被推进到 **`fab9d32`**（4 个提交），其中 **Step 1 已把运行时 DDL 摘掉**。按 `master-plan` §5.29 的新纪律（「交接/验收前必须重跑 `git log` 对锚」「不得把截断的工具输出当作完整事实」），**已发生的事实必须就地登记而不是静默覆盖正文**。

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL136** | **HEAD 对锚与引用纪律**：本册起草时 **HEAD = `dbccd89`**；落笔中 **HEAD = `fab9d32`**（P3 Step 1 摘 `ensureSupportSchema`）；**交付时 HEAD = `0da1cea`**（master-plan **v0.36 / §5.31**「自我更正：v0.35 的『读不再写』下得过宽；第二步 DDL 路径已派 Step 1b」）。⇒ **凡引用仓内文件者必须给 blob sha256**；**本册 §3/§9/§10 的行号与判定取自 `backend-ts/src/index.ts` 在 `dbccd89` 的状态**，若该文件之后被改，须以**固定副本**重跑再引用。**⚠️ 本仓在本次交付窗口内被并发推进 ≥2 次（`dbccd89`→`fab9d32`→`0da1cea`）** ⇒ 下游引用本册任何行号前，先跑 `git log --oneline -3` 对锚。 | 本册后续修订；派单 brief | 「引用漂移」是本仓已实测发生的事故（§5.29 的并发会话冲突）；`git status` 现另见 `docs/qa/*` 三份未跟踪文件与 `backend-ts/src/database.ts` 的工作区改动，**均非本册产物** | 【已冻结】（`master-plan` §5.29 纪律） |
| **DL137** | **`ensureLegacyTableNames` 必须与 `ensureSupportSchema` 同族摘除**：`backend-ts/src/database.ts:239` 定义（模块级缓存 `legacyTableEnsurePromise` 在 `:57`），体内 `DO $$` 含**两处条件 DDL** —— `:250-251` `gift → prize_item` 的 `ALTER TABLE ... RENAME TO`、`:254-255` `journey → task_progress`；被 **4 个读方法**调用（`listBrands:1046` / `listTasks:1197` / `getTask:1226` / `getBrandById:1466`）。**本册裁定：摘除**（依据：① 它是**请求路径上的 schema 变更**，与 DL6「禁运行时 DDL」同罪；② 目标表在新数据层里**根本不存在**（§3 判定旧表整体废弃）⇒ 无表可 rename，今天是**条件空转**；③ `AGENTS.md` 禁死代码）。**✅ 与 `master-plan` §5.31 的处置一致**（该处已派 **Step 1b**：摘除定义 + 孤儿 promise + 4 处调用，并以**类级断言**交付）。 | 已派 **Step 1b**（Kong） | 不摘它 = 运行时 DDL 会以「条件 RENAME」的另一形态复活；且「条件空转」**不改表数** ⇒ 用表数不变来验收「读不写」是**假证** | **【已冻结】**（本册裁定 + `master-plan` §5.31） |
| **DL138** | **9 张懒表已被 `DROP` ⇒ 本册一切「沿用/重建」措辞统一为「重新 `CREATE`」**：`app_config` / `prize` / `prize_item` / `task_progress` / `shard` / `shard_transfer` / `market_order` / `market_trade` / `permission_group` **全部不在库、不在任何迁移**（`master-plan` §5.30：真库 17 → **8** 张表，与 `0012` 目标集逐一相等）。⇒ ① `DL71`（`app_config`）与 `DL72`（权限模型）的建表责任 **100% 在 `0016`**；② 旧表名（`prize` / `shard` / `task_progress` / `market_order` / `market_trade`）**在库里不存在** ⇒ §3 的「旧→新映射」是**代码/概念层映射**，**不是**「改表现有结构」。 | §3 / §6 / §10 的措辞 | 「按旧表改结构」会凭空造出 9 张表（正是 D19 刚清掉的东西） | **【已冻结】**（`master-plan` §5.30 / D19） |
| **DL139** | **迁移目录 = `backend-ts/migrations/`**（**不是** 仓根 `migrations/`）：已核 12 个文件 `0001_ledger_core.sql` … `0012_replay_pre_gate_before_balance_gate.sql`。⇒ 本册 §6.1 的 `migrations/0013_…` 一律读作 **`backend-ts/migrations/0013_…`**。**另**：本册 §9 提到的 `users` 建表语句在 `0002_user_identity.sql`、函数体在 `0004`/`0005`/`0009`/`0012`（与 `ledger.spec` 的登记一致）。 | §6.1 / §9 / §13-B2 | 「迁移放在哪」是 Kong 落地时第一件会撞的事 | **【已冻结】**（实测 `ls`） |

---

## §17 **v0.2 新增**：两条库级事实（跨 schema 同名表 / 政策表回归判据）

> **本节是 v0.2 的新增章**（按 `DL135`「章节编号一律向后追加，不重排」放在 §16 之后）。**两条事实的来源** = `master-plan` **§5.33**（Zang 的「两条库级发现 + 一次自我更正」，2026-09-28），**v0.2 已用只读探针独立复核**（读数见 **§13.2 的 P1–P7**）⇒ 本节**不是转抄**，而是**一手读数 + 规范落点**。
> **为什么必须落进本册**：这两条都会**静默**改错东西 —— ① 裸表名会**读到另一张表**；② 测试夹具会**静默改全平台费率**。两者都属「不报错的错」，正是一个口径册该堵的东西。

### 17.1 跨 schema 同名表：`account` 在 `public` 与 `neon_auth` 各有一张

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL151** | **（v0.2 新增 · 库级事实① · 见 §1.3 的压缩版）新数据层的所有 SQL 必须显式限定 schema（`public.`），禁止裸表名。** **事实（v0.2 只读实测，§13.2-P3/P4）**：`account` **同时存在于两个 schema** —— `public.account`（**账本账户，7 列**：`uid,cid,balance,frozen,version,time_created,time_updated`）与 **`neon_auth.account`**（**13 列**：`id,accountId,providerId,userId,accessToken,refreshToken,idToken,accessTokenExpiresAt,refreshTokenExpiresAt,scope,password,createdAt,updatedAt` = **OAuth 会话列**）；`neon_auth` 另有 **9 张表**（`account`/`invitation`/`jwks`/`member`/`organization`/`project_config`/`session`/`user`/`verification`）。**规约三条**：① **裸表名一律禁止**（例：`SELECT * FROM account` 的结果**依赖 `search_path`** ⇒ 可能读到 **OAuth 会话表**并当成账本账户）；② 该纪律**同族**于 **硬 1**（裸 `user` 被解析成 `current_user`、**静默返回 1 行**）—— 两次都是**裸名解析陷阱**，一次已实测（`user`）、一次已实测（`account`）；③ **质检可判负**：对 `backend-ts/src/**` 的 SQL 字面量扫「`FROM`/`JOIN`/`UPDATE`/`INSERT INTO` 后**不带 `public.`** 的账本表名」。**✅ v0.3（已裁）**：`neon_auth` 的处置**已由 Zang 裁定（`master-plan` §5.38②，2026-09-28）= 不启用 Neon Auth** ⇒ 闭 §12.2-11；登录 = EVM 钱包签名（`DL107`），`neon_auth` 登记「**存在但未使用**」、新数据层**完全绕开**；**将来启用须另立规范**。 | 全仓 SQL 审查；code review 硬项；质检脚本（扫裸表名）；`src/db.ts` / `src/ledger.ts` 的查询层 | 一个不带 schema 的 `SELECT ... FROM account` **可能读到 OAuth 会话表**并把它当账本账户 ⇒ 与「唯一真源」（`DL1`）直接冲突；且它**不报错**（有名字就解析得到） | **【已裁定 · Zang 终审 v0.2】**（`master-plan` §5.33 ①；处置①为裁定、处置②为**待裁**） |

### 17.2 政策表回归判据：`commission_policy` 的「差一步」近失

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL152** | **（v0.2 新增 · 库级事实② · 见 §1.3 的压缩版）政策表回归判据 + 夹具禁令。** **事实（Zang 只读亲裁 + v0.2 §13.2 同批探针；证据件 = `/Users/kevin/.hermes/profiles/zang/cache/scratch/m3-arbitrate-20260928045335.json`，run-tagged、`public.` 限定只读）**：`commission_policy` 现有 **19 行** = **种子 1 行**（`policy_id=1`，`effective_from = 1970-01-01T00:00:00Z`）＋ **18 行测试夹具**（`policy_id` **20–37**，**全部 `created_by = 0`**；**id 全集 = `1` + `20..37`，`min=1` / `max=37`、无重号**）；列名 = **`policy_id` / `fee_rate_bp` / `levels` / `weights_bp` / `effective_from` / `created_by` / `time_created`**，其中 **`weights_bp` 类型实测 = `smallint[]`**（**按 `int[]` 比较会报 `operator does not exist: smallint[] = integer[]`** ⇒ 回归判据须按 `smallint[]` 写）。按 `effective_from` 取最新 ⇒ **末行 = `policy_id=37`，`fee_rate_bp = 100`、`levels = 10`、`weights_bp = {3000,2000,1500,1000,800,600,500,300,200,100}`** = **预期组合** ⇒ **当前生效政策是对的**。**判据（写死，可机读）**：**任何时刻，`max(effective_from)` 的那一行，其 `fee_rate_bp` / `levels` / `weights_bp` 必须等于预期组合**（当前 = **`100` / `10` / `{3000,2000,1500,1000,800,600,500,300,200,100}`**）。**夹具禁令**：**P3 测试夹具不得向生产政策表追加生效版本** —— 要么**独立命名空间**（测试专用 schema/表/`created_by` 标记），要么**夹具后立即断言末行 == 预期值**。**处置联动**：D20 清理时把 `commission_policy` **收回到 1 行种子**。<br>**⚠️ 列名差异（必须留痕）**：Zang 裁定与 `master-plan` §5.33 原文写 **`fee_bp`**，**库内实列名 = `fee_rate_bp`**（v0.2 实测，`§5.20 #3` 用的也是 `fee_rate_bp`）⇒ **本册判据按库内实列名 `fee_rate_bp` 写**，差异已进 **§12.2-12**（**✅ v0.3 已裁：以 `fee_rate_bp` 为准**；**不**静默改裁定原文）。<br>▸ **v0.2 旧写法（错，v0.3 已修正 · M3）**：夹具 `policy_id` 写作 **2–19**，与同句「末行 = `policy_id=37`」**自相矛盾** ⇒ **v0.3（Zang 亲裁，run-tagged `m3-arbitrate-20260928045335.json`）改为 `20–37`**；并**补证据指针** + **类型事实 `weights_bp = smallint[]`**。 | 质检脚本（run-tagged）；D20 清理批次；`commission.spec` §4.4 的键登记 | 「生效政策 = 最新 `effective_from`」是**运行时约定** ⇒ 任何一条最后落库的测试行都会**静默改变全平台费率与层级**；本仓已**差一步**（`fee_rate_bp=500 / levels=9` = **5% 手续费 + 9 级返佣**）；机制上不安全，**不是**「这次运气好」 | **【已裁定 · Zang 终审 v0.2】**（`master-plan` §5.33 ② / §5.38①；列名差异**已于 v0.3 裁定：以 `fee_rate_bp` 为准**） |

### 17.3 `kind` 口径缺口登记（`platform_withdraw` / `listing_deposit_forfeit`）

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL153** | **（v0.2 新增）两个 `kind` 缺口的**分级**登记（**不得**混为一谈）**：① **`listing_deposit_forfeit`（强制下架罚款）** = 已于 v0.3（P1c）删除；「强制下架罚款」是**新语义新 kind**，须单独裁定（`ledger.spec` §5.1 #21 / §19.8.B）⇒ **P3 不启用**（与 `DL82` 一致）。② **`platform_withdraw`（平台收入提取）** = **R103 悬置**（「在 Kevin 批准前 `−1` 只进不出」）⇒ **P3 不启用**；但它是**产品级**问题（平台要不要有出账口）⇒ **登记为「待 Kevin 表态」**，**不得**写「**Zang 已裁**」（Zang 只裁了「P3 不启用」这一层）。**两条共同约束**：在各自裁定到位前，**不得**在任何新迁移/新路由/新前端按钮里出现对应 `kind` 或「提取 / 罚款」入口（`DL129`：「悬置」不是「否决」，但**入口不得实现**）。 | 后台 P6；`ledger.spec` §5.1 / §15 #3；**§12.2-1 / §12.2-2** | 这两项**都涉及「平台出账」**⇒ 是**资金口径**而非实现细节；把 ② 误记成「Zang 已裁」会让**产品决策被技术裁定冒充** | **【已裁定（P3）· 产品层待 Kevin】**（`master-plan` §5.32 / R103 / v0.3） |

> **▸ v0.1 旧写法**：**本章不存在** —— v0.1 把 ① 压在 `DL82` 的一行、把 ② 压在 `DL8`/§13 的散点，**没有**独立的「库级事实」章；`neon_auth` 与政策夹具**两件事 v0.1 完全未登记**（它们发生在 v0.1 交付之后，属「已发生的仓内/库内事实」，按 §16 的纪律**就地登记而非静默覆盖正文**）。

### 17.4 **v0.4 新增**：`getSchemaVersion` 的 `public.` 限定缺口（`DL155` · **待收紧**）

> **登记依据**：与 `DL151`（全仓 SQL **必须**显式限定 `public.`、禁裸表名）**字面口径不一致** —— `DL151` 是「审查硬项」，本处是**已存在的具体违规点** ⇒ 按 §16「已发生的事实**就地登记**而非静默覆盖正文」的纪律**登记为待收紧项**（**不**改代码、**不**改 `DL151` 正文）。
> **诚实边界**：v0.4 **未复测**跨 schema 是否存在同名 `schema_migration`（**NOT_MEASURED**）⇒ 本条**不据未实测事实作断言**，仅登记「措辞口径不一致」这一**已实测**事实。

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **DL155** | **（v0.4 新增 · `DL151` 的现存违规点登记）`src/db.ts#getSchemaVersion` 现读 `SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1`（实测落点 = `backend-ts/src/db.ts:252`），**表名未限定 `public.`** ⇒ 与 `DL151` 的字面口径（「所有 SQL 必须显式限定 `public.`，**禁止**裸表名」）**不一致**。**处置 = 登记为「待收紧项」**：由**下一接路由的单**一并处理（改为 `public.schema_migration`，并纳入 `DL151③` 的裸表名扫描清单）。**不阻塞 `0013` 验收**（`0013` 的验收读数与门禁不受此影响）。 | `backend-ts/src/db.ts:252`（`getSchemaVersion`）；`DL151③` 的裸表名扫描；`/health` 的 `schema_version` 读口（§10.1 #5 / `DL7`） | 「不报错的错」与 `DL151` 的两次裸名陷阱**同族**：裸名解析依赖 `search_path`，一旦解析环境变化就会**静默**读到别的同名表 ⇒ 与「唯一真源」（`DL1`）冲突。当前实测结果正确（`schema_version=0013`），故**只登记、不紧急** | **【本册裁定】**（v0.4 · **待收紧**；下一接路由的单处理，**不阻塞 `0013` 验收**） |
