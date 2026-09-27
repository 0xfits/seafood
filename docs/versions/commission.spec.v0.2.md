# 海鲜市场 · P2「十级返佣」口径冻结裁定书

> **文档状态**：**v0.2 · 已完成**（18 章 [§0–§17] + 目录 + 规则总索引；**规则 = 85 条 `CR1–CR85`，无缺号**）。**v0.2 = 落位 `docs/seafood.master-plan.md` §5.20 的 16 项裁定**（**权威口径，逐条照落、不自行推导**）：**#1 防环机制重写**（`depth` **不再是防环机制** ⇒ 祖先检查 + 绑定串行化，且 `0007` 必须带「2-环反例」判负用例）、#2 **D13 胜**（差额按已有层级权重比例再分配）、#3 费率真源、#4 不建 `commission_payout` 表且 `ref_id` = 同一 `job_id`、#5 / #16 **守卫失败类一律 `400`**、#6 业务表可 FK 到 `users(uid)`、#7 `depth` 不设上限、#8 不提供改绑（错绑永久 ⇒ 排 P6）、#9 口径 A + `created_by` 放宽并去 FK、#10 禁止回填 `effective_from`、#11 无邀请人手续费**入 `−1`**、#12 雇主可为受益人、#13 无 `down` 迁移（有 `commission` 行只准前滚）、**#14 计算不下沉且「Σ佣金 == 手续费」由 DB 侧强制**（`0007` 触发器；**禁改 `ledger_post_event` 函数体**）、#15 读法 ①。**新增规则 CR78–CR85（编号空间不重排）**；**不新增错误码（仍 33 码关闭集）**；**章节编号未重排**。规则编号空间 = **`CR*`**（Commission Rule），**与 `docs/ledger.spec.md` 的 `R1–R108` 物理分离**，避免编号撞车（理由见 §0.3）。
> **权威性**：本文件是「十级返佣（P2）」的 **唯一权威口径**。
> **上位口径**：`docs/ledger.spec.md` **v0.8**（账本内核，1659 行 / R1–R108；**v0.8 = P2 裁定落位四处就地增补**：R45 由 D13 取代、§14.1 #32 费率真源更正、§7.2 #8 不建 `commission_payout` 表、R21 加范围限定）+ `docs/seafood.master-plan.md` **v0.24**（living plan；**§5.18 = append-only 的真实边界**、§5.19 = 本任务立项拆解、**§5.20 = 16 项裁定的权威口径**）。
> **冲突处置（硬纪律）**：① **账本机制**（事务 / 幂等 / 错误码 / 锁 / append-only）有冲突 ⇒ **一律以 `ledger.spec.md` 为准**；② **返佣业务口径**有冲突 ⇒ 以**本文件**为准；③ 本文件**不得**新增错误码（`LD001–LD033` 关闭集不动）、**不得**修改 `migrations/0001`–`0006`、**不得**改 `backend-ts/**` 与 `frontend/**`（本册只写口径，不写实现）；④ **不得修改 `ledger_post_event` 函数体**（裁定 #14 **明令禁止**）—— `0007` 只允许在 `ledger_entry` 上**新增只读的后置断言触发器**（见 CR80）；⑤ **P2 的 DB 变化只允许落在 `0007`**；若采纳裁定 #11 的「手续费入 `−1`」路由，则**还必须**用 **`0008+`** 扩展 `−1` 的白名单（**只能新建迁移，不得改 `0001`–`0006`**，见 CR84 / §9.5 / §12.2 / §14.2 #1）。
> **制定者**：Jing（制度员） | **裁定者**：Zang | **落库实现**：Kong | **质检**：Neng
> **冻结日期**：2026-09-27（CST）｜**开工 HEAD**：`7ec402c`（动笔前 `git log --oneline -1` 自取）；**骨架落盘时再取 HEAD = `83c3706`**（完整 sha `83c37066835e21b89a10a4f497a740230488f92d`，`master-plan v0.23`）⇒ **本册以 `83c3706` 为基线**；两个读数**都登记在 §17.2**，不用其一覆盖另一。
> **诚实边界**：本册的 DDL 与判据**全部未经真机执行**（不连库、不启停服务、不写迁移文件）⇒ 未实测项集中于 §15，**不得**在验收时当作已通过。

---

## 目录

- [§0 元信息、适用范围与阅读约定](#0-元信息适用范围与阅读约定)
- [§1 术语与记账符号冻结](#1-术语与记账符号冻结)
- [§2 迁移 `0007` 的数据契约（DDL 口径）](#2-迁移-0007-的数据契约ddl-口径)
- [§3 邀请图 `referral`：终身绑定、防环靠构造](#3-邀请图-referral终身绑定防环靠构造)
- [§4 版本化佣金政策 `commission_policy`](#4-版本化佣金政策-commission_policy)
- [§5 一次原子事件的载荷形状（jsonb）](#5-一次原子事件的载荷形状jsonb)
- [§6 池子、取整与最大余数法](#6-池子取整与最大余数法)
- [§7 重归一化](#7-重归一化)
- [§8 边界情形：无邀请人 / 短链 / 零额](#8-边界情形无邀请人--短链--零额)
- [§9 平台账户与 `PLATFORM_KIND_WHITELIST`](#9-平台账户与-platform_kind_whitelist)
- [§10 幂等与并发](#10-幂等与并发)
- [§11 可证伪判据（机读）](#11-可证伪判据机读)
- [§12 升级、幂等与回滚（`0007`）](#12-升级幂等与回滚0007)
- [§13 错误码映射（**不新增错误码**）](#13-错误码映射不新增错误码)
- [§14 待 Zang 裁定清单](#14-待-zang-裁定清单)
- [§15 未能核实 / 未实测诚实清单](#15-未能核实--未实测诚实清单)
- [§16 规则总索引 CR1–CR85](#16-规则总索引-cr1cr85)
- [§17 变更记录](#17-变更记录)

---

## §0 元信息、适用范围与阅读约定

### 0.1 本册覆盖什么

本册覆盖 P2「十级返佣」的全部数据契约与规则：

- 邀请图 `referral`（**终身绑定 / 不可变 / 防环**）；
- **DB 侧强制的守恒断言**（`0007` 的**只读后置断言触发器**：同一事件内 `Σ commission` 出池 == `Σ job_fee` 入池，见 CR80 / §6.5）；
- 版本化佣金政策 `commission_policy`（费率 + 层级 + 权重 + 生效时间 + 不追溯）；
- **一次原子事件的载荷形状**（`op='entries'`：`job_payout` → `job_fee` → N× `commission`，**一个幂等键**）；
- 池子与取整（**最大余数法**、`Σ实付 == 池子` 逐分不差、残余的确定性归属）；
- 重归一化（链上不足 `levels` 层 / 权重和 < 100%）；
- 三类边界：**零额 / 无邀请人 / 短链**；
- 平台佣金账户 `uid = −2` 的进出白名单（`PLATFORM_KIND_WHITELIST`）；
- 幂等与并发重放；
- **可机读的可证伪判据**（§11，本册的交付重心）；
- 迁移 `0007` 的幂等、校验和登记与人工回滚。

### 0.2 本册**不**覆盖什么（避免被当成本册遗漏）

| 不覆盖项 | 归属 |
|---|---|
| 账本三表、`kind` 关闭集（20）、错误码关闭集（33 码 `LD001–LD033`）、幂等键协议、加锁全序、append-only、对账判据 1–9 | `docs/ledger.spec.md` v0.7（**本册只引用，不重写**） |
| `ledger_post_event` 函数体、`PLATFORM_KIND_WHITELIST` 的实现 | `backend-ts/migrations/0004` / `0005` + `backend-ts/src/ledger.ts`（本册只声明**要求与理由**，不写 SQL / TS 实现） |
| 招工单 `job` 的状态机、验收流程、雇主与打工者的身份定义 | P3 spec（本册只消费「酬金 `gross`」与 `job_id`） |
| 商品 / 交易所的计费路径 | P4 / P5 spec（**D15：P2 只做招工酬金一条路径**） |
| 后台运营面板的字段、权限、UI 与按钮 | P6 spec（本册只规定「后台可改政策」的**接口口径**与「**不追溯**」） |
| 邀请码 / 邀请链接 / `?ref=<code>` 的前端与绑定入口 | P6 / P7（本册只规定**图的不变式**） |
| 用户表 / 身份 / 登录 / 会话 | P0 身份 spec（本册只引用 `public.users(uid)`） |
| 「账龄分档」（master-plan §3.3 曾提 T+0 / T+30 / T+365 多套权重） | **本册不做**：D12 已把「随时间变化」冻结为「后台可改 + 按生效时间版本化」。**若要恢复账龄分档，是**新语义**、须单独裁定并新增 `commission_policy` 的维度**（不给建议值，只登记此边界） |

### 0.3 阅读约定

1. **每条规则一个编号**，格式固定为：`编号 | 口径 | 落点建议 | 连带影响 | 状态`。
2. **编号空间 = `CR1..CRn`**（**C**ommission **R**ule），**刻意不与 `ledger.spec.md` 的 `R1–R108` 共用**。理由：两册并行演进，共用编号必然在「某册中间插一条」时全线撞车；跨册引用一律写全 `CR*` / `R*`，禁止省略前缀。
3. **状态列**只有三种取值：
   - **【已冻结】** = 来自 Kevin 拍板的 **D6 / D12 / D13 / D14 / D15** 与 `master-plan` §5.19 立项拆解 / 已裁定的术语冻结表，**不得自行改动**；
   - **【待拍板】** = 本册给出的建议值，标「一句话可改」，一句话即可推翻；
   - **【待裁定】** = 与 Zang 的既有口径**冲突**、或存在**缺口**之处：本册**给出建议但不静默落位**，一律登记 §14。
4. 出现 `⚠️ 仲裁` 标记 = 本册发现的**上位口径之间的冲突**，同处给出**反例或数值依据**与建议裁决，并登记 §14（**不做静默重写**）。
5. 本册所有金额示例一律以**最小单位整数**书写（对齐 R66）；JSON 中的 id 与金额一律**十进制字符串**（对齐 R70）。
6. **本册不写 TypeScript、不写 PL/pgSQL**，只写「表 / 字段 / 约束 / 索引 / 触发器 / 函数名 / 载荷字段名」级别的锚点与口径。
7. 本册引用的既有事实（whitelist 内容、函数行为、limit 数值）**均在动笔时逐字自核过真源文件**；凡未自核的一律标「未核对」，不补造。

### 0.4 本册承接的冻结决策（**继承关系表**）

| 冻结项 | 内容 | 本册承接位置 |
|---|---|---|
| **D6** | 酬金 **1%–5%（后台可设）全额**进佣金池，按 **10 级**分给邀请链祖先；**平台不抽成** | §6 / §7 / CR38 / CR46 |
| **D12** | 权重「随时间变化」= **后台可改 + 按生效时间版本化**；一笔结算用「**事件时刻生效**」的那版；**不追溯重算** | §4 / CR23–CR28 / 判据 M7 |
| **D13** | 池子分不完（链上不足 10 级 / 权重和 < 100%）⇒ **按已有层级权重比例再分配** | §7 / CR47 / CR50 |
| **D14** | 手续费**从打工者酬金里扣**（到手减少、雇主支出不变） | §5 / §6 / CR32 / CR39 |
| **D15** | P2 **只做招工酬金**一条计费路径；商品 / 交易所不在本册 | §0.2 |
| **裁定 #11**（§5.20） | 无邀请人 ⇒ 手续费**仍收但入 `−1`（平台收入）**，**不入 `−2`**；`−2` 只作**佣金中转**、同一事件内进出相抵、**净额 0、不留存** | §8.1 / §8.2 / §11.3 / CR49 / CR52 / **CR84** |
| **裁定 #14**（§5.20） | **计算不下沉**（金额仍在应用层算）；但「**Σ佣金 == 手续费**」**必须由 DB 侧强制**（`0007` 的只读后置断言触发器） | §6.5 / CR43 / **CR80 / CR81** |
| **裁定 #9 / #5 / #16**（§5.20） | **口径 A**（`0007` 种默认政策）+ `created_by` 放宽为平台 id 并**去掉** FK；**政策写入守卫失败类一律 `400`** | §2.1 / §4.1 / §7.3 / **CR82 / CR83** |
| **邀请绑定终身且不可变** | 绑定后不得改、不得删 | §3 / CR15 |
| ~~**防环靠构造**~~ | ⛔ **v0.2 作废（裁定 #1）**：`depth = 父的 depth + 1` **不是防环机制**（§3.2 的 2-环反例成立、Zang 已裁定）⇒ 正式机制 = **祖先检查**（断言**新父 `P` 不是 `child` `C` 的后代**）+ **绑定串行化**；`depth` 降级为**遍历上界 / 审计** | §3.2 / CR16 / CR17 / CR18 / **CR78 / CR79** |
| **仅 `uid = −3` 允许 transfer 出账** | R101（Zang · P1a 收口） | §9 / CR54（本册**不放宽**任何格） |

### 0.5 与 `ledger.spec.md` 的**三条点名张力**（本册不静默改上位册，一律登记 §14）

| # | 张力 | 本册处置 |
|---|---|---|
| ① | **R45「若 10 级权重之和不足 100%，差额留在佣金池（累计余额）」** ⟷ **D13「按已有层级权重比例再分配」** —— 二者**互斥**（同一笔钱要么留池、要么分完） | 本册按 **D13**（更新的冻结项，且与判据 M3「`−2` 净额为 0」自洽）；建议 Zang 对 **R45 出 v0.8 就地增补**（见 §7.2 / §14 #2） ⇒ ✅ **已裁定（#2）：D13 胜**；`ledger.spec` **v0.8 已就地增补 R45**（原文标「已由 D13 取代」）⇒ 本册 §6 / §7 / §8 中一切「差额留池」表述**已全部改为「按已有层级权重比例再分配」** |
| ② | **§14.1 #32「`app_config` 费率不在 1%–5%」** ⟷ **本册 `commission_policy.fee_rate_bp`** —— 费率真源迁移 | 本册：**政策是真源**，`app_config` 键在 P2 起**不再参与计费**；错误码 #32 **复用**、`details.reason` 区分（见 §4.4 / §14 #3） ⇒ ✅ **已裁定（#3）**：**`commission_policy.fee_rate_bp` 是唯一真源**；`ledger.spec` **v0.8 已把 §14.1 #32 的措辞就地更正**（含「写入守卫 = `400`、#32 仍是 `500` 缺陷类」的边界） |
| ③ | **§7.2 #8「写最多 10 组 `commission` 分录 **+ 对应 `commission_payout` 行**」** ⟷ **单语句 `ledger_post_event` 形态（§7.1 / §19.5）** —— 单条 `SELECT` 内的 PL/pgSQL **不能**写一张尚不存在的业务表 | 本册：**`0007` 不建 `commission_payout` 表**，审计真源 = `ledger_entry`（见 §5.6 / §14 #4） ⇒ ✅ **已裁定（#4）**：**不建该表**、**审计真源 = `ledger_entry`**、**`ref_id` = 同一 `job_id`**；`ledger.spec` **v0.8 已就地更正 §7.2 #8** |

---

## §1 术语与记账符号冻结

### 1.1 本册专用术语表（与 `ledger.spec.md` §1 / master-plan §2 的界面术语并存）

| 术语 | 定义 |
|---|---|
| **邀请人（inviter / parent）** | 在 `referral` 中以 `parent_uid` 出现的一方（**上行方向的下一跳**）。 |
| **被邀请人（invitee / child）** | `referral.child_uid`。**PK ⇒ 每人至多一个邀请人**，且终身不可变。 |
| **祖先链（ancestor chain）** | 从「打工人」出发，沿 `parent_uid` 逐级上溯得到的有序 uid 序列 `(a₁, a₂, …, a_M)`，`a₁` = 直接邀请人。 |
| **层级（level, `L`）** | `a₁` 的 `L = 1`，`a₂` 的 `L = 2`，…。**级数从 1 起，不是 0**。 |
| **链深（`chain_depth`）** | 祖先链的**实际可用长度** `M`（上溯到「无邀请人者」为止的步数）。 |
| **池子（pool, `P`）** | 本次结算事件**进入**佣金账户 `uid = −2` 的手续费金额，`P ≡ job_fee` 的金额。（「池子」= 既有 `−2` 账户在本事件中的进项，**不是**新账户、也不是账户总余额。） |
| **政策版本（policy）** | `commission_policy` 的一行：`(policy_id, fee_rate_bp, levels, weights_bp, effective_from)`。 |
| **事件时刻（`T`）** | 结算事件发生的那一刻，取自 DB `now()`（**不接受客户端时间**，对齐 R5）。 |
| **权重（weight, `w_L`）** | 第 `L` 层在政策里的**基点**权重（`10000` = 100%，`100` = 1%）。 |
| **实付（`x_L`）** | 第 `L` 层最终落账的 `commission` 金额（整数最小单位）。 |
| **受益人（beneficiary）** | 收到 `commission` 的真实用户（`uid > 0`）。 |
| **结算事件（settle event）** | 一次招工验收：`job_payout` + `job_fee` + N× `commission`，**一个幂等键、一次原子调用**。 |
| **毛额（`gross`）** | 雇主托管、验收后被支付的招工酬金**全额**（其来源与状态机由 P3 定义）。 |
| **手续费（`fee`）** | 从 `gross` 中扣出的 **1%–5%**，全额进池子（D6）。 |
| **净额（`net`）** | 打工人**实收** `= gross − fee`（**D14；用减法求**，对齐 R68）。 |
| **残余（`D`）** | 最大余数法里 `P` 除以权重后**未被整数分配掉**的余量，`0 ≤ D < M`。 |

### 1.2 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **CR1** | 账务术语**一律沿用 `ledger.spec.md` §1 的「减方 / 增方」**，**禁止**使用「借 / 贷」；本册**不新造同义术语**（「池子」只是 `−2` 在本事件中的进项，不是新实体）。 | 本册全部表格的列名 | 前端账单页进出方向仍由 `delta` 正负号决定（R1） | 已冻结（承 R1） |
| **CR2** | **层级与级数一律从 1 起**（`L = 1` = 直接邀请人）。`levels`（政策）与 `depth`（图）都是 **≥ 1 的整数**；**禁止**任何地方出现 level 0 或「第 0 层」。 | §5 的载荷顺序 / §6 的循环 `FOR L IN 1..M` | 差一错位（off-by-one）在本场景会**整体错一层**发放 ⇒ 直接「分错人」；这是本册最廉价也最致命的一类缺陷 | 待拍板（命名，一句话可改） |
| **CR3** | **P2 结算恒为单币种**：事件内全部分录的 `cid` **必须相同**（= 该招工的计价币种）。**禁止**出现「酬金 A 币、手续费 B 币、佣金 C 币」的混币事件。底层 `op='entries'` 结构上允许混币，但**P2 的佣金链不允许**。 | 事件组装器；§5 载荷契约 | 跨币种分佣需要汇率 ⇒ 属 P5 议题，不在 P2（D15） | 待拍板（一句话可改） |
| **CR4** | 一切时间戳 `timestamptz`、由 DB `now()` 生成（对齐 R5）：`referral.bound_at`、`commission_policy.time_created`、`ledger_entry.time_created`。**政策选择所用的「事件时刻 `T`」同样取自 `now()`**，**不得**由调用方传入。 | 两张新表的默认值；§4 版本选择 | 「用客户端时间选政策版本」= 可被操纵的计费口径，必须封死 | 已冻结（承 R5） |
| **CR5** | 本册**不新增错误码**、**不新增 `kind`**、**不修改 `migrations/0001`–`0006`**、**不修改 `ledger_entry` 表结构**。P2 的一切落库变化只允许出现在 `0007`（及其后的新迁移）。 | §12 / §13 | 任何越过此界的改动，必须**先回来改本册**并登记 §17（否则 `migrate.ts` 会因 checksum 漂移 ABORT，见 CR73） | 已冻结（关闭集 + checksum 纪律） |


---

## §2 迁移 `0007` 的数据契约（DDL 口径）

### 2.1 DDL 片段（**是 DDL 口径，不是实现**）

> 落点：`backend-ts/migrations/0007_<name>.sql`（**本册不写迁移文件**，只给形状与约束；命名后缀由 Kong 定，建议 `0007_referral_and_commission_policy.sql`）。**前置**：`0001`–`0006` 已应用且**不得改动**（CR73）。

```sql
-- ① 邀请图：终身绑定、INSERT-only
CREATE TABLE referral (
  child_uid  bigint      NOT NULL,
  parent_uid bigint      NOT NULL,
  depth      smallint    NOT NULL,
  bound_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_pk         PRIMARY KEY (child_uid),
  CONSTRAINT referral_child_fk   FOREIGN KEY (child_uid)  REFERENCES users(uid),
  CONSTRAINT referral_parent_fk  FOREIGN KEY (parent_uid) REFERENCES users(uid),
  CONSTRAINT referral_no_self    CHECK (child_uid <> parent_uid),
  CONSTRAINT referral_depth_rng  CHECK (depth >= 1)
);

CREATE INDEX idx_referral_parent ON referral (parent_uid);

-- ② 版本化佣金政策：INSERT-only
CREATE TABLE commission_policy (
  policy_id      bigint      GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  fee_rate_bp    integer     NOT NULL,
  levels         smallint    NOT NULL,
  weights_bp     smallint[]  NOT NULL,
  effective_from timestamptz NOT NULL,
  created_by     bigint      NOT NULL,
  time_created   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_policy_fee_rate_rng   CHECK (fee_rate_bp BETWEEN 100 AND 500),
  CONSTRAINT commission_policy_levels_rng     CHECK (levels BETWEEN 1 AND 10),
  CONSTRAINT commission_policy_weights_len    CHECK (array_length(weights_bp, 1) = levels),
  CONSTRAINT commission_policy_weights_nonneg CHECK (0 <= ALL (weights_bp)),
  CONSTRAINT commission_policy_effective_uniq UNIQUE (effective_from),
  -- ⛔ v0.2（裁定 #9）：**去掉**指向 users 的 FK —— 口径 A 的种子行作者是**平台 id**
  --    （P2 时点 users 可能 0 行，FK 会让种子插不进去）
  CONSTRAINT commission_policy_created_by_rng CHECK (created_by >= 0 OR created_by IN (-1, -2, -3)),
  -- v0.1 旧写法（留痕、作废）：CONSTRAINT commission_policy_created_by_fk FOREIGN KEY (created_by) REFERENCES users(uid)
  -- v0.1 旧写法（留痕、作废）：CONSTRAINT commission_policy_created_by_pos CHECK (created_by > 0)
);

-- ③ 不可变触发器（与 ledger_entry 同法；诚实边界见 2.2）
CREATE OR REPLACE FUNCTION referral_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'referral is append-only: % forbidden (child_uid=%)',
        TG_OP, COALESCE(OLD.child_uid, 0);
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_referral_append_only
BEFORE UPDATE OR DELETE ON referral
FOR EACH ROW EXECUTE FUNCTION referral_append_only();

CREATE OR REPLACE FUNCTION commission_policy_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'commission_policy is append-only: % forbidden (policy_id=%)',
        TG_OP, COALESCE(OLD.policy_id, 0);
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_commission_policy_append_only
BEFORE UPDATE OR DELETE ON commission_policy
FOR EACH ROW EXECUTE FUNCTION commission_policy_append_only();

-- ④ 权重和守卫（§2.3 的 CHECK 表达不了 Σ ⇒ 必须用触发器）
CREATE OR REPLACE FUNCTION commission_policy_weights_guard() RETURNS trigger AS $$
DECLARE v_sum integer;
BEGIN
  v_sum := COALESCE((SELECT sum(w) FROM unnest(NEW.weights_bp) AS w), 0);
  IF array_length(NEW.weights_bp, 1) IS DISTINCT FROM NEW.levels THEN
    RAISE EXCEPTION 'commission_policy_weights_guard: weights_bp length (%) <> levels (%)',
          array_length(NEW.weights_bp, 1), NEW.levels
      USING ERRCODE = '23514';
  END IF;
  IF v_sum > 10000 THEN
    RAISE EXCEPTION 'commission_policy_weights_guard: sum(weights_bp) = % > 10000', v_sum
      USING ERRCODE = '23514';
  END IF;
  -- 🆕 v0.2（裁定 #16）：退化分母在**政策写入时**就拒（失败类 23514 ⇒ input ⇒ 400，见 CR83）
  IF v_sum = 0 THEN
    RAISE EXCEPTION 'commission_policy_weights_guard: sum(weights_bp) = 0 (degenerate denominator W = 0)'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.weights_bp[1] = 0 THEN
    RAISE EXCEPTION 'commission_policy_weights_guard: weights_bp[1] = 0 (prefix-all-zero ⇒ W = 0 when M = 1)'
      USING ERRCODE = '23514';
  END IF;
  IF (SELECT count(*) FROM unnest(NEW.weights_bp) AS w WHERE w < 0) > 0 THEN
    RAISE EXCEPTION 'commission_policy_weights_guard: negative weight in %', NEW.weights_bp
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_commission_policy_weights_guard
BEFORE INSERT OR UPDATE ON commission_policy
FOR EACH ROW EXECUTE FUNCTION commission_policy_weights_guard();
```

> ⚠️ **`0007` 不建 `commission_payout` 表**（口径边界，见 CR14 与 §14 #4；**v0.2（裁定 #4）：已裁定「不建」**）。**不新增 `LEVY` / `REFERRAL` 类错误码**（CR5/CR75）。
> 🆕 **v0.2 对 `0007` 的三项增补（裁定 #9 / #14 / #16）**：
> ① **种子行是 `0007` 的交付物**（口径 A，裁定 #9）：`INSERT` 一版默认政策 —— `effective_from = '1970-01-01T00:00:00Z'`、`fee_rate_bp = 100`、`levels = 10`、`weights_bp = {3000,2000,1500,1000,800,600,500,300,200,100}`、**`created_by = 0`**（平台 id ⇒ 上表已去掉 FK）⇒ **「无政策行」不可达**（CR82 / §4.1）。
> ② **DB 侧不计算金额**（裁定 #14）：**另须新增一条只读后置断言触发器**，对同一 `event_root_key` 断言 **`Σ commission` 出池 == `Σ job_fee` 入池**（推荐 `CONSTRAINT TRIGGER … AFTER INSERT … FOR EACH ROW DEFERRABLE INITIALLY DEFERRED`；**不得**用 `FOR EACH STATEMENT`，理由见 CR80）—— **不得**借此改写 `ledger_post_event` 函数体（明令禁止）。
> ③ **权重守卫新增两条拒绝**（`Σweights_bp = 0`、`weights_bp[1] = 0`），失败类仍 `23514` ⇒ `input` ⇒ **`400`**（CR83）。

### 2.2 ⚠️ 诚实口径：这两张表的「不可变」是**护栏**，不是绝对不变式

**必须原样写入、不得夸大**（与 `master-plan` §5.18 对 `ledger_entry` 的实测边界同口径）：

| 手段 | 拦得住什么 | 拦不住什么 |
|---|---|---|
| `BEFORE UPDATE OR DELETE` 行触发器 | **应用层**的一切 UPDATE / DELETE（**owner 也拦得住** ⇒ 这是**主手段**，对齐 R73） | ① **`TRUNCATE` 不触发行触发器**（需语句级 `BEFORE TRUNCATE` 触发器才能拦）；② **`ALTER TABLE ... DISABLE TRIGGER USER`** 的管理员旁路 —— 仓库内 `backend-ts/scripts/purge-test-data.ts` **就是这么干的**（P1 对 `ledger_entry` 已实测同类旁路） |
| `REVOKE` 类权限 | 非 owner 角色 | 库 owner（Neon 连接串的默认角色通常是 owner）⇒ 只作纵深防御 |

⇒ 规范表述一律为：**「防应用层事故的护栏」**。**禁止**在本册、报告、UI 文案里声称「绝对不可变」「数学上不可能被改」。同理，**防环**的结论也只到「**按 CR78 / CR79 的守卫写入的前提下**不成环」，**不是**「任何写入都不可能成环」；⛔ **v0.2 更正（裁定 #1）**：**禁止**再写「`depth` 构造上不可能成环」或「构造保证无环」这类命题（已被 §3.2 的 2-环反例否证，Zang 已裁定）。

### 2.3 ⚠️ 一处 PostgreSQL 硬约束：`Σweights_bp <= 10000` **不可能**用 `CHECK` 表达

- PostgreSQL 的 `CHECK` **禁止子查询与集合函数** ⇒ `CHECK ((SELECT sum(w) FROM unnest(weights_bp) w) <= 10000)` 会被**拒绝**，`CHECK (sum(weights_bp) <= 10000)` 同样不行。
- 能进 `CHECK` 的只有逐元素 / 纯标量表达式：`array_length(...) = levels`、`0 <= ALL (weights_bp)`（本册已用）。
- ⇒ **`Σ` 守卫的唯一落点 = `BEFORE INSERT OR UPDATE` 触发器**（`trg_commission_policy_weights_guard`），失败抛 **`23514`**（`check_violation` 家族）。
- ⇒ **不改既有分类器**：`0005` 的 `ledger_error_for_sqlstate` 对「其余 `23514`」归 **`input` ⇒ `LEDGER_AMOUNT_INVALID` / `400`**（§14.3 的 `23514` 分桶细则）。本册**沿用**该分桶，**不**为守卫新增分桶（新增分桶 = 改 `0005` = 越界，见 CR73）。
- **备选**（留给 Kong 选型，登记 §14 #5）：把权重拆进子表 `commission_policy_weight(policy_id, level, weight_bp)`，用**延后约束触发器**做 `Σ` 校验。代价：多一张表 + 查询要 join；收益：`Σ` 的守卫点更细。**本册不选定**，只要求「无论哪种，`Σ <= 10000` 必须被 DB 拒绝，且失败类 = `400`」。 ✅ **v0.2（裁定 #5 / #16）：失败类已裁定 = `400`**（`input` 桶），**不得**用 `500`；且守卫点必须**同时**拒 `Σ > 10000`、`Σ = 0`、**前 `M` 层全零**（CR83）。

### 2.4 命名规范（**对齐 `0001`–`0006` 的既有风格**）

| 对象 | 规范 | 本册实例 |
|---|---|---|
| 表名 | `snake_case`、无引号、无前缀（对齐 R22） | `referral` / `commission_policy` |
| 列名 | `snake_case`、无引号 | `child_uid` / `parent_uid` / `depth` / `bound_at` / `fee_rate_bp` / `levels` / `weights_bp` / `effective_from` / `created_by` / `time_created` |
| 约束名 | `<table>_<subject>_<kind>`，`kind ∈ {pk, fk, uniq, rng, guard, fmt, enum, pos, len, nonneg, no_self}` | `referral_pk` / `referral_child_fk` / `referral_no_self` / `commission_policy_weights_nonneg` |
| 索引名 | `idx_<table>_<cols>`（**唯一约束派生的索引沿用约束名**，与 `account_pk` / `ledger_idem_uniq` 一致） | `idx_referral_parent` /（`commission_policy_effective_uniq` 即索引名） |
| 触发器 | `trg_<table>_<action>`；函数同名去掉 `trg_` 前缀 | `trg_referral_append_only` / `referral_append_only()` |
| 序列 | identity 由 PG 自动命名 `<table>_<col>_seq` | `commission_policy_policy_id_seq` |

> 📌 **0006 的教训（必须写进约束）**：**改表名不会自动改 identity 序列名**（D11 连带项实测）。⇒ 本册**刻意不给新表起任何「日后可能需要改名」的名字**（`referral` / `commission_policy` 都不是保留字、都不会撞 `user` 类陷阱）。

### 2.5 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **CR6** | **`referral`** 四列：`child_uid`（**PK**）/ `parent_uid` / `depth` / `bound_at`；`child_uid` / `parent_uid` 均 FK 到 `users(uid)`；`CHECK (child_uid <> parent_uid)`。**PK 在 `child_uid` 上 ⇒ 「每人至多一个邀请人」是结构性保证**，不靠应用层。 | §2.1 ① | 反过来说：**没有** `parent_uid` 上的唯一约束 ⇒ 一人可邀请多人（正确，这是树不是链） | 已冻结（master-plan §5.19 领域模型）+ **v0.2（裁定 #6）**：两列 FK **保留** —— **业务表 FK 到 `users(uid)` 不受 R21 约束**（`ledger.spec` v0.8 已给 R21 加范围限定）；⚠️ 同批的 `commission_policy.created_by` FK 已由 #9 **去掉**（见 CR7） |
| **CR7** | **`commission_policy`** 七列：`policy_id` / `fee_rate_bp`（`100–500`）/ `levels`（`1–10`）/ `weights_bp`（`smallint[]`，长度 = `levels`）/ `effective_from` / `created_by` / `time_created`；`UNIQUE (effective_from)`。 | §2.1 ② | `created_by` 必须是**真实用户**（`> 0` + FK）⇒ 禁止「系统匿名」写政策（可审计） | 已冻结（master-plan §5.19）+ **v0.2（裁定 #9）**：`created_by` **放宽为允许平台 id（`0 / −1 / −2 / −3`）并去掉指向 `users` 的 FK**（`CHECK (created_by >= 0 OR created_by IN (-1,-2,-3))`）—— 旧写法「必须是真实用户（`> 0` + FK）」**作废**（原文留痕）；理由：口径 A 的种子行作者是平台 id，且 P2 时点 `users` 可能 0 行 |
| **CR8** | 两张表都是 **INSERT-only**：`BEFORE UPDATE OR DELETE` 触发器无条件 `RAISE`（对齐 R73 的手段选择：**触发器为主、权限为辅**）。**诚实边界同 §2.2**（`TRUNCATE` 无保护 + 管理员可 `DISABLE TRIGGER USER`）⇒ 表述为**护栏**。 | §2.1 ③；`trg_referral_append_only` / `trg_commission_policy_append_only` | 政策「改一版」= **插一行**，永不 UPDATE（D12 的机械保证）；图「改绑定」= 不允许（CR15） | 已冻结（D12 + 终身不可变） |
| **CR9** | **`Σweights_bp <= 10000` 用 `BEFORE INSERT OR UPDATE` 触发器守卫**（`CHECK` 表达不了 `Σ`，见 §2.3），失败抛 `23514` ⇒ 映射 `400 LEDGER_AMOUNT_INVALID` + `reason = WEIGHTS_SUM_EXCEEDS_10000`；**应用层必须更早校验**（同一口径双层，对齐 R80：DB 闸是兜底、不是流程）。 | `trg_commission_policy_weights_guard` | **不得**为它新增 SQLSTATE 分桶（那要改 `0005`） | **已裁定（§5.20 #5 / #16）**：失败类 = **`400`**（`input` 桶），**不得**用 `500`；并**新增两条拒绝**（`Σ = 0` / `weights_bp[1] = 0`）⇒ 见 CR83 |
| **CR10** | **命名 / 索引 / 触发器命名规范化**（见 §2.4）：表与列 `snake_case` 无引号；约束 `<table>_<subject>_<kind>`；索引 `idx_<table>_<cols>`；触发器 `trg_<table>_<action>`。 | §2.4 | 命名不一致的代价是可检索性（`\d` 输出无法按前缀聚类）；对齐 0001–0006 是硬要求 | 待拍板（一句话可改） |
| **CR11** | **必建索引只有 2 个二级索引**：`idx_referral_parent (parent_uid)`（查「我邀请了谁」）与 `commission_policy_effective_uniq UNIQUE (effective_from)`（**版本选择**；btree 可反向扫描 ⇒ **不另建** `(effective_from DESC)` 索引）。PK（`referral_pk` / `commission_policy_pkey`）由约束自带。 | §2.1 ① ② | 对齐 R96 的精神（新增索引须说明为何现有索引不能覆盖）；`referral` 是**读多写极少**的表，不需要更多索引 | 待拍板（清单可增，不可减） |
| **CR12** | **两张新表的 uid 列一律建 FK 到 `users(uid)`**（`referral.child_uid` / `referral.parent_uid` / `commission_policy.created_by`）。⚠️ **这是本册**主动**与 R21「不对 `account.uid` / `ledger_entry.uid` 建 FK」区分的处**：R21 的适用范围是**账本表**（它的 uid 允许平台负值 ⇒ 不能 FK 到 `users`），而本册两张表的 uid **语义上就是「一个真实用户」**、恒 `> 0`、且**不建 FK 就会让脏 uid 静默沉淀**（佣金永远发不出去、`referral` 指向不存在的人）。⇒ 建议 Zang 确认该区分（§14 #6）。 | §2.1 ①② | FK 的连带约束：删用户会连带失败 ⇒ 用户注销必须先处理邀请图（P6 议题） | **已裁定（§5.20 #6）**：**同意本册** —— R21 的适用范围是**账本表**；**业务表可以 FK 到 `users(uid)`**（`ledger.spec` v0.8 已在 R21 正文加范围限定）；⚠️ 但 `commission_policy.created_by` 的 FK 已由 #9 **去掉**，故 FK 只保留在 `referral` 两列 |
| **CR13** | **`depth` 不设上限**（只 `CHECK (depth >= 1)`）；**封顶的是「分配层数」**（`levels <= 10`，CR7）。理由：把 `depth` 封顶为 10 会**禁止深度 10 的用户再邀请人**，把「这一层以后分不到佣金」误做成「不能建立邀请关系」——两者是完全不同的产品语义。 | ① `referral_depth_rng`；② §7 的 `M = min(levels, chain_depth)` | 若 Zang 要**链深硬上限**（如 `depth <= 64`，用于给 CR17 的环检查一个确定上界），那是**新增约束**、须回来改本册（§14 #7） | **已裁定（§5.20 #7）**：**`depth` 不设上限**（只 `CHECK (depth >= 1)`）；封顶的是**分配层数** `levels ≤ 10`；`depth` 保留作**遍历上界 + 审计**（与裁定 #1 一致：它**不再是**防环机制） |
| **CR14** | **`0007` 只建这两张表**。**`commission_payout` 表不在 `0007`**：`ledger.spec` §7.2 #8 要求「写最多 10 组 `commission` 分录 **+ 对应 `commission_payout` 行**」，但 P2 的事件是**单条 `SELECT ledger_post_event($1::jsonb)`**（§7.1 / §19.5），函数内**不能**写一张业务表 ⇒ 二者存在**形态张力**（§0.5 ③）。本册口径：**P2 的审计真源 = `ledger_entry`**（`kind='commission'` + `ref_type='commission_payout'` + `memo` + `idx_ledger_kind_time`），`commission_payout` 表留到 P6 报表需要时再建。 | §0.5 ③；§14 #4 | ⚠️ 若 Zang 坚持「必须落 `commission_payout` 行」，则 P2 需要**额外一次写调用**或**改函数**（= 新迁移）⇒ 会打破「一个业务事件 = 一次原子调用」⇒ 必须先裁定 | **已裁定（§5.20 #4）**：**不建该表**（已定）；审计真源 = `ledger_entry`；**`commission` 分录的 `ref_id` = 同一 `job_id`**（实现上逐条只给 `ref_type = 'commission_payout'`、`ref_id` 回落 payload 级即可） |
| **CR83** | **政策写入守卫（v0.2 · 裁定 #5 / #16）**：**在政策写入时就拒**下列形态，失败类一律 **`400`**（借 `LEDGER_AMOUNT_INVALID` + `details.reason`；**不得** `500`、**不得**新增码）：① `Σweights_bp > 10000`；② **`Σweights_bp = 0`**；③ **前 `M` 层权重全零** —— 可静态判定的等价式 = **`weights_bp[1] > 0`**（`M = min(levels, chain_depth) ∈ [1, levels]`，`M = 1` 时前缀只有第 1 层；推导见 §14.2 #2）；④ `levels ∉ [1,10]` / `len(weights_bp) ≠ levels` / 含负权重（CR27 / CR9）。⇒ 运行时 `W = 0` 分支因此**不可达**（§7.3）。 | §2.1 的 `trg_commission_policy_weights_guard`（DB）+ 后台写政策服务层（同一口径双层，对齐 R80） | 守卫失败**必须先于任何落库**；「让 DB 报错来当校验」禁止；DB 侧 `23514` ⇒ 既有分类器归 `input` ⇒ 同码同 status | **已裁定（#5 / #16）** |

---

## §3 邀请图 `referral`：终身绑定、防环靠构造

### 3.1 五条结构性不变式（**I1–I5**）

| # | 不变式 | 由什么保证 | 强度 |
|---|---|---|---|
| **I1** | **每人至多一个邀请人** | `referral_pk = PRIMARY KEY (child_uid)` | **结构性**（DB 层） |
| **I2** | **终身绑定、不可变** | `BEFORE UPDATE OR DELETE` 触发器（`trg_referral_append_only`）+ 应用层无改删路径 | **护栏**（§2.2：`TRUNCATE` / 管理员旁路不在此列） |
| **I3** | **无自指** | `referral_no_self CHECK (child_uid <> parent_uid)` | **结构性**（DB 层） |
| **I4** | **无环** | ⚠️ **不能**只靠 `depth` 构造（§3.2 反例）⇒ **必须**由绑定期守卫 `C ∉ ancestors(P)` + 绑定串行化保证（CR17 / CR18）〔**v0.2（裁定 #1）：已裁定** —— `depth` **不是**防环机制；`0007` 必须**同时**提供「**自指禁令 + 祖先检查 + 串行化**」三件（CR78）〕 | **依赖绑定协议**（不是 DB 约束能表达的） |
| **I5** | **`depth` 一致**：沿每条边 `depth(child) = depth(parent) + 1`；对**没有 `referral` 行**的用户约定 `depth = 0`（这正是「父无行 ⇒ 1」的形式化）。等价地 **`depth(u) = chain_depth(u)`**（`chain_depth` = §3.4 从 `u` 上行能走到的、**自身有行**的祖先个数 = 该节点的**可发放层数**）—— **两者是同一个量**，故 §3.4 的 `M` 与 `depth` 天然同尺度（自核：`W → I1 → I2`（`I2` 无行）⇒ `depth(W) = 2`、`chain_depth(W) = 2`） | 由 CR16 的写入口径 + I4 共同保证 | **可机读断言**（判据 M9）〔**v0.2（裁定 #1）**：M9 的 `bad_depth` 断言**保留**（审计用），但它**不再是**防环判据 —— 2-环下该等式仍成立 ⇒ 防环必须靠 CR79 的判负用例〕 |

### 3.2 ⚠️ 仲裁：**「防环靠构造」不成立** —— 反例与最小修复（**v0.2：Zang 已裁定 —— 本册反例成立；`depth` 不再是防环机制**）

**D-冻结原文**（`master-plan` §5.19）：`depth = 父的 depth + 1`（父无行则 1）⇒ **环在数学上不可能形成**，不靠事后检测。

**本册否证**（反例，两次插入**逐字遵守**该规则）：

| 步骤 | 动作 | 规则算出的值 | 落库结果 |
|---|---|---|---|
| 0 | （空表） | — | `referral` 无行 |
| 1 | 插 `(child=A, parent=B)` | `B` 无行 ⇒ `A.depth := 0 + 1 = 1` | `A → B`（`A.depth = 1`） |
| 2 | 插 `(child=B, parent=A)` | `A` 有行、`depth = 1` ⇒ `B.depth := 1 + 1 = 2` | `B → A`（`B.depth = 2`） |
| 结果 | — | — | **`A` 的邀请人是 `B`，`B` 的邀请人是 `A` ⇒ 2-环成立** |

**为什么构造不成立（形式化的原因）**：无环性要求 I5 的等式在**所有时刻、所有边上**成立。步骤 2 的插入使**既有边** `A → B` 的等式失效（新状态下 `A.depth = 1` 而 `B.depth + 1 = 3`）—— 而规则**只校验新插入的那条边**。⇒ 只要允许「把边插到自己的后代上」，「先插的边」就会被后来的插入**追溯破坏**。

**最小修复（保持 D-冻结「不靠事后检测」的意图）**：新增边 `C → P` 造环 **⟺** `C` 已在 `P` 的上行链上（依据：I1 使每个节点入度 ≤ 1 ⇒ **任何新造出的环必然经过这条新边**）。⇒ 绑定前做**一次上行遍历**即可判死：

```
合法 ⟺ NOT EXISTS ( P 的上行链中出现 C )
```

- 这是 **O(链深)** 的**构造性**检查：不是「事后扫描全图找环」、也不是引入闭包表 ⇒ **保留 D-冻结「不靠事后检测」的意图**。
- 修复后 I5 沿**所有边**恒成立 ⇒ `depth` 才可以安全当作「层级标签」，§7 的「10 级」遍历才有语义基础。
- ⚠️ **该检查单独存在仍不够**（并发面，见 CR18）：两个并发绑定可**各自通过**检查再都落库 ⇒ 仍成环。

**🆕 v0.2 正式口径（裁定 #1 · Zang §5.20 —— 本节的权威结论；上面 v0.1 的文字保留作留痕）**：

> **裁定要点**：⛔ **本册的反例是对的、「防环靠构造」是错的** —— `depth = 父.depth + 1` 只校验**新边**，**既有边会被追溯破坏**（先 `A→B` 再 `B→A`：插入时等式成立、环已形成）。⇒ **`depth` 保留（遍历上界 + 审计），但它不再是防环机制**；必须改为「**绑定时断言新父 `P` 不是 child `C` 的后代**」**＋ 绑定串行化**；`0007` **必须同时**提供（**自指禁令 + 祖先检查 + 串行化**），**且必须有一条「2-环反例」判负用例**。

**规范要求（可机读）**：

```text
referral_cycle_guard                       # v0.2 · 裁定 #1（原文见 master-plan §5.20）
  depth_role               = "traversal_bound_and_audit_only"
  depth_is_cycle_guard     = false                     # ⛔ 不再作为防环机制
  mechanisms_required      = ["no_self",               # ① CHECK child_uid <> parent_uid
                              "ancestor_check",        # ② 绑定前：断言新父 P 不是 child C 的后代
                              "serialized_binding"]    # ③ 同一事务 + 串行化点（CR18）
  mechanisms_missing_fails = true                      # 三缺一即判负
  ancestor_check           = { direction: "从候选新父 P 沿 parent_uid 上行，遇 child C 即拒",
                               equivalent: "C ∉ ancestors(P)",
                               reject: { code: "LEDGER_AMOUNT_INVALID", http: 400,
                                         reason: "REFERRAL_CYCLE_REJECTED" } }
  negative_case_required   = "先插 A→B，再插 B→A ⇒ 第二条绑定必须被拒（2-环反例）"
  negative_case_machine_readable = true                # 机读断言，见 CR79 / §11.8
```

- **为什么只验 `depth` 等式必然漏**：2-环下 `depth` 等式**仍然成立**（本节反例表已逐行验算）⇒ **任何 `depth` 校验都不能替代祖先检查**。这条必须写进实现注释与质检用例（与 CR34 同精神：两条结论并存、不得只写一条）。
- **串行化的位置**：`幂等检查 → 祖先检查 → INSERT` 必须在**同一事务**内，且在**祖先检查之前**取得串行化点（本册建议 `users` 两行 `FOR UPDATE`，按 `uid` 升序对齐 R79）—— 见 §3.3 / CR18。
- **未实测**：并发面与「`0007` 是否真能挡住 2-环」都仍是**设计意图**，读数待质检补（§15 #6 / #14）。

### 3.3 绑定写入协议（**建议形状，未实测**）

```
⓪ **自指禁令**（裁定 #1 的第 ① 件）：C ≠ P —— DB 侧 referral_no_self CHECK + 应用层同判（失败 400 REFERRAL_SELF_BIND）
① 校验 C 与 P 均为真实用户（uid > 0）
② **串行化点**（裁定 #1 的第 ③ 件）：SELECT ... FROM users WHERE uid IN (C, P) ORDER BY uid ASC FOR UPDATE   -- R79 对齐（uid 升序）
③ 幂等：若 referral 已有 child_uid = C 的行 ⇒ 同 P 则读回返回（200 replay）；异 P 则 409（CR19）
④ **祖先检查**（裁定 #1 的第 ② 件；方向：断言**新父 P 不是 child C 的后代**，等价式 C ∉ ancestors(P)；实现 = 从 P 沿 parent_uid 上行、遇 C 即拒）⇒ 命中即 400（CR17）
⑤ 写：depth := 1 + COALESCE(depth(P), 0)（**由 DB 侧算，不由调用方传**，CR16）—— ⚠️ depth **只是层级标签 / 遍历上界**，不承担防环
⑥ 插入 referral(C, P, depth)
⑦ **必带判负用例**（裁定 #1）：先插 A→B、再插 B→A ⇒ 第二次绑定**必须被拒**（400 REFERRAL_CYCLE_REJECTED）；另配「绕过守卫直插两行 ⇒ §11.8 M9 的 cycles / bad_depth **必须**变红」的对照（CR79）
```

> ② 的锁域（`users` 两行）是为 ④ 提供一个**串行化点**：`A→B` 与 `B→A` 并发时会争抢同一对 `users` 行 ⇒ 后者在等待结束后再跑 ④，此时前者已提交 ⇒ ④ 能看见新边并拒绝。**这是设计意图，不是实测结论**（§15 #6）。

### 3.4 祖先链读取口径（分配用）

```sql
-- 取「打工人 W」的上行链，最多 levels 层，L 升序（L=1 = 直接邀请人）
WITH RECURSIVE up AS (
  SELECT r.parent_uid, 1 AS level
    FROM referral r WHERE r.child_uid = :worker_uid
  UNION ALL
  SELECT r.parent_uid, up.level + 1
    FROM referral r JOIN up ON r.child_uid = up.parent_uid
   WHERE up.level < :levels            -- ⚠️ 硬闸在 CTE 内：缺它则深链拖长事务 / 有环时无限递归
)
SELECT parent_uid AS beneficiary_uid, level FROM up ORDER BY level;
```

两条**必须**的后置断言：① `count(*) <= 10`（`levels <= 10` ⇒ 恒成立，作兜底）；② `level` 连续无空洞（`1..M`）。链深 `M = count(*)`。〔**v0.2（裁定 #1）**：查询里的 `level < :levels` 硬闸**仍然必需**（它是**遍历上界**，与防环无关 —— 防环在**写入侧**由 CR78 的三件保证）；`depth` 同样**不再**被任何地方当作防环依据〕

### 3.5 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **CR15** | 邀请绑定**终身且不可变**：不提供任何 UPDATE / DELETE 路径（触发器 + 应用层双闸）。⇒ **纠错路径不存在**：错绑无法改、无法删。本册**不给静默默认**：若必须有纠错，那是**新语义 + 新迁移 + 全量对账**（§14 #8）。 | §2.1 ③；绑定服务 | 错的邀请关系会**永久**影响佣金分配：`ledger_entry` 虽可 `reversal` 冲正**已发的钱**，但**冲正不改邀请图** ⇒ **下一次结算还会错发** | 已冻结（终身不可变）+ **已裁定（§5.20 #8）**：**P2 不提供改绑** ⇒ **错绑是永久的**，登记为**已知运营风险**、与 D3（无手机号 ⇒ 账号找回）同批排 **P6**；**上线前必须如实告知用户**（§14.2 #5） |
| **CR16** | `depth` **写入口径**：`NEW.depth := 1 + COALESCE((SELECT depth FROM referral WHERE child_uid = NEW.parent_uid), 0)`（父无行 ⇒ 1）。**必须由同一事务内的 DB 侧计算**（`BEFORE INSERT` 触发器或绑定函数），**禁止**把 `depth` 作为 API 入参暴露给调用方。 | 建议 `trg_referral_depth` 或绑定函数 | **安全项**：客户端可控 `depth` ⇒ 可伪造层级（自造「深链」抢佣金）。⇒ `depth` 在任何接口上**都只能是输出** | 已冻结 + **v0.2（裁定 #1）**：`depth` 语义**降级**为「层级标签 / 遍历上界 / 审计」，**不再**是防环前提（写入口径不变：DB 侧算、不得入参） |
| **CR17** | ⚠️ **仲裁**：**绑定前必须断言 `C ∉ ancestors(P)`**（§3.2 反例 ⇒ D-冻结的「仅靠 `depth` 构造」**不足**）。失败 ⇒ `400 LEDGER_AMOUNT_INVALID` + `reason = REFERRAL_CYCLE_REJECTED`（**借码，不新增错误码**）。这是**本册对 D-冻结的最小修复**，保留其「不靠事后检测」的意图。 | 绑定函数内递归 CTE / `BEFORE INSERT` 触发器 | **未加此闸 ⇒ 2-环可达 ⇒ 佣金链遍历无限递归**（§3.4 的 CTE 若去掉 `level < levels` 闸会直接打挂结算）；且 §11 判据 M1（`Σx = P`）在有环时虽仍成立，但「第 3 层」会指向第 1 层的人 ⇒ **分错人** | **已裁定（§5.20 #1）**：本册反例**成立**、本册的修复**被采纳** —— 绑定前**必须**断言「**新父 `P` 不是 `child` `C` 的后代**」（等价式 `C ∉ ancestors(P)`；实现 = 从 `P` 上行、遇 `C` 即拒），失败 ⇒ `400 LEDGER_AMOUNT_INVALID` + `reason = REFERRAL_CYCLE_REJECTED`（借码，不新增码） |
| **CR18** | 绑定的**原子性与串行化**：`幂等检查 → 环检查 → INSERT` 必须在**同一事务**内，且必须先取得**串行化点**（本册建议 §3.3 ② 的 `users` 两行 `FOR UPDATE`，**按 uid 升序**对齐 R79）。⚠️ **仅 CR17 不够**：`A→B` 与 `B→A` 并发时两边**各自**检查都通过（此时对方还无行）⇒ 都落库 ⇒ **仍成环**。 | 绑定服务 + 事务包装 | 「先查后插」在**单线程**下足够、在并发下**必然**漏 ⇒ 质检必须写**并发绑定**用例（对齐 R93：没有对照的绿色用例视为装饰） | **已裁定（§5.20 #1）**：**绑定必须串行化**（`0007` 必须提供的第 ③ 件）；「并发绑定不成环」**仍是未实测的设计意图** ⇒ 质检必须写并发绑定用例 + 对照（§15 #6） |
| **CR19** | 绑定的**幂等**：① 同 `(C, P)` 重复提交 ⇒ PK 冲突 ⇒ **读回既有行** ⇒ `200 {idempotent_replay: true}`（**不报错**）；② `C` 已有行但 `parent_uid` **不同** ⇒ `409 LEDGER_IDEMPOTENCY_CONFLICT` + `reason = REFERRAL_ALREADY_BOUND`（借码，语义对齐 R52②）；③ ⚠️ 绑定**不产生账本分录** ⇒ 幂等性**来自 `referral_pk`**；**禁止**为了「占位」而写一条 `ledger_entry`（那会污染账本、破坏 ledger.spec 判据 1/3）。 | 绑定服务；§13 借码表 | 为绑定造一条假分录是本场景最容易被诱发的偷懒实现（「反正账本有幂等」）—— 明令禁止 | 待拍板（借码见 §13） |
| **CR20** | **祖先链读取口径**（§3.4）：最多 `levels` 层、`L` 升序（`L=1` 最近）、`level < levels` 的硬闸必须在 CTE 内；后置断言 `count(*) <= 10` 与 `L` 连续。 | §3.4 的查询 | ⚠️ 该查询与结算事件**不在同一语句** ⇒ 与政策一样有 TOCTOU 面（CR26）：**重放必须复用同一 payload** | 待拍板（形状可改） |
| **CR21** | **平台保留 uid（`0` 与 `−1…−99`）不得出现在链上**：① `referral` 的 FK 到 `users(uid)` 已挡住（`users.uid` 自增从 1 起，R98/R100）；② 应用层仍必须校验（对齐 R100）。 | FK + 路由守卫 `assertUserUid()` | 若链上出现 `−2`，会造出「佣金发给自己」（`−2 → −2`）的自环式事件；`ledger_move_guard` 不能表达这种语义非法 | 已冻结（承 R98 / R100） |
| **CR22** | **链上 uid 互不重复**（构造保证）：I1 ⇒ 每个节点入度 ≤ 1 ⇒ 上行遍历必为**简单路径** ⇒ 「同一受益人出现在两层」**不可能** ⇒ 无需去重、无需担心权重叠加。⚠️ 该结论**以 CR17/CR18 为前提**：有环时遍历会重复并无限递归。 | §3.4 | 这是「同层去重」与「`Σx = P` 守恒」的**前提**；也是「受益人唯一」这条审计口径的依据 | 已冻结（PK）+ **前提已裁定（§5.20 #1）**：以 CR78 的三件守卫成立为前提 |
| **CR78** | **防环机制（v0.2 · 裁定 #1，权威）**：⛔ **`depth` 不再是防环机制**（保留作**遍历上界 + 审计**；`depth_is_cycle_guard = false`）。防环 = **① 自指禁令**（`child_uid <> parent_uid`）**＋ ② 祖先检查**（绑定前断言**新父 `P` 不是 `child` `C` 的后代**；等价式 `C ∉ ancestors(P)`；实现 = 从 `P` 沿 `parent_uid` 上行、遇 `C` 即拒）**＋ ③ 绑定串行化**（同一事务 + 串行化点，CR18）。⇒ **`0007` 必须同时提供这三件**（**三缺一即判负**）；机读形状 = §3.2 的 `referral_cycle_guard` 块。 | `0007`：`referral_no_self` CHECK + 绑定函数/触发器 + `users` 两行 `FOR UPDATE` | 缺任一 ⇒ 2-环可达 ⇒ 佣金链遍历无限递归 + 分错人；**只验 `depth` 等式必然漏**（2-环下等式仍成立） | **已裁定（#1）** |
| **CR79** | **必带「2-环反例」判负用例（v0.2 · 裁定 #1）**：必须有一条**机读**判负用例 —— **先插 `A→B`、再插 `B→A`，第二次绑定必须被拒**（`400` + `REFERRAL_CYCLE_REJECTED`）；并与「**绕过守卫直接 INSERT 两行** ⇒ §11.8 M9 的 `cycles = 1` / `bad_depth = 1`」的对照配套。**没有该判负用例的绿色绑定用例不算通过**（对齐 R93）。 | 质检脚本（run-tagged）+ §11.8 M9 | 这条是「防环机制有效」的**唯一机读证据**；它同时是「`depth` 不足以防环」的证据（§3.2 反例） | **已裁定（#1）** |

---

## §4 版本化佣金政策 `commission_policy`

### 4.1 版本选择口径（**冻结**）

```
给定事件时刻 T（= 结算语句内的 now()）：
  policy(T) := SELECT * FROM commission_policy
                WHERE effective_from <= T
                ORDER BY effective_from DESC
                LIMIT 1
```

- **只取一版**：`UNIQUE (effective_from)` 保证没有并列；`ORDER BY effective_from DESC LIMIT 1` 走 `commission_policy_effective_uniq` 的 btree（可反向扫描，CR11）。
- **「事件时刻生效」的那一版**（D12）—— **不是**「当前最新版」（两者只在「排期未来生效」的行存在时不同）。

> ✅ **v0.2（裁定 #9）：已裁定为「口径 A」** —— `0007` **必须**种入一版默认政策（`effective_from = '1970-01-01T00:00:00Z'`、`fee_rate_bp = 100`、`levels = 10`、`weights_bp` = §4.4 那一行、**`created_by = 0`（平台 id）**）⇒ **「无政策行」不可达**、`policy(T)` 恒有返回值；连带按裁定把 CR7 / §2.1 的 `created_by` **放宽为允许平台 id（`0 / −1 / −2 / −3`）并去掉 FK**（CR82）。下表两个口径**原样保留作留痕**（**口径 B 已不采用**，仅在「种子行被人工删除 / 越界改库」这类缺陷场景下才作为兜底读数出现）：
>
> | 口径 | 做法 | 后果 |
> |---|---|---|
> | **A（本册倾向）** | `0007` 种入一版默认政策（`effective_from = '1970-01-01T00:00:00Z'`）⇒ **「无政策行」不可达**，`policy(T)` 恒有返回值 | 需要 `created_by` 能取一个**平台主体**值（`0`）⇒ 与 §2.1 的 `created_by > 0` + FK 冲突 ⇒ **若选 A，CR7 的这两条约束必须改成 `created_by >= 0` 且去掉 FK**（用户表在 P2 时点可能 0 行，拿不到真实作者） |
> | **B** | 不种默认政策；后台首配之前**不产生结算** | 需要一条「无政策 ⇒ 拒绝」的明确行为（本册建议：`500 LEDGER_FEE_RATE_INVALID` + `reason = COMMISSION_POLICY_MISSING`，**R108 告警**，因为「计费配置缺失」只可能是运营/部署缺陷）。⚠️ **若选 B，冻结「不静默按 0 费率结算」**：静默 0 费率 = 悄悄改变资金口径（雇主白省、祖先白少收） |

### 4.2 不追溯（D12 的机械含义）

- 政策改版**只**影响 `T >= effective_from` 的**新**事件；
- **已落盘的 `ledger_entry` 逐字节不变**（append-only 的直接后果）⇒ 判据 M7；
- **禁止**任何「按新权重重算历史」的后台功能：重算要么**改历史行**（被 `trg_ledger_entry_append_only` 拒），要么**追加冲正行**（那会让「同一 `job_id` 一个结算事件」的口径与判据 M3 失效）⇒ 两条路都不可走。

### 4.3 后台可改（接口口径，不含 UI）

- 「后台可改」的**唯一**合法动作 = **插一行新政策**（`INSERT`，不是 `UPDATE`）⇒ INSERT-only 触发器（CR8）是其机械保证。
- 「立即生效」= `effective_from = now()`；「排期生效」= 未来时间。两者都不需要额外机制（`policy(T)` 自己就会选对）。
- 写政策的**作者**必须可追溯（`created_by`，见 §4.1 的口径选择）。**v0.2（裁定 #9）**：作者 = **真实用户（`> 0`）**或**平台 id（`0 / −1 / −2 / −3`）**；平台 id 表示「`0007` 种子 / 平台运维写入」，仍必须可追溯到**迁移或操作日志**（不再要求 FK 到 `users`）。

### 4.4 费率真源迁移（§0.5 张力 ②）与**默认权重矩阵建议**

**费率真源**：`ledger.spec` §14.1 #32 把费率写成 `app_config` 里的键（100 = 1%、500 = 5%）。P2 起，**费率的唯一真源 = `commission_policy.fee_rate_bp`**（因为它必须与权重**同一版本**才能自洽：费率随时改而权重按版本走，会造出「哪一版配哪个费率」的歧义）。⇒ `app_config` 的费率键**在 P2 起不再参与计费**（保留键、不做删除，避免动既有表的语义）。错误码 #32 **复用**（借码，`details` 里区分来源，§13）。✅ **v0.2（裁定 #3）：已裁定** —— **`commission_policy.fee_rate_bp` 是唯一真源**；`ledger.spec` **v0.8 已就地更正 §14.1 #32 的措辞**（并写明「P2 起 `app_config` 费率键不再参与计费」）；⚠️ `ledger.spec` 侧 `app_config` 的**金额上限键不受影响**（R71 / §15 #18）。

**默认权重矩阵建议**（`ledger.spec` §0.2 明确把「返佣权重矩阵的具体数值」判给 P2 spec ⇒ 本册必须给一版）：

| `L` | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Σ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `weights_bp` | 3000 | 2000 | 1500 | 1000 | 800 | 600 | 500 | 300 | 200 | 100 | **10000** |
| 占比 | 30% | 20% | 15% | 10% | 8% | 6% | 5% | 3% | 2% | 1% | 100% |

⇒ 缺省 `fee_rate_bp = 100`（1%，D6 区间下沿）。**这套数值是【待拍板】的**（后台可改；改的方法是插一行新政策，CR23）。

### 4.5 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **CR23** | **版本选择 = 「`effective_from <= T` 中 `effective_from` 最大者」**（`T` 取自 DB `now()`，CR4）。**无任何符合行**时的行为**未定** ⇒ 两个口径见 §4.1 的对照表（本册倾向**口径 A：`0007` 种默认政策**，使「无政策」不可达），**待 Zang 裁定**（§14 #9）。 | 组装器的读查询；`0007` 的种子（若选 A） | 若选口径 A，则 §2.1 / CR7 的 `created_by` 约束必须同步放宽（否则种子行建不出来）——**这是本节与 §2 的一处强耦合** | **已裁定（§5.20 #9）**：**口径 A**（`0007` 种默认政策 ⇒ 「无政策行」**不可达**）；连带 `created_by` 放宽为平台 id 并去 FK（CR7 / CR82） |
| **CR24** | **不追溯（D12）**：政策改版**只**影响 `T >= effective_from` 的新事件；历史事件的分录**逐字节不变**。**禁止**「按新权重重算历史」的任何功能（改历史行 = 被触发器拒；追加冲正 = 破坏「一 job 一事件」与判据 M3）。 | §4.2；判据 M7 | 「后台改权重」是**高频运营动作**（P6），因此这条必须在前端文案里就说清「只影响以后」 | 已冻结（D12） |
| **CR25** | **`effective_from` 单调**：新插行的 `effective_from` **必须严格大于**既有最大值（`UNIQUE` 是结构性保证，**应用层必须先校验并给可读错误**）。⇒ **禁止**插入「介于两个既有版本之间 / 早于最大值」的行：那会得到一个**永不生效的死版本**（`policy(T)` 永远选不到它）⇒ 静默无效配置 + 审计误导。**补录历史版本**的需求必须走 §14 #10 的裁定。 | 后台写政策的服务层；`commission_policy_effective_uniq` | 「后台点一次保存、看起来成功了、其实永远不生效」是本场景最可能的运营事故 | **已裁定（§5.20 #10）**：**禁止回填**（只能严格递增）—— 回填 = 永不生效的死版本 + 静默无效配置 + 审计误导 |
| **CR26** | ⚠️ **政策读取的 TOCTOU 面 + 调用方重放纪律**：① 政策必须在**组装 payload 之前、同一请求内**读取一次（`T` 与服务端时钟一致）；② **重放必须复用同一 payload 与同一 `request_fingerprint`**（R52①）⇒ 调用方必须**缓存 payload/指纹**，**禁止**「重试时重新计算金额」——否则政策改版后重试会得到**不同 payload** ⇒ 同键异指纹 ⇒ **`409`（而不是重放）**，用户看到「请求内容已变更」而钱没发；③ **备选（更严，超出 `0007`）**：把「读政策 + 算 `x_L`」下沉进 `ledger_post_event`（DB 内计算）⇒ 彻底消除 TOCTOU，代价 = 需要**新迁移改函数**〔⛔ **v0.2（裁定 #14）：本备选作废** —— 计算不下沉，见 CR81〕。 | 结算服务 + 客户端重试策略 | 这条是**运维级**坑：它只在「政策刚改过 + 恰好有重试」时出现，测试默认路径**测不到** | **已裁定（§5.20 #14）**：**计算不下沉** ⇒ ① 的 TOCTOU 面**保留**、③ 的「下沉」备选**作废**（CR81）；**② 的「重放必须复用同一 payload / 指纹」是硬纪律**；DB 侧只加**后置断言**（CR80） |
| **CR27** | **政策参数必须在组装 payload 前校验**：`fee_rate_bp ∈ [100,500]`、`levels ∈ [1,10]`、`len(weights_bp) == levels`、`Σweights_bp <= 10000`、每个 `w_L >= 0`；任一失败 ⇒ `400 LEDGER_AMOUNT_INVALID` + 前缀化 `reason`（§13），**不落账**。**禁止**「让 DB 报错来当校验」（R80 同口径：DB 闸是兜底、不是流程）。<br>**费率真源（§0.5 ②）**：P2 起费率**只**取 `commission_policy.fee_rate_bp`；`app_config` 的费率键不再参与计费。 | 结算服务的前置校验；§4.4 | 若沿用 `app_config` 的费率而权重按政策版本走，会产生「哪一版配哪个费率」的歧义 ⇒ 明确切断 | 已冻结（v0.2：裁定 #3 已把费率真源定死；形状校验为既有纪律，R80 同口径） |
| **CR28** | **政策相关字段都不得进幂等键**：`policy_id` / `effective_from` / `fee_rate_bp` / `weights_bp` / 任何金额，一律**禁止**出现在 `idempotency_key` 里（对齐 R50：键只能用不可变标识）。⇒ 键**只**由 `job_id` 派生（CR57）⇒ 「政策改版后的同键重放」判定**与政策无关**。 | 事件构造函数 | 若把 `effective_from` 拼进键，政策一改就会生成**新键** ⇒ 同一笔结算**双发**（这正是要防的事故） | 已冻结（承 R50） |
| **CR82** | **口径 A 的落地（v0.2 · 裁定 #9）**：`0007` **必须**种入默认政策（`effective_from = '1970-01-01T00:00:00Z'`、`fee_rate_bp = 100`、`levels = 10`、`weights_bp` = §4.4 那一行、`created_by = 0`）⇒「**无政策行**」**不可达**，§13.2 #1 的 `COMMISSION_POLICY_MISSING` 在正常路径**不可达**（保留作兜底）；`created_by` **允许平台 id（`0 / −1 / −2 / −3`）**且**去掉指向 `users` 的 FK**（`CHECK (created_by >= 0 OR created_by IN (-1,-2,-3))`）。 | §2.1 的 `0007` DDL + 种子 `INSERT`（幂等，CR71） | 种子行与 FK 的取舍是**同一件事**（P2 时点 `users` 可能 0 行）；种子行本身就是「无政策」不可达的**唯一**保证 | **已裁定（#9）** |

---

## §5 一次原子事件的载荷形状（jsonb）

### 5.1 顶层载荷（`op='entries'`，**一个幂等键**）

```json
{
  "op": "entries",
  "idempotency_key": "biz:job:settle:<job_id>",
  "request_fingerprint": "<sha256(规范化请求体)>",
  "ref_type": "job",
  "ref_id": "<job_id>",
  "memo": "招工验收结算 job=<job_id>",
  "entries": [ /* 见 5.3，2 + 2 + 2N 条 */ ]
}
```

调用形状固定为**一条语句**：`SELECT ledger_post_event($1::jsonb)`（对齐 `ledger.spec` §7.1 / §19.5：**自带隐式事务**，应用层**不得**再包 `BEGIN…COMMIT`）。`ledger.spec` §7.1 的「单语句」形态是**本节的唯一合法形态**。

### 5.2 `entries[]` 逐条字段清单

| 字段 | JSON 类型 | 本事件必填？ | 取值口径 |
|---|---|---|---|
| `uid` | **string**（十进制） | ✔ | 账户 uid（`job_payout`/`job_fee` 减方 = 雇主；`job_payout` 增方 = 打工人；`job_fee`/`commission` 减方 = `−2`；`commission` 增方 = 受益人 `> 0`） |
| `cid` | **string** | ✔ | **全事件同一个 `cid`**（CR3），= 该招工的计价币种 |
| `kind` | string | ✔ | 本事件**只允许** `job_payout` / `job_fee` / `commission`（20 关闭集内的三个；其余 17 个**不得**出现在本事件） |
| `delta` | **string** | ✔ | 可用余额变动（可为 `"0"`）；**非字符串 ⇒ `400 NOT_STRING`**（既有闸，P2 不得绕过） |
| `frozen_delta` | **string** | 视分录 | 冻结余额变动（本事件只给**雇主减方**用负值）；缺省 = `"0"` |
| `ref_type` | string | 可选 | 逐条覆盖 payload 级；本事件：`job_payout`/`job_fee` ⇒ `"job"`，`commission` ⇒ `"commission_payout"` |
| `ref_id` | **string** | 可选 | 逐条覆盖 payload 级；见 CR36 —— **v0.2（裁定 #4）：取值 = 同一 `job_id`**（逐条只给 `ref_type`、`ref_id` 回落 payload 级即可） |
| `memo` | string | 可选 | 人读；**不参与任何逻辑判断**（R19） |
| `reversal_of_txid` | — | ✘ | 本事件**禁止出现**（非冲正事件；出现即触发 `REVERSAL_GUARD`） |
| `idempotency_key` | — | ✘ | **禁止传**：逐条键**不是 DB 契约字段**（函数自行派生、**值被忽略**），只做「禁 `#` / 禁控制字符 / 必须是字符串」的硬闸（`ledger.spec` §6.2 v0.4 块 (2)） |

**顶层可选字段** `currency_op`：`entries` 分支支持一个可选的币种状态矩阵闸（`ledger.spec` §19.3：结算类仅 `listed`）。**本册不强制**：① 不传 ⇒ 只做「币存在 + `cid=1` 恒 `listed`」的默认校验；② 传 `'settle'` ⇒ 对本事件所有 `cid` 施加结算档的状态矩阵。两者都合法，**选哪个待拍板**（P3 落地 `job` 状态机时一并定）。

### 5.3 分录顺序铁律（**本册的核心契约**）

`K` = 顶层 `idempotency_key`（= 事件根键，CR57）。派生键规则来自 `ledger.spec` R51：**第 1 条用 `K` 本身，第 `i` 条（`i ≥ 2`，1-based）用 `K#<i>`**—— 换算到 0-based 数组下标 `idx` 即：**`idx = 0 ⇒ K`，`idx ≥ 1 ⇒ K#(idx+1)`**。

| `idx` | 分录 | `uid` | `kind` | `delta` | `frozen_delta` | 派生键 |
|---|---|---|---|---|---|---|
| 0 | `job_payout` **减方** | 雇主 | `job_payout` | `"0"` | `−net` | **`K`（事件根行 / 幂等探针）** |
| 1 | `job_payout` **增方** | 打工人 | `job_payout` | `+net` | `"0"` | `K#2` |
| 2 | `job_fee` **减方** | 雇主 | `job_fee` | `"0"` | `−fee` | `K#3` |
| 3 | `job_fee` **增方** | `−2`（佣金账户） | `job_fee` | `+fee` | `"0"` | `K#4` |
| `4+2(L−1)` | `commission` **减方** | `−2` | `commission` | `−x_L` | `"0"` | `K#(5+2(L−1))` |
| `5+2(L−1)` | `commission` **增方** | 第 `L` 层受益人 `a_L` | `commission` | `+x_L` | `"0"` | `K#(6+2(L−1))` |

其中 `L = 1..N`，`N` = 本次**实际发放**的层数（`N ≤ M ≤ min(levels, 10)`，见 §7；`x_L = 0` 的层**不出现**，CR48）。

**规模自检**：`entries` 条数 = `2 + 2 + 2N ≤ 24 ≤ 32`（R64 上限）；涉及账户 = `2 + 1 + N ≤ 13 ≤ 16`（R64 上限）⇒ **P2 天然在上限内**（`levels ≤ 10` 是这条结论的前提，CR7）。**零额事件**（`fee = 0`）只有 2 条（CR51）。

**「雇主支出不变」的验算（D14）**：雇主 `frozen` 累计减少 `net + fee = gross`（= 托管额全额解冻），`balance` **不变** ⇒ 雇主实付仍是 `gross`；打工人实收 `net`（少掉 `fee`）；`fee` 全额进 `−2`。 〔**v0.2（裁定 #11）唯一分支变化**：打工人**无邀请人**时 `job_fee` **增方的 uid = `−1`（平台收入）而不是 `−2`**（`entries[3].uid = -1`），其余顺序与派生键映射**完全不变**；该分支需要 `−1` 的白名单接纳 `job_fee`，见 §9.5 / CR84 / CR85〕

### 5.4 锁序与调用方传序（**两件事，不得混淆**）

| 维度 | 由谁决定 | 结论 |
|---|---|---|
| **加锁全序（R79）** | **DB 内部**：`entries` 分支按 `SELECT DISTINCT uid, cid … ORDER BY 1, 2` 建槽并 `FOR UPDATE`（db 侧自核：`0005` 的 C4 段） | ⇒ **`entries[]` 的数组顺序不影响锁序**，**不得**依赖调用方传序（这正是 R79 想要的性质） |
| **派生键序号** | **数组顺序**：`K#(idx+1)` | ⇒ 数组顺序**必须确定性**（同一业务事实 ⇒ 逐字节相同的数组），否则重放时派生键漂移 ⇒ 撞唯一约束 ⇒ `LD024 / derived_key_collision`（`500`，R108 告警）——**本册最容易忽略的一条** |
| **逐条推演的错误优先级** | **数组顺序**：DB 按数组顺序滚动校验余额/冻结（C5 段） | ⇒ 「先撞哪条 `LEDGER_INSUFFICIENT_*`」由顺序决定 ⇒ 顺序变了，**错误码可能跟着变**（同一残缺状态的报错不同） |

⇒ 组装器的义务：**先按 §5.3 排列、再交给 DB**；**不得**「让 DB 自己排」。

### 5.5 幂等与形状（与 §10 呼应）

- 事件根键 `K` **只由 `job_id` 派生**（`biz:job:settle:<job_id>`，CR57）；前缀 `biz:` 是强制的（R49）。
- `K` **必须**过键字符集闸（禁 `#`、禁 C0/DEL，R49 v0.4）——`job_id` 是纯数字/短串，天然安全；**但不得**在键里拼业务描述文本（含空格/`#` 会直接 `400`）。

### 5.6 ⚠️ 与 `ledger.spec` §7.2 #8 的形态张力（§0.5 ③）

`ledger.spec` §7.2 #8（招工验收结算）原文包含「**写最多 10 组 `commission` 分录 + 对应 `commission_payout` 行**」。P2 的事件走**单条 `SELECT ledger_post_event($1::jsonb)`**（D10 / `ledger.spec` §7.1 / §19.5）⇒ **函数内不能写一张业务表**（`0007` 也不建它，CR14）。⇒ 本册口径：**审计真源 = `ledger_entry`**（`kind='commission'` + `ref_type='commission_payout'` + `memo` + `idx_ledger_kind_time`），**`commission_payout` 行留待 P6**。**该张力已登记 §14 #4，不由本册单方面解决。** ✅ **v0.2（裁定 #4）：已裁定 —— `0007` 不建该表**；**审计真源 = `ledger_entry`**；**`ref_id` = 同一 `job_id`**；`ledger.spec` v0.8 已就地更正 §7.2 #8（原文划线留痕）。

### 5.7 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **CR29** | 一个结算事件 = **一次** `SELECT ledger_post_event($1::jsonb)`（`op='entries'`）；**禁止**拆成多次调用、禁止应用层包 `BEGIN…COMMIT`（`ledger.spec` §7.1 / §19.5）。 | 结算服务唯一入口 | 拆开会出现「酬金已付、佣金未发」的**可见中间态**，且判据 M3 不再可机读 | 已冻结（D10 + §19.5） |
| **CR30** | **顶层字段清单**（§5.1）：`op` / `idempotency_key` / `request_fingerprint` / `ref_type='job'` / `ref_id=<job_id>` / `memo` / `entries`。`ref_type` 与 `ref_id` **成对**（R18）。 | 事件构造函数 | 缺 `ref_id` ⇒ `REF_PAIR_MISMATCH`（400 借码）；`ref_type` 必须在既有白名单内 | 已冻结（承 R18） |
| **CR31** | **`entries[]` 字段清单**（§5.2）：必填 `uid` / `cid` / `kind` / `delta`；可选 `frozen_delta` / `ref_type` / `ref_id` / `memo`；**禁** `reversal_of_txid`；**禁**逐条 `idempotency_key`（传了也只做硬闸、值被忽略）。 | 事件构造函数 | `delta` 与 `frozen_delta` **不得同时为 0**（`ledger_move_guard` 前置判定会以 `400 BOTH_ZERO` 拒收） | 已冻结（既有 DB 契约） |
| **CR32** | **顺序铁律**（§5.3）：`idx=0` **必须**是 `job_payout` 减方（= 幂等探针根行）；随后 `job_payout` 增方 → `job_fee` 减方 → `job_fee` 增方 → 逐层 `commission` （减方在前、增方在后，`L` 升序）。 | 事件构造函数 | 成对分录的顺序反了不影响 `Σ`，但会改变 C5 的错误优先级与派生键分配 | 待拍板（**本册核心契约**，一句话可改但改动须回写） |
| **CR33** | **派生键确定性**（§5.4）：`K#(idx+1)` ⇒ 数组必须逐字节可复现。**禁止**把「已排序的 DB 结果」以外的任何集合（`Set` / 无序 map / 并发遍历）直接当数组交给 DB。 | 事件构造函数 | 顺序漂移 ⇒ `LD024 / derived_key_collision`（`500` 缺陷告警）+ 半成品风险（该分支在 C0 禁 `#` 后**不可达**，故一旦出现即为**实现缺陷**） | 已冻结（承 R51） |
| **CR34** | **锁序不依赖传序**（§5.4）：R79 全序由 DB 内部排序保证；**同时**承认数组顺序决定**派生键序号**与**错误优先级** ⇒ 两条结论必须**同时**写进实现注释，**不得**只写一条（只写「顺序无所谓」会诱发 CR33 的缺陷）。 | 实现注释 + 质检用例 | 这是本册**最容易被误读**的一处（「乱序也能过」与「顺序必须确定」并存） | 待拍板（口径，不可删） |
| **CR35** | **规模上限自检**（§5.3）：`entries ≤ 24 ≤ 32`、账户 `≤ 13 ≤ 16`；超限的根因只可能是 `levels > 10` 或混币（CR3）⇒ 该两情形必须先改 `ledger.spec` R64。⚠️ **受益人可以从未开户**：DB 的 C4 段会 `INSERT INTO account … ON CONFLICT DO NOTHING`（0/0 开户，R75）⇒ **禁止**把「受益人不在 `account` 里」实现成 `LEDGER_ACCOUNT_NOT_FOUND`。 | 事件构造器 + 质检用例 | 把「未开户」当错误是本场景最常见的误读，会凭空拦住合法分佣 | 已冻结（既有 DB 行为，db 侧自核） |
| **CR36** | **`commission` 分录的 `ref_type = 'commission_payout'`** —— 该值**自 `0001` 起就在 `ledger_ref_type_enum` 白名单内**，**无需改约束**（自核：`0001` 的白名单与 `0005` 的逐条校验白名单均含它）。`ref_id` 取值**待裁定**（§14 #4）。**实现提示**：DB 支持「逐条只给 `ref_type`、`ref_id` 回落 payload 级」⇒ 若裁定 `ref_id = job_id`，逐条**不必**重复写 `ref_id`。 | 事件构造函数 | 若 `ref_id` 取不到值（不给逐条、payload 级也没有）⇒ `REF_PAIR_MISMATCH` | **已裁定（§5.20 #4）**：**`ref_id` = 同一 `job_id`**（逐条不必重复写，回落 payload 级） |
| **CR37** | 金额字段**一律十进制字符串**（R70）；`delta` / `frozen_delta` 传 JSON number ⇒ `400 LEDGER_AMOUNT_INVALID` + `NOT_STRING`（既有闸）。同时**禁止** `amount` / `amount_units` 出现在 `entries[]` 里（那是 op=其他分支的字段；`entries` 分支只认 `delta` / `frozen_delta`）。 | 事件构造函数 | 「金额传 number 更自然」是本项目历史上真实踩过的坑（M31/M43 同源） | 已冻结（承 R70 / R72） |

---

## §6 池子、取整与最大余数法

### 6.1 手续费与净额（**冻结**）

```
fee = (gross × fee_rate_bp + 5000) / 10000        -- 整数除法 = half-up，对齐 R68
net = gross − fee                                  -- 减法求净额，对齐 R68/R44
P   = fee                                          -- 池子 = 手续费全额（D6）
```

- `fee_rate_bp` ∈ `[100, 500]`（D6）；**只取事件时刻生效的政策**（CR23）；`gross > 0`（P3 保证）。
- `D14` 的验算：`net + fee == gross` 恒等 ⇒ 雇主支出不变（§5.3）。
- `fee = 0` ⇒ 走 §8 的零额口径（CR51）。

### 6.2 最大余数法（**本册的唯一分配算法**）

```
输入：池子 P（> 0）、层数 M、权重 w_1..w_M（bp，w_L >= 0）
W  := Σ_{L=1..M} w_L                              -- 归一化分母（§7：不是 10000）
q_L := (P × w_L) / W                              -- 整数除法（向下取整）
r_L := (P × w_L) mod W                            -- 余数
D  := P − Σ_{L=1..M} q_L                          -- 残余，数学上 0 <= D < M
排序：把 L 按 (r_L DESC, L DESC) 排成全序
x_L := q_L + 1  若 L 在前 D 名内
       q_L      否则
```

**性质（可证）**：

1. `Σ q_L <= P` 且 `D = P − Σq_L`，且 `D < M`（因为 `Σ (P·w_L mod W) / W < M`） ⇒ **`D` 个 +1 刚好分完**。
2. ⇒ **`Σ x_L == P` 逐分不差**（判据 M1）—— **不需要任何二次舍入**（CR45）。
3. 排序键 `(r_L DESC, L DESC)` 是**全序**（同一 `M` 内 `L` 唯一）⇒ 结果**唯一确定**、可复现。

### 6.3 ⚠️ 一处口径解读：「残余给最深一层」

`master-plan` §5.19 的措辞是「任何残余给**最深一层**（确定性规则）」。它与同处的「**最大余数法**」有**两种互斥读法**：

| 读法 | 含义 | 本册处置 |
|---|---|---|
| **读法 ①（本册采用）** | 主体用**最大余数法**；「给最深一层」= **破平局规则**（余数相同时，层数更深者优先） ⇒ 最大余数法本来就把 `D` 分完，不存在「剩下的给谁」的问题；「最深一层」的唯一用武之地就是**同余数** | **采用**：它同时满足两句话、且结果唯一、可机读（例 5 是专门的平局用例） |
| **读法 ②** | **不用**最大余数法：`q_L = floor(P·w_L/W)`，**所有**残余 `D` 一并加给 `L = M` | ❌ **不采用**：它会使「单笔最多差 `D` 个单位（< M）」全部砸在一层，最坏情况下**第 10 层独占 `P − Σq`**，与「按权重成比例」的直觉冲突；且 `D` 可达 `M−1` 个单位，在 `P` 很小时（如 `P = 1..9`）会让**最深层独吞整个池子** |

⇒ 两读法的差异**只在余数相同时显现**；本册选定 ①（**登记 §14 #15**，一句话可改）。

### 6.4 纸面推演（**未跑实现，仅手算**，§15 #4）

| 例 | 场景 | `P` | `M` | `w` | `q` | `r` | `D` | `x` | `Σ` |
|---|---|---|---|---|---|---|---|---|---|
| **1** | 满 10 层、权重和 10000（= 100%） | 10000 | 10 | 3000..100 | 3000,2000,1500,1000,800,600,500,300,200,100 | 全 0 | **0** | 同 `q` | **10000** ✓ |
| **2** | 短链：`M=3`、权重和 6500（重归一化，§7） | 10000 | 3 | 3000,2000,1500 | 4615,3076,2307 | 2500,6000,4500 | **2** | **4615,3077,2308** | **10000** ✓ |
| **3** | 极小额池子 | 1 | 3 | 3000,2000,1500 | 0,0,0 | 3000,2000,1500 | **1** | **1,0,0** ⇒ 第 2/3 层**不建分录**（CR48） | **1** ✓ |
| **4** | 零额池子 | 0 | — | — | — | — | — | **不发任何 `commission`**（CR51） | **0** ✓ |
| **5** | **平局**（验证「最深一层」破平局） | 1 | 2 | 2500,2500 | 0,0 | 2500,**2500** | **1** | **0,1** ⇒ 更深者拿 | **1** ✓ |

**例 3 与例 5 是同一个「小池子」现象的两面**：`P` 小于权重和时，「谁拿到那 1 个单位」完全由余数决定 ⇒ 这条**必须**有判据（M1 + M5）覆盖。

### 6.5 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **CR38** | `fee = (gross × fee_rate_bp + 5000) / 10000`（整数除法 = **half-up**，对齐 R68）；`fee_rate_bp` **只来自事件时刻生效的政策**（CR23），P2 起**不读 `app_config`**（CR27）。 | 金额工具函数（建议名 `mulDivHalfUp(a, b, den)`，`ledger.spec` R68 已建议该名） | 全项目**只有一个**取整点（此处），避免「两处各自四舍五入」产生 1 分差 | 已冻结（D6 + R68） |
| **CR39** | `net = gross − fee`（**减法**求净额）；**禁止**用第二个乘法/取整去算 `net`（对齐 R68）。⇒ `net + fee == gross` 恒等（判据 M2）。 | 同上 | 用两个独立取整算 `net`/`fee` 会出现 `net + fee ≠ gross` 的 1 分残差 ⇒ 判据 M2 必红 | 已冻结（D14 + R68） |
| **CR40** | **`P = fee`**（池子 = 手续费全额，D6「全额进佣金池、平台不抽成」）；`P` **不减去**任何平台留存。 | §6.1 | 若将来要「平台抽成」，那是**推翻 D6**，必须由 Kevin 拍板并改 `ledger.spec` §5.2 R45 | 已冻结（D6） |
| **CR41** | **分配用最大余数法**（§6.2 的六行公式）：`W = Σw_L`；`q_L = (P×w_L)/W`（整除）；`r_L = (P×w_L) mod W`；`D = P − Σq_L`；按 `(r_L DESC, L DESC)` 取前 `D` 名各 `+1`。 | 组装器的分配函数（建议名 `splitPool(P, weights)`） | ⚠️ **本册的分配只在应用层实现一次**（DB 不算金额、只做配对断言）⇒ 不存在「两侧算式不一致」的面；**但**若 §14 #14 裁定把计算下沉进 DB，则必须**同时**保留算式唯一（不得两套）〔**v0.2（裁定 #14）：已裁定「不下沉」** ⇒ 算式**只存在于应用层一处**；DB 侧只加**后置断言**（CR80）〕 | 已裁定（#14；算法本身仍为待拍板口径） |
| **CR42** | **破平局 = `(r_L DESC, L DESC)`**（余数相同时**更深层优先**）—— 这是「残余给最深一层」的机器可验落点（§6.3 读法 ①）。 | 同上 | 必须用**全序**（不得只比 `r_L`，那会因排序不稳定而**不可复现**） | **已裁定（§5.20 #15）**：采用**读法 ①**（最大余数法 + **同余数深层优先**）；**否决读法 ②**（小池子时最深层独吞，不公平）；§6.4 例 5 是判据 |
| **CR43** | **`Σ x_L == P` 逐分不差**：必须在**落账前**做一次显式断言（组装器里的 `assert(sum(x) == P)`）。失败 ⇒ 借 `500 LEDGER_ACCOUNT_GUARD_VIOLATION` + `reason = COMMISSION_SPLIT_SUM_MISMATCH`（**500 类 = 实现缺陷 ⇒ 必须 R108 告警**，§13）。 | 组装器自检 | 这条断言把「分不干净」从**静默的资金黑洞**变成**响亮的 500**；没有它，残差会表现为「`−2` 余额只增不减」（判据 M3 变红但没人看） | 已冻结（v0.2：**裁定 #14 已把「Σ佣金 == 手续费」定为 DB 侧强制** ⇒ 本条不再是唯一防线，见 CR80） |
| **CR44** | **全整数运算、禁浮点**（对齐 R67）：`P`、`w_L`、`q_L`、`r_L`、`D`、`x_L` 全程整数；**禁止** `Number()` / 浮点除法 / `Math.round`。中间量可行性：本册取值域内 `P ≤ 5×10¹³`（`gross ≤ 1e15` 且 `fee_rate_bp ≤ 500`）⇒ `P × w_L ≤ 5×10¹⁷ < 9.22×10¹⁸`（`bigint` 上限）**不溢出**；**但不得依赖这一点**：`ledger.spec` R71 的单笔上限是 `app_config` **可配**值，可能被调大 ⇒ 实现**必须**用 `BigInt`（TS）或 `numeric`（SQL）做乘除。 | 分配函数；R71 对齐 | 这是**纸面推导**（§15 #5），未实测；`P×w_L` 与 `Σ` 都应按大整数处理 | 待拍板 |
| **CR45** | **舍入只在 `fee` 一处**（CR38 的 half-up）；**分佣只做「整除 + 整数 `+1`」，不做任何二次舍入** ⇒ 「`Σ` 逐分不差」是**构造出来的**，不是「再舍入修回来的」。 | 分配函数 | 「先浮点算比例、再一次性修差」是这类实现最常见的写法，也是 `Σ ≠ P` 的根因 —— 明令禁止 | 待拍板（**强烈建议冻结**） |
| **CR80** | **「Σ佣金 == 手续费」必须由 DB 侧强制（v0.2 · 裁定 #14）**：`0007` **必须新增一条只读后置断言触发器**，对同一 `event_root_key` 断言 **`Σ(commission 减方：`−2` 出池) == Σ(job_fee 增方：入池)`**（两方向各自的 `delta` 求和、逐分相等）。**推荐机制** = `CREATE CONSTRAINT TRIGGER … AFTER INSERT ON ledger_entry FOR EACH ROW DEFERRABLE INITIALLY DEFERRED`（**推迟到事务提交时**执行 ⇒ 单语句调用的隐式事务提交点 = 事件装配完成点）。⛔ **禁止**：① **改 `ledger_post_event` 函数体**（§5.20 #14 明令禁止，也不得 `CREATE OR REPLACE` 覆盖）；② 改 `0001`–`0006`；③ 改 `ledger_entry` **表结构**（**新增触发器不属**表结构改动）；④ 触发器**写任何表**（只读断言）；⑤ 用 `FOR EACH STATEMENT`（PL/pgSQL 内每条 `INSERT` 都是**独立语句** ⇒ 会在**事件中途**误报）。**失败必须落 `500` 缺陷类**（`defect` 桶 + R108 告警，与 §13.2 #9 同族）—— ⚠️ **不得裸抛 `23514`**（既有分类器把「其余 `23514`」归 `input` ⇒ `400`）；具体 SQLSTATE ⇒ 码名的落地须**真库探针**确认并回填（§14.2 #3 / §15 #11）。 | `0007` 内的新触发器（幂等创建，CR71）；不为它新增码 | 这是**调用方自觉之外**的强制：应用层断言（CR43）可被绕过（手搓 payload、直连 DB），DB 断言**不可**；同时它**不得**让 P1 既有回归变红（§14.2 #4 / §15 #12） | **已裁定（#14）** |
| **CR81** | **计算不下沉（v0.2 · 裁定 #14）**：读政策、读邀请图、算 `fee` / `net` / `x_L` **一律留在应用层**（本册 §5 / §6 的载荷契约**不变**）；**不得**重写 P1 已验证的核心、**不得**新增改 `ledger_post_event` 的迁移。⇒ §5 / §6 中一切暗示「把计算下沉进 DB」的表述**作废**（CR26 ③、CR41 的括号注已就地注记）；DB 侧**只**做 CR80 的后置断言。 | 结算服务；本册 §5 / §6 | 代价（已认）：CR26 ① 的 **TOCTOU 面保留** ⇒「重放必须复用同一 payload / 指纹」是**硬纪律** | **已裁定（#14）** |

---

## §7 重归一化

### 7.1 层数 `M` 的定义（**冻结**）

```
M := min(levels, chain_depth)      -- chain_depth = 从打工人上溯、能走到的「自身有 referral 行」的祖先个数（§3.4）
                                   -- 自核：W → I1 → I2（I2 无行）⇒ chain_depth(W) = 2 = depth(W)（I5）
```

- `M` = 本次**参与分配**的层数；`L = 1..M`。
- `N` = 本次**实际产生 `commission` 分录**的层数（`x_L = 0` 的层不产生，CR48）⇒ `N ≤ M`。
- `M = 0`（无邀请人）⇒ 走 CR49。

### 7.2 重归一化（D13）—— 与 `ledger.spec` R45 的**互斥**口径

```
W := Σ_{L=1..M} w_L        -- 归一化分母 = 「已存在层级的权重和」，不是 10000
```

`W` 是 §6.2 公式里**唯一**的分母 ⇒ 链上不足 `levels` 层时（`M < levels`）**按已存在层级权重比例再分配**（D13）；权重和 `< 10000` 时同理。**两种「分不完」都被这一条消解为一个分母**，所以：

- `Σ x_L == P` **恒成立**（与 `M`、与 `Σw` 无关）⇒ 「池子分不完」在 P2 的**分配层**不存在。

> ⚠️ **仲裁（§0.5 ①）**：`ledger.spec` §5.2 **R45** 写「若 10 级权重之和不足 100%，**差额留在佣金池（累计余额）**，不退回平台账户」。这与 **D13** 的「按已有层级权重比例再分配」**互斥**：同一笔钱不能既留池又分完。
> **本册按 D13**（更新的冻结项；且只有它能让判据 M3「`−2` 在本事件的净额 = 0」成立）。⇒ 请 Zang 对 **R45 出 v0.8 就地增补**（§14 #2）。**本册不改 `ledger.spec.md`**。 ✅ **v0.2（裁定 #2）：已裁定 D13 胜**；`ledger.spec` **v0.8 已就地增补 R45**（原文标「已由 D13 取代」）⇒ 本口径即**权威口径**，「差额留池」在本册**不再出现**。

### 7.3 ⚠️ 退化分母 `W = 0`（前 `M` 层权重**全为 0**）—— **v0.2：已裁定为「政策写入时就拒」**

**✅ v0.2（裁定 #16）**：**在政策写入时就拒绝** —— 要求 **`Σweights_bp > 0` 且「前 `M` 层不得全零」**（可静态判定的等价式 = **`weights_bp[1] > 0`**，推导见 §14.2 #2），失败类 = **`400`**（借 `LEDGER_AMOUNT_INVALID` + `reason = POLICY_WEIGHTS_ALL_ZERO`；**不用 `500`、不新增码**）⇒ 见 CR83 / §2.1 的守卫。⇒ **运行时的 `W = 0` 分支因此不可达**：任何已落库的政策都保证 `W > 0`。

⚠️ **例外与登记**：若库里**已存在** `weights_bp[1] = 0` 的政策行（越界改库 / 迁移缺陷 ⇒ 只可能是人工写库），则属**缺陷类**（`500` + R108 告警 + 修复政策），见 §14.2 #2；**不得**把它当「正常边界」。

下面 v0.1 的三条**保留作留痕**（当时的「建议 = `500` + 告警」**已被裁定取代**，且当时的前提「靠运行时才发现」已由写入守卫消灭）：

若政策的 `weights_bp[1..M]` 全为 `0` ⇒ `W = 0` ⇒ §6.2 的除法**不可定义**。本册**不静默处置**：
- **不建议**「不发 `commission`、池子留在 `−2`」——那会让钱永久沉在 `−2`：`R103` 规定平台账户**只进不出**（连运维提取都没有 `kind`）⇒ 池子变成**取不出的钱**。
- **本册建议**：视为**配置缺陷**（作者本意应是「设置权重」，全零是笔误）⇒ 借 `500 LEDGER_FEE_RATE_INVALID` + `reason = POLICY_WEIGHTS_ALL_ZERO`，**R108 告警**，事件**不落账**。
- ⇒ 登记 **§14 #16**（本册只给建议，不落位）。 ⛔ **v0.2 已裁定（#16）：改为「政策写入时就拒 ⇒ `400`」** —— 上面三条 v0.1 文字保留作留痕，**已被取代**。

### 7.4 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **CR46** | `M = min(levels, chain_depth)`；`levels` 取自事件时刻生效的政策（CR23），`chain_depth` 取自 §3.4 的上行链。`M ≤ 10` **恒成立**（`levels ≤ 10`，CR7）⇒ 判据 M4（10 级全深度可结）可达。 | 组装器 | `M` 是 `N` 与 `W` 的唯一输入 ⇒ `M` 算错 = 整体分错（`off-by-one` 的头号落点） | 已冻结（D6/D13 + CR7 的约束） |
| **CR47** | **重归一化 = 分母取 `W = Σ_{L=1..M} w_L`**（D13）；**不是**固定 `10000`。⇒ `Σ x_L == P` 与 `M`、与 `Σw` 无关地成立。⇒ ⚠️ 与 `ledger.spec` R45「差额留池」**互斥**，本册按 D13（§7.2 / §14 #2）。**退化 `W = 0` 的处置**见 §7.3（⛔ v0.2 裁定 #16：**政策写入时就拒 ⇒ `400`**，运行时不可达；旧「建议 500 + 告警」作废）。 | 组装器；`splitPool()` 的分母 | 这条是「链上不足 10 级也能分完」的**唯一**机制；若无它，短链会把大量钱留在 `−2`（判据 M3 变红） | 已冻结（D13） |
| **CR48** | **某层 `x_L = 0` ⇒ 不建该层的两条分录**（`commission` 减方 + 增方），**不报错、不写 0 额流水**。其「份额并入余数池再分」由 §6.2 的 `D` 分配**天然实现**（基线 `q_L = 0` 的层仍参与余数竞争，可能拿到那个 `+1`，如例 3 与例 5）。⇒ **不得**写 `delta = "0"` 的 `commission` 分录（会被 `ledger_move_guard` 以 `400 BOTH_ZERO` 拒收）。 | 组装器的分录生成循环 | 零额分录有害无益：污染流水、拉长事件、且**会被 DB 直接拒绝**；同时它会让 `Σ commission` 的条数不稳定 ⇒ 判据 M1 更难断言 | 待拍板（一句话可改） |

---

## §8 边界情形：无邀请人 / 短链 / 零额

### 8.1 四类情形与「每类的归属 + 读数」（**硬项：每个情形都必须有判据**）

| 情形 | 触发条件 | 分录形状 | `commission` 条数 | `job_fee` 分录 | **`−2` 在本事件的净额** | 是否报错 | 判据 |
|---|---|---|---|---|---|---|---|
| **正常** | `chain_depth ≥ 1` 且 `P > 0` | §5.3 全集 | `2N`（`N ≤ M ≤ 10`） | 有（1 对） | **`0`**（进 `fee`、出 `Σx = fee`） | 否 | M1 / M3-A / M4 |
| **无邀请人** | `chain_depth = 0` | `job_payout` 对 + `job_fee` 对（**增方 = `−1`**，v0.2 裁定 #11） | **`0`** | **有**（1 对，**入 `−1`**） | **`0`**（`−2` 全程不参与；`−1` 净额 = `+fee`） | **否** | **M3-C** / M5① |
| **短链** | `1 ≤ chain_depth < levels` | `job_payout` 对 + `job_fee` 对 + `M` 对 | `2M` | 有（1 对） | **`0`**（重归一化后分完，CR47） | 否 | M2 / M3-A / M5② |
| **零额** | `fee = 0`（`P = 0`） | **只有 `job_payout` 对（2 条）** | **`0`** | **无**（CR51） | **`0`**（无进无出） | **否** | M5③ |
| **零额 + 无邀请人** | `fee = 0` 且 `chain_depth = 0` | 同零额 | `0` | 无 | `0` | 否 | M5③ 的退化 |

**唯一「报错」的边界**是 §7.3 的退化分母（`W = 0`，配置缺陷，**建议** 500；§14 #16），以及 §4.1 的「无政策」（口径未定；§14 #9）。**其余边界一律静默正确**。 〔**v0.2 更正（裁定 #16 / #9）**：① 退化分母改为**政策写入时就拒（`400`）** ⇒ **运行时不再有这一条报错边界**；② 「无政策」在**口径 A** 下**不可达**（`0007` 种子政策）⇒ **P2 的运行时「边界报错集」为空**（四条边界情形**全部静默正确**）；唯一可能的失败是**装配缺陷**（`Σ` 不等 / 派生态漂移）⇒ `500` 类 + R108 告警，见 §13.2 #9 / CR80〕

### 8.2 无邀请人时手续费去哪（**v0.2：已裁定 —— 入 `−1`，不入 `−2`**）

**✅ v0.2（裁定 #11）**：**手续费仍收，但入 `uid = −1`（平台收入账户），不入 `−2`（佣金池）**。理由（裁定原文）：**`−2` 若只进不出，钱会永久沉淀**；`−1` 才是平台收入账户。**并明确：`−2` 只作佣金中转，同一事件内进出相抵、净额 0、不留存。**

- **事件形状**（与 §5.3 相比的**唯一**差异）：`job_fee` **增方的 uid = `−1`**（`entries[3].uid = -1`）；`−2` 在本事件中**完全不出现**；`Σ commission = 0`。
- **机读判据（取代 v0.1 的 M3-B）**：§11.3 的 **M3-C** —— `minus2_net = 0`、`commission_rows = 0`、**`minus1_net = +fee`**。
- ⚠️ **机械前提（本册 v0.2 新发现，登记 §14.2 #1）**：现行白名单里 **`−1` 的 `credit` 只允许 `trade_fee` / `listing_fee` / `currency_create_fee`，不含 `job_fee`**（DB 侧 `ledger_assert_platform_mutation` 的 `'-1'` 分支，**本册 v0.2 `read_file` 自核**；TS 侧**未核对**）⇒ 本裁定**必须**配一条 **`0008`** 扩展 `−1` 的白名单（**不得**靠换 `kind` 或走 `transfer` 绕过：CR54 不放宽任何格）。**`0008` 落地前本口径不可实现**（§9.5 / CR84 / CR85）。

下面 v0.1 的两口径对照与风险说明**保留作留痕**（结局见末行）：

| 口径 | 内容 | 依据 / 代价 |
|---|---|---|
| **本册口径（留池）** | **手续费仍收**（`job_fee` 照发，`fee` 全额进 `−2`），`−2` 在本事件的净额 = `+fee`；⇒ **判据 = 「`Σ commission` 为 0 且 `job_fee` 金额 == 该事件对 `−2` 的 `delta` 增量」** | 对齐 `master-plan` §5.19 的「倾向：手续费仍收、留在平台佣金账户 ⇒ 需 spec 明写并给判据」；且与 `ledger.spec` R45「未分配余额累计留存」**不冲突**（R45 那段与 D13 冲突的是**权重不足**的情形，不是「无人可发」的情形） |
| **备选口径（不收）** | 无邀请人 ⇒ `fee = 0`（雇主只付 `net = gross`），**不产生 `job_fee` 分录** | 理由：D6「全额进佣金池、平台不抽成」的目的是**分给邀请链**；链不存在时这份钱没有任何应得人，留池反而使 `−2` 变成「无人受益的沉淀账户」——而 `R103` 规定平台账户**只进不出**（连运维提取都没有 `kind`）⇒ 沉淀的钱**取不出来** |
| **风险（两种口径都要认）** | 若「无邀请人」是**常态**（例如 P2 上线初期多数用户还没绑邀请人），留池口径会快速累积一笔**不可动用的余额**；它不会被对账判据抓出（`ledger.spec` 判据 6「佣金池守恒」照样成立），属**经济设计**问题而非**账实不符**问题 | ⇒ 建议 P6 后台把「佣金池累计余额」做成**显性指标**（`ledger.spec` R45 的连带影响也这么要求） |

⇒ ~~**本册采用「留池」并给判据；备选口径登记 §14 #11**（由 Zang 裁定）。~~ ⛔ **v0.2 结局（裁定 #11）**：

| v0.1 候选 | 结局 |
|---|---|
| ~~**本册口径（留池）**~~：`fee` 全额进 `−2`、`−2` 净额 `+fee` | ⛔ **作废**（裁定 #11：`−2` 只进不出 ⇒ 钱永久沉淀） |
| ~~**备选口径（不收）**~~：`fee = 0`、不产生 `job_fee` | ⛔ **未采用**（裁定 #11 明确「**仍收**」） |
| **采用**：仍收，**入 `−1`** | ✅ **已裁定（#11）** —— 见本节抬头；判据 = **M3-C** |
| **风险（仍成立）** | 「无邀请人」若是常态，`−1` 会快速累积**平台收入**；但 `−1` 的语义正是「平台收入」⇒ 不再是「无人受益的沉淀」；仍建议 P6 把「平台收入累计 / 佣金池余额」做成**显性指标** |

### 8.3 零额（`fee = 0`）的事件形状（**必须显式分支**）

`fee = 0` 的常见来源：`gross` 很小、`fee_rate_bp = 100` ⇒ `(gross × 100 + 5000)/10000 = 0` **当且仅当** `gross × 100 + 5000 < 10000`，即 `gross < 50`（最小单位）。⇒ **`gross ∈ [1, 49]` 一律 `fee = 0`**（`decimals = 0` 的 `$` 下即「酬金少于 50 个 `$`」）。

| 事件形状 | `fee > 0` | `fee = 0` |
|---|---|---|
| `entries` 条数 | `4 + 2N` | **`2`** |
| 派生键集合 | `{K, K#2, K#3, K#4, …}` | **`{K, K#2}`** |
| `Σ(delta + frozen_delta)` | `0` | `0` |
| 打工人到手 | `net = gross − fee` | **`net = gross`** |
| 雇主 `frozen` 减少 | `gross` | `gross` |

⇒ **禁止**「先按 `fee > 0` 组装 4 条分录、再让 DB 去拒 0 额行」：`ledger_move_guard` 的前置判定会以 `400 LEDGER_AMOUNT_INVALID` + `reason = BOTH_ZERO` 拒收（db 侧自核），**报错而不是静默**——但那是**不该发生的报错**（R80 同口径：DB 闸是兜底、不是流程）。

### 8.4 其它边界（逐条给定论，避免下游各自发挥）

| 边界 | 定论 | 理由 |
|---|---|---|
| 打工人自己出现在链上？ | **不可能**（链从 `parent` 起，不含自身） | §3.4 的 CTE 起点是 `parent_uid` |
| 同一受益人出现在两层？ | **不可能** | I1 ⇒ 简单路径（CR22） |
| **雇主是打工人的祖先**（雇主既是付钱方又是受益人）？ | **本册允许**（仅按邀请关系分配，不额外禁止） | 是否禁止是**经济设计**选择，不是不变式；且「禁止」需要额外的链上比对 ⇒ 登记 §14 #12 ✅ **v0.2（裁定 #12）：允许** —— **只按邀请关系分配、不对「雇主 / 打工者」身份特判**；**唯一硬约束 = 受益人不得是打工者本人**（由 CR78 的自指禁令 / 图的无环性保证） |
| 受益人**从未开过户**？ | **允许**，DB 自动 `INSERT INTO account … ON CONFLICT DO NOTHING`（0/0 开户，R75） | 既有 DB 行为（db 侧自核，CR35）；**禁止**把它当 `LEDGER_ACCOUNT_NOT_FOUND` |
| 受益人是平台保留 uid（`≤ 0`）？ | **不可能**（FK + R100，CR21） | `referral.*_uid` FK 到 `users(uid)`，`uid ≥ 1` |
| 链上出现**已注销 / 已删**用户？ | ⚠️ **缺口**：`users` 能否删行、删了之后 `referral` 怎么办（FK 会拦住删除）**未定** ⇒ 属 P6 身份议题，本册只登记 | FK 已给出机械后果（删用户会失败），但「注销流程怎么走」不在本册 |
| `gross` 为 `0` 或负？ | **不可能**（P3 的 `job` 状态机保证 `gross > 0`）；若传入即为 P3 缺陷 | 本册不重复校验（D15 边界） |

### 8.5 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **CR49** | **无邀请人（`chain_depth = 0` ⇒ `M = 0`）**：**不产生任何 `commission` 分录**、**不报错**；`fee` 仍收（口径见 §8.2）⇒ 该事件 **`−2` 净额 = `0`**（`job_fee` 增方 = **`−1`**，v0.2 裁定 #11）、**`−1` 净额 = `+fee`**。 | 组装器分支 | 该分支的**判据**是 **M3-C** 与 M5①（不是「没报错就算过」） | 已冻结（master-plan §5.19）+ **已裁定（#11）** |
| **CR50** | **短链（`1 ≤ chain_depth < levels`）**：按 CR47 **重归一化、全额分完**（`Σ x_L == P`）；**不得**因「不足 10 级」而留池（D13）。 | 组装器；`W = Σ_{L=1..M} w_L` | 这是 D13 的**主用例**；若实现按 `10000` 出分母，短链会静默留池 ⇒ 判据 M3-A 必红 | 已冻结（D13） |
| **CR51** | **零额（`fee = 0`）**：① **不写 `job_fee` 分录**（对齐 R44 的 `fee = 0` 分支）；② **不产生任何 `commission` 分录**；③ **不报错**；④ 事件 `entries` **恰 2 条**（`job_payout` 对），派生键 = `{K, K#2}`。**禁止**用「写 4 条再让 DB 拒零额」的方式实现。 | 组装器分支（§8.3 的表） | 形状变化会连带影响派生键集合 ⇒ 重放必须复现**同一形状**（CR33） | 已冻结（R44 的 `fee=0` 分支）+ 细节待拍板 |
| **CR52** | **无邀请人时手续费归属（v0.2 · 裁定 #11）**：**仍收，但入 `−1`（平台收入），不入 `−2`**；`−2` **只作佣金中转、同一事件内进出相抵、净额 0、不留存**。机读判据 = **M3-C**（§11.3）。 | 组装器分支 + §11.3 M3-C | **派生的机械前提**：需 `0008` 扩展 `−1` 的白名单接纳 `job_fee`（§9.5 / CR84 / CR85 / §14.2 #1）；**不得**换 `kind` 或走 `transfer` 绕过 | **已裁定（#11）** |
| **CR53** | **其它边界的定论**（§8.4）：受益人 = 雇主 ⇒ 允许（§14 #12）；受益人未开户 ⇒ 自动开户（CR35）；链上无重复（CR22）；打工人不在链上；受益人恒 `> 0`。 | 组装器 + 质检用例清单 | 「注销用户 / 链上残留」是**唯一**仍开口的边界（P6 议题），本册只登记 | 已冻结（v0.2：裁定 #12 已裁定「允许雇主为受益人」+「受益人不得是打工者本人」的硬约束） |
| **CR84** | **无邀请人 ⇒ 手续费入 `−1`（v0.2 · 裁定 #11）**：① **仍收**（`fee > 0` 时**必有** `job_fee` 对）；② **增方 uid = `−1`（平台收入）**，**不入 `−2`**；③ **`−2` 只作佣金中转**：同一事件内进出相抵、**净额 0、不留存**（⇒ 正常稳态余额 `0`，`ledger.spec` 判据 6 的期望读数因此更紧）；④ **不得**为绕过白名单而换 `kind`、**不得**走 `transfer`（CR54 不放宽任何格）；⑤ **机械前提**：现行白名单里 `−1` 的 `credit` **不含 `job_fee`** ⇒ **必须**新增 **`0008`** 扩展（DB + TS 两侧同改）；**`0008` 落地前本口径不可实现**（§9.5 / CR85 / §14.2 #1）。 | 组装器分支（`entries[3].uid`）+ `0008`；判据 **M3-C** | 这条把「无人受益的沉淀」变成「平台收入」；代价是**引入跨迁移依赖**（P2 = `0007` + `0008`），必须在排期里显式登记 | **已裁定（#11）** |

---

## §9 平台账户与 `PLATFORM_KIND_WHITELIST`

### 9.1 硬项：`commission` 的出账方 = 平台佣金账户 ⇒ **必须**在白名单内

**要求**：`commission`（减方方向）**必须**在 `PLATFORM_KIND_WHITELIST['-2'].debit` 内。依据：`ledger.spec` §5.1 #11 规定 `commission` 的减方恒为 `uid = −2`，而 §13 R101 规定「平台账户只允许白名单内的 kind 变动」，且 DB 侧 `ledger_post_event` 对**每一条**分录按方向调用 `ledger_assert_platform_mutation`（db 侧自核：`0005` 的 C5 段，`v_e_delta < 0 OR v_e_frz < 0 ⇒ 'debit'`）。

### 9.2 现状核对（**逐字自核，非转抄**）

| 侧 | 真源 | `−2` 的格 | 结论 |
|---|---|---|---|
| TS | `backend-ts/src/ledger.ts` 的 `PLATFORM_KIND_WHITELIST` | `'-2': { credit: ['job_fee'], debit: ['commission'] }` | ✅ **已含 `commission`** |
| DB | `backend-ts/migrations/0004_ledger_post_event.sql` 的 `ledger_assert_platform_mutation` | `WHEN '-2' THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('job_fee') ELSE p_kind IN ('commission') END` | ✅ **已含 `commission`** |
| kind 关闭集 | `ledger_entry` 的 `ledger_kind_enum` | 20 值含 `job_payout` / `job_fee` / `commission` | ✅ |
| DB（**v0.2 自核**） | 同上函数的 `'-1'` 分支 | `WHEN '-1' THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('trade_fee', 'listing_fee', 'currency_create_fee') ELSE false END` | ⚠️ **不含 `job_fee`** ⇒ 裁定 #11 的「手续费入 `−1`」**必须**配一条 `0008`（见 §9.5 / §14.2 #1）；本册只自核了 **DB 侧**，**TS 侧 `PLATFORM_KIND_WHITELIST['-1']` 未核对** |

⇒ **P2 不需要 `ALTER` 白名单**（这不是遗漏，是既有实现已覆盖）。硬项 7 的落点因此**不是**「改白名单」，而是 **CR55 的迁移自检**。

### 9.3 为什么仍然必须写成一条规则（**理由，不是形式**）

P2 的**准入前提**（`commission` 出账）真源在 `0001`–`0006` 与 TS 里 ⇒ **`0007` 改不到它、只能断言它还在**。若有人日后「清理」白名单（例如把平台账户的白名单收紧成「只进不出」），P2 会在**生产结算的那一刻**才以 `400 LEDGER_RESERVED_UID / PLATFORM_DEBIT_FORBIDDEN` 硬失败 —— 而那是**一个不可自愈的运营事故**（每次结算都失败，直到改回）。⇒ 「不安检就不许起飞」。

### 9.4 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **CR54** | **`commission` 的减方恒为 `uid = −2`，且必须在该账户的 `debit` 白名单内**（§9.1）。**本册不放宽任何格**：`−2` 的 `credit` 仍只允许 `job_fee`，`−2` **不得**出现 `transfer` / `hold` / `purchase`（对齐 R101，`−3` 的 `transfer` 例外**不外延**）。 | `PLATFORM_KIND_WHITELIST`（TS）+ `ledger_assert_platform_mutation`（DB） | 若将来要做「平台运维提取」，那是 `R103` 的**未决项**（需新 `kind`），与 P2 无关 | 已冻结（承 R101） |
| **CR55** | **`0007` 的迁移自检必须断言 3 件事仍在**（失败即**中止迁移**，不得静默跳过）：① `commission` ∈ TS 的 `PLATFORM_KIND_WHITELIST['-2'].debit`；② DB 的 `ledger_assert_platform_mutation` 的 `-2` 分支含 `'commission'`（**行为探针优先**：对 `−2` 发一条 `commission` 减方分录**必须不**报 `LD021`；文本断言作辅助）；③ `ledger_kind_enum` 仍含 `job_payout` / `job_fee` / `commission`。 | `0007` 末尾的自检 `DO $$ … $$`（或 `0007` 之后的独立探针脚本，run-tagged） | 这是硬项 7 的**实际落点**：白名单已就位 ⇒ 唯一可做且必须做的动作是**把它钉住** | 待拍板（**强烈建议冻结**） |
| **CR56** | **`−2` 不得透支**（对齐 R102 / 判据 9）：池子不足 ⇒ **整事件回滚**（`409 LEDGER_INSUFFICIENT_BALANCE`，`rows_written_0 = true`）。本册保证该分支**不可达**：`fee` 与 `Σx` 在同一语句内且 `Σx == fee`（CR43）⇒ 本次支出恒 ≤ 本次进项。⇒ 若它真的发生，即 `Σx == fee` 的断言被绕过 ⇒ **响亮失败**（正是 R102 想要的）。 | 组装器断言（CR43）+ DB 的 R102 兜底 | 「池子不足」在正常路径不可能 ⇒ 一旦出现必然是**实现缺陷**，不得用「少发一层」来兜 | 已冻结（承 R102） |
| **CR85** | **白名单扩展与迁移边界（v0.2 · 裁定 #11 / #14）**：① **`0007` 允许在 `ledger_entry` 上新增只读断言触发器**（CR80）—— 这**不属**「修改 `ledger_entry` 表结构」、也不属「改函数体」；② **`−1` 的 `credit` 白名单接纳 `job_fee`** 属**既有对象的行为改变** ⇒ **只能落在 `0008+`**（**不得**改 `0001`–`0006`，CR73）；③ `0007` / `0008` **都必须幂等**（CR71），且**都不得**触碰 `ledger_post_event` 的函数体（裁定 #14 明令禁止）；④ TS 侧 `PLATFORM_KIND_WHITELIST` 必须与 DB 侧**同时**改。 | `0007`（触发器）/ `0008`（白名单）+ `src/ledger.ts` | ⇒ **P2 的迁移交付物从「`0007` 一个」变为「`0007` + `0008`」**（前提 = 采纳裁定 #11 的 `−1` 路由；若 Zang 改裁，`0008` 取消）—— 排期影响登记 **§14.2 #1** | **已裁定（#11 / #14）**（`0008` 的必要性**待 Zang 确认**） |

### 9.5 v0.2 新增要求：`−1` 的白名单扩展必须落在 `0008`（裁定 #11 的机械前提）

- **事实（v0.2 `read_file` 自核，非转抄）**：`backend-ts/migrations/0004_ledger_post_event.sql` 的 `ledger_assert_platform_mutation` 对 `'-1'` 只放行 `credit ∈ {trade_fee, listing_fee, currency_create_fee}`、`debit` 恒 `false`（与 `ledger.spec` §13 R101 同口径）⇒ **`job_fee` 入 `−1` 会被该守卫拒绝**。
- **要求**：裁定 #11 的「无邀请人 ⇒ 手续费入 `−1`」**必须**由 **`0008`**（新迁移）扩展 `−1` 的 `credit` 白名单，且 **DB 侧与 TS 侧 `PLATFORM_KIND_WHITELIST` 同时改**（两层口径一致，CR55 同精神）。**不得**改 `0004`（checksum 纪律，CR73）；**不得**用换 `kind` / `transfer` 绕过（CR54）。
- **落地前**：该分支**不可实现** ⇒ 判据 **M3-C 不得读作已通过**（§15 #13）。
- **未核对**：TS 侧 `PLATFORM_KIND_WHITELIST['-1']` 的内容本册**未读**；**不得**假设它已含 `job_fee`。

---

## §10 幂等与并发

### 10.1 事件根键（**唯一、确定性、不含可变字段**）

```
K := "biz:job:settle:<job_id>"        -- 前缀 biz: 强制（R49）；job_id 是不可变业务标识
```

- 同一 `job_id` 的验收**只有一个**结算事件 ⇒ `K` 天然唯一（P3 保证「一次验收只落一次结算」）。
- **禁**入键的字段（R50）：金额（`gross`/`fee`/`net`/`x_L`）、政策版本（`policy_id`/`effective_from`/`weights_bp`）、时间戳、层级、任何状态位（CR28）。
- 键已过字符集闸（禁 `#`、禁 C0/DEL）⇒ `job_id` 若含非法字符会直接 `400 LEDGER_IDEMPOTENCY_KEY_INVALID`（**不是**静默降级）。

### 10.2 并发重放：**完全复用既有机制，P2 不新增任何并发设施**

| 环节 | 机制（全部既有） |
|---|---|
| 探针 | 事件根行（`entries[0]`，键 = `K`）的 `idempotency_key UNIQUE`（`ledger_idem_uniq`） |
| 冲突处理 | 函数内首条分录带 `ON CONFLICT (idempotency_key) DO NOTHING`；0 行 ⇒ 走函数内的**重放分支**（返回 `idempotent_replay = true`） |
| 原子性 | **一条 `SELECT` 自带隐式事务**（D10）⇒ 失败即整体回滚（`rows_written_0`） |
| 派生行归属 | `ledger_entry.event_root_key = split_part(idempotency_key,'#',1)` = `K`（结构性守卫） ⇒ 重放判定按**事件根键精确等值**（`ledger.spec` §6.2 v0.4 块 (4)） |
| 并发同键 | 第二个语句在**唯一索引**上等待第一个提交 ⇒ 然后 `ON CONFLICT DO NOTHING` 命中 ⇒ 重放分支 ⇒ **恰一组分录**（不双扣、不双发） |
| 并发不同键 | 争夺同一 `−2` / 同一受益人 ⇒ 由 **R79 全序（uid 升序、同 uid 再 cid 升序）** 串行化；**禁止**应用层锁（R86） |

### 10.3 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **CR57** | **事件根键 = `biz:job:settle:<job_id>`**（§10.1）；前缀 `biz:` 强制；**禁**把金额 / 政策 / 层级 / 时间戳 / 状态进键（CR28）。 | 事件构造函数 | 「同单改价重发」会被判为**同键异指纹 ⇒ 409**（`ledger.spec` R50 的**故意行为**），而不是双扣 | 待拍板（模板可改，纪律不可改） |
| **CR58** | **并发重放不双扣、不双发**：**完全复用** R51 的幂等协议 + `ledger_idem_uniq` + 单语句隐式事务（§10.2）；P2 **不引入**任何新机制（不加锁表、不加 Redis、不加版本列）。⇒ 「N 个并发同键请求」的期望读数 = **恰一组** `commission` 行 + `N−1` 次 `idempotent_replay = true`（判据 M6）。 | 结算服务（无需额外代码） | 若有人为 P2「加一层幂等缓存」，那会造出**第二套真源**（R86 同精神：正确性必须落在 DB 事务 + 唯一约束上） | 已冻结（承 R51 / R86） |
| **CR59** | **重放返回语义**（对齐 R52）：同键**同**指纹 ⇒ `200 {idempotent_replay: true, …}`；同键**异**指纹 ⇒ `409 LEDGER_IDEMPOTENCY_CONFLICT`（**不执行、不改动任何数据**）。⇒ **调用方重试必须复用同一 payload 与同一指纹**（CR26 ② 的纪律；「重试时重新算金额」会从「重放」退化成「409」）。 | 结算服务 + 客户端重试策略 | 「第二次点结算弹错误」是这类项目最常见的体验缺陷 ⇒ 前端必须把 `idempotent_replay: true` **当成功**（R106） | 已冻结（承 R52 / R106） |
| **CR60** | **禁止把分佣拆成独立事件或异步执行**（对齐 R57 / R58）：`N× commission` **必须**在同一事件的同一次调用内。 | 结算服务 | 拆开会出现「酬金已付、佣金未发」的**可见中间态**（`ledger.spec` §7.2 #8 的「不允许拆分的理由」正是这一条）；且判据 M3 只在单事件口径下可机读 | 已冻结（承 R57 / R58） |
| **CR61** | **不同 `job_id` 的并发结算**：靠 **R79 全序**串行化（`−2` 与重叠受益人会成为争抢点）；**禁止**用应用层 / 分布式锁「优化」（R86）。⇒ 两个并发结算最多 `13 + 13 = 26` 个账户的行锁，锁序仍有界、无死锁。 | 无需额外代码 | 「先查池子余额再发」这类预校验（R63 禁止的跨事务检查-使用）在并发下必然双发 ⇒ 严禁 | 已冻结（承 R79 / R86 / R63） |

---

## §11 可证伪判据（机读）

> **本节的每一条都必须是「能被机器验、且能判负」的**。约定：`:K` = 事件根键（`biz:job:settle:<job_id>`）；`ev` = 该事件的行集 `WHERE event_root_key = :K`；`:worker` / `:employer` / `:cid` 已知。**所有读数一律 run-tagged 落盘、不写固定文件名**（v0.7 §16 #12 的纪律）。

### 11.1 判据 M1 — 池子守恒：`Σ x_L == P` **（硬项 ①）**

```sql
WITH ev AS (SELECT * FROM ledger_entry WHERE event_root_key = :K),
     pool AS (SELECT COALESCE(sum(delta), 0) AS p FROM ev WHERE uid = -2 AND kind = 'job_fee'),
     paid AS (SELECT COALESCE(-sum(delta), 0) AS s FROM ev WHERE uid = -2 AND kind = 'commission')
SELECT (SELECT p FROM pool) AS pool, (SELECT s FROM paid) AS paid,
       (SELECT p FROM pool) = (SELECT s FROM paid) AS m1_ok;
```

- **期望**：`m1_ok = true`；零额事件 `pool = paid = 0`（0 = 0 也算 `true`）。
- **判负（对照实验）**：把某一层的 `x_L` 人为 `+1` ⇒ `m1_ok` **必须变 false**；把某一层整对分录删掉 ⇒ **必须变 false**。
- **注意**：`m1_ok` 为真**不等价于**「分给了对的人」—— 它是**金额守恒**判据，不是**归属**判据；归属由 M4/M5 的链构造覆盖。

### 11.2 判据 M2 — 打工者净额 = 酬金 − 手续费（**硬项 ②**）

```sql
WITH ev AS (SELECT * FROM ledger_entry WHERE event_root_key = :K),
     g AS (SELECT COALESCE(-sum(frozen_delta), 0) AS gross FROM ev WHERE uid = :employer),
     f AS (SELECT COALESCE(sum(delta), 0)       AS fee   FROM ev WHERE uid = -2 AND kind = 'job_fee'),
     w AS (SELECT COALESCE(sum(delta), 0)       AS got   FROM ev WHERE uid = :worker AND kind = 'job_payout'),
     e AS (SELECT COALESCE(sum(delta), 0)       AS emp_delta FROM ev WHERE uid = :employer)
SELECT (SELECT gross FROM g) AS gross, (SELECT fee FROM f) AS fee, (SELECT got FROM w) AS worker_got,
       (SELECT emp_delta FROM e) AS employer_delta,
       (SELECT got FROM w) = (SELECT gross FROM g) - (SELECT fee FROM f) AS m2_net_ok,
       (SELECT got FROM w) + (SELECT fee FROM f) = (SELECT gross FROM g) AS m2_sum_ok,
       (SELECT emp_delta FROM e) = 0                                       AS m2_employer_balance_unchanged;  -- D14
```

- **期望**：三项**全 true**（`net = gross − fee`、`net + fee = gross`、雇主**可用余额**不变）。
- **判负**：把 `job_payout` 增方改成 `gross`（未扣手续费）⇒ `m2_net_ok` 与 `m2_sum_ok` **必须变 false**；把 `job_fee` 减方改成从 `balance` 扣（而不是 `frozen`）⇒ `m2_employer_balance_unchanged` **必须变 false**。

### 11.3 判据 M3 — 平台佣金账户在该事件上的净额（**硬项 ③**，**两个分支**）

```sql
WITH ev AS (SELECT * FROM ledger_entry WHERE event_root_key = :K),
     comm AS (SELECT count(*) AS n, COALESCE(-sum(delta),0) AS paid
                FROM ev WHERE uid = -2 AND kind = 'commission'),
     net  AS (SELECT COALESCE(sum(delta), 0) AS d FROM ev WHERE uid = -2)
SELECT (SELECT d FROM net) AS minus2_net, (SELECT n FROM comm) AS commission_rows,
       (SELECT d FROM net) = 0 AS m3_a_net_zero,
       (SELECT d FROM net) = (SELECT COALESCE(sum(delta),0) FROM ev WHERE uid = -2 AND kind = 'job_fee')
                            AND (SELECT n FROM comm) = 0 AS m3_b_net_plus_fee;
```

| 分支 | 条件 | 期望读数（**v0.2：与裁定 #11 / D13 自洽**） | 判负 |
|---|---|---|---|
| **M3-A（有可付祖先）** | `chain_depth ≥ 1` 且 `fee > 0` | `minus2_net = 0`（进多少出多少 ⇒ **D13 下全额分完、不留池**） | 漏发一层 ⇒ `minus2_net = +x_L ≠ 0` **必须变红** |
| **M3-C（无邀请人）**（原 M3-B，**v0.2 修正**） | `chain_depth = 0` | **`minus2_net = 0`**（`−2` 全程不参与）、`commission_rows = 0`、**`minus1_net = +fee`**（手续费入 `−1`，裁定 #11） | 若实现「无邀请人就不收手续费」⇒ `minus1_net = 0` **必须变红**；若仍按 v0.1 口径把手续费留在 `−2` ⇒ `minus2_net = +fee ≠ 0` **必须变红** |
| **零额** | `fee = 0` | `minus2_net = 0`、`commission_rows = 0`、`minus1_net = 0` | — |

**M3-C 的机读形状（v0.2 新增，替代 v0.1 的 `m3_b_net_plus_fee`）**：

```sql
WITH ev AS (SELECT * FROM ledger_entry WHERE event_root_key = :K),
     m2 AS (SELECT COALESCE(sum(delta),0) AS d FROM ev WHERE uid = -2),
     m1 AS (SELECT COALESCE(sum(delta),0) AS d FROM ev WHERE uid = -1),
     cm AS (SELECT count(*) AS n FROM ev WHERE uid = -2 AND kind = 'commission')
SELECT (SELECT d FROM m2) AS minus2_net, (SELECT d FROM m1) AS minus1_net,
       (SELECT n FROM cm) AS commission_rows,
       (SELECT d FROM m2) = 0                                                             AS m3c_minus2_zero,
       (SELECT n FROM cm) = 0                                                             AS m3c_no_commission,
       (SELECT d FROM m1) = (SELECT COALESCE(sum(delta),0) FROM ev WHERE uid = -1 AND kind = 'job_fee')
                                                                                          AS m3c_minus1_equals_fee;
```

- **期望**：三项全 `true`。⚠️ **`0008`（`−1` 白名单）未落地前本判据不可执行**（§9.5 / §14.2 #1）。

> ⚠️ **诚实提示**：`M1 ∧ (job_fee 进了 pool)` **蕴含** `M3-A`。两者不是独立判据（一条红另一条必红），保留两条是因为它们**面向不同的读者**（M1 面向「分配算法」，M3-A 面向「账户不变量」）。**不得**把「两条都绿」当成「两条都验过」。

### 11.4 判据 M4 — 10 级全深度可结（**硬项 ④**）

构造：`levels = 10`、`weights_bp = {3000,2000,1500,1000,800,600,500,300,200,100}`（Σ = 10000）、打工人 `W` 的上行链**恰好 10 层**（10 个祖先，每人一行 `referral`）。

```sql
SELECT count(*) FILTER (WHERE uid > 0 AND kind = 'commission')                        AS credit_rows,
       count(DISTINCT uid) FILTER (WHERE uid > 0 AND kind = 'commission')             AS distinct_beneficiaries,
       count(DISTINCT uid) FILTER (WHERE uid = -2 AND kind = 'commission')            AS payer_rows
  FROM ledger_entry WHERE event_root_key = :K;
```

- **期望**：`credit_rows = 10`、`distinct_beneficiaries = 10`、`payer_rows = 1`（`−2` 是**同一个**账户 ⇒ distinct 恒为 1，**与层数无关**；`−2` 的 `commission` **减方行数**才是 `N`）。
- **判负（必做两个对照）**：① 把链截成 9 层 ⇒ `credit_rows` **必须变 9**（同时 M1 仍须为真 ⇒ 这条对照顺带验证重归一化）；② 把 `levels` 设成 9（政策改版）⇒ 同样变 9。

### 11.5 判据 M5 — 三条边界各一例（**硬项 ⑤**）

| 例 | 构造 | 断言（机读） |
|---|---|---|
| **① 无邀请人** | `W` 无 `referral` 行；`fee > 0` | `commission` 条数 = **0**；`job_fee` 条数 = **2**（**增方 = `−1`**）；**M3-C** 为真（`−2` 净额 `0`、`−1` 净额 `+fee`）；**HTTP 200**（不报错） |
| **② 短链** | 链深 `M = 3`、`levels = 10`、`Σw = 6500` | `commission` 条数 = **6**（3 对）；`M1` 为真（`Σx = P`，**且 `x` 必须等于 §6.4 例 2 的 `{4615,3077,2308}`**——这是**逐值**断言，不是只断言和） |
| **③ 零额** | `gross = 30`（< 50）⇒ `fee = 0`；链任意 | `job_fee` 条数 = **0**；`commission` 条数 = **0**；`entries` 总数 = **2**；**HTTP 200**（不报错）；打工者到手 = `gross` |
| **④（附加）小池子平局** | `P = 1`、`M = 2`、`w = {2500,2500}` | 第 2 层拿到那 1 个单位（§6.4 例 5）⇒ 验证 CR42 的破平局规则 |

- **判负**：例③ 若实现「先写 4 条分录」⇒ 会收到 `400 BOTH_ZERO`（**报错而不是 200**）⇒ 判据必须变红（`http_status = 200` 的断言失败）。
- **⚠️ 例② 的逐值断言是本节最硬的一条**：它把「重归一化 + 最大余数法 + 破平局」三件事**同时**钉在一个可复现的读数上。

### 11.6 判据 M6 — 并发重放不双发（**硬项 ⑥**）

- **构造**：`N ≥ 8` 个连接**同时**提交**同一 payload**（同一 `K`、同一 `request_fingerprint`）。
- **断言**：

```sql
SELECT (SELECT count(*) FROM ledger_entry WHERE event_root_key = :K)                       AS rows_total,
       (SELECT count(*) FROM ledger_entry WHERE event_root_key = :K AND kind='commission') AS comm_rows,
       (SELECT count(*) FROM ledger_entry WHERE idempotency_key = :K)                      AS root_rows;
```

  | 断言 | 期望 |
  |---|---|
  | `root_rows` | **恰 1**（幂等探针只落一行） |
  | `rows_total` | **恰 `4 + 2N_levels`**（正常情形）或 **恰 2**（零额情形） |
  | `comm_rows` | **恰 `2 × N_levels`**（不双发） |
  | 应用侧 `idempotent_replay = true` 的响应数 | **恰 `N − 1`** |
  | 所有响应 | `200`（**不得**出现 `409` / `500`；除第一条外全部是重放） |

- **判负（必做）**：把 `ON CONFLICT DO NOTHING` 换成「先 SELECT 查在不在，再 INSERT」⇒ 同键并发**必须**出现双扣/双发（对齐 R93 的对照纪律）。**没有这条对照的绿色 M6 不算通过。**

### 11.7 判据 M7 — 政策改版后历史事件读数不变（**硬项 ⑦，双向**）

| 步骤 | 动作 | 断言 |
|---|---|---|
| 1 | 用政策 `P₁` 结算事件 `E`（`job_id = J`），记录 `E` 的全部行（`txid` / `delta` / `kind` / `uid` / `idempotency_key`）指纹 | — |
| 2 | `INSERT` 一版**全新政策 `P₂`**（`effective_from = now() + 1s`，权重与费率**全改**，如 `fee_rate_bp = 500`、权重全置 1000） | 插入成功（政策是 INSERT-only） |
| 3 | 等 `effective_from` 生效后，**复查** `E` 的行指纹 | **逐字节相同**（`fingerprint_after == fingerprint_before`） |
| 4 | 用**同一 `job_id`** 重放 `E` 的**原 payload + 原指纹** | `200 + idempotent_replay = true`；`ledger_entry` **零新增** |
| 5 | 在新政策下结算**另一个**事件 `E'`（新 `job_id`） | 必须**按 `P₂`** 分配（费率/权重是新的）——**这一条防的是「不追溯」被实现成「政策完全不生效」** |

- **判负**：第 3 步若指纹变化（有人重算或改写历史）⇒ 红；第 5 步若 `E'` 仍按 `P₁` 分配（政策永不生效）⇒ **也必须红**。⇒ **双向断言，缺一不算通过**。

### 11.8 判据 M8 / M9 — 配对不变式与图的不变式

**M8（对齐 `ledger.spec` §11 判据 8 的 P2 实例）**：

```sql
SELECT COALESCE(sum(delta + frozen_delta), 0) AS ev_sum
  FROM ledger_entry WHERE event_root_key = :K;         -- 期望 0
```

外加「键族两口径都必须归零」（对齐 §11 判据 8 v0.4 块 ③）：
```sql
-- 口径①：归属列优先、历史行回退 split_part
SELECT count(*) FROM (
  SELECT COALESCE(event_root_key, split_part(idempotency_key,'#',1)) AS k
    FROM ledger_entry GROUP BY 1
   HAVING sum(delta + frozen_delta) <> 0) s;                  -- 期望 0 行
-- 口径②：纯键前缀算术（无视归属列）
SELECT count(*) FROM (
  SELECT split_part(idempotency_key,'#',1) AS k
    FROM ledger_entry GROUP BY 1
   HAVING sum(delta + frozen_delta) <> 0) s;                  -- 期望 0 行
```

- **判负**：写一条**单边** `commission`（只减方不增方）⇒ 两个口径**必须**都变非零。

**M9（图的不变式，覆盖 I4 / I5 —— 这是 §3.2 反例的**机读闸门**）**：

```sql
-- (a) 无环：从每个节点上行，不得回到自己（walk 上限 100 作防爆）
WITH RECURSIVE up AS (
  SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
  UNION ALL
  SELECT u.start, r.parent_uid, u.d + 1
    FROM referral r JOIN up u ON r.child_uid = u.cur
   WHERE u.d < 100)
SELECT count(*) AS cycles FROM up WHERE cur = start;          -- 期望 0

-- (b) depth 一致：depth = max(步数)（等价于 I5 的 depth(child)=depth(parent)+1，父无行视作 0）
WITH RECURSIVE anc AS (
  SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
  UNION ALL
  SELECT a.start, r.parent_uid, a.d + 1
    FROM referral r JOIN anc a ON r.child_uid = a.cur
   WHERE a.d < 100)
SELECT count(*) AS bad_depth
  FROM referral x
  JOIN (SELECT start, max(d) AS mx FROM anc GROUP BY 1) t ON t.start = x.child_uid
 WHERE x.depth <> t.mx;
```

- **判负**：按 §3.2 的反例插 `(A,parent=B)` 与 `(B,parent=A)` 两行（**绕过 CR17 的守卫**，直接 `INSERT`）⇒ `cycles` **必须变 1**、`bad_depth` **必须变 1**。⇒ **这条对照实验就是「防环构造不成立」的机读证据**（§14 #1 的裁定材料）。✅ **v0.2（裁定 #1）：已成硬要求** —— 它同时是 **CR79** 的判负用例（先 `A→B` 再 `B→A` ⇒ **绑定必须被拒**）的配套证据；**没有这两条对照的绿色 M9 不算通过**（R93）。
- ⚠️ 该对照需要**直接写表**（绕过绑定的应用层守卫）；**跑完必须清理**（测试 uid 固定 ≥ 900000，master-plan §5.7 硬4）。

### 11.9 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **CR62** | **判据 M1（池子守恒）** 必须实现（§11.1）：`Σ x_L == fee` 逐分相等；零额时 `0 = 0` 也算通过；**必须**附「人为 `+1` / 删一层 ⇒ 变红」的对照实验。 | 质检脚本（建议 `backend-ts/scripts/p2-0x-*.ts`，run-tagged） | 这是硬项 ①；**没有对照的绿色不算通过**（R93） | 已冻结（硬项清单） |
| **CR63** | **判据 M2（净额恒等）** 必须实现（§11.2）：`net = gross − fee`、`net + fee = gross`、雇主**可用余额**不变（D14）；三项全真。 | 同上 | 这是硬项 ②；雇主可用余额不变是 D14 的**直接**读数（只验 `net` 会漏掉「从 balance 扣手续费」的实现错误） | 已冻结（硬项清单 + D14） |
| **CR64** | **判据 M3（`−2` 净额，两分支）** 必须实现（§11.3）：有可付祖先 ⇒ `0`；无邀请人 ⇒ `+fee` 且 `commission` 条数 0。**两分支的期望值不同，必须分别断言**（不得只测一支）。 | 同上 | 这是硬项 ③；**同时**它是 `R45` vs `D13` 之争的**裁判证据**（若 `−2` 净额 `≠ 0` 且链非空 ⇒ 有人在留池 ⇒ §14 #2 未落地） | 已冻结（硬项清单）+ **已裁定（#11）**：分支 B **改为 M3-C**（`−2` 净额 `0`、`−1` 净额 `+fee`），见 §11.3 |
| **CR65** | **判据 M4（10 级全深度）** 必须实现（§11.4）：`credit_rows = 10`、`distinct_beneficiaries = 10`；**并附两个对照**（链截 9 层 ⇒ 9；`levels = 9` ⇒ 9）。 | 同上 | 这是硬项 ④；「10 级全深度可结」是本册唯一能证明「封顶是 10 而不是 9 或 11」的判据 | 已冻结（硬项清单） |
| **CR66** | **判据 M5（三条边界 + 1 附加）** 必须实现（§11.5）：① 无邀请人 ② 短链（**逐值**断言 `{4615,3077,2308}`）③ 零额（0 条 `job_fee`、2 条 `entries`、**200 不报错**）④ 平局（`0,1`）。 | 同上 | 这是硬项 ⑤；②的逐值断言把「重归一化 + 最大余数法 + 破平局」钉死在一个读数上 | 已冻结（硬项清单）+ **v0.2**：例① 的期望值已按裁定 #11 改为「`−2` 净额 `0` / `−1` 净额 `+fee`」（§11.5） |
| **CR67** | **判据 M6（并发重放不双发）** 必须实现（§11.6）：`N ≥ 8` 并发同键 ⇒ `root_rows = 1`、`rows_total` 恰为形状值、`comm_rows` 不翻倍、`N−1` 次重放；**必须**附「改成先查后插 ⇒ 必须双发」的对照。 | 同上 | 这是硬项 ⑥；**单线程串行重放测不出任何东西**（`ledger.spec` R85/R93 已为此立规） | 已冻结（硬项清单） |
| **CR68** | **判据 M7（不追溯，双向）** 必须实现（§11.7）：改版后① 历史行指纹不变 ② 同键重放零新增 ③ **新**事件按新政策分配。**缺任一方向不算通过**。 | 同上 | 这是硬项 ⑦；正向（不改历史）容易过，**反向（新政策必须生效）**才是防「政策被实现成永不生效」的那一半 | 已冻结（D12 + 硬项清单） |
| **CR69** | **判据 M8（配对不变式）与 M9（图不变式）** 必须实现（§11.8）：M8 = `Σ(delta+frozen_delta) = 0` + 键族两口径归零；M9 = `cycles = 0` + `bad_depth = 0`。**M9 必须附**「按 §3.2 反例插两行 ⇒ 两条都变红」的对照（**这是 §14 #1 的裁定材料**）。 | 同上 | M8 承接 `ledger.spec` §11 判据 8；M9 是本册**独有**的判据，且它是唯一能**机读证明**防环构造不足的实验 | M8 已冻结（承接）／**M9 已裁定（#1）**：含「2-环反例」的判负用例为**硬要求**（CR79） |
| **CR70** | **判据的元规则**：① 每条判据必须**能判负**（注入-还原或对照实验；对齐 R89 / R93，「没有对照的绿色用例视为装饰」）；② 读数一律 **run-tagged 落盘**、**禁止**固定文件名（会被静默覆盖）；③ 测试数据 **uid ≥ 900000**、自建币 **symbol 前缀固定**、**跑完清理**（master-plan §5.7 硬4）；④ 判据脚本**一律只读或「写-验-清理」**，**禁止**自动改数（对齐 R91：发现不一致只能报警 + 落盘差异清单）；⑤ 判据不得依赖 `ledger_entry` 之外的业务表（`job` 表要 P3 才有 ⇒ **P2 的判据用 `ref_id` 一个自造的测试 id 即可**，因为 `ref_id` **不是 FK**，DB 不校验其存在性——**这一点在 P2 阶段是必要的**，但⚠️ 它同时意味着「`ref_id` 指向不存在的 `job`」在 DB 层**拦不住** ⇒ 属于 P3 的应用层责任，登记 §15 #10）。 | 质检脚本模板 + 报告结构 | ⑤ 是 P2 能**独立**验收的关键：不需要等 P3 的 `job` 表 | 待拍板（**强烈建议冻结**） |

---

## §12 升级、幂等与回滚（`0007`）

### 12.1 `0007` 的幂等机制（**既有基础设施，不得另造**）

`backend-ts/scripts/migrate.ts` 已是版本化迁移器（db 侧自核）：

| 环节 | 现状 |
|---|---|
| 版本表 | `public.schema_migration(id bigserial PK, version text UNIQUE, name text, checksum text, applied_at timestamptz DEFAULT now())`（脚本自举创建） |
| 登记 | 应用成功后 `INSERT INTO schema_migration (version, name, checksum)` |
| 校验和 | `sha256(sql 文件内容)` ⇒ 存 `checksum` |
| 重复应用 | 已应用且 `checksum` 一致 ⇒ `action: "skipped"`（**幂等**） |
| 漂移 | 已应用但 `checksum` 变了 ⇒ `action: "ABORT"`（**exit 3**，不静默重放） |

### 12.2 与 `0001`–`0006` 的关系（**不得修改前六个**）

| 约束 | 理由 |
|---|---|
| **不得编辑 `0001`–`0006` 的任何字节** | 改一个字节 ⇒ `checksum` 漂移 ⇒ 下一次 `migrate.ts` **整条链 ABORT（exit 3）** ⇒ 部署停摆 |
| 本册需要的一切**新**对象只出现在 `0007` | 两张表 + 触发器 + 索引 + （可选）种子行 + 迁移自检（CR55） |
| 若 P2 后续需要改 `ledger_kind_enum` / 白名单 / `ledger_post_event` 函数体 | **只能新建 `0008` 及以后**，且**必须先回来改本册并登记 §17**（CR5） |
| **`0007` 允许**在 `ledger_entry` 上**新增只读断言触发器**（v0.2 · 裁定 #14，CR80） | 它**不属**「修改 `ledger_entry` 表结构」、也**不属**「改函数体」⇒ 落在 `0007` 合法；⚠️ 触发器**只读**（不得写表），且必须**幂等**创建（CR71） |
| **`−1` 的 `credit` 白名单接纳 `job_fee`**（v0.2 · 裁定 #11，CR84 / CR85） | 属**既有对象的行为改变** ⇒ **只能新建 `0008`**（**不得**改 `0004`）；TS 侧 `PLATFORM_KIND_WHITELIST` 同步 ⇒ 见 §9.5 / §14.2 #1 |

### 12.3 人工回滚口径（**无 `down` 迁移**）

仓库内**不存在** `down` 脚本（与 `0001`–`0006` 一致）⇒ 回滚 = **人工步骤**：

```
① 先跑对账：本册 §11 判据（M1–M9）+ ledger.spec §11 判据 1–9，读数归档（run-tagged）
② 确认两张新表无业务数据（referral 0 行 / commission_policy 仅种子行），或已导出
③ DROP：两张表（连带触发器与索引）＋ 删 schema_migration 中 version = '0007' 的行
④ 绝对禁止触碰 ledger_entry（append-only，R77 对齐）；回滚后必须复跑一次对账取证
```

> ⚠️ **一旦有真实结算落账（即存在 `kind = 'commission'` 的行），就不得回滚**（只能前滚）：表被 drop 之后，「这些佣金是按哪一版政策和哪张邀请图发的」将**无法复算** ⇒ 账本虽在、口径已失。⇒ 本册要求回滚窗口 = **P2 上线前**；上线后的纠错只能靠新迁移 + `reversal` 冲正。 ✅ **v0.2（裁定 #13）：已裁定同意本册** —— **无 `down` 迁移**、四步人工回滚、**上线后一旦有 `commission` 行只准前滚**。

### 12.4 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **CR71** | **`0007` 必须幂等**：由 `migrate.ts` 的 `schema_migration(version, checksum)` 去重 ⇒ 重复应用必须输出 `action = "skipped"`（`reason = "already applied, checksum match"`）。**同时**：`0007` 内部的每条 DDL **仍必须自带存在性守卫**（`to_regclass` / `pg_constraint` / `IF NOT EXISTS`），对齐 `0006` 的写法 —— 理由：① 迁移文件可能被人在库外手工跑过；② 与 0001–0006 的风格一致。 | `0007_*.sql` 全文 | 「脚本说 skipped」与「DDL 自己也能重跑」是**两层**保障，缺一层都会在异常路径上炸 | 已冻结（既有迁移器契约） |
| **CR72** | **校验和登记**：`0007` 的 `sha256` 由 `migrate.ts` 在应用时写入 `schema_migration.checksum`；**交付报告必须逐字带上** `version / name / checksum(前 12 位) / ms / action`。⚠️ **本册不预填任何 checksum 值**（那是实现方的运行产物，编造即造假）。 | 交付报告字段 | 与 `0006`（`checksum 4aa19b148700`）同格式，便于比对 | 已冻结 |
| **CR73** | **不得修改 `0001`–`0006`**（§12.2）；本册需要的**新**对象一律落在 `0007`；需要改既有 `kind` 关闭集 / 白名单 / 函数体时，**只能新建 `0008+` 并先回来改本册**。 | `0007` 的边界 + 代码评审检查项 | 这是本册唯一的**硬边界**（`CR5` 的落点）；越过即断链 | 已冻结（checksum 纪律） |
| **CR74** | **人工回滚口径**（§12.3）：**无 `down` 迁移**；回滚四步；**上线后不得回滚**（有 `commission` 行即只能前滚）。✅ **已裁定（§5.20 #13）：同意本册**。 | 运维手册条目 | 「先回滚再说」是本场景最危险的直觉：drop 表 = 丢失「按哪一版政策发的」这一信息 | **已裁定（§5.20 #13）** |

---

## §13 错误码映射（**不新增错误码**）

### 13.1 关闭集不动（**硬纪律**）

`ledger.spec` §14.1 的 **33 个错误码（`LD001–LD033`）** 是**关闭集**；`bucket ↔ 状态类` 映射已冻结（`input⇒400` / `integrity⇒400|404|409` / `retryable|infra⇒503` / `defect⇒500`）。**本册不新增任何错误码**（CR5 / CR75）。P2 的一切新情形一律走 **`ledger.spec` §14.3 的借用方案**：借最贴近的既有码 + **前缀化 `details.reason`**。

### 13.2 P2 情形 → 借码映射表（**逐格**）

| # | P2 情形 | 借用错误码 | HTTP | `details.reason` | 依据 / 说明 |
|---|---|---|---|---|---|
| 1 | 无任何政策满足 `effective_from <= T` | `LEDGER_FEE_RATE_INVALID` | `500` | `COMMISSION_POLICY_MISSING` | §14.1 #32 的语义最贴近「计费配置缺失」（**v0.2（裁定 #3）：真源 = `commission_policy.fee_rate_bp`**）；**口径 A 已裁定（#9）⇒ 本格在正常路径不可达**，保留作兜底（一旦触发即「种子被删 / 越界改库」缺陷 ⇒ `500` + R108 告警） |
| 2 | `fee_rate_bp` 不在 `[100,500]`（**政策写入**时） | `LEDGER_AMOUNT_INVALID` | **`400`** | `FEE_RATE_OUT_OF_RANGE` | 🆕 **v0.2（裁定 #5 / #16）：守卫失败类一律 `400`**（`input` 桶；DB 侧 `CHECK` / `23514` ⇒ 既有分类器归 `input` ⇒ 同码同 status）；**不得**用 `500`；真源 = `commission_policy.fee_rate_bp`（`app_config` 费率键不再参与计费，CR27） |
| 3 | `levels` 不在 `[1,10]` / `len(weights_bp) ≠ levels` / 含负权重 | `LEDGER_AMOUNT_INVALID` | `400` | `POLICY_SHAPE_INVALID` | 入参**形态**非法 ⇒ 借 400 类（`ledger.spec` §14.3 v0.5 的三分类纪律） |
| 4 | `Σ weights_bp > 10000` | `LEDGER_AMOUNT_INVALID` | `400` | `WEIGHTS_SUM_EXCEEDS_10000` | 同上；DB 侧守卫抛 `23514` ⇒ 既有分类器归 `input` ⇒ **同码同 status**。⚠️ **不得**改成 `500`（那会破坏「`500` 只来自 `defect` bucket」这条**已机读验证**的判据，修正它需要改 `0005` = 越界）。🆕 **v0.2（裁定 #5 / #16）**：本条与「`Σ = 0`」「**前 `M` 层全零**」同属**政策写入时的 `400`**（CR83）；守卫必须在**写入时**就拒 |
| 5 | `effective_from` ≤ 既有最大值（回填出**死版本**） | `LEDGER_AMOUNT_INVALID` | `400` | `POLICY_EFFECTIVE_BACKDATED` | 见 CR25（违反「单调」纪律） |
| 6 | 绑定：`parent_uid == child_uid` | `LEDGER_AMOUNT_INVALID` | `400` | `REFERRAL_SELF_BIND` | 违反 `referral_no_self` 的语义（DB 侧 `23514` ⇒ 同 `input` 桶 ⇒ 同码） |
| 7 | 绑定：`child` 已有行且 `parent` 不同 | `LEDGER_IDEMPOTENCY_CONFLICT` | `409` | `REFERRAL_ALREADY_BOUND` | 语义对齐 R52②「同一业务事实、不同内容 ⇒ 409」 |
| 8 | 绑定：`parent` 落在 `child` 的上行链上（会造环） | `LEDGER_AMOUNT_INVALID` | `400` | `REFERRAL_CYCLE_REJECTED` | CR17 的守卫（**本册新增的检查**，因此新 `reason` 必须登记，见 CR76） |
| 9 | 分佣金额和不等于池子（组装器自检失败） | `LEDGER_ACCOUNT_GUARD_VIOLATION` | `500` | `COMMISSION_SPLIT_SUM_MISMATCH` | `500` 类 = **实现缺陷**（`defect` bucket）⇒ R108 **必告警**；借 #31 的语义（「账实不符」家族）最贴近。🆕 **v0.2**：**DB 侧后置断言（CR80）失败亦用本族码 + 同 status**（两侧一致：应用层组装断言与 DB 侧强制断言**同码同 status**；`reason` 为诊断信息、非契约） |
| 10 | `Σ weights_bp = 0` **或前 `M` 层权重全为零**（退化分母 `W = 0`） | `LEDGER_AMOUNT_INVALID` | **`400`** | `POLICY_WEIGHTS_ALL_ZERO` | 🆕 **v0.2（裁定 #16）：在政策写入时就拒**（要求 `Σ > 0` 且 `weights_bp[1] > 0`，见 CR83 / §7.3）⇒ **运行时 `W = 0` 不可达**、事件不产生；**不用 `500`、不新增码** |
| 11 | **受益人未开户** | —（**不是错误**） | `200` | — | DB 自动 0/0 开户（CR35）⇒ **禁止**读成 `LEDGER_ACCOUNT_NOT_FOUND` |
| 12 | 零额事件（`fee = 0`） | —（**不是错误**） | `200` | — | CR51：形状不同，但不是错误 |
| 13 | 无邀请人 | —（**不是错误**） | `200` | — | CR49 + **v0.2（裁定 #11）**：手续费**入 `−1`**（`−2` 净额 = `0`、`−1` 净额 = `+fee`）；**不是错误** |

### 13.3 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **CR75** | **P2 不新增任何错误码**（33 码关闭集不动，CR5）；一切新情形走 §13.2 的**借码 + 前缀化 `reason`**。 | 结算服务 / 后台建政策的服务层 | 与 `ledger.spec` §14.3 的「借用法已由 Zang 裁定采纳」一致；新增码会与 R104「唯一来源 + i18n key」打架 | 已冻结（承 §14.3 借用方案） |
| **CR76** | §13.2 新增的 `reason` 取值（`COMMISSION_POLICY_MISSING` / `FEE_RATE_OUT_OF_RANGE` / `POLICY_SHAPE_INVALID` / `WEIGHTS_SUM_EXCEEDS_10000` / `POLICY_EFFECTIVE_BACKDATED` / `REFERRAL_SELF_BIND` / `REFERRAL_ALREADY_BOUND` / `REFERRAL_CYCLE_REJECTED` / `COMMISSION_SPLIT_SUM_MISMATCH` / `POLICY_WEIGHTS_ALL_ZERO`）**必须进 R104 的唯一常量表**（`errors.ts` 的 `details.reason` 枚举）。⚠️ **`reason` 是诊断信息、不是契约** ⇒ **调用方只准按 `code` 分支，不得按 `reason` 分支**（对齐 `ledger.spec` v0.7 的增补纪律）。 | `errors.ts` 常量表；i18n key 不变（只按 `code` 建 key） | 新增 `reason` **不是**新增错误码 ⇒ 不违反关闭集；但它必须是**机器可读枚举**，**不得**写中文自由文本。🆕 **v0.2（裁定 #14）**：`COMMISSION_SPLIT_SUM_MISMATCH` **同时**用于 **DB 侧后置断言（CR80）** 的失败读数（同码同 status、两侧一致）；该 `reason` 已在本清单内，**不新增错误码** | 已冻结（承 R104 + v0.7 纪律） |
| **CR77** | **借用的两条铁律**（原样承接 `ledger.spec` §14.3 末段）：① 借用**不改变** §14.1 各码自身的触发条件 —— 本表只在「§14.1 无覆盖」的情形下使用；② `details` **只放非敏感上下文**（`cid` / `symbol` / `field` / `reason` / 期望值），**禁止**放 SQL、约束名、堆栈、表名、连接串（R107）。 | 响应包装层中间件 | 「把约束名 `commission_policy_weights_guard` 塞进 `details`」很诱人（好排查）但**明令禁止**（重名即泄露 schema）；诊断上下文只入日志 | 已冻结（承 R107） |

---

## §14 待 Zang 裁定清单

> **本节的纪律（v0.2 更新）**：以下 16 项本册原先**只给建议、不静默落位**；**现 16 项已由 Zang 逐条裁定**（**权威口径 = `docs/seafood.master-plan.md` §5.20**）—— 逐条的**裁定值 + 落点**见 **§14.0**。**下表的问题描述一字不改地保留作留痕**（**不再读作「待裁」**）。另：**§14.2** 登记**未被这 16 条覆盖**、由裁定**新派生**出来的待确认项（本册发现，逐条列出、不隐藏）。

### 14.0 v0.2 裁定落位表（16 项逐条 · 权威来源 = `master-plan` §5.20）

> **性质**：本表把 §5.20 的裁定**逐条落位到本册**（**规范条文**在下表「落点」指向的各节正文里，**不搬 §5.20 的表格**）。**16 项全部已裁定** ⇒ 下面 §14 的原问题清单只作**留痕**。

| # | 裁定（v0.2 落位值） | 本册落点 |
|---|---|---|
| **1** | **本册反例成立、「防环靠构造」不成立** ⇒ **`depth` 不再是防环机制**（仅作**遍历上界 / 审计**）；防环 = **祖先检查**（断言**新父 `P` 不是 `child` `C` 的后代**，等价式 `C ∉ ancestors(P)`）**+ 绑定串行化**；**`0007` 必须同时给「自指禁令 + 祖先检查 + 串行化」，且必须有一条「2-环反例」判负用例**（先 `A→B` 再 `B→A` **必须被拒**） | §3.2（`referral_cycle_guard` 机读块）/ §3.3 / §3.1 I4 / §11.8 M9 / **CR78 / CR79** / CR16 / CR17 / CR18 / CR22 |
| **2** | **D13 胜**：差额（含链上不足 `levels` 层）**按已有层级权重比例再分配** ⇒ `Σ commission == job_fee` 恒成立；**`−2` 事件净额 0、不留存** | §6.1 / §6.2 / §7.1 / §7.2 / §8.1 / **CR47 / CR50** / §11.3 M3-A；`ledger.spec` v0.8 已增补 R45 |
| **3** | **`commission_policy.fee_rate_bp` 是费率唯一真源**（`app_config` 费率键不再参与计费、键保留） | §4.4 / CR27 / CR38 / §13.2 #1–#2；`ledger.spec` v0.8 已更正 §14.1 #32 |
| **4** | **`0007` 不建 `commission_payout` 表**；**审计真源 = `ledger_entry`**；**`ref_id` = 同一 `job_id`** | §5.2 / §5.6 / **CR14 / CR36** |
| **5** | **权重守卫失败类 = `400`**（`input` 桶），**不得** `500`（改 `500` 会破坏「`500` 只来自 `defect` 桶」的机读判据） | **CR83** / CR9 / §2.3 / §13.2 #2 / #4 |
| **6** | **同意本册**：R21 的适用范围是**账本表**；**业务表可以 FK 到 `users(uid)`** | **CR6 / CR12**（`referral` 两列 FK 保留）；`ledger.spec` v0.8 已给 R21 加范围限定 |
| **7** | **`depth` 不设上限**（只 `CHECK (depth >= 1)`）；封顶的是**分配层数** `levels ≤ 10` | **CR13** / §2.1 `referral_depth_rng` |
| **8** | **P2 不提供改绑**（终身绑定）⇒ **错绑 = 永久**；登记为**已知运营风险**，与 D3 同批排 **P6**；**上线前必须如实告知用户** | CR15 / §14.2 #5（告知义务） |
| **9** | **口径 A**：`0007` **种默认政策**（⇒「无政策行」不可达）；`created_by` **放宽为允许平台 id（`0 / −1 / −2 / −3`）并去掉 FK** | §2.1 DDL / §4.1 / §4.3 / **CR7 / CR23 / CR82** |
| **10** | **禁止回填 `effective_from`**（严格递增；回填 = 永不生效的死版本） | CR25 / §4.2 |
| **11** | 无邀请人 ⇒ 手续费**仍收**，但**入 `−1`（平台收入）**、**不入 `−2`**；**`−2` 只作佣金中转、同一事件内进出相抵、净额 0、不留存** | §8.1 / §8.2 / §11.3 **M3-C** / §11.5 ① / **CR49 / CR52 / CR84** |
| **12** | **允许**雇主是受益人（只按邀请关系分配、**不对身份特判**）；**唯一硬约束：受益人不得是打工者本人** | §8.4 / CR53 / §14.0 #1 的自指禁令 |
| **13** | **同意本册**：**无 `down` 迁移**、四步人工回滚、**上线后一旦有 `commission` 行只准前滚** | §12.3 / CR74 |
| **14** | **计算不下沉**（金额算在应用层）；**但「Σ佣金 == 手续费」必须由 DB 侧强制**（`0007` 的**触发器**做**后置断言**）；**禁止改 `ledger_post_event` 函数体** | **CR80 / CR81** / §6.5 / §12.2 / §13.2 #9 / §15 #11 |
| **15** | **读法 ①**：最大余数法 + **同余数深层优先**（`(r_L DESC, L DESC)`）；**否决读法 ②** | CR41 / CR42 / §6.3 / §6.4 例 5 / §11.5 ④ |
| **16** | 退化分母 `W = 0` ⇒ **在政策写入时就拒**（要求 `Σweights_bp > 0` 且**前 `M` 层不得全零**）⇒ **`400`**；**不用 `500`、不新增码** | §7.3 / **CR83** / §2.1 守卫 / §13.2 #10 / §14.2 #2 |

> ⛔ **以下 16 行是 v0.1 的**原文留痕**（一字未改）**：每行的**裁定值见 §14.0 的同号行**；本表「阻塞」列的「**必须先裁定**」等表述**已失效**，**不得**再读作待办。**未被这 16 条覆盖的派生项**单独列在 **§14.2**。

| # | 事项 | 本册建议 | 备选 | 冲突源 / 影响面 | 阻塞 |
|---|---|---|---|---|---|
| **1** | ⚠️ **「防环靠构造」不成立**（`depth = 父 depth + 1` 不能阻止成环）—— §3.2 的 2-环反例 | **接受最小修复**：绑定期断言 `C ∉ ancestors(P)`（CR17）**＋** 绑定串行化（CR18）；并在 §11 用 M9 的对照实验**机读证明**修复有效 | ① 接受风险（**不建议**：有环 ⇒ 链遍历无限递归 ⇒ 结算直接崩）；② 引入闭包表 `referral_closure`（**推翻** master-plan §5.19 的「不用闭包」选择）；③ 链深硬上限 + 拒绝超限绑定 | `master-plan` §5.19 的数学断言（**本册已否证**） | **阻塞 P2 实现**（CR17/CR18 是新增检查，不裁定则实现方无口径） |
| **2** | ⚠️ **R45「差额留在佣金池」⟷ D13「按已有层级权重比例再分配」**（互斥） | **按 D13**（本册 §7.2）；请对 `ledger.spec` **R45 出 v0.8 就地增补**（本册不改上位册） | 按 R45（留池）—— 但那会让判据 M3-A（`−2` 净额 = 0）**永久为红** ⇒ 与硬项 ③ 直接冲突 | `ledger.spec` §5.2 R45 vs master-plan D13 | 阻塞 P2 验收（判据 M1/M3 的期望值取决于此） |
| **3** | **费率真源**：`app_config`（`ledger.spec` §14.1 #32 的措辞）⟷ `commission_policy.fee_rate_bp`（本册） | **政策是真源**；`app_config` 费率键在 P2 起不参与计费；错误码 #32 **复用**、`details.reason` 区分；请对 `ledger.spec` #32 的措辞做就地增补 | 两处都读（**不建议**：会造出「哪一版配哪个费率」的歧义） | `ledger.spec` §14.1 #32 vs 本册 §4.4 | 阻塞 P2 实现（读哪个源） |
| **4** | **`commission_payout` 表 / `ref_id` 取值**：`ledger.spec` §7.2 #8 要求「写 `commission_payout` 行」，但单语句形态下函数不能写业务表 | **`0007` 不建该表**；审计真源 = `ledger_entry`；`commission` 分录的 **`ref_id` 建议 = 与 `job` 分录同一 `job_id`**（实现上逐条只给 `ref_type='commission_payout'`、`ref_id` 回落 payload 级） | ① 新建 `0008` 把该表纳入并在函数内写（**违反**「一次原子调用」⇒ 需重开 D10 的讨论）；② P2 结束后由 P6 报表按需建表，届时把 `ref_id` 迁到该表主键 | `ledger.spec` §7.2 #8 vs D10/§7.1 单语句形态 | 阻塞 P2 实现（分录的 `ref_id` 写什么） |
| **5** | **权重守卫的失败类**（`Σ > 10000` 与 `W = 0`） | **`400`**（`Σ>10000` 借 `LEDGER_AMOUNT_INVALID`）—— 与既有分类器对「其余 `23514` ⇒ `input`」的分桶**一致**，**不需改 `0005`**；`W = 0` 另按 §7.3 建议 `500` | 全部改 `500` + R108 告警 —— **代价**：需要新增 `23514` 分桶 = **改 `0005`** = 越界（CR73），且会打破「`500` 只来自 `defect` bucket」的可机读判据 | `ledger.spec` §14.3 的 `23514` 分桶细则 | 阻塞 `0007` 的守卫写法 |
| **6** | **新增 FK 到 `users(uid)`** ⟷ `ledger.spec` R21「不对 `account.uid` / `ledger_entry.uid` 建 FK」 | **建 FK**（CR12）：R21 的适用范围是**账本表**（允许负 uid ⇒ 不能 FK 到 `users`）；本册两张表的 uid 恒 `> 0` 且语义就是「一个用户」 | 不建 FK、只靠应用层校验 —— 代价：脏 uid 静默沉淀（佣金永远发不出去） | `ledger.spec` §2.2 R21（**本册是范围外的主动扩展，故须确认**） | 阻塞 `0007` 的 DDL |
| **7** | **`depth` 是否设上限** | **不设上限**（只 `CHECK (depth >= 1)`）；封顶的是分配层数 `levels ≤ 10`（CR13） | 设链深硬上限（如 `depth <= 64`）—— 收益：给 CR17 的环检查一个确定上界；代价：深度超限的用户**不能再邀请人**（产品语义变化） | 本册自定（`master-plan` §5.19 未提） | 阻塞 `0007` 的 DDL + CR17 的遍历上界 |
| **8** | **错绑的纠错路径**（终身不可变 ⇒ 无改无删，CR15） | **本册不提供**；若必须有，则须**新语义 + 新迁移 + 全量对账**（且冲正**不**改图 ⇒ 只能靠人工补发/追回） | ① 允许「首次绑定后 N 天内可改一次」（**推翻**「终身不可变」）；② 提供管理员改绑工具（需审计 + 对账） | 「终身不可变」（本册冻结）vs 运营现实 | 不阻塞 P2 实现，但**上线前必须知道**「错绑怎么办」 |
| **9** | **无政策行时的行为**（CR23 / §4.1 的口径 A/B） | **口径 A**：`0007` 种入一版默认政策（`effective_from = '1970-01-01Z'`）⇒ 「无政策」**不可达**；**连带**：`created_by` 必须允许平台主体 `0`（⇒ CR7/§2.1 的 `>0` + FK 要同步放宽） | **口径 B**：不种；「无政策」⇒ 拒绝结算（`500` + `COMMISSION_POLICY_MISSING`） | 本册内部：口径 A 与 CR7 的 `created_by` 约束**强耦合** | **阻塞 `0007`**（种子行 + `created_by` 的约束形状） |
| **10** | **能否回填 `effective_from`**（CR25 禁止） | **禁止**（只能严格递增；回填会造出**永不生效的死版本**） | 允许回填（需附「此版本为何永不生效 / 或它如何改变未来读数」的书面说明 + 对账证据） | D12「不追溯」的边界 | 阻塞后台建政策的校验规则 |
| **11** | **无邀请人时手续费归属**（CR52 / §8.2） | **仍收、留 `−2`**（给判据 M3-B） | **不收**（`fee = 0`，雇主只付 `net = gross`）—— 理由：链不存在时这份钱没有应得人；且 `R103` 使 `−2` **只进不出** ⇒ 留池的钱**取不出来** | `master-plan` §5.19 的「倾向」vs 经济自洽性 | 阻塞判据 M3-B/M5① 的期望值 |
| **12** | **受益人 = 雇主 是否允许**（§8.4） | **允许**（只按邀请关系分配，不额外禁止） | 禁止（需要额外的链上比对 ⇒ 更慢，且引入「发给谁」的例外规则） | 本册自定 | 不阻塞 |
| **13** | **人工回滚口径**（CR74 / §12.3） | 无 `down` 迁移；四步人工回滚；**上线后不得回滚**（有 `commission` 行即只能前滚） | 写一个 `0007` 的 `down` 脚本（与 0001–0006 的风格不一致，且**回滚本身仍会丢口径**） | 本册自定 | 阻塞运维手册 |
| **14** | **「读政策 + 算 `x_L`」是否下沉进 DB**（消除 TOCTOU，CR26 ③） | **不下沉**（保持「应用层算金额 + 单语句落账」）—— 代价：保留 CR26 的 TOCTOU 面与「重放必须复用 payload」的纪律 | **下沉**（函数内读政策 + 读图 + 算 `x_L`）—— 收益：彻底消除 TOCTOU 与「重放指纹漂移」；代价：**需要新迁移改 `ledger_post_event`**（`0008+`），且 TS 侧退化为只传 `job_id` + `gross` ⇒ **本册 §5 的整节载荷契约会被推翻重写** | D10 的边界 + 本册 §5 | **重大**：若裁定下沉，本册 §5/§6 需出 v0.2 重写 |
| **15** | **「残余给最深一层」的读法**（§6.3 读法 ① vs ②） | **读法 ①**：最大余数法 + 同余数时深层优先（破平局），§6.4 例 5 是判据 | **读法 ②**：不用最大余数法，所有残余一次给 `L = M`（代价：`P` 很小时最深层独吞整个池子） | `master-plan` §5.19 的两句话并存 | 阻塞判据 M5④ 的期望值 |
| **16** | **退化分母 `W = 0`**（前 `M` 层权重全零）的处置（§7.3） | **`500` + R108 告警**（借 `LEDGER_FEE_RATE_INVALID` + `reason = POLICY_WEIGHTS_ALL_ZERO`），事件**不落账** | ① 静默不发、池子留 `−2`（**不建议**：钱沉在只进不出的账户里）；② `400`（视为参数非法） | 本册自定；与 §14 #5 的失败类口径**必须一起裁** | 阻塞 §7.3 的实现与 §13.2 #10 的 status |

### 14.1 裁定的**批量依赖**（避免逐条来回）（**v0.2：本节保留作留痕** —— 16 项**已全部裁定**（§14.0）；下列「阻塞关系」仍可作为**实现排期参考**）

- **#1 / #2 / #3 / #4 / #9 / #14** 是**实现前**必须裁的六条（否则 `0007` 与 TS 层的形状定不下来）。
- **#5 / #16** 必须**一起**裁（同一个「失败类」问题）。
- **#11 / #15** 只影响**判据期望值**（不影响 DDL），但**不裁就无法写质检的断言**。
- **#6 / #7 / #9 / #10** 只影响 `0007` 的 DDL 细节。
- **#8 / #12 / #13** 不阻塞 P2 实现。

### 14.2 未被 16 条裁定覆盖的**派生待确认项**（v0.2 · 本册新发现，逐条列出）

> **性质**：以下 5 项**不是** §5.20 的 16 条之一，而是**由裁定本身派生出来**、且本册**无权自行选定**的项。**前 3 项需要 Zang 一句话确认**；后 2 项是**必须登记的义务 / 未实测项**。**本册不隐藏、也不静默处置。**

| # | 派生项 | 本册发现（自核） | 需要什么 |
|---|---|---|---|
| **1** | **`−1` 的白名单扩展是裁定 #11 的机械前提** | 现行 `ledger_assert_platform_mutation` 的 `'-1'` 分支只放行 `credit ∈ {trade_fee, listing_fee, currency_create_fee}`、`debit` 恒 `false`（**v0.2 `read_file` 自核 `0004`**）⇒ **`job_fee` 入 `−1` 会被拒**；而 #11 要求无邀请人时手续费入 `−1` | **(a) 接受「P2 交付物 = `0007` + `0008`」**（`0008` 扩展白名单，DB + TS 同改）；或 **(b) 明确指出推翻 #11**（那本册回到「留池」，判据回到 M3-B）—— **二选一必须由 Zang 定**，本册不自行选定 |
| **2** | **#16 的「前 `M` 层不得全零」的可静态判定式比字面更严** | `0007` 在**政策写入时不知道链深 `M`**，而 `M = min(levels, chain_depth) ∈ [1, levels]` ⇒ 「对**每个可达 `M`**，前 `M` 层不全零」**等价于 `weights_bp[1] > 0`**（`M = 1` 时前缀只有第 1 层）⇒ 本册按等价式落位（§2.1 守卫 / CR83） | 确认该等价式即可；**代价**：`w_1 = 0` 但 `w_2 > 0` 这类政策会被拒 ⇒ 若运营确需如此，**须单独发单放宽 #16**（本册不自行放宽）。另：库里若已有 `weights_bp[1] = 0` 的历史行 ⇒ 属越界改库 ⇒ 按 `500` 缺陷处置（§7.3） |
| **3** | **DB 侧后置断言的失败必须落 `500`，而不得落 `400`** | 现有分类器把「其余 `23514`」归 `input` ⇒ `400`（**v0.2 自核 `0005` 的 `ledger_error_for_sqlstate`**）；而断言失败语义上属**装配缺陷** ⇒ 必须 `defect` / `500`（与 §13.2 #9 同族）⇒ **断言器不得裸抛 `23514`**；具体 SQLSTATE ⇒ 码名的落地（例如裸 `RAISE` 走 `ELSE` ⇒ `LEDGER_TRANSACTION_REQUIRED` + `reason = unclassified_db_error`）**须真库探针确认并回填** | 若探针显示只能落 `400` 桶 ⇒ 需 Zang 裁定「**接受 `400`**（并说明为何不动 `0005`）」或「改抛法」。**未回填前 CR80 的失败面不得读作已验**（§15 #11） |
| **4** | **新增断言对 P1 既有回归 / 历史事件形状的影响未测** | 断言对四种 P2 事件形状都纸面成立（正常 / 短链 / 无邀请人 / 零额），**但**库内是否存在「有 `job_fee` 入 `−2` 而无对应 `commission`」的**历史或回归**行**未核对**（P1 的 smoke / 逃逸扫描是否写过 `job_fee`，**未查**） | 上线前用既有回归套件对拍：新断言**不得**让旧用例变红；若存在该形状 ⇒ 断言范围收窄（如仅对含 `commission` 行的事件启用）并**回写本册**（§15 #12） |
| **5** | **#8 的告知义务（错绑永久）** | 终身绑定 + 不提供改绑 ⇒ **错绑无法纠正**，仅能靠人工补发 / 追回（`reversal` 不改图） | **上线前必须在用户可见处**（邀请绑定页文案）如实告知；**文案属 P7**，本册只登记该义务与已知风险（P6 同批） |

---

## §15 未能核实 / 未实测诚实清单

> 本节是本册的**诚实边界**：以下 **14** 项**未被实测或未能核实**，**不得**在 P2 验收时当作已通过。本册的写作环境**未连库、未启停任何服务、未写迁移文件**（只读自核了 `0001`–`0006`、`src/ledger.ts`、`scripts/migrate.ts` 的文本）。〔**v0.2**：本版**新增 4 项**（#11–#14，对应裁定 #11 / #14 带来的新面），且**未改变**「不连库」的写作边界 ⇒ 原 10 项的未实测状态**一律不变**。〕

| # | 未实测 / 未核实项 | 具体到什么程度 | 后果与建议 |
|---|---|---|---|
| **1** | **本册全部 DDL 未在真实 Neon 上执行过** | 下列写法**仅经纸面审阅**：① `smallint[]` + `array_length(weights_bp,1) = levels` 的 `CHECK`；② `0 <= ALL (weights_bp)`；③ `BEFORE INSERT OR UPDATE` 触发器里 `RAISE … USING ERRCODE = '23514'`（能否被既有分类器当成 `input`）；④ 三处 `FOREIGN KEY … REFERENCES users(uid)`（`users.uid` 是 identity PK 吗？本册**依据 `0002` 的自述与 §13 的「自增从 1 起」推断，未在库上验证**）；⑤ `GENERATED BY DEFAULT AS IDENTITY` + `CREATE TABLE` 同语句的合法性〔**v0.2 追加未实测**：⑥ `created_by` 的新 `CHECK (created_by >= 0 OR created_by IN (-1,-2,-3))`；⑦ 守卫新增的两条 `RAISE`（`Σ = 0` / `weights_bp[1] = 0`）与 `weights_bp[1]` 下标访问在 `smallint[]` 上的行为；⑧ 种子行 `INSERT` 的幂等写法〕 | 建库后第一件事是把 `0007`（+ `0008`）在空库跑一遍，并用 `\d+` 逐条核对约束**真的落地了** |
| **2** | **两张新表的触发器拦截面未实测** | `BEFORE UPDATE OR DELETE` 对**应用层**的拦截是**推断**（同 `ledger_entry` 的实测结论外推）；本册**没有**在 `referral` / `commission_policy` 上实测过任何一次 UPDATE/DELETE 拒绝 | 与 `ledger_entry` 的实测**同构**但不等于**已验**；`§2.2` 的诚实边界（`TRUNCATE` / 管理员旁路）也只作类比 |
| **3** | **`DISABLE TRIGGER USER` 旁路对新表的影响** | `backend-ts/scripts/purge-test-data.ts` 会 `DISABLE TRIGGER USER`（对 `ledger_entry` 已实测）；**它当前是否覆盖两张新表、其清理语句长什么样，本册未核实**（未 `read_file` 该脚本全文） | 若清理脚本会 `TRUNCATE` / `DELETE` 新表 ⇒ **每轮质检都会静默清掉邀请图与政策** ⇒ 判据读数不可比。P2 实施前**必须**先核实并出引用清单（`master-plan` §5.18 的连带要求） |
| **4** | **§6.4 的五个数值示例全部是纸面推演** | `q` / `r` / `D` / `x` 的手算结果**未经任何实现或探针验证**（例 2 的 `{4615,3077,2308}` 因此是**判据的期望值**，不是读数） | 实现完成后必须**先**用这五例做单元级对照；判据 M5② 的**逐值**断言正是为此而设 |
| **5** | **`P × w_L` 的溢出边界** | 纸面：本册取值域内 `P ≤ 5×10¹³` ⇒ 乘积 `≤ 5×10¹⁷ < 9.22×10¹⁸` **不溢出**；**但**该结论依赖 `ledger.spec` R71 的单笔上限恒为 `1e15`（**它是 `app_config` 可配值**） | ⇒ 实现**必须**用 `BigInt` / `numeric` 做乘除（CR44），**不得**因为「算过了不溢出」而用原生 `number` |
| **6** | **§3.3 的绑定协议在并发下未实测** | 包括：① 「`users` 两行 `FOR UPDATE`」能否真的把 `A→B` 与 `B→A` 串行化；② 并发下环检查的窗口是否真的被关死；③ 该锁是否与 R79 全序兼容（会不会引入与账本事务的死锁） | ⇒ 「并发绑定不成环」是**设计意图**，不是**实测结论**；质检必须写并发绑定用例 + 对照实验（对齐 R93）。〔**v0.2（裁定 #1）**：串行化已从「本册建议」升级为**裁定要求**（`0007` 必须提供）⇒ **该读数由「最好有」变为「必须有」**，见 CR78 / CR79 / §15 #14〕 |
| **7** | **政策读取的 TOCTOU 面未实测** | 并发「读政策」与「插入新政策」在同一时刻的行为**未取读数**；CR26 的「重放必须复用 payload」目前只是**纪律**，没有机读证据 | 建议 P2 质检加一条：结算途中插入新政策 ⇒ 观察结算用的是哪一版（期望：**事件时刻那一版**，且事件本身成功） |
| **8** | **24 条分录 / 13 账户规模的实测读数不存在** | 既有实测规模（`ledger.spec` §16 #12 的 604 格矩阵）覆盖的是**更小的事件**；本册的「`≤24 ≤32` / `≤13 ≤16`」是**纸面核算**（R64 的上限自核） | 不得把「P2 天然在上限内」读作「24 条事件已经跑过」 |
| **9** | **两条链上断言未在真库验证** | ① `depth` 的结构不变式（M9-b）；② §3.4 的 `count(*) <= 10`。两者都**只在纸面上推过**（含 I5 的「父无行 ⇒ 1」约定） | 建库后应先用**小规模构造**（3–4 层）验证 M9-b，再上 10 层 |
| **10** | **`ref_id` 不是 FK ⇒ DB 拦不住「指向不存在的 `job`」** | 这是 P1 既有事实（`ledger_ref_pair` 只校验成对，不校验存在）；P2 的判据因此可以**不依赖 `job` 表**（CR70 ⑤）—— **但同一事实也意味着**：在 P3 之前，「用自造 `job_id` 落一笔结算」在 DB 层**是合法的** | ⇒ P2 阶段**必须**用「测试 uid ≥ 900000 + 自造 `job_id` + 跑完清理」的纪律（master-plan §5.7 硬4），**不得**在共享库上留下测试结算行；P3 落地后由应用层承担 `ref_id` 的存在性校验（`LEDGER_REF_NOT_FOUND` / `404`，§14.1 #23） |
| **11** | **`0007` 的 DB 侧后置断言触发器未在真 PG 上跑过**（v0.2 · 裁定 #14 新增面） | 断言形状（`CONSTRAINT TRIGGER … AFTER INSERT … DEFERRABLE INITIALLY DEFERRED`）、以及**失败时的 SQLSTATE ⇒ 码名落桶**（要求 `defect` / `500`，**不得**落 `input` / `400`）都只是**纸面推导**；分类器 `ledger_error_for_sqlstate` 的 `ELSE ⇒ defect / LEDGER_TRANSACTION_REQUIRED / reason = unclassified_db_error` 仅经**文本自核** | 建库后第一件事：对一条**故意装配错**的事件（`Σ commission ≠ job_fee`）跑一次，记录 `code` / `status` / `bucket` / `reason` 并**回填本册**（§14.2 #3）；**未回填前 CR80 的失败面不得读作已验** |
| **12** | **新增断言与 P1 既有回归 / 历史事件形状的相容性未测**（v0.2） | 四种 P2 形状下断言恒成立（纸面）；但库内是否有「有 `job_fee` 入 `−2` 而无 `commission`」的**历史 / 回归**行**未核对**（`ledger-smoke*` / 逃逸扫描是否写过 `job_fee` **未查**） | 上线前用既有回归套件对拍（新断言**不得**让旧用例变红）；若存在 ⇒ 收窄断言范围并**回写本册**（§14.2 #4） |
| **13** | **`−1` 白名单扩展（`0008`）与「手续费入 `−1`」路径未实现、未实测**（v0.2 · 裁定 #11） | `0008` **未写**；DB / TS 两侧白名单**未改**；**TS 侧 `PLATFORM_KIND_WHITELIST['-1']` 的内容未核对** | ⇒ 判据 **M3-C 不得读作已通过**；`0008` 落地前 **M3-C 不可执行**（§9.5 / §14.2 #1） |
| **14** | **裁定 #1 的「2-环反例」判负用例未跑**（v0.2） | 该用例（先 `A→B` 再 `B→A` ⇒ **必须被拒**）**未在真库执行**；§3.3 的串行化点（`users` 两行 `FOR UPDATE`）**未验证**（同 #6） | 建库后必须补跑并落 **run-tagged** 读数；**没有该读数的 CR79 不得读作已通过**（§11.8 M9 的对照同批） |

### 15.1 本册**已**自核的既有事实（与非自核项区分）

| 自核对象 | 结论 |
|---|---|
| `0001` 的 `ledger_ref_type_enum` | 白名单含 `'job'` 与 `'commission_payout'` |
| `0004` 的 `ledger_assert_platform_mutation` | `'-2'` 的 `credit` 只允许 `job_fee`、`debit` 只允许 `commission` |
| `0005` 的 `entries` 分支 | 条数上限 **32**、账户上限 **16**、逐条字段清单、`BOTH_ZERO` 前置判定、派生键 `K#(idx+1)`、锁按 `(uid, cid)` 升序、自动开户 `ON CONFLICT DO NOTHING`、逐条平台白名单按方向判定 |
| `src/ledger.ts` | `PLATFORM_KIND_WHITELIST['-2'] = { credit: ['job_fee'], debit: ['commission'] }` |
| `scripts/migrate.ts` | 版本表 `schema_migration`、`sha256` 校验和、`skipped` / `ABORT(exit 3)` 语义 |
| `ledger_entry` 的 kind 关闭集 | 20 个（含 `job_payout` / `job_fee` / `commission`） |
| `ledger.spec` v0.7 | 33 码关闭集、`bucket↔状态类` 冻结、§14.3 借用法、重放按 `event_root_key` 精确归属 |

---

## §16 规则总索引 CR1–CR85

本册共 **85 条规则**，编号连续覆盖 **CR1–CR85**，无缺号（编号空间刻意与 `ledger.spec.md` 的 `R1–R108` 分离，见 §0.3）。**v0.2 新增 CR78–CR85（8 条）**，按「**新增一律向后追加**」纪律追加在本节末的 v0.2 块；**CR1–CR77 的编号与顺序一字未动**（就地增补，无重排）。

> ⚠️ **状态分布**：**已冻结**（承 D6/D12/D13/D14/D15、R* 系列或硬项清单）= 部分；**待拍板** = 本册建议值（一句话可改）；**待裁定** = 需 Zang 拍板者**全部**汇总在 **§14（16 项）**，此处只标「待裁定（§14 #n）」。

> ✅ **v0.2 状态翻转总表（裁定落位后）**：§14 的 16 项**已全部裁定**（裁定值 + 落点见 **§14.0**）⇒ 下列各条的「**待拍板 / 待裁定**」**已全部失效**，**以 §14.0 与各条正文的 v0.2 追加注为准**（**索引行的旧状态保留作留痕、不逐行改写**，避免同一处出现两套口径）：
> **CR7 · CR9 · CR12 · CR13 · CR14 · CR15 · CR17 · CR18 · CR22 · CR23 · CR25 · CR26 · CR36 · CR41 · CR42 · CR52 · CR53 · CR64 · CR69 · CR74**（共 20 条）。
> **新增规则**：**CR78 · CR79**（§3 防环机制 / 2-环判负用例）、**CR80 · CR81**（§6.5 DB 侧强制断言 / 不下沉）、**CR82**（§4 口径 A）、**CR83**（§2 政策写入守卫）、**CR84**（§8 无邀请人手续费入 `−1`）、**CR85**（§9 白名单扩展与迁移边界）。

**§1 术语与记账符号冻结**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| CR1 | 账务术语**一律沿用 `ledger.spec.md` §1 的「减方 / 增方」**，**禁止**使用「借 / 贷」；本册**不新造同义术语**（「池子」只是 `−2` 在本事件中的进项，不是新实体）。 | 已冻结（承 R1） |
| CR2 | **层级与级数一律从 1 起**（`L = 1` = 直接邀请人）。`levels`（政策）与 `depth`（图）都是 **≥ 1 的整数**；**禁止**任何地方出现 level 0 或「第 0 层」。 | 待拍板（命名，一句话可改） |
| CR3 | **P2 结算恒为单币种**：事件内全部分录的 `cid` **必须相同**（= 该招工的计价币种）。**禁止**出现「酬金 A 币、手续费 B 币、佣金 C 币」的混币事件。底层 `op='entries'` 结构上允许混币，但**… | 待拍板（一句话可改） |
| CR4 | 一切时间戳 `timestamptz`、由 DB `now()` 生成（对齐 R5）：`referral.bound_at`、`commission_policy.time_created`、`ledger_entry.time_cr… | 已冻结（承 R5） |
| CR5 | 本册**不新增错误码**、**不新增 `kind`**、**不修改 `migrations/0001`–`0006`**、**不修改 `ledger_entry` 表结构**。P2 的一切落库变化只允许出现在 `0007`（及其后的新… | 已冻结（关闭集 + checksum 纪律） |

**§2 迁移 `0007` 的数据契约（DDL 口径）**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| CR6 | **`referral`** 四列：`child_uid`（**PK**）/ `parent_uid` / `depth` / `bound_at`；`child_uid` / `parent_uid` 均 FK 到 `users(u… | 已冻结（master-plan §5.19 领域模型） |
| CR7 | **`commission_policy`** 七列：`policy_id` / `fee_rate_bp`（`100–500`）/ `levels`（`1–10`）/ `weights_bp`（`smallint[]`，长度 = `… | 已冻结（master-plan §5.19）+ 细节待拍板 |
| CR8 | 两张表都是 **INSERT-only**：`BEFORE UPDATE OR DELETE` 触发器无条件 `RAISE`（对齐 R73 的手段选择：**触发器为主、权限为辅**）。**诚实边界同 §2.2**（`TRUNCATE`… | 已冻结（D12 + 终身不可变） |
| CR9 | **`Σweights_bp <= 10000` 用 `BEFORE INSERT OR UPDATE` 触发器守卫**（`CHECK` 表达不了 `Σ`，见 §2.3），失败抛 `23514` ⇒ 映射 `400 LEDGER_AM… | 待拍板（失败类见 §14 #5） |
| CR10 | **命名 / 索引 / 触发器命名规范化**（见 §2.4）：表与列 `snake_case` 无引号；约束 `<table>_<subject>_<kind>`；索引 `idx_<table>_<cols>`；触发器 `trg_<t… | 待拍板（一句话可改） |
| CR11 | **必建索引只有 2 个二级索引**：`idx_referral_parent (parent_uid)`（查「我邀请了谁」）与 `commission_policy_effective_uniq UNIQUE (effective_… | 待拍板（清单可增，不可减） |
| CR12 | **两张新表的 uid 列一律建 FK 到 `users(uid)`**（`referral.child_uid` / `referral.parent_uid` / `commission_policy.created_by`）。⚠… | 待裁定（见 §14 #6） |
| CR13 | **`depth` 不设上限**（只 `CHECK (depth >= 1)`）；**封顶的是「分配层数」**（`levels <= 10`，CR7）。理由：把 `depth` 封顶为 10 会**禁止深度 10 的用户再邀请人**，… | 待裁定（见 §14 #7） |
| CR14 | **`0007` 只建这两张表**。**`commission_payout` 表不在 `0007`**：`ledger.spec` §7.2 #8 要求「写最多 10 组 `commission` 分录 **+ 对应 `commis… | 待裁定（见 §14 #4） |

**§3 邀请图 `referral`：终身绑定、防环靠构造**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| CR15 | 邀请绑定**终身且不可变**：不提供任何 UPDATE / DELETE 路径（触发器 + 应用层双闸）。⇒ **纠错路径不存在**：错绑无法改、无法删。本册**不给静默默认**：若必须有纠错，那是**新语义 + 新迁移 + 全量对账… | 已冻结（终身不可变）+ 纠错缺口**待裁定** |
| CR16 | `depth` **写入口径**：`NEW.depth := 1 + COALESCE((SELECT depth FROM referral WHERE child_uid = NEW.parent_uid), 0)`（父无行 ⇒ … | 已冻结（防环构造的前提）+ 落点待拍板 |
| CR17 | ⚠️ **仲裁**：**绑定前必须断言 `C ∉ ancestors(P)`**（§3.2 反例 ⇒ D-冻结的「仅靠 `depth` 构造」**不足**）。失败 ⇒ `400 LEDGER_AMOUNT_INVALID` + `re… | **待裁定**（见 §14 #1） |
| CR18 | 绑定的**原子性与串行化**：`幂等检查 → 环检查 → INSERT` 必须在**同一事务**内，且必须先取得**串行化点**（本册建议 §3.3 ② 的 `users` 两行 `FOR UPDATE`，**按 uid 升序**对齐… | **待裁定**（见 §14 #1 连带；未实测，§15 #6） |
| CR19 | 绑定的**幂等**：① 同 `(C, P)` 重复提交 ⇒ PK 冲突 ⇒ **读回既有行** ⇒ `200 {idempotent_replay: true}`（**不报错**）；② `C` 已有行但 `parent_uid` **… | 待拍板（借码见 §13） |
| CR20 | **祖先链读取口径**（§3.4）：最多 `levels` 层、`L` 升序（`L=1` 最近）、`level < levels` 的硬闸必须在 CTE 内；后置断言 `count(*) <= 10` 与 `L` 连续。 | 待拍板（形状可改） |
| CR21 | **平台保留 uid（`0` 与 `−1…−99`）不得出现在链上**：① `referral` 的 FK 到 `users(uid)` 已挡住（`users.uid` 自增从 1 起，R98/R100）；② 应用层仍必须校验（对齐 … | 已冻结（承 R98 / R100） |
| CR22 | **链上 uid 互不重复**（构造保证）：I1 ⇒ 每个节点入度 ≤ 1 ⇒ 上行遍历必为**简单路径** ⇒ 「同一受益人出现在两层」**不可能** ⇒ 无需去重、无需担心权重叠加。⚠️ 该结论**以 CR17/CR18 为前提*… | 已冻结（PK）+ 前提**待裁定** |

**§4 版本化佣金政策 `commission_policy`**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| CR23 | **版本选择 = 「`effective_from <= T` 中 `effective_from` 最大者」**（`T` 取自 DB `now()`，CR4）。**无任何符合行**时的行为**未定** ⇒ 两个口径见 §4.1 的对… | 待裁定（见 §14 #9） |
| CR24 | **不追溯（D12）**：政策改版**只**影响 `T >= effective_from` 的新事件；历史事件的分录**逐字节不变**。**禁止**「按新权重重算历史」的任何功能（改历史行 = 被触发器拒；追加冲正 = 破坏「一 j… | 已冻结（D12） |
| CR25 | **`effective_from` 单调**：新插行的 `effective_from` **必须严格大于**既有最大值（`UNIQUE` 是结构性保证，**应用层必须先校验并给可读错误**）。⇒ **禁止**插入「介于两个既有版本… | 待拍板（一句话可改） |
| CR26 | ⚠️ **政策读取的 TOCTOU 面 + 调用方重放纪律**：① 政策必须在**组装 payload 之前、同一请求内**读取一次（`T` 与服务端时钟一致）；② **重放必须复用同一 payload 与同一 `request_fi… | **待裁定**（§14 #14）+ ② 已定为纪律 |
| CR27 | **政策参数必须在组装 payload 前校验**：`fee_rate_bp ∈ [100,500]`、`levels ∈ [1,10]`、`len(weights_bp) == levels`、`Σweights_bp <= 100… | 待拍板（一句话可改） |
| CR28 | **政策相关字段都不得进幂等键**：`policy_id` / `effective_from` / `fee_rate_bp` / `weights_bp` / 任何金额，一律**禁止**出现在 `idempotency_key` … | 已冻结（承 R50） |

**§5 一次原子事件的载荷形状（jsonb）**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| CR29 | 一个结算事件 = **一次** `SELECT ledger_post_event($1::jsonb)`（`op='entries'`）；**禁止**拆成多次调用、禁止应用层包 `BEGIN…COMMIT`（`ledger.spec… | 已冻结（D10 + §19.5） |
| CR30 | **顶层字段清单**（§5.1）：`op` / `idempotency_key` / `request_fingerprint` / `ref_type='job'` / `ref_id=<job_id>` / `memo` / `… | 已冻结（承 R18） |
| CR31 | **`entries[]` 字段清单**（§5.2）：必填 `uid` / `cid` / `kind` / `delta`；可选 `frozen_delta` / `ref_type` / `ref_id` / `memo`；**禁… | 已冻结（既有 DB 契约） |
| CR32 | **顺序铁律**（§5.3）：`idx=0` **必须**是 `job_payout` 减方（= 幂等探针根行）；随后 `job_payout` 增方 → `job_fee` 减方 → `job_fee` 增方 → 逐层 `commi… | 待拍板（**本册核心契约**，一句话可改但改动须回写） |
| CR33 | **派生键确定性**（§5.4）：`K#(idx+1)` ⇒ 数组必须逐字节可复现。**禁止**把「已排序的 DB 结果」以外的任何集合（`Set` / 无序 map / 并发遍历）直接当数组交给 DB。 | 已冻结（承 R51） |
| CR34 | **锁序不依赖传序**（§5.4）：R79 全序由 DB 内部排序保证；**同时**承认数组顺序决定**派生键序号**与**错误优先级** ⇒ 两条结论必须**同时**写进实现注释，**不得**只写一条（只写「顺序无所谓」会诱发 CR… | 待拍板（口径，不可删） |
| CR35 | **规模上限自检**（§5.3）：`entries ≤ 24 ≤ 32`、账户 `≤ 13 ≤ 16`；超限的根因只可能是 `levels > 10` 或混币（CR3）⇒ 该两情形必须先改 `ledger.spec` R64。⚠️ *… | 已冻结（既有 DB 行为，db 侧自核） |
| CR36 | **`commission` 分录的 `ref_type = 'commission_payout'`** —— 该值**自 `0001` 起就在 `ledger_ref_type_enum` 白名单内**，**无需改约束**（自核：… | 待裁定（§14 #4） |
| CR37 | 金额字段**一律十进制字符串**（R70）；`delta` / `frozen_delta` 传 JSON number ⇒ `400 LEDGER_AMOUNT_INVALID` + `NOT_STRING`（既有闸）。同时**禁止… | 已冻结（承 R70 / R72） |

**§6 池子、取整与最大余数法**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| CR38 | `fee = (gross × fee_rate_bp + 5000) / 10000`（整数除法 = **half-up**，对齐 R68）；`fee_rate_bp` **只来自事件时刻生效的政策**（CR23），P2 起**不读… | 已冻结（D6 + R68） |
| CR39 | `net = gross − fee`（**减法**求净额）；**禁止**用第二个乘法/取整去算 `net`（对齐 R68）。⇒ `net + fee == gross` 恒等（判据 M2）。 | 已冻结（D14 + R68） |
| CR40 | **`P = fee`**（池子 = 手续费全额，D6「全额进佣金池、平台不抽成」）；`P` **不减去**任何平台留存。 | 已冻结（D6） |
| CR41 | **分配用最大余数法**（§6.2 的六行公式）：`W = Σw_L`；`q_L = (P×w_L)/W`（整除）；`r_L = (P×w_L) mod W`；`D = P − Σq_L`；按 `(r_L DESC, L DESC)`… | 待拍板（本册核心算法） |
| CR42 | **破平局 = `(r_L DESC, L DESC)`**（余数相同时**更深层优先**）—— 这是「残余给最深一层」的机器可验落点（§6.3 读法 ①）。 | 待裁定（§14 #15） |
| CR43 | **`Σ x_L == P` 逐分不差**：必须在**落账前**做一次显式断言（组装器里的 `assert(sum(x) == P)`）。失败 ⇒ 借 `500 LEDGER_ACCOUNT_GUARD_VIOLATION` + `r… | 待拍板（**强烈建议冻结**） |
| CR44 | **全整数运算、禁浮点**（对齐 R67）：`P`、`w_L`、`q_L`、`r_L`、`D`、`x_L` 全程整数；**禁止** `Number()` / 浮点除法 / `Math.round`。中间量可行性：本册取值域内 `P ≤… | 待拍板 |
| CR45 | **舍入只在 `fee` 一处**（CR38 的 half-up）；**分佣只做「整除 + 整数 `+1`」，不做任何二次舍入** ⇒ 「`Σ` 逐分不差」是**构造出来的**，不是「再舍入修回来的」。 | 待拍板（**强烈建议冻结**） |

**§7 重归一化**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| CR46 | `M = min(levels, chain_depth)`；`levels` 取自事件时刻生效的政策（CR23），`chain_depth` 取自 §3.4 的上行链。`M ≤ 10` **恒成立**（`levels ≤ 10`，C… | 已冻结（D6/D13 + CR7 的约束） |
| CR47 | **重归一化 = 分母取 `W = Σ_{L=1..M} w_L`**（D13）；**不是**固定 `10000`。⇒ `Σ x_L == P` 与 `M`、与 `Σw` 无关地成立。⇒ ⚠️ 与 `ledger.spec` R45「… | 已冻结（D13） |
| CR48 | **某层 `x_L = 0` ⇒ 不建该层的两条分录**（`commission` 减方 + 增方），**不报错、不写 0 额流水**。其「份额并入余数池再分」由 §6.2 的 `D` 分配**天然实现**（基线 `q_L = 0` … | 待拍板（一句话可改） |

**§8 边界情形：无邀请人 / 短链 / 零额**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| CR49 | **无邀请人（`chain_depth = 0` ⇒ `M = 0`）**：**不产生任何 `commission` 分录**、**不报错**；`fee` 仍收（口径见 §8.2）⇒ 该事件 `−2` 净额 = **`+fee`**。 | 已冻结（master-plan §5.19） |
| CR50 | **短链（`1 ≤ chain_depth < levels`）**：按 CR47 **重归一化、全额分完**（`Σ x_L == P`）；**不得**因「不足 10 级」而留池（D13）。 | 已冻结（D13） |
| CR51 | **零额（`fee = 0`）**：① **不写 `job_fee` 分录**（对齐 R44 的 `fee = 0` 分支）；② **不产生任何 `commission` 分录**；③ **不报错**；④ 事件 `entries` *… | 已冻结（R44 的 `fee=0` 分支）+ 细节待拍板 |
| CR52 | **无邀请人时手续费归属**：本册采用**「仍收、留 `−2`」**（§8.2），并给出可机读判据（M3-B）；**备选口径「不收」登记 §14 #11**。⇒ 两种口径都**必须**先裁定再实现，**不得**由实现方自选。 | **待裁定**（§14 #11） |
| CR53 | **其它边界的定论**（§8.4）：受益人 = 雇主 ⇒ 允许（§14 #12）；受益人未开户 ⇒ 自动开户（CR35）；链上无重复（CR22）；打工人不在链上；受益人恒 `> 0`。 | 待拍板（§14 #12） |

**§9 平台账户与 `PLATFORM_KIND_WHITELIST`**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| CR54 | **`commission` 的减方恒为 `uid = −2`，且必须在该账户的 `debit` 白名单内**（§9.1）。**本册不放宽任何格**：`−2` 的 `credit` 仍只允许 `job_fee`，`−2` **不得**… | 已冻结（承 R101） |
| CR55 | **`0007` 的迁移自检必须断言 3 件事仍在**（失败即**中止迁移**，不得静默跳过）：① `commission` ∈ TS 的 `PLATFORM_KIND_WHITELIST['-2'].debit`；② DB 的 `l… | 待拍板（**强烈建议冻结**） |
| CR56 | **`−2` 不得透支**（对齐 R102 / 判据 9）：池子不足 ⇒ **整事件回滚**（`409 LEDGER_INSUFFICIENT_BALANCE`，`rows_written_0 = true`）。本册保证该分支**不可… | 已冻结（承 R102） |

**§10 幂等与并发**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| CR57 | **事件根键 = `biz:job:settle:<job_id>`**（§10.1）；前缀 `biz:` 强制；**禁**把金额 / 政策 / 层级 / 时间戳 / 状态进键（CR28）。 | 待拍板（模板可改，纪律不可改） |
| CR58 | **并发重放不双扣、不双发**：**完全复用** R51 的幂等协议 + `ledger_idem_uniq` + 单语句隐式事务（§10.2）；P2 **不引入**任何新机制（不加锁表、不加 Redis、不加版本列）。⇒ 「N 个并… | 已冻结（承 R51 / R86） |
| CR59 | **重放返回语义**（对齐 R52）：同键**同**指纹 ⇒ `200 {idempotent_replay: true, …}`；同键**异**指纹 ⇒ `409 LEDGER_IDEMPOTENCY_CONFLICT`（**不执行… | 已冻结（承 R52 / R106） |
| CR60 | **禁止把分佣拆成独立事件或异步执行**（对齐 R57 / R58）：`N× commission` **必须**在同一事件的同一次调用内。 | 已冻结（承 R57 / R58） |
| CR61 | **不同 `job_id` 的并发结算**：靠 **R79 全序**串行化（`−2` 与重叠受益人会成为争抢点）；**禁止**用应用层 / 分布式锁「优化」（R86）。⇒ 两个并发结算最多 `13 + 13 = 26` 个账户的行锁，… | 已冻结（承 R79 / R86 / R63） |

**§11 可证伪判据（机读）**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| CR62 | **判据 M1（池子守恒）** 必须实现（§11.1）：`Σ x_L == fee` 逐分相等；零额时 `0 = 0` 也算通过；**必须**附「人为 `+1` / 删一层 ⇒ 变红」的对照实验。 | 已冻结（硬项清单） |
| CR63 | **判据 M2（净额恒等）** 必须实现（§11.2）：`net = gross − fee`、`net + fee = gross`、雇主**可用余额**不变（D14）；三项全真。 | 已冻结（硬项清单 + D14） |
| CR64 | **判据 M3（`−2` 净额，两分支）** 必须实现（§11.3）：有可付祖先 ⇒ `minus2_net = 0`；**无邀请人 ⇒ M3-C**（`minus2_net = 0`、`commission` 条数 0、`minus1_net = +fee`）。**两分支的期望值不同，必须分别断言**。 | 已冻结（硬项清单）+ **已裁定（#11）** |
| CR65 | **判据 M4（10 级全深度）** 必须实现（§11.4）：`credit_rows = 10`、`distinct_beneficiaries = 10`；**并附两个对照**（链截 9 层 ⇒ 9；`levels = 9` ⇒ … | 已冻结（硬项清单） |
| CR66 | **判据 M5（三条边界 + 1 附加）** 必须实现（§11.5）：① 无邀请人 ② 短链（**逐值**断言 `{4615,3077,2308}`）③ 零额（0 条 `job_fee`、2 条 `entries`、**200 不报错… | 已冻结（硬项清单） |
| CR67 | **判据 M6（并发重放不双发）** 必须实现（§11.6）：`N ≥ 8` 并发同键 ⇒ `root_rows = 1`、`rows_total` 恰为形状值、`comm_rows` 不翻倍、`N−1` 次重放；**必须**附「改成… | 已冻结（硬项清单） |
| CR68 | **判据 M7（不追溯，双向）** 必须实现（§11.7）：改版后① 历史行指纹不变 ② 同键重放零新增 ③ **新**事件按新政策分配。**缺任一方向不算通过**。 | 已冻结（D12 + 硬项清单） |
| CR69 | **判据 M8（配对不变式）与 M9（图不变式）** 必须实现（§11.8）：M8 = `Σ(delta+frozen_delta) = 0` + 键族两口径归零；M9 = `cycles = 0` + `bad_depth = 0`… | M8 已冻结（承接）／**M9 已裁定（#1）**：含 2-环反例的判负用例为**硬要求**（CR79） |
| CR70 | **判据的元规则**：① 每条判据必须**能判负**（注入-还原或对照实验；对齐 R89 / R93，「没有对照的绿色用例视为装饰」）；② 读数一律 **run-tagged 落盘**、**禁止**固定文件名（会被静默覆盖）；③ 测试… | 待拍板（**强烈建议冻结**） |

**§12 升级、幂等与回滚（`0007`）**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| CR71 | **`0007` 必须幂等**：由 `migrate.ts` 的 `schema_migration(version, checksum)` 去重 ⇒ 重复应用必须输出 `action = "skipped"`（`reason = "… | 已冻结（既有迁移器契约） |
| CR72 | **校验和登记**：`0007` 的 `sha256` 由 `migrate.ts` 在应用时写入 `schema_migration.checksum`；**交付报告必须逐字带上** `version / name / checks… | 已冻结 |
| CR73 | **不得修改 `0001`–`0006`**（§12.2）；本册需要的**新**对象一律落在 `0007`；需要改既有 `kind` 关闭集 / 白名单 / 函数体时，**只能新建 `0008+` 并先回来改本册**。 | 已冻结（checksum 纪律） |
| CR74 | **人工回滚口径**（§12.3）：**无 `down` 迁移**；回滚四步；**上线后不得回滚**（有 `commission` 行即只能前滚）。 | **已裁定（§5.20 #13）** |

**§13 错误码映射（**不新增错误码**）**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| CR75 | **P2 不新增任何错误码**（33 码关闭集不动，CR5）；一切新情形走 §13.2 的**借码 + 前缀化 `reason`**。 | 已冻结（承 §14.3 借用方案） |
| CR76 | §13.2 新增的 `reason` 取值（`COMMISSION_POLICY_MISSING` / `FEE_RATE_OUT_OF_RANGE` / `POLICY_SHAPE_INVALID` / `WEIGHTS_SUM_E… | 已冻结（承 R104 + v0.7 纪律） |
| CR77 | **借用的两条铁律**（原样承接 `ledger.spec` §14.3 末段）：① 借用**不改变** §14.1 各码自身的触发条件 —— 本表只在「§14.1 无覆盖」的情形下使用；② `details` **只放非敏感上下文*… | 已冻结（承 R107） |

---

**v0.2 新增规则（CR78–CR85）—— 按 \`master-plan\` §5.20 的裁定落位**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| CR78 | **防环机制（裁定 #1，权威）**：⛔ **\`depth\` 不再是防环机制**（保留作**遍历上界 + 审计**）；防环 = **① 自指禁令 + ② 祖先检查（新父 \`P\` 不是 \`child\` \`C\` 的后代，等价式 \`C ∉ ancestors(P)\`）+ ③ 绑定串行化** ⇒ **\`0007\` 必须同时提供三件，三缺一即判负**；机读形状见 §3.2 的 \`referral_cycle_guard\` 块。 | **已裁定（#1）** |
| CR79 | **必带「2-环反例」判负用例**：先插 \`A→B\`、再插 \`B→A\` ⇒ 第二次**必须被拒**（\`400\` + \`REFERRAL_CYCLE_REJECTED\`）；并与「绕过守卫直插两行 ⇒ §11.8 M9 的 \`cycles\` / \`bad_depth\` 必须变红」配套。**没有该判负用例的绿色绑定用例不算通过**（R93）。 | **已裁定（#1）** |
| CR80 | **「Σ佣金 == 手续费」由 DB 侧强制**：\`0007\` 必须新增**只读后置断言触发器**（推荐 \`CONSTRAINT TRIGGER … AFTER INSERT … DEFERRABLE INITIALLY DEFERRED\`），对同一 \`event_root_key\` 断言出池 == 入池；**禁止改 \`ledger_post_event\` 函数体 / 改 \`0001\`–\`0006\` / 改表结构 / 触发器写表 / 用 \`FOR EACH STATEMENT\`**；失败落 \`defect\` ⇒ \`500\` + R108（**不得裸抛 \`23514\`**）。 | **已裁定（#14）** |
| CR81 | **计算不下沉**：读政策 / 读图 / 算 \`fee\` / \`net\` / \`x_L\` 一律留在应用层（§5 / §6 载荷契约不变）⇒ 一切「下沉进 DB」的表述**作废**；代价（已认）= CR26 ① 的 TOCTOU 面**保留**，故「重放必须复用同一 payload / 指纹」是**硬纪律**。 | **已裁定（#14）** |
| CR82 | **口径 A 的落地**：\`0007\` **必须种默认政策**（\`effective_from = 1970-01-01T00:00:00Z\` / \`fee_rate_bp = 100\` / \`levels = 10\` / 默认权重见 §4.4 / \`created_by = 0\`）⇒「无政策行」**不可达**；\`created_by\` **允许平台 id（\`0 / −1 / −2 / −3\`）且去掉指向 \`users\` 的 FK**。 | **已裁定（#9）** |
| CR83 | **政策写入守卫**：**在政策写入时**即拒 ①\`Σweights_bp > 10000\` ②**\`Σweights_bp = 0\`** ③**前 \`M\` 层全零**（可静态判定式 = \`weights_bp[1] > 0\`，§14.2 #2）④ \`levels\` / \`len\` / 负权重（CR27）；失败类一律 **\`400\`**（借码 + \`reason\`），**不得 \`500\`、不得新增码** ⇒ 运行时 \`W = 0\` **不可达**。 | **已裁定（#5 / #16）** |
| CR84 | **无邀请人 ⇒ 手续费入 \`−1\`**：仍收（\`job_fee\` 照发、增方 uid = \`−1\`）、**不入 \`−2\`**；\`−2\` **只作佣金中转**、同一事件内进出相抵、**净额 0、不留存**；**不得**换 \`kind\` / 走 \`transfer\` 绕过白名单；**机械前提 = \`0008\` 扩展 \`−1\` 白名单（§9.5）**。 | **已裁定（#11）** |
| CR85 | **白名单扩展与迁移边界**：① \`0007\` **允许**在 \`ledger_entry\` 上新增**只读**断言触发器；② \`−1\` 的 \`credit\` 接纳 \`job_fee\` 属**既有对象行为改变** ⇒ **只能落在 \`0008+\`**；③ \`0007\` / \`0008\` 均须**幂等**且**不得**触碰 \`ledger_post_event\` 函数体；④ TS \`PLATFORM_KIND_WHITELIST\` 与 DB 侧**同改** ⇒ **P2 交付物 = \`0007\` + \`0008\`**（\`0008\` 的必要性**待 Zang 确认**）。 | **已裁定（#11 / #14）** |

---

---

## §17 变更记录

| 版本 | 日期 | 变更 | 变更人 |
|---|---|---|---|
| v0.1 | 2026-09-27 | **首版**（`R3-P2a` 交付）。流程：**先落盘骨架**（17 章标题 + 目录 + 占位）→ **逐节填充**（§0–§13 分 8 次就地写入）→ **规则总索引由脚本从规则表抽取生成**（杜绝手抄错号）→ 自核。内容：§0 范围/阅读约定/承接的冻结决策/**点名三条与 `ledger.spec` 的张力**；§1 术语 + CR1–CR5；§2 `0007` 的 DDL（`referral` + `commission_policy` + 4 个触发器）+ **诚实边界**（`TRUNCATE` / 管理员旁路 ⇒ 护栏而非绝对不变式）+ **`CHECK` 不能表达 `Σ`** 这一 PostgreSQL 硬约束 + 命名规范 + CR6–CR14；§3 邀请图五条不变式（I1–I5）+ ⚠️ **否证「防环靠构造」的 2-环反例**并给出最小修复（`C ∉ ancestors(P)` + 串行化）+ CR15–CR22；§4 政策版本化（`policy(T)` / 不追溯 / 单调 `effective_from` / TOCTOU 与重放纪律 / 费率真源迁移 / **默认权重矩阵建议** = 3000·2000·1500·1000·800·600·500·300·200·100）+ CR23–CR28；§5 一次原子事件的载荷形状（顶层字段 + `entries[]` 逐条字段清单 + **分录顺序铁律表 + 派生键映射** + 锁序 vs 传序的区分 + 规模自检）+ CR29–CR37；§6 池子/取整/**最大余数法**（含 5 个纸面推演）+ CR38–CR45；§7 重归一化（`W = Σ w_L`）+ ⚠️ **R45 与 D13 互斥**的登记 + 退化分母 `W = 0` + CR46–CR48；§8 三类边界 + **四类情形归属/读数表**（含「无邀请人时手续费归属」的两口径对照）+ CR49–CR53；§9 平台白名单（**逐字自核两侧均已含 `commission`** ⇒ `0007` 只需**断言**它仍在）+ CR54–CR56；§10 幂等与并发（**完全复用既有机制**）+ CR57–CR61；§11 **可机读可证伪判据 M1–M9**（每条含 SQL 形状 + 判负对照；M9 是「防环构造不成立」的机读闸门）+ CR62–CR70；§12 `0007` 幂等/校验和/不得改 `0001`–`0006`/人工回滚 + CR71–CR74；§13 借码映射 13 格（**不新增错误码**）+ CR75–CR77；§14 **待 Zang 裁定 16 项**（含阻塞标记）；§15 **未实测诚实清单 10 项** + 已自核事实表；§16 规则总索引 **CR1–CR77**；§17 本表。**规则总数 = 77 条（CR1–CR77，无缺号/无重复，由脚本自核）**。 | Jing |
| v0.2 | 2026-09-27 | **落位 `docs/seafood.master-plan.md` §5.20 的 16 项裁定**（`master-plan` v0.24 / HEAD `524b8eb`；**逐条照落、不自行推导**）+ 同步上位册 `ledger.spec.md` **v0.8** 的四处就地增补。**新增规则 CR78–CR85（8 条，向后追加；CR1–CR77 编号与顺序未变）**；**章节编号未重排**（一律就地增补）；**不新增错误码**（仍 33 码关闭集）。逐节落位：**§0** 版本 / 上位口径 / 冲突处置（新增 ④ **禁改 `ledger_post_event` 函数体**、⑤ P2 的 DB 变化只准落在 `0007`；采纳 #11 时须 `0008`）+ 裁定总表 3 行（#11 / #14 / #9,#5,#16）+ §0.5 三条张力逐条标「已裁定」；**§2.1** `created_by` **去 FK** 改 `CHECK (created_by >= 0 OR created_by IN (-1,-2,-3))` + 权重守卫**新增两条拒绝**（`Σ = 0` / `weights_bp[1] = 0`）+ 口径 A 种子行 + **DB 侧后置断言触发器**要求 + CR82 / CR83；**§2.2** 删「`depth` 构造上不可能成环」类表述；**§2.3** 失败类 `400` 已裁定；**§2.5** CR6/7/9/12/13/14 状态翻转；**§3.1–§3.5** **防环机制重写**（`depth` 不再是机制 ⇒ **自指禁令 + 祖先检查（新父 `P` 不是 `child` `C` 的后代）+ 绑定串行化**；新增 `referral_cycle_guard` **机读块**；**2-环判负用例**上表）+ CR78 / CR79 + CR15–CR22 翻转；**§4** 口径 A / 费率真源 / `created_by` 放宽 / 禁止回填 + CR82 + CR23–CR27 翻转；**§5** `ref_id` = 同一 `job_id`（**不建 `commission_payout` 表**）+ 无邀请人时 `entries[3].uid = -1` + CR36 翻转；**§6.5** **CR80**（Σ 佣金 == 手续费 **由 DB 侧强制**；**禁改 `ledger_post_event` 函数体**）/ **CR81**（不下沉）+ CR41 / CR42 / CR43 翻转；**§7.2 / §7.3** **D13 胜** + 退化分母改「**政策写入时就拒 ⇒ `400`**」+ CR47 更新；**§8** 无邀请人手续费**入 `−1`**（`−2` 只作中转、净额 0、不留存）+ CR84 + CR49 / CR52 / CR53 翻转；**§9.2 / §9.5**（含新增要求子节） `−1` 白名单**只读自核**（**不含 `job_fee`** ⇒ 需 `0008`）+ 新增 §9.5 要求 + CR85；**§11.3** 判据 **M3-C**（含新 SQL 形状）+ §11.5 ① / §11.8 M9 + CR64 / CR66 / CR69 翻转；**§12.2** 新增两行（`0007` 允许只读断言触发器 / `0008` 扩展白名单）+ §12.3 + CR74 翻转；**§13.2** #1 / #2 / #4 / #10 / #13 五格改判（**守卫类一律 `400`**）+ CR76 追加；**§14.0（新增）16 项裁定落位表** + §14.1 留痕 + **§14.2（新增）5 项派生待确认项**；**§15** 未实测 **10 → 14** 项（新 #11–#14）；**§16** 总索引 **CR1–CR85** + v0.2 状态翻转总表；**§17** 本表。**规则总数 = 85 条（CR1–CR85，无缺号 / 无重复，由脚本自核）**。**纪律**：先存快照 `docs/versions/commission.spec.v0.1.md`（**逐字节相同**，md5 `b091d95d3636e617e32e02386a39df79`）再就地改；本次**只改 `docs/**`**，**未 commit / 未 push / 未连库 / 未启停服务**。 | Jing |

### 17.1 本版**未做**的事（留痕，避免被读成已做）

- **未写任何迁移文件**（`0007` 只是 DDL 口径，落在 `docs/`）。
- **未改 `backend-ts/**` / `frontend/**` / `migrations/**`**；**未改 `ledger.spec.md`**（三条点名张力一律**登记**而非就地改上位册，见 §0.5）。
- **未连库、未启停服务、未跑任何探针**（§15 的 10 项因此全部未消除）。
- **未 commit / 未 push**（工作区仅新增本文件）。
- **未预填 `0007` 的 checksum**（CR72：那是实现方的运行产物）。

**v0.2 追加（同一纪律，逐条登记）**：
- **仍未写任何迁移文件**：`0007` 的 DDL 口径与 `0008` 的**必要性**只在 `docs/` 里（**`0008` 未写、DB / TS 白名单未改**，见 §9.5 / §14.2 #1）。
- **仍未改 `backend-ts/**` / `frontend/**` / `migrations/**`**；本次仅**新增** `docs/versions/commission.spec.v0.1.md`（快照）并就地改本文件（`git status` 只出现 `docs/**`）。
- **仍未连库、未启停服务、未跑任何探针**：§15 的 **14** 项因此**全部未消除**（含 v0.2 新增的 #11–#14：DB 侧断言未跑、2-环判负用例未跑、`0008` 路径未实现）。
- **未 commit / 未 push**；**未改 `ledger.spec.md` 的规则编号空间 / 错误码关闭集**（本次对它的改动是依 §5.20 的就地增补，R1–R108 与 33 码均未变）。

### 17.2 动笔期间的**环境事实**（诚实登记）

- **HEAD 在动笔前后发生了推进**：本册**首次探测**（动笔前的 `git log --oneline -1`）= `7ec402c`（`spec v0.7（6 #12 回填 + …）+ master-plan v0.22（§5.18 …）`）；**落盘骨架时**再取 = **`83c3706`**（`master-plan v0.23: P1 收口（§5.18）+ P2 立项（§5.19 拆解 + 冻结 D12-D15）`，完整 sha `83c37066835e21b89a10a4f497a740230488f92d`）。⇒ 本册以 **`83c3706`** 为基线（其 `docs/seafood.master-plan.md` 已含 §5.19）；两个值都记在此处，**不用其一覆盖另一**（避免「转抄运行时真值」类事故，`master-plan` §5.7 硬3）。**本册未对仓库做任何写操作除了本文件**，故 HEAD 的推进来自**其它会话**，与本册无关。
- 本册引用的所有既有事实均在动笔时 `read_file` 自核（清单见 §15.1），**未采信任何转抄**。

**v0.2 追加（动笔时的环境事实）**：
- **HEAD 在 v0.2 动笔时 = `524b8eb`**（`P2 spec v0.1 入库 + master-plan v0.24：§5.20 裁定 16 项（#1 防环机制被推翻，我 §5.19 的错误主张就地划掉）`，取自本会话 `git log --oneline -1`）。⇒ **本册 v0.2 的权威裁定源 = 该 HEAD 的 `docs/seafood.master-plan.md` §5.20**；若读取时 HEAD 已推进，**以到场时的 §5.20 为准**并回来改本册（`master-plan` §5.7 硬3）。
- v0.2 期间对既有事实的**只读自核**：`0004_ledger_post_event.sql` 的 `ledger_assert_platform_mutation`（`'-1'` 白名单格 ⇒ **不含 `job_fee`**）、`0005_ledger_event_root_key.sql` 的 `ledger_error_for_sqlstate`（「其余 `23514`」⇒ `input`）。**TS 侧 `PLATFORM_KIND_WHITELIST` 未读**（§9.2 / §15 #13 已如实标「未核对」）。
