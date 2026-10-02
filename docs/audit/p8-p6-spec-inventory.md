# 批 8（P6 运营后台）· 三册规范面盘点（八项：既有冻结 vs 缺口 vs 冲突/顺序雷）

> **单据**：批 8 第 1 轮「只读盘点」· **规范盘点单**（依据 = `docs/seafood.master-plan.md` **§5.178 B** 表第 2 行 + **§5.177 B** 栏）。
> **角色**：**Jing（Specifier · 制度员）**。
> **产物**：**本文件唯一写盘** = `docs/audit/p8-p6-spec-inventory.md`。
> **口径**：**严格只读**。本单只**读**三册（`route-layer.spec.md` / `data-layer.spec.md` / `ledger.spec.md`）+ `backend-ts/migrations/0022…0024` + 只读 `docs/seafood.master-plan.md`；**未改任何 spec / 未建快照 / 未碰** `docs/qa/**`、`docs/audit/**` 既有件、`docs/seafood.master-plan.md`。
> **未做**（安全红线自证）：**零库连接 · 零 HTTP · 零代码改动 · 零 `git add/commit/push` · 未 `npm install` · 未碰/未打印 `.env*` · 未用 `pkill -f`/`killall` · 未启停 5787/5788**。
> **纪律**：逐条给**条款号 / 行号 / 逐字引文**；**未测项写原因，禁填 0 或空**（见 §10）。

---

## §0 元信息与现取口径

### 0.1 三册（现取 · 本单开工时点）

| 册 | 文件 | 本单现取行数 | 本单现取 md5 | 册头自报版本 |
|---|---|---:|---|---|
| 路由层与资金编排契约 | `docs/route-layer.spec.md` | **3840** | `3f261af960e3dd4a15ba1b08c3a0eed0` | **v2.1**（`:181`） |
| 海鲜市场 · P3 数据层口径 | `docs/data-layer.spec.md` | **1070** | `f63fffad343e0591934d00ba129c8683` | **v0.9**（`:3`） |
| 多币种账本口径冻结裁定书 | `docs/ledger.spec.md` | **2028** | `eee9f165704e100c98b3655d742d1ac2` | **v0.13**（`:3`） |

> **行号声明**：本单所有行号为**本单现取**（`read_file` / `grep -n` 现读，时点见上表 md5）。**注册点**现取 = `grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts` = **68**（`wc -l` = **2060**）—— 与 `route-layer.spec` §1.14 的「**基线 68**」一致；`wc -l` = 2060 系**又一轮漂移**（§1.14 记 T1 = 1981 / T2 = 2047）。

### 0.2 八项清单（**逐字**引自 `master-plan` §5.177 B 栏 / §5.178 C 段）

> **§5.177 B（逐字）**：「**B P6 运营后台**（费率配置 / 10 级返佣权重矩阵 / 上市保证金规则 / **自建单位审核** / 合规审核 / 用户与权限 / **资产与流水审计台**（与 `ledger_entry` 逐条对账）/ `app_config` 管理 + 门禁；4–6 轮；★ 风险 = AC 要求「配置改动被业务层真读取生效」）」
> **§5.178 C（逐字）**：「① **`app_config` 管理 + 合法键清单/写入门禁**（其它配置面的地基；已登记为批 6 规格）→ ② **费率配置**（`commission_policy.fee_rate_bp` 写口）→ ③ **返佣权重矩阵**（10 级 × 时间权重）→ ④ **自建单位审核**（R3 风险面）→ ⑤ **合规审核**（商品/招工）→ ⑥ **用户与权限**（十一键已冻结，**可能已大半具备**）→ ⑦ **资产与流水审计台**（对账口径）→ ⑧ **上市保证金规则**；**A 小项**（`R-7E-6` keys 收敛）并入第一批」

> **★ 重要**：§5.178 C 的**切片编号**与 §5.177 B 的**枚举顺序**不同，且 §5.178 把「上市保证金规则」列为 **⑧**、把「`app_config` 管理」列为 **①**。本单**按派单给定的编号**（① 费率配置 … ⑧ `app_config` 管理）逐项盘点，**并在各项标注 §5.178 C 的等价切片号**，防误读。

### 0.3 状态词表（写死 · 防误读）

| 词 | 含义 |
|---|---|
| **已冻结** | 三册内已成条文且**标注已裁定 / 已冻结**（附裁定出处） |
| **部分覆盖** | 三册有**相邻**条文，但**未覆盖**本项的核心动作/字段 |
| **未覆盖（缺口）** | 三册内**检索不到**该面的规范条文 |
| **冲突 / 顺序雷** | 三册互斥、或与**已上线行为**（`0022`/`0023`/`0024`/注册点 68）矛盾、或**依赖顺序不得颠倒** |

### 0.4 已知「已上线行为」基线（**转引**；本单**零库连接**，非本单实测）

- **`0022` 十一键冻结**：`route-layer.spec` §11.1（`:2913`–`:2914`）登记「已 apply ⇒ `/health` `schema_version` 报 `0022`」，**11 键三真源逐键相等**（后端 `ALL_ADMIN_PERMISSIONS` ↔ 前端 ↔ `0022`）。
- **`0023` 审计表 + 日累计**：`route-layer.spec` §11.2（`:2920`–`:2926`）登记 `public.admin_ops_audit_log`（15 列） + DB 编排函数 `admin_points_adjust_post_event` + 日累计闸 `1,000,000 / 日`。
- **`0024` 退款审计表**：`route-layer.spec` §12.13（`:3577`）登记「`schema_version = 0024` … `applied_at = 2026-10-02T08:01:41.542Z`」+ 表 `admin_refund_audit_log`。
- **注册点 68**：§1.14（`:677`）；本单复取 = **68**（见 §0.1）。

---

## §1 项① 费率配置（`commission_policy.fee_rate_bp` 写口）〔§5.178 C 等价切片 = **②**〕

### 1.1 已有冻结（逐条 · 条款号 / 行号 / 逐字）

- **`route-layer.spec` §4.2 事件表 · R3 行**（`:1055`）逐字：
  > 「| **R3** | 变更佣金政策（后台可设） | `POST /api/admin/commission_policy`（**路由层随批 4**） | `insertCommissionPolicy`（`commission.ts:240`） | **无分录**（插一行政策） | `fee_rate_bp`、`levels`、`weights_bp`、`effective_from?`、`created_by` | 无（INSERT-only 表；`effective_from` **严格递增**） | 单语句 `INSERT ... WHERE NOT EXISTS(≥ now())`；失败 ⇒ 无行 ⇒ 400 | `400` LD016 + `FEE_RATE_OUT_OF_RANGE`/`POLICY_SHAPE_INVALID`/`WEIGHTS_SUM_EXCEEDS_10000`/`POLICY_WEIGHTS_ALL_ZERO`/`POLICY_EFFECTIVE_BACKDATED` | 批 2（service）；路由批 4 |」

- **`route-layer.spec` §4.4-11**（`:1093`）逐字（费率真源唯一）：
  > 「费率真源 = `commission_policy.fee_rate_bp`（**唯一真源**，`ledger.spec` §14.1 #32 / §5.20 #3）」
  同条硬口径逐字：「**金额必须服务端取数（配置真源或下限校验），不得由调用方决定**」。

- **`route-layer.spec` §4.8.2 逐事件表 · J5 行**（`:1353`）逐字：
  > 「| **J5** | `fee` | **B** | DB `job_settle_plan` 由 `f(reward, commission_policy.fee_rate_bp)` 派生；费率唯一真源 = `commission_policy.fee_rate_bp`（`ledger.spec` §14.1 #32；§7-16 读取侧纪律） | 同上（**无该入参**） | §4.4-13；Zang §5.89 裁定② |」

- **`route-layer.spec` §4.8.2 逐事件表 · R3 行**（`:1364`）逐字：
  > 「| **R3** 变更佣金政策 | `fee_rate_bp`、`weights_bp` | **B**（**管理面写入 + 运行时只读**） | 写入端点 = `POST /api/admin/commission_policy`（`src/commission.ts:240`，**权限闸 + `effective_from` 严格递增**）；**运行时计费只读** `commission_policy.fee_rate_bp`（永不读 `app_config`，§7-16） | 管理面入参属**配置写入**，**不得**被任何业务路由复用为计费来源 | §7-16 / §7-23；Zang §5.89 裁定② |」

- **`route-layer.spec` §1.11 Q8**（`:567`）逐字（**权限键点名**）：
  > 「`POST /api/admin/commission_policy` = **`manage_settings`**；**原则 = 复用既有权限键、不新造**」

- **`route-layer.spec` §4.5 幂等键总表 · C1 行**（`:1041`）与 **§4.2 R3**（`:1055`）对 `POST /api/admin/commission_policy` 的**键面**：**无键（INSERT-only 表）** —— 与 `data-layer §8.3`（`:589`）「`ops:<admin_uid>:commission_policy:<effective_from>`」**并存登记**。

- **`route-layer.spec` §7-16**（`:1642`）逐字（费率键黑名单定案 + 项⑧立项）：
  > 「★ Zang §5.82 裁定 = **采纳选项 (A) 删除**（`master-plan:1430`）：**删除整个 `FEE_RATE_KEY_PATTERNS` 黑名单** … **「真源唯一」改由读取侧纪律保证**：**任何计费只读 `commission_policy`，永不读 `app_config`**。⇒ 本册口径 = 删除该黑名单要求（写入侧只做「不得新写费率键」的**命名提示**，**非硬拒**）。**登记（批 6 配置面规格）**：「**`app_config` 合法键清单 / 写入门禁**」（现在**无键名枚举** ⇒ **硬造即自拟**）⇒ 归**批 6 配置面**。」

- **`route-layer.spec` §7-23**（`:1649`）逐字（费率真源 + 数值待 Kevin）：
  > 「**费率**真源 = `commission_policy.fee_rate_bp`（`ledger.spec` §14.1 #32 **唯一真源**；读取侧纪律见 §7-16）；**保证金下限的数值与载体**（新增 `app_config` 键？抑或用 `currency.deposit_amount` 既有语义？）**待 Kevin/Zang 给数** ⇒ **不得自选**；改「从平台配置取数」归**批 6 配置面**（真源键名待定、**不得从 `app_config` 硬造键名**）。」

- **`data-layer.spec` §2.2**（`:112`）逐字（政策表回归判据 · 压缩版）：
  > 「**政策表回归判据（`DL152`，正文 §17.2）**：任何时刻 `commission_policy` 的 `max(effective_from)` 行，其 `fee_rate_bp` / `levels` / `weights_bp` **必须**等于预期组合（当前 = `100` / `10` / `{3000,2000,1500,1000,800,600,500,300,200,100}`）；**P3 测试夹具不得向生产政策表追加生效版本**。」

- **`data-layer.spec` DL152**（`:997`）逐字（判据 + 夹具禁令 + 类型事实）：
  > 「**判据（写死，可机读）**：**任何时刻，`max(effective_from)` 的那一行，其 `fee_rate_bp` / `levels` / `weights_bp` 必须等于预期组合**（当前 = **`100` / `10` / `{3000,2000,1500,1000,800,600,500,300,200,100}`**）。**夹具禁令**：**P3 测试夹具不得向生产政策表追加生效版本** … **处置联动**：D20 清理时把 `commission_policy` **收回到 1 行种子**。」
  同条列名/类型逐字：「列名 = **`policy_id` / `fee_rate_bp` / `levels` / `weights_bp` / `effective_from` / `created_by` / `time_created`**，其中 **`weights_bp` 类型实测 = `smallint[]`**」。

- **`data-layer.spec` DL70③**（`:465`）逐字（后台读口）：
  > 「③ 「当前费率/权重」读 `commission_policy` 的 `policy(now())`（CR23）」

- **`data-layer.spec` §8.3 写路由 → 幂等键全表**（`:589`）逐字：
  > 「| `POST /api/admin/commission_policy` | `ops:<admin_uid>:commission_policy:<effective_from>` | 运维写（无分录） | `effective_from` / `fee_rate_bp` / `levels` / `weights_bp` | 政策**插行不 UPDATE**（CR8/CR23）；`effective_from` 严格递增（CR25，禁止回填） |」

- **`ledger.spec` §14.1 #32**（`:890`）逐字：
  > 「32 | `LEDGER_FEE_RATE_INVALID` | `500` | **费率真源 = `commission_policy.fee_rate_bp`**（**v0.8 就地更正，§5.20 #3**）；触发条件收紧为「**已越过政策写入守卫**仍不合规」（例：库里被人工写入非法费率、非整数基点、政策行缺失且无默认政策）」

- **`ledger.spec` §14.1 v0.8 增补块 ①**（`:894`）逐字：
  > 「① **费率真源 = `commission_policy.fee_rate_bp`（唯一）**（§5.20 #3）；`app_config` 的费率键**在 P2 起不再参与计费**（键保留、不做删除）；本册其余把「费率」落点写作 `app_config` 的处（§5.2 R44 落点、§8.3 R68 的费率基点）**一并改读 `commission_policy.fee_rate_bp`**」

- **`ledger.spec` §5.2 R44**（`:376`）与 **R68**（`:566`）逐字（费率取值 + 取整）：R44「费率取自后台可配区间 `1%–5%`（D6）」；R68「费率以**基点整数**存 `app_config`〔**v0.8**：P2 起真源改为 `commission_policy.fee_rate_bp`，见 §14.1 #32 v0.8 块〕（`100` = 1%，`500` = 5%，分母 `10000`）」。

- **`ledger.spec` §19.12.B**（`:1768`）逐字（守卫失败类一律 400）：裁定值 =「**`commission_policy.fee_rate_bp` 是费率唯一真源**（#3）；**守卫失败类一律 `400`**（`Σweights_bp > 0` 且前 `M` 层不得全零在**政策写入时就拒**，#5 / #16）；**`#32` 仍为 `500` 缺陷类**」。

### 1.2 缺口

- **①-缺1（后台读口形状）**：三册**无**「费率配置后台读口」的**响应键集**条文 —— `DL70③` 只给「读 `commission_policy` 的 `policy(now())`」，`route-layer §6.4`（`:1596`）只冻结 `GET /api/admin/me` 的 **6 键**；费率读口的键集**未冻结**（属前端契约空缺）。
- **①-缺2（区间来源）**：`fee_rate_bp ∈ [100,500]`（route §4.2 R3 `:1055`）是**写死区间**，三册**无**「区间本身是否可配置 / 载体」条文（若可配置 ⇒ 须新增 `app_config` 键 ⇒ 与 §7-16「不得从 `app_config` 硬造键名」冲突）。
- **①-缺3（权限键）**：**无 `manage_commission_policy` 落库**（`data-layer DL106` 要求新增、与 `manage_settings` **分离**），三册亦无「费率写口的权限键」条文（实际由 `route §1.11 Q8` 取 `manage_settings`）。
- **①-缺4（"生效读" 后台可见性）**：无「后台显示当前生效政策 vs 历史政策」的条文；`DL152` 只给**回归判据**，不给**读口**。

### 1.3 冲突与顺序雷

- **①-冲1（权限键闭集 · 与项⑥同源）**：`data-layer DL106`（`:611`）逐字「**新增** … `manage_commission_policy`（写佣金政策，与 `manage_settings` **分离**）」 **vs** `route-layer §1.11 Q8`（`:567`）点名 `manage_settings` + `0022`（`backend-ts/migrations/0022_admin_permission_seed.sql:50-62`）**11 键不含 `manage_commission_policy`**。**先例裁定** = `route-layer §12.1.1`（`:3042`）逐字：「若 Zang 认为应改为新键 ⇒ **代价（不可在本批做）**：新键须 ① 新迁移 … ② 后端真源 … ③ 前端兜底数组 … ④ `0022` 的 apply-time 自检断言（`<> 11 ⇒ RAISE`）**必须同批改** … ⇒ **三真源 + 迁移面 4 处** ⇒ 本批 **禁改 `migrations/**` 与代码** ⇒ **不可行**」。
- **①-冲2（费率键黑名单 · 裁定 vs 已上线）**：`route §7-16`（`:1642`）**已定 = 删除** `FEE_RATE_KEY_PATTERNS`；**但** 代码仍在（本单现取：`backend-ts/src/admin-service.ts:89` `const FEE_RATE_KEY_PATTERNS: RegExp[] = [`、`:101` 命中即拒；`backend-ts/src/index.ts:1159` `reason: 'FEE_RATE_KEY_NOT_IN_APP_CONFIG'`），且 `route §1.1 #33`（`:300`）仍写「**禁写费率键**」、`§1.4 F8`（`:380`）实测「带费率键 ⇒ **400 `FEE_RATE_KEY_NOT_IN_APP_CONFIG`**」⇒ **裁定与已上线行为相反**，方向未收口。
- **①-顺1**：`route §7-16` 把「`app_config` 合法键清单 / 写入门禁」**登记为批 6 配置面规格** ⇒ **项①（费率写口）与项⑧（app_config 门禁）必须同批定**；否则费率键「不得新写」的判定无处落。

---

## §2 项② 返佣权重矩阵（10 级 × 时间权重）〔§5.178 C 等价切片 = **③**〕

### 2.1 已有冻结（逐条 · 条款号 / 行号 / 逐字）

- **★ 真源归属（最要紧）** —— **`ledger.spec` §0.2**（`:58`）逐字：
  > 「| 返佣权重矩阵的具体数值与账龄分档 | P2 spec（本册只冻结「佣金池如何流入 / 流出」的账务部分） |」
  ⇒ **权重矩阵的数值/算式真源 = `docs/commission.spec.md` v0.2，不在本三册内。**

- **`route-layer.spec` §0.1 权威输入清单 I3**（`:210`）逐字：
  > 「| I3 | `docs/commission.spec.md` | **v0.2**（经 `backend-ts/src/commission.ts:5-7` 引用） | 十级返佣：`CR*` / §5.3 顺序铁律 / §6.2 最大余数法 / §13 借码 |」

- **`route-layer.spec` §4.2 事件表 · R2 行**（`:1054`）逐字：
  > 「| **R2** | 打工酬金 → 平台费 → **10 级返佣按权重分发** | （由 J5 触发，无独立端点） | `job_settle_plan(...)`（`0013:250`）+ `job_post_event(op='settle')` | `job_payout` `job_fee` `commission` | `fee_rate_bp ∈ [100,500]`（**= 1%–5%**）、`levels ∈ [1,10]`、`weights_bp`（Σ ≤ 10000） | `biz:job:settle:<job_id>` | **最大余数法**：`Σx_L == P` **构造保证**（`D = P − Σq` 按 `(r_L DESC, L DESC)` 补 1）；**分配失败 = 500 defect**（`0013:342-360`） | 见 J5 | 批 3 |」

- **`route-layer.spec` §4.5 J5 结算行**（`:1041`）逐字（事件根键 + 派发语义）：
  > 「| **J5** | **审核通过 → 发放 + 手续费 + 10 级返佣** … | **事件根键** = `biz:job:settle:<job_id>`（`= commission.ts:119 jobSettleKey`，**只由 job_id 派生**） |」

- **`route-layer.spec` §4.3 资金四栏 · J5 行**（`:1070`）逐字（重归一化）：
  > 「**分配** = 沿 `referral` 链上溯 `M = min(levels, chain_depth)` 层，按 `weights_bp[1..M]` **重归一化**（`W = Σ_{L≤M} w_L`，**不是 10000**）用**最大余数法**分配 ⇒ **`Σx_L == fee` 逐分不差**；`x_L = 0` 的层**不建分录**。」

- **`data-layer.spec` DL70③**（`:465`）逐字（读口）：同 §1.1 所引（「当前费率/权重」读 `commission_policy` 的 `policy(now())`（CR23））。

- **`data-layer.spec` DL152**（`:997`）逐字（**预期组合 = 10 级权重真值**）：
  > 「`levels = 10`、`weights_bp = {3000,2000,1500,1000,800,600,500,300,200,100}`」+「**夹具禁令**：P3 测试夹具不得向生产政策表追加生效版本」。

- **`data-layer.spec` §7.1 ④返佣 佣金发放行**（`:514`）逐字：
  > 「| ④返佣 | 佣金发放 | `commission`（**只在结算事件内**，R4：其他场景不得出现） | `commission_payout` / `job_id` | `cm:<job_fee_key>:<level>:<beneficiary_uid>` | 0 |」

- **`ledger.spec` §5.1 #11 `commission`**（`:353`）逐字：
  > 「| 11 | `commission` | 10 级返佣发放 | `uid −2` 佣金池 `balance −x` | 各受益用户 `balance +x` | 0 | `commission_payout` |」

- **`ledger.spec` R4**（`:110`）逐字：
  > 「| **R4** | 「招工 / 打工」是**唯一**触发平台手续费与 10 级返佣的场景；其他任何 kind 都不得产生 `job_fee` / `commission`。」

- **`ledger.spec` R45**（`:377`）逐字（含 v0.8 划线留痕）：
  > 「若 10 级权重之和不足 100%，差额留在佣金池（累计余额），**不**退回平台账户。 ⛔ **【v0.8 就地增补（§5.20 #2 裁定）：本句已由 D13 取代 —— 差额不再留池，改为「按已有层级权重的比例再分配」…原文保留以留痕】**」

- **`ledger.spec` §5.2 v0.8 块 ①**（`:382`）逐字（D13 胜 + 分母）：
  > 「① **裁定（#2）：D13 胜。** 正式口径 = **「10 级权重之和不足 100%」与「链上不足 `levels` 层」两种「分不完」，一律按已有层级权重比例再分配** ⇒ 分配分母取 **`W = Σ 已有层级的 weights_bp`**（**不是**固定 `10000`）」

- **`ledger.spec` §5.2 v0.8 块 ③**（`:384`）逐字（审计真源）：
  > 「③ **审计真源（#4）**：**不建 `commission_payout` 表** … ⇒ 审计真源 = **`ledger_entry`**（`kind = 'commission'` + `ref_type = 'commission_payout'` + **`ref_id` = 同一 `job_id`**）」

- **`ledger.spec` §19.14.C**（`:1889`）逐字（P2 佣金层验收读数 · 只登记）：含 `c2` `W = 6500`、`c4` `fee=0` 无佣金分录、`c7` 平局更深者得、`7_m7_no_retroactive` 政策改版后历史行指纹不变、`M3-C`（`chain_depth = 0` ⇒ `minus1_net = +1`）。

### 2.2 缺口

- **②-缺1（★ 时间权重无载体 · 核心）**：三册**不含**「时间权重 / 账龄分档」的**任何分档表或算式**（`ledger §0.2` `:58` 明写归 P2 spec）。项名「10 级 × **时间权重**」在**三册内查无实据**。
- **②-缺2（写口字段）**：`POST /api/admin/commission_policy`（route §4.2 R3 `:1055`）的入参只列 `fee_rate_bp` / `levels` / `weights_bp` / `effective_from?` / `created_by` —— **无**任何「时间分档 / 账龄」字段。
- **②-缺3（后台读口端点）**：三册**无**「权重矩阵读口」的路由/键集条文（`DL70③` 只给读法）。
- **②-缺4（生效语义）**：`effective_from` 「严格递增」（R3 / DL152）已冻结，但**无**「改版后历史行不变」的**规范条文**（只有 `ledger §19.14.C` 的**读数登记** `7_m7_no_retroactive`）。

### 2.3 冲突与顺序雷

- **②-冲1（★ 顺序雷 · 载体已废）**：`ledger.spec` **R5**（`:111`）逐字「「账龄分档」（P2 权重）以 `commission_payout.time_created` 为准」 **vs** `ledger.spec` §7.2 #8 v0.8 块（§19.12③，`:1772` 转引）「**不建 `commission_payout` 表**」+ `data-layer DL2`（`:89`）「**不建 `commission_payout` 表**」 ⇒ **R5 指定的时间权重载体列已不存在**；项② 若照 R5 实现，**必落空**（须先裁定「账龄分档」的替代载体）。
- **②-冲2（夹具禁令对批 8 的约束）**：`DL152`（`:997`）「P3 测试夹具不得向生产政策表追加生效版本」 ⇒ 批 8 若加权重矩阵后台写口 + 测试，**必须**满足该禁令（否则「静默改全平台费率与层级」）。**库内已有 18 行夹具**（`policy_id` 20–37）**转引** `DL152`（**本单零库连接，未复核**，见 §10）。
- **②-顺1（公式口径不得回退）**：分配口径已由 `§5.20 #2` 定 = **D13 胜**（`W = Σ weights_bp`、池净额 0）；`ledger R45` 原文已划线留痕 ⇒ **不得**以「差额留池」实现（否则破 `Σ commission.amount == job_fee`）。
## §3 项③ 上市保证金规则（`listing_deposit` / `hold_release` / `hold_forfeit`）〔§5.178 C 等价切片 = **⑧**〕

### 3.1 已有冻结（逐条 · 条款号 / 行号 / 逐字）

- **★ `ledger.spec` §19.0 裁定一（最要紧）：上市保证金 = 消耗（不可退）**（`:1437`–`:1441`）逐字：
  > 「**依据**：Kevin 原文「用户自定义的社区积分如需上市，**需要消耗一定的积分作为保证金**」。
  > **v0.2 新写法（对）**：`listing_deposit` = **消耗** —— `$` 从创建者 `balance` 扣（`delta` 负数），转入平台手续费归集账户 `uid = −1`，**计入平台收入**；**不可退**；**不存在可退保证金，`listing_deposit_refund` 这个 kind 不存在**（kind 关闭集 **22 → 21**）。」

- **`ledger.spec` R31**（`:288`）逐字（两笔性质 + 下架口径）：
  > 「「上市收费」拆成两笔**性质不同**的动作，且都必须在下架时口径明确：① `listing_deposit` = **消耗** `deposit_amount` 的 `$`（**不可退** ⇒ 记 `delta` 负数，转入平台手续费归集账户 `uid = −1`，即**计入平台收入**）；② `listing_fee` / `currency_create_fee` = **消耗** `$`… **保证金是消耗、计入平台收入；不存在可退保证金；`listing_deposit_refund` 这个 kind 不存在**」

- **`ledger.spec` §5.1 #19 `listing_deposit` 行**（`:361`）逐字：
  > 「19 | `listing_deposit` | **上市保证金消耗（不可退）**：`$` 从创建者 `balance` 扣、进平台手续费归集账户 `uid = −1` 〔v0.1 旧写法：上市保证金冻结（可退）…〕 | 创建者 `balance −d` | `uid −1` `balance +d` | 0 | `currency` |」

- **`ledger.spec` §19.8.B**（`:1516`）逐字（删 kind）：裁定：kind 关闭集 **21 → 20**（删 `listing_deposit_forfeit`）；同册 §19.8.B 同口径条：「**不得复活已删名**」。

- **`ledger.spec` §13.2 保留 uid 区间**（`:823`–`:831`）逐字（`−1` 行）：
  > 「| `−1` | **手续费归集账户** | **平台收入**：`trade_fee` + `listing_fee` + `currency_create_fee` + **`listing_deposit`（v0.2 新增：上市保证金已改为消耗，直接入本账户）** |」

- **`ledger.spec` §13.2「不设「保证金池」账户（v0.2 口径）」**（`:836`）逐字：
  > 「上市保证金是**消耗**：在上市事务内直接从创建者 `balance` 扣、转入平台手续费归集账户 `uid = −1`（kind `listing_deposit`），**既不设保证金池、也不再表现为用户账户的 `frozen`**。」

- **`ledger.spec` R101**（`:845`）逐字（`−1` 白名单 + 唯一放行例外）：
  > 「**🔴 v0.13 就地更正（Zang §5.81 勘误落位）**：**`−1` 的增方白名单追加 `listing_deposit`** —— 原文只列 `trade_fee` / `listing_fee` / `currency_create_fee`（**漏列**）… **kind 关闭集仍 20**（R40 不动）」；同条「**仅 `uid = −3`（罚没池）允许以 `transfer` 出账**」。

- **`ledger.spec` §11.1 判据 7（平台收入守恒）**（`:755`）逐字：
  > 「`account(−1, cid).balance == Σ(trade_fee) + Σ(listing_fee) + Σ(currency_create_fee) + Σ(listing_deposit)`」

- **`ledger.spec` R33**（`:323`）逐字（`frozen` 流动白名单 · 与保证金无关）：
  > 「`frozen` 的**流动方向白名单**：只能流向 ① 同账户 `balance`（`hold_release`）、② 同账户外的合法受款方（`job_payout` 给打工人 / `purchase`/`trade` 给卖方 / `hold_forfeit` 给罚没账户 `uid = −3`…）」

- **`ledger.spec` R37**（`:327`）逐字（`hold` 家族不含保证金）：
  > 「`hold` 只能由业务事件触发（挂单、招工托管）〔v0.1 旧写法含「上市保证金」—— v0.2 起保证金为消耗，不走 `hold`〕」

- **`data-layer.spec` DL67**（`:457`）逐字：
  > 「**下架无账务动作**（保证金不退；**不存在罚没**，v0.3 裁定）」+ 同条「`master-plan` §6 P5 的「保证金三态可验」**措辞作废**（张力 #4）」

- **`data-layer.spec` DL88**（`:533`）逐字：
  > 「**`listing_deposit` 的语义**：**上市即消耗**（`balance → uid −1`），**不可退、无罚没、无退还 kind**（R31 / v0.3）。⇒ 交易所路由**不得**提供「退还保证金」按钮或接口。」

- **`data-layer.spec` DL91**（`:536`）逐字（★ 罚没不启用）：
  > 「**`hold_forfeit` 在 P3 **不启用**：罚没的标的物是**在冻资金**，而 P3 招工争议路径（C7）只做「退回托管」（`job_escrow_refund`）。若 Zang 裁定要「违约罚没」，须同时给：罚没比例、去向（`−3`）、申诉与退还路径（R38 要求可退还）⇒ 本册**登记为待裁决**（§12），**不预先启用**。」

- **`data-layer.spec` §7.1 ③交易所 单位下架 / 合规冻结行**（`:509`）逐字：
  > 「| ③交易所 | 单位下架 / 合规冻结（R29） | **无分录**（保证金不退、无罚没）；**必须**写 `currency_status_log` | `currency` / `cid` | `ops:<admin_uid>:currency_status:<cid>:<to_status>` | 0 |」

- **`data-layer.spec` §12.1 #2**（`:817`）逐字：
  > 「2 | **`hold_forfeit` / 强制下架罚款是否启用**（含违约金比例、去向 `−3`、退还路径） | **不启用**（DL91/DL82） | Zang（+ Kevin 若涉资金） | 招工争议路径（P6） |」

- **`route-layer.spec` §7-3**（`:1629`）逐字（最终裁定 + 根因 + 铁证）：
  > 「**Zang §5.81（2026-09-30）最终裁定**：**`listing_deposit` = 上市即消耗 → 贷 `uid = -1`**（**不可退、无退还 kind、无罚没**）… **真根因** = `backend-ts/src/ledger.ts:174-175` 的 `HOLD_KINDS` **误含 `listing_deposit`**（P1c 删 `listing_deposit_forfeit` 时漏删）」

- **`route-layer.spec` §7-22**（`:1648`）逐字（退市/罚没 = 无账务动作）：
  > 「退市「**无账务动作**」（**保证金不退**）、强制下架**亦无账务动作**（**不存在可罚没的标的物**）⇒ **`§4.2 C3` = 不建端点、不建幂等键、不建分录** … **★ 将来若做「强制下架罚款」= 新语义、新 kind ⇒ 须单独裁定**（`ledger.spec` §19.8.B 同口径：**不得复活已删名**）」

- **`route-layer.spec` §4.2 C1 / C2 / C3 行**（`:1050`/`:1051`/`:1052`）逐字：C1 = `POST /api/currency`（`currency_create_fee` ×2）；C2 = `POST /api/currency/:cid/list` 逐字「**4 腿全在 `balance`、`frozen` 零变动**（§1.7 H3）。**不可退、无退还 kind（`listing_deposit_refund` 不存在）、无罚没**」；C3 = 「**（P3 无此动作 ⇒ 不建端点）**」。

- **`route-layer.spec` §4.9 数值定值**（`:1393`/`:1399`）逐字：
  > 「建币费 `currency_create_fee` = **10,000 `$`**、上市费 `listing_fee` = **10,000 `$`**、上市保证金 `listing_deposit` = **50,000 `$`**」
  > 「| 上市保证金 `listing_deposit` | **50,000** | `backend-ts/src/currency-service.ts:144`（`CURRENCY_LIST_DEPOSIT_FLOOR = 50000`） |」

- **`route-layer.spec` §1.7 H1/H2/H3**（`:437`–`:439`）逐字（两迁移 + 源码手术 + 入账形状）：H1 = `0019`（167 行）+ `0020`（1115 行）**已应用**；H2 = `src/ledger.ts` `:178` `HOLD_KINDS = ['hold','hold_release','job_escrow','job_escrow_refund']`（**已移除 `listing_deposit`**）；H3 = 「**4 腿** … **逐腿 `frozen_delta=0`** … 回执 `deposit_consumed` / `deposit_credit_uid:'-1'` / `deposit_refundable:false`」。

- **`route-layer.spec` §4.1 关闭集**（`:1025`/`:1027`）逐字：hold 家族 =「`hold` `hold_release` `job_escrow` `job_escrow_refund`（**★ v0.3 更正：不含 `listing_deposit`**）」；`-1` 可 credit 的 kind =「`trade_fee` `listing_fee` `currency_create_fee` `job_fee` + **★ `listing_deposit`（v0.3 新增）**（**`debit` 恒空**）」。

### 3.2 缺口

- **③-缺1（退还/罚没面 · 有意留白）**：三册**无**「保证金退还」「保证金罚没」的规范条文 —— 属**刻意留白**（`DL88`/`DL91`/`§7-22`）。批 8 若做这两面 ⇒ **新语义 + 新 kind + 须单独裁定**。
- **③-缺2（下限载体）**：`route §7-23`（`:1649`）逐字「**保证金下限的数值与载体**（新增 `app_config` 键？抑或用 `currency.deposit_amount` 既有语义？）**待 Kevin/Zang 给数** ⇒ **不得自选**」 ⇒ 载体**未定**（机制已落地 = 服务端常量 `50000`）。
- **③-缺3（平台收入提取）**：`ledger §13.3 R103`（`:847`）逐字「「平台运维提取」（把 `−1` 的钱转出平台）**当前 kind 集不覆盖** … ① 在补 kind 之前，平台收入账户**只进不出**；② 补 kind 的建议名为 `platform_withdraw`」 ⇒ 项③ 若含「平台收入管理/提取」= **无规范依据**。

### 3.3 冲突与顺序雷（★ 项名雷为主）

- **③-冲1（★★ 项名与已冻结裁定相反 —— 本单最重要发现之一）**：派单项名写作「上市保证金规则（`listing_deposit` / `hold_release` / `hold_forfeit`）」—— 但三册对三者的**已冻结口径**是：
  1. **`listing_deposit`**：唯一在用，且 = **消耗入 `−1`**（`ledger §19.0` / `R31` / `route §7-3`）；
  2. **`hold_release`**：`ledger R33`（`:323`）白名单 = 只承载「**同账户 `frozen → balance`**」，**与上市保证金无任何关联**；`route §4.1`（`:1025`）hold 家族**已移除 `listing_deposit`**；
  3. **`hold_forfeit`**：`data-layer DL91`（`:536`）**P3 不启用**；且「**不存在可罚没的标的物**」（`route §7-22` `:1648`）。
  ⇒ **若照项名实现「保证金 = 冻结可退（`hold_release`）+ 罚没（`hold_forfeit`）」= 复活 v0.2 被 Zang §5.81 推翻的错误推断**，并触 `ledger §19.8.B`「**不得复活已删名**」。
- **③-冲2（同源佐证 · AC 措辞已作废）**：`data-layer.spec` §0.4 张力 #4（`:75`）逐字：「`master-plan` §6 P5 AC 写「保证金冻结 / 退还 / 罚没三态可验」，而 D7/v0.3 已裁定保证金**消耗不可退、不存在罚没标的物** … 本册在 §3 映射表内标注该措辞作废」 ⇒ **批 8 的验收口径若沿用 §6 P5 旧 AC 措辞（三态可验）= 与裁定冲突**。
- **③-顺1**：数值已定（50,000，`route §4.9`）**且**标「起始值、可配置」—— 「可配置」的**载体**未定（见 ③-缺2）⇒ 若选 `app_config`，**必须**先落项⑧ 的键清单/门禁。
## §4 项④ 自建单位审核（用户可发币的审核闸）〔§5.178 C 等价切片 = **④**〕

### 4.1 已有冻结（逐条 · 条款号 / 行号 / 逐字）

> **★ 结论先行**：三册**只有「自建单位的定义 + 建单位 + 上市」三块冻结条文**，**没有任何「审核闸」条文** —— 本项的主体（审核）**在三册内 = 零覆盖**，属**纯新增语义**。

- **`ledger.spec` R3**（`:109`）逐字（自建单位定义）：
  > 「| **R3** | 「社区积分 / 自建单位」= `currency.owner_uid > 0` 的币种，符号由创建者自定义（如 `dashJ`），**不是**系统币的别名。 | `currency.owner_uid` 语义 | 后台文案、交易所币对命名、`CurrencyGlyph` 泛化 | 已冻结 |」

- **`ledger.spec` §3.1 `$` 与「用户自建单位」的差异矩阵**（`:245`）逐字（核心口径）：表头 =「| 维度 | `$`（系统币） | 用户自建单位（如 `dashJ`） |」。

- **`ledger.spec` R9**（`:226`）逐字（创建必带 `supply_cap`）：
  > 「$ 的 `supply_cap = NULL`（平台可无限铸）；用户自建单位创建时**必须**指定 `supply_cap`（不得为 NULL…）」

- **`ledger.spec` R10**（`:227`）逐字（**状态机只有四态 · 无「待审核」态**）：
  > 「`currency.status` 四态字符串枚举：`draft / listed / frozen / delisted`；`listed_at` 在首次进入 `listed` 时写入，之后**不再清空**…`deposit_amount`（$ 最小单位整数）与 `deposit_cid`（当前恒 `= 1`）记录**上市保证金口径**」

- **`ledger.spec` R23**（`:280`）逐字（mint 授权）：
  > 「`mint` 的授权判定 = 「`currency.owner_uid` 与操作用户 `uid` 相等，**或** `owner_uid = 0` 且调用方是平台受信任路径」。自建单位铸造**只能铸造到 owner 自己的账户**」

- **`data-layer.spec` DL89**（`:534`）逐字（mint/burn 边界）：
  > 「**`mint` / `burn` 的使用边界**：`mint` 只允许 ①平台铸 `$`（`owner_uid = 0`，R23）②自建单位 owner 铸**到自己账户**（不得铸给他人，R23）」

- **`data-layer.spec` DL67**（`:457`）逐字（上市不需要新表）：已引（§3.1）。

- **`route-layer.spec` §1.1 新增端点表**（`:344`/`:345`）逐字（**两动作已注册**）：
  > 「| `POST /api/currency`（建单位） | **★ 已实现（批 3a）**：`src/currency-service.ts`（`createCurrencyVerb`）+ `DatabaseService.createCurrencyWithFee`（单语句 CTE）；**已注册**（`src/index.ts:1160`） | **批 3a（已落地）** |」
  > 「| `POST /api/currency/:cid/list`（上市→收上市费 + 保证金） | **★ 已实现（批 3a）**：`listCurrencyWithDeposit`（单语句 CTE）；**已注册**（`src/index.ts:1179`） |」

- **`route-layer.spec` §4.2 C1 行**（`:1050`）逐字（建单位 = 单语句 · 无审核）：
  > 「| **C1** | 自定义积分创建（建单位） … | **单语句 CTE**（迁移冻结 ⇒ 不新增编排函数）… | `currency_create_fee` **×2** … | `symbol`、`name`、`decimals`、`owner_uid`（**须 = actor**）、`fee` … | … 门控 CTE ⇒ 重放 / 符号占用 / 越权**一律零分录** |」

- **`data-layer.spec` DL106**（`:611`）逐字（**唯一的「单位上市审核」权限位线索**）：
  > 「**新增** `audit_ledger`（流水审计台）/ **`manage_currency`（单位上市审核）** / `manage_commission_policy`（写佣金政策…）」 —— **★ 但该键未落库**（见 §6.3 ⑥-冲1）。

### 4.2 缺口（★ 本项 = 三册最大缺口）

- **④-缺1（★ 审核闸完全无覆盖）**：三册**无**「用户创建自建单位的审核」任何条文 —— **无**审核状态位、**无**审核队列、**无**审核端点（路径/方法）、**无**权限键（`manage_currency` 未落库）、**无**幂等键、**无**审计表、**无**错误码（`LEDGER_*` 33 码闭集内无「审核」相关码）。
- **④-缺2（状态机无载体）**：`currency.status` 仅 **四态**（R10 `:227`），**无「待审核 / 已驳回」态**；`DL157①`（`:474`）逐字「`from_status` / `to_status` 的值域 = **不加 CHECK（写死）**：两个状态列**不建白名单 CHECK**、**不建 enum** … 值域权威已有唯一真源 = `currency.status` 侧（`CONSTRAINT currency_status_enum`）」 ⇒ 加审核态 = **改状态机 = 新语义**（`DL7`：「不得就地改 `0017`」；改 `0001` 的 `currency_status_enum` 亦属已 apply 迁移）。
- **④-缺3（创建即不可逆）**：`route §4.2 C1` 是**单语句 CTE**（`:1050`）⇒ 建单位**当前无审核挂起点**；加审核 = 改已 apply 的单语句形态（须新迁移 + 新裁定，非本批可改码范围）。
- **④-缺4（「审核」与 R29 合规冻结的区别未立条）**：`ledger R29`（`:286`）是**平台合规冻结**（`listed → frozen`，用于涉诈/违规调查），与「**上市前审核**」是**两回事**，三册未区分、未登记。

### 4.3 冲突与顺序雷

- **④-冲1**：与 ⑥-冲1 **同源**（`manage_currency` 未落库，`0022` 11 键不含）⇒ 审核闸**无键可选**。
- **④-顺1**：若审核闸落在「建单位（`draft`）→ 审核 → `listed`」之间，则**必须**同时裁定：① 状态机加态（改 `currency_status_enum`）+ ② 审核动作的账务口径（是否与 `C2` 的上市费/保证金同事件）+ ③ 审计留痕载体（`currency_status_log` 还是新表）+ ④ 权限键 --- **四项缺一不可**，且均属**新语义 ⇒ 须单独裁定**（`route §7-22` / `ledger §19.8.B` 同口径）。
- **④-顺2**：与项③/项⑧ 交叉 —— 若审核闸允许「驳回并处置保证金」，**必触** `DL88`/`DL91`（不退、无罚没）⇒ **顺序雷**。

---

## §5 项⑤ 商品/招工合规审核〔§5.178 C 等价切片 = **⑤**〕

### 5.1 已有冻结（逐条 · 条款号 / 行号 / 逐字）

- **`data-layer.spec` §4.1 #47**（`:288`）逐字（**合规下架 = 新路径 · 待定义**）：
  > 「**合规下架**属 P6 审核能力（新路由 `/api/admin/listing/:id/takedown`，需单独定义）」

- **`data-layer.spec` §10.1 #47**（`:679`）逐字：
  > 「| 47 | `POST /api/admin/prize/delete` | **删除** | 同上；**禁止**物理删除（DL79）；**✅ v0.2（C3 ①）：确认删除**；合规下架另立 P6 `/api/admin/listing/:id/takedown`（待定义） |」

- **`data-layer.spec` §10.1 #46**（`:678`）逐字（**商品合规的载体 = `frozen` 状态位**）：
  > 「| 46 | `POST /api/admin/prize/update` | **删除** | 同上（**商品合规用 `frozen` 状态位，不靠编辑**）；**✅ v0.2（C3 ①）：确认删除** | — |」

- **`data-layer.spec` DL106**（`:611`）逐字（**两权限位语义重定义**）：
  > 「**保留** `manage_settings` / `manage_permissions` / `manage_users` / `manage_rewards`（**改语义为「商品合规」**）/ `review_tasks`（**改语义为「纠纷仲裁」**）；**删除** `publish_tasks` / `publish_prizes`（管理员**不再发布**招工/商品…）」+「**✅ v0.2（C7 已裁）**：招工的**审核方 = 雇主**（**管理员不审**，`/api/tasklist/*` 归雇主视角）；`review_tasks` 的语义**收敛为「纠纷仲裁」**，**不得**读作「替雇主验收」；管理员仲裁入口 = P6 `/api/admin/arbitration/*`」

- **`data-layer.spec` §5-C7**（`:350`）逐字（审核方归属）：
  > 「**雇主审**（`POST /api/job/:jobId/review`，D5）；管理员只做**仲裁**（争议单，P6 路由 `/api/admin/arbitration/*`）」

- **`data-layer.spec` §10.1 #52**（`:684`）逐字：
  > 「| 52 | `POST /api/tasklist/:jID/verify` | **重写（范围收敛）** | **C7 已裁：`review` 由雇主执行**（结算触发者 = 雇主）；**`review_tasks` 权限位**的语义 = 「**平台仲裁**」，**不是**「替雇主验收」」

- **`data-layer.spec` DL115**（`:697`）逐字（后台新面枚举）：
  > 「⇒ **管理员从「发布方」转为「仲裁 + 运维方」** … 后台的**新增**面：权限、佣金政策、币种状态、冲正、**审计台**」

- **`data-layer.spec` §7.1 ①招工 仲裁强制退单（P6）行**（`:503`）逐字：
  > 「| ①招工 | 仲裁强制退单（P6） | `job_escrow_refund` ×2；**若要罚没** ⇒ `hold_forfeit`（需新裁定，§7.2） | `job` | `ops:<admin_uid>:job_arbitrate:<job_id>` | 0 |」

- **`data-layer.spec` DL91**（`:536`）逐字（罚没不启用）：已引（§3.1）。

- **`ledger.spec` R29**（`:286`）逐字（合规冻结 · 与审核的区别）：
  > 「`frozen` 是**平台合规冻结**（涉诈/违规调查），**不是**用户可自行触发的操作；解冻同样只能平台发起。冻结/解冻**不产生任何账务分录**（不动 balance/frozen，用户钱仍在），但**必须**写一条 `app_config` 之外的审计记录（建议 `currency_status_log` 或在后台操作日志表）」

- **`ledger.spec` R28**（`:285`）逐字（状态 × 操作矩阵 · 只定义 5 操作 + 已裁）：
  > 「✅ **已裁定（Zang · P1a 收口，登记见 §19.3）**：本矩阵**只定义了 5 个操作**（`mint` / `transfer` / `hold` / 商品标价 / 招工酬金计价），**未覆盖 `hold_release` 与结算类**。裁定：**`hold_release` 四态全可**…；**结算类（`job_payout` / `purchase` / `sale` / `trade` / `hold_forfeit` 等）与 `hold` 同档 —— 仅 `listed`**。」

- **`route-layer.spec` §5.1 逐项最终处置表 · 后台发布商品行**（`:1490`）逐字：
  > 「| 后台发布商品 | `POST /api/admin/prize/{create,update,delete}`（:894/:907/:928） | **`410` + `R107` + `sunset` ×3**（实测） | **`410` 已落地**（**C3 ① 终审「整体删除」**）；合规下架另立 P6 `/api/admin/listing/:id/takedown` |

- **`route-layer.spec` §7-6**（`:1632`）逐字（仲裁面排期）：
  > 「**Zang §5.73 7-6**：`410` 随批 2 生效（**已落地**，§1.4 F5）；后台页面**只读化**（不整页删）；**仲裁面 `/api/admin/arbitration/*` 排 P6**」

- **`route-layer.spec` §1.1 #44**（`:311`）逐字：
  > 「| 44 | `POST /api/admin/prize/delete` **:928** | **【弃用→410】** | —（合规下架另立 P6 `/api/admin/listing/:id/takedown`） | C3 ① + §4.1 #47（`data-layer.spec.md:285`）；批 2b 已落地（同上） |」

- **`data-layer.spec` DL79**（`:486`）逐字（禁物理删除 · 合规下架须用状态位）：
  > 「**`DELETE` 一律不出现在业务表**：业务行的终结 = **状态位**（`cancelled` / `delisted` / `filled`），**不得**物理删除」

### 5.2 缺口

- **⑤-缺1（两条路径均未定义）**：`/api/admin/listing/:id/takedown` —— 三册**逐字写「需单独定义」/「待定义」**（`:288`/`:679`）⇒ **无路径正典、无权限键、无幂等键、无错误码、无审计**。`/api/admin/arbitration/*` —— 三册只给**路径族名**（`route §7-6` / `data-layer C7`），**无任何细节**（无子路径、无许可键、无账务口径）。
- **⑤-缺2（商品合规的载体未定）**：`#46`（`:678`）说「商品合规用 `frozen` 状态位」—— 但 `listing` 表（`0015`）的 `status` 枚举**三册未给**（`DL76` 只归类「可变（状态机守卫触发器）」）；且 `frozen` 语义在 `ledger R28/R29` 是**币种**的合规冻结，**商品**的合规冻结态**未立条**。
- **⑤-缺3（招工合规/争议无账务口径定案）**：`§7.1 ①招工 仲裁强制退单` 给了 `job_escrow_refund` ×2 + `ops:<admin_uid>:job_arbitrate:<job_id>` 键，但**罚没部分仍悬**（`DL91` 不启用）。
- **⑤-缺4（权限键语义未落）**：`DL106` 要求 `manage_rewards` 改语义「商品合规」、`review_tasks` 改语义「纠纷仲裁」；`0022`（`backend-ts/migrations/0022_admin_permission_seed.sql:50-62`）**已 apply 的 name 仍是「奖励管理」/「任务审核」** ⇒ **语义差未落库**（键名同，语义不同）。

### 5.3 冲突与顺序雷

- **⑤-冲1（权限键语义 vs 落库 name）**：见 ⑤-缺4；`DL106` 标「【已裁定 · Zang 终审 v0.2】」但 `0022` 未体现 ⇒ **须先裁定「语义重定义是否需迁移改名」**。
- **⑤-冲2（商品合规 `frozen` vs `DL157①`）**：若合规下架用 `listing.status = 'frozen'`（新态），则与「状态机不改已 apply 枚举」的既有纪律冲突（同 ④-缺2 形态）。
- **⑤-顺1（注册点）**：两条 P6 路径（takedown / arbitration）**落地必增注册点**（现取 68，`route §1.14` `:677`）⇒ 须先定「**复用同路径 vs 新路径**」—— 先例 = `route §12.7`（`:3200`，管理员退款）「倾向 = 复用」。**新路径 = 注册点 68 → >68，须同步 §1.14**。
- **⑤-顺2（招工审核方已定 · 不得复辟）**：`C7` 已裁「审核方 = 雇主，管理员不审」⇒ 项名「招工合规审核」**不得**读作「管理员替雇主验收」（`DL106` 明禁）。
## §6 项⑥ 用户与权限（`admin_role*` 三表 + 十一权限键 + `resolveAdminAccess`）〔§5.178 C 等价切片 = **⑥**〕

### 6.1 已有冻结（逐条 · 条款号 / 行号 / 逐字）

- **`route-layer.spec` §6.1 单一真源**（`:1560`–`:1569`）逐字：
  > 「```
  > can_access_admin(uid) := users.is_admin OR EXISTS (SELECT 1 FROM public.admin_user_role r WHERE r.uid = :uid)
  > ```」
  > 「- **真源位置**：`migrations/0017_platform_config.sql:88-90`（DL72 逐字）… - **`users.is_admin` = 总开关** … - **旧 `permission_group` 已废弃**（DL72「不复用」，`:110`）；**旧 `isAdminAddress` 双源禁止**（`:33`）——**收敛顺序见 §6.5**。- **（v0.2）** 真源实现已落地：`backend-ts/src/database.ts` 的 `resolveAdminAccess`（两分支并行取 `users.is_admin` OR `admin_user_role`）；**权限键的代码侧真源 = `database.ts:11-23` 的 `ALL_ADMIN_PERMISSIONS`（11 键）**，与前端 `frontend/src/admin-utils.js:40-52` **逐键 0 差异**（裁定 Zang §5.77/§5.78）。」

- **`route-layer.spec` §6.2 判定顺序（写死）**（`:1571`–`:1579`）逐字（5 步）：`requireActor` 无/坏 token ⇒ **`401 AUTH_UNAUTHORIZED`**；`can_access_admin = false` ⇒ **`403 AUTH_FORBIDDEN + reason=NOT_ADMIN`**；`is_admin = true` ⇒ **放行（不再查 `requiredPermission`）**；否则须命中 `requiredPermission`（数组 = **OR**）⇒ 未命中 **`403 … reason=PERMISSION_NOT_GRANTED`**；附「已参与但无该动作权限」⇒ **`403 … reason=ACTOR_NOT_ALLOWED`**。

- **`route-layer.spec` §6.3 四张表的角色与守卫**（`:1583`–`:1594`）逐字（4 表）：`admin_role`（PK `role_key`，`0017:93`）/ `admin_permission`（PK `permission_key`，`0017:103`）/ `admin_role_permission`（PK `(role_key, permission_key)`，`0017:112`）/ `admin_user_role`（PK `(uid, role_key)`，`0017:123`）；**守卫函数 3 个**逐字「`platform_config_key_immutable`（`:161`…）、`platform_config_touch_updated`（`:181`…）、`currency_status_log_append_only`（`:192`…）」；**批 2c 实测**逐字「`admin_role*` 四表 **0→0**（**禁写种子是硬口径**…⇒ 实测只到 `404`；登记 `NOT_MEASURED`，**批 6 落地后补测**）」。

- **`route-layer.spec` §6.4 `GET /api/admin/me` 目标形状 = 6 键**（`:1596`–`:1608`）逐字：
  > 「`{uID, EVM, is_admin, permissions[], can_access_admin, preferred_admin_path}`」+「**`permissions[]` 语义（已满足）**：… **`is_admin = true` 时按「全权限」语义处理**，= **11 键全量**（`ALL_ADMIN_PERMISSIONS`），**不得**回空数组；非 admin ⇒ `[]`。」+「**登记缺口**：`0017` **只建表、不插种子**（`admin_permission` 0 行）…`admin_permission` 种子**留批 6**（见 §7-8）。」

- **★★ `route-layer.spec` §6.5 `isAdminAddress` 第三真源的收敛顺序依赖**（`:1610`–`:1618`）逐字：
  > 「**★ 顺序依赖（Zang §5.78 ④ 裁定，v0.2 显式记录）**：**收敛第三真源（删两处硬编码地址支路）必须先有「批 6 的权限种子迁移」** —— 即**必须**先保证运营管理员在库里有 `users.is_admin=true` 或 `admin_user_role` 行，**再**删代码支路。理由：收敛所需的**库写正是批 2/批 3 被禁的**…⇒ 若「先删代码支路再补数据」会把运营管理员**当场锁在后台外**。」
  > 「⇒ **本册口径**：批 3 一律**不动** `isAdminAddress`…；**批 6 = 权限种子迁移 + `isAdminAddress` 收敛 + §6.3 的 `NOT_MEASURED` 面补测**（一条线收口）。」

- **`route-layer.spec` §11.1（批 6 已落地）**（`:2911`–`:2916`）逐字：
  > 「迁移 `backend-ts/migrations/0022_admin_permission_seed.sql`（**177 行** · **纯 DML、幂等** · **已 apply** ⇒ `/health` `schema_version` 报 **`0022`**）—— 种下：`admin_permission` **11** / `admin_role` **1**（`super_admin`）/ `admin_role_permission` **11** / `admin_user_role` **1**（绑定**原第三真源地址持有人** uid `970213`…）」
  > 「**权限键三真源逐键相等**（机器判据 `all_three_equal=true`；转引 `docs/audit/p6-b6-perm-seed.md` §5-④）：后端常量 `ALL_ADMIN_PERMISSIONS`（`backend-ts/src/database.ts:11-23`，11 键） ↔ 前端兜底数组（`frontend/src/admin-utils.js:40-52`，11 键） ↔ `0022` §①（11 键）。」
  > 「**★ `isAdminAddress` 第三真源已删除、收敛为单一真源**… `src/auth.ts` 删 `DEFAULT_ADMIN_ADDRESS` / `ADMIN_EVM_ADDRESSES`（原 `:35-44`）与 `isAdminAddress()`（原 `:136-139`）；`src/database.ts:2588`（`resolveAdminAccess`，去形参 ⇒ `const bypass = user.is_admin;`）…」
  > 「**★★ 顺序依赖（不得颠倒，否则当场锁死运营管理员）**：**必须先 apply `0022`、后部署收敛代码**。反证（转引 `p6-b6-perm-seed.md` §4）：原地址持有人 uid `970213`（`is_admin=false`）在**收敛已部署、种子未 apply** 时 = **`403 NOT_ADMIN`**（实测 `200→403`）… **已遵守**。」

- **`route-layer.spec` §12.1.1 十一键逐键（现取调用面）**（`:3030`–`:3046`）逐字（含 11 键名 + 中文名 + 现取调用面）：`manage_points`（积分管理，**0 处（首次启用）**，★ 选中）/ `manage_settings`（系统设置，3 处）/ `manage_users`（用户管理，1 处）/ `manage_permissions`（权限管理，3 处）/ `review_tasks`（任务审核，5 处）/ `manage_tasks` / `publish_tasks` / `manage_rewards` / `publish_prizes` / `read_users` / `dashboard_access`（各 0 处）；结论逐字「**权限闸 = `requireAdmin(req, res, 'manage_points')`** … **零新造键**（`0022` 已 apply 的 11 键之内）」。

- **`data-layer.spec` DL72**（`:472`）逐字（权限模型重建 + 单一真源）：
  > 「**权限模型重建**：`admin_role(role_key text PK, name text, time_created)`；`admin_permission(permission_key text PK, name text)`；`admin_role_permission(role_key FK, permission_key FK, PK(role_key, permission_key))`；`users.is_admin boolean` 保留为**总开关**，角色分配用 `admin_user_role(uid FK users, role_key FK admin_role, PK(uid, role_key))`。**单一真源**：`can_access_admin = users.is_admin OR ∃ role`…」

- **`data-layer.spec` DL103**（`:608`）逐字（`requireActor` 语义）/ **DL104**（`:609`）逐字（入参白名单：`target_uid` / `is_admin` / `role_key` / `bio`，**明确禁止** `evm`、`uid`、**任何余额或积分类字段**） / **DL105**（`:610`）逐字（`requireAdmin` 语义 + 401/403 形状）/ **DL110**（`:615`）逐字（平台账户守卫 `assertUserUid()`）。

- **`data-layer.spec` DL106**（`:611`）逐字（★ 权限位集合重定义）= §5.1 已引（**新增 `audit_ledger` / `manage_currency` / `manage_commission_policy`；删 `publish_tasks` / `publish_prizes`；`manage_rewards` 改「商品合规」、`review_tasks` 改「纠纷仲裁」**）。

- **`data-layer.spec` §11.3 AUTH 域码登记表**（`:760`–`:789`）逐字：**AUTH 码关闭集恰好 2 条** = `AUTH_UNAUTHORIZED`（401）/ `AUTH_FORBIDDEN`（403）；`reason` 码表 = `ACTOR_NOT_ALLOWED` / `NOT_ADMIN` / `PERMISSION_NOT_GRANTED`（+ `reason_code_missing` 例外登记）；§11.3.3 三条写死。

- **`data-layer.spec` DL114**（`:696`）逐字：「④ **管理员写必须 `requireAdmin` + 显式权限位**（DL105；旧面 #48/#49/#53/#54 无权限位）。**任一条不满足 ⇒ 该路由不得合并**」 / **DL115**（`:697`）逐字（后台 12 条去留）。

- **`data-layer.spec` DL112**（`:622`）逐字（`audit_ledger` 的第二处引用）：见 §7.1。

- **`0022` 现取（11 键逐字）**：`backend-ts/migrations/0022_admin_permission_seed.sql:48` 逐字注释「① 权限键种子（11 键 · 逐键来自 src/database.ts:12-22 ALL_ADMIN_PERMISSIONS）」；`:50`–`:62` 逐字键名 = `dashboard_access` / `manage_tasks` / `publish_tasks` / `manage_rewards` / `publish_prizes` / `read_users` / `manage_users` / `manage_points` / `manage_permissions` / `manage_settings` / `review_tasks`（**含 11 键**，`ON CONFLICT (permission_key) DO NOTHING`）。

- **`route-layer.spec` §7-8**（`:1634`）逐字（种子留批 6）：
  > 「**★ 由 Zang §5.77 修正**：**真源放代码侧**（`src/database.ts` 的 `ALL_ADMIN_PERMISSIONS`，11 键）+ **对齐前端 `admin-utils.js`（0 差异，实测）**；`admin_permission` 表种子**留批 6（走迁移）**」

- **`route-layer.spec` §7-52**（`:1748`）逐字（A1 无键面遗留）：
  > 「**★ Zang Z1 附加**：**不动 A1 既有的无键 `requireAdmin` 面**（`src/index.ts:1402` 现取）；「**A1 无键面与新契约不一致**」（新契约要求**命名权限键** = `manage_points`；A1 现取为**无键** ⇒ 闸实际退化为 `can_access_admin`…）⇒ **登记为下一轮 spec 收口项**」

### 6.2 缺口

- **⑥-缺1（三表无「读口键集」冻结）**：`GET /api/admin/permissions`（route §1.1 #35 `:302`）/ `POST /api/admin/permissions/save`（#36）/ `delete`（#37）**已批 2c 落地**，但**响应/入参键集**三册**未冻结**（§2 前端契约冻结只覆盖部分端点）。
- **⑥-缺2（`is_admin_in_prod` 之外的运维旁路未立条）**：§11.1（`:2915`）逐字「**行为变更（有意、非回归）**：env `ADMIN_EVM_ADDRESSES` 运维旁路**移除** ⇒ 新增管理员**只能**走 `users.is_admin` 或 `admin_user_role`」—— 「新增管理员的**标准作业**（加 `admin_user_role` 行 / 置 `users.is_admin`）落在哪个端点、需何权限」三册**未立条**（`POST /api/admin/user/update` 收窄为 4 白名单字段，不含 role 分配路径细节）。
- **⑥-缺3（自锁守卫的规范面）**：`route §1.1 #36`（`:303`）逐字有「**自锁守卫**」+「`admin_permission` 存在性前置闸」，`data-layer §10.1 #40`（`:672`）逐字「**禁止**删除 `is_admin = true` 的账号的 `manage_users`」 —— **两条相邻但不一致**（一处说 `admin_permission` 存在性、一处说 `manage_users`），**规范面未统一**。
- **⑥-缺4（`audit_ledger` / `manage_currency` 无任何实现面）**：**本单现取** `grep -rn 'audit_ledger\|manage_currency\|manage_commission_policy'` ⇒ 仅命中 `data-layer.spec.md:611`（DL106）与 `:622`（DL112），**代码/迁移/前端零命中**。

### 6.3 冲突与顺序雷

- **★★ ⑥-冲1（本单最重要发现之一 · 权限键闭集两套并存）**：
  - **一套 = `DL106` 目标态**（`data-layer.spec:611`，标「**【已裁定 · Zang 终审 v0.2】**」）：**新增** `audit_ledger` / `manage_currency` / `manage_commission_policy`；**删除** `publish_tasks` / `publish_prizes`；`manage_rewards` / `review_tasks` **改语义**。
  - **另一套 = 已上线 `0022`**（`backend-ts/migrations/0022_admin_permission_seed.sql:50-62`）：11 键 = `dashboard_access` / `manage_tasks` / **`publish_tasks`** / `manage_rewards` / **`publish_prizes`** / `read_users` / `manage_users` / `manage_points` / `manage_permissions` / `manage_settings` / `review_tasks`（**无 `audit_ledger` / `manage_currency` / `manage_commission_policy`**）。
  - ⇒ **两套键集不同、且 `DL106` 标「已裁定」而 `0022` 标「已 apply」——「谁优先」三册未裁**。**影响面 = 项①（费率键）/ 项③（单位上市）/ 项④（单位上市审核）/ 项⑤（商品合规/仲裁）/ 项⑦（审计台）**。
  - **已有先例（对本批有约束力）** = `route §12.1.1`（`:3042`）逐字：新键须「**三真源 + 迁移面 4 处** ⇒ 本批 **禁改 `migrations/**` 与代码** ⇒ **不可行**」 ⇒ **批 8 只能在 `0022` 的 11 键内选键**（先例 = 管理员退款选 `manage_points`）。
- **★ ⑥-顺1（顺序雷 · 已登记的先例）**：`route §6.5`（`:1616`）/ §11.1（`:2916`）**「先 apply 权限种子、后部署收敛代码」** —— 批 8 若再动权限面（加键/改语义/改种子），**必须**沿此序列；否则「当场锁死运营管理员」。**已遵守**（§11.1 `:2916`）。
- **⑥-顺2（`DL106` 语义重定义 vs 已 apply name）**：见 ⑤-冲1（`0022` 的 `name` 未改）。
- **⑥-顺3（`DL115` 的后台新面 vs 权限键）**：`DL115`（`:697`）枚举后台新增面「权限、佣金政策、币种状态、冲正、审计台」——**其中四项所需的命名键（`manage_commission_policy` / `manage_currency` / `audit_ledger`）均未落库** ⇒ **切片前必须先解决 ⑥-冲1**。

---

## §7 项⑦ 资产与流水审计台（须与 `ledger_entry` **逐条对账**）〔§5.178 C 等价切片 = **⑦**〕

### 7.1 已有冻结（逐条 · 条款号 / 行号 / 逐字）

- **★ `ledger.spec` §11.1 判据清单（9 条 · 必须能判负）**（`:745`–`:757`）逐字（表体 9 条）：① 账户级守恒；② 快照一致性；③ 全局总量守恒；④ 币种发行量；⑤ 冻结归属守恒；⑥ 佣金池守恒；⑦ 平台收入守恒；⑧ 事件配对不变式；⑨ 平台账户非负。**判据 5 逐字**：「每个 `(uid, cid)`：`account.frozen == Σ(业务表在冻额)` … **待 P3/P4/P5 业务表落地后补 SQL**；本册只冻结「必须存在这条判据」」。

- **`ledger.spec` R87–R93**（`:775`–`:781`）逐字（对账脚本契约）：R87「上表 9 条判据全部必须实现，缺一条即视为对账功能未交付」；R88「脚本退出码与输出契约」；R89「判负能力 … **注入-还原演练**」；R90「注入方式优先序」；R91「**对账脚本禁止自动改数**（no auto-fix）」；R92「运行频率与留痕」；R93「判负能力同样适用于并发与幂等用例」。

- **`data-layer.spec` DL2**（`:89`）逐字（**审计台与用户可见面同一真源**）：
  > 「| **DL2** | **邀请关系与佣金政策的真源 = `referral` / `commission_policy`；佣金发放的真源 = `ledger_entry`（`kind='commission'` + `ref_type='commission_payout'` + `ref_id`=同一 `job_id`）。****不建 `commission_payout` 表**… | … | 审计台与用户可见面**同一真源**，避免「后台数字与用户账单不一致」 |」

- **`data-layer.spec` DL112**（`:622`）逐字（`audit_ledger` 读他人余额）：
  > 「**`GET /api/user/points` 的 `uid` 参数**：**默认只能查自己**（省略参数 = 自己）；查他人**仅管理员**（`audit_ledger`），且必须走审计语义（返回 `{cid, balance, frozen}` 而不含隐私）」

- **`data-layer.spec` DL146⑤**（`:698`）逐字（审计台 = P6）：
  > 「⑤ **必须进审计台**，列 **P6**（P3 只开写口，审计台能力在 P6）。**违反任一条 ⇒ 该路由不得合并。**」

- **`data-layer.spec` DL115**（`:697`）逐字（审计台 = 后台新增面之一）：已引（§5.1）。

- **`data-layer.spec` §10.1 #54**（`:686`）逐字：
  > 「| 54 | `POST /api/admin/points/adjust` | **重写** | 走 `ledger_post_event`（`mint`/`burn`，`ops:` 键）；**✅ v0.2（C3 ③）：确认保留但锁死**…；审计台列 **P6** | **P3**（写口）+ **P6**（审计台） |」

- **`route-layer.spec` §11.2（`0023` 审计表 + 日累计）**（`:2918`–`:2926`）逐字（**审计台的第一张底表**）：`public.admin_ops_audit_log`（**15 列**）+ append-only 触发器 + `public.admin_points_adjust_post_event(jsonb)`；逐字「**资金分录与审计行同语句 ⇒ 同生同灭**」、「**★★ 唯一约束 `UNIQUE(idempotency_key, result)`**」、「**live 线上实证 11/11** … 成功路径 ⇒ **200** + 资金分录 txid **277** 与审计行 `log_id 5` / `txid 277` **逐字相同 ⇒ 两表行级同源**」。

- **`route-layer.spec` §12.13（`0024` 已 apply）**（`:3577`）逐字（**第二张审计底表**）：
  > 「| **F-0024-1** | **迁移 `0024` 已 apply** | `schema_version = 0024`… | **F-0024-3** | **审计表 `admin_refund_audit_log` 在场**…」

- **★★ `route-layer.spec` §7-53**（`:1749`）逐字（**审计面分裂 · 待 P6 审计台立项时定**）：
  > 「**★ Zang Z2 登记**：变体 B（新建表）的已知代价 = 「谁对用户资产做过什么」需**扫两张表** ⇒ **P6 审计台立项时定**是否**合并为通用表 / 视图**；**本批不扩面**（缓解手段 = **同前缀命名** + spec/data-layer **双登记** + 检索视图（可选））」

- **`route-layer.spec` §12.0 只读取证**（`:2967`）逐字（审计取证的**既有范式**）：
  > 「本节 = **本册现取、非转引**；产物 = `.p6jing-artifacts/p6jing-00-probe.<run>.json`，run-tagged；探针 = `.p6jing-artifacts/p6jing-00-probe.cjs`，**只 SELECT / 只读目录，零 DDL / 零 DML / 零事务写**」

- **`ledger.spec` R108**（`:913`）逐字（500 必须告警）：「`500` 类错误（#29 / #30 / #31 / #32）**必须触发告警**」 / **R107**（`:912`）逐字（统一错误响应结构）。

### 7.2 缺口（★ 本项 = 「逐条对账」口径缺口）

- **⑦-缺1（★★ AC 的「逐条对账」无规范条款）**：三册有 **`ledger §11.1` 的 9 条账本自洽判据** 与 **`DL2`「同一真源」**，但 **无一条**把「**审计台读数** ↔ **`ledger_entry`** 的**逐条对账**」写成可判负条款。`DL146⑤` 只说「**必须进审计台**」，**未给对账 SQL / 键集 / 判据**。⇒ `master-plan §5.178 D.2` 逐字要求「审计台读数必须与 `ledger_entry` **逐条对得上**（给对账 SQL 与零差异读数）」——**该交付物在规范面是空的**。
- **⑦-缺2（审计台路由 = 零注册）**：**本单现取**注册点 = **68**（`route §1.14` `:677`），**无任何审计台路径**（`grep` 三册除 `DL106`/`DL112` 的键名外无路由条文）⇒ 审计台是**全新面**（新路径 + 新许可键 + 新键集）。
- **⑦-缺3（审计台读口的键集未冻结）**：无「审计台响应形状 / 分页 / 对账列」条文。
- **⑦-缺4（两张底表 vs 逐条对账）**：`0023` 的 `admin_ops_audit_log` 有 `txid` 列（逐字上引「资金分录 txid 277 与审计行 txid 277 逐字相同」）⇒ **可与 `ledger_entry` 逐条对**；但 **`0024` 的 `admin_refund_audit_log` 的列**（`route §12.11.2` 12 语义列 + `log_id`）**是否含 `txid`** —— **本单只读到 §12.11.2 的列名清单转引，未逐列复核**（见 §10 `NOT_MEASURED`）⇒ **对账能力未证**。

### 7.3 冲突与顺序雷

- **⑦-冲1（审计面分裂 · 先决裁定缺位）**：`route §7-53`（`:1749`）逐字把「是否合并为通用表/视图」**留给 P6 审计台立项时定** ⇒ **批 8 项⑦ 的第一动作必须是该裁定**（否则审计台要「扫两张表」）。
- **⑦-顺1（改已 apply 审计表被禁）**：`route §12.11.2 / Z2 依据③`（`:3284`）逐字「**复用须 `CREATE OR REPLACE` 改 **已 apply** 函数体 ⇒ 作废 `0023` 质检字节锚**」 ⇒ **不得**就地改 `0023`/`0024` 的表或函数体；统一审计台须**走视图 / 检索层**（缓解手段逐字含「检索视图（可选）」）。
- **⑦-顺2（审计台与项⑥ 权限键）**：`DL106` 给审计台键 `audit_ledger`（未落库）⇒ 审计台若落地，**须先解决 ⑥-冲1**（先例 = 退款面选 `manage_points`）。
- **⑦-顺3（判据 5 的 SQL 仍未补）**：`ledger §11.1 判据 5`（`:753`）逐字「**待 P3/P4/P5 业务表落地后补 SQL**」；`DL4`（`:91`）逐字「P3 起判据 5 **必须有 SQL**」 ⇒ 「逐条对账」若含**冻结归属**（挂单未成交 + 招工托管 + …），**判据 5 的 SQL 是前置**（当前状态未取证，见 §10）。
## §8 项⑧ `app_config` 管理（含「**合法键清单 + 写入门禁**」）〔§5.178 C 等价切片 = **①**（**地基**）〕

### 8.1 已有冻结（逐条 · 条款号 / 行号 / 逐字）

- **`data-layer.spec` DL71（`app_config` 重建 · DDL 权威）**（`:471`）逐字：
  > 「**`app_config` 重建（DDL 提案）**：`app_config(key text PRIMARY KEY, value jsonb NOT NULL, updated_by bigint NOT NULL, time_updated timestamptz NOT NULL DEFAULT now())` —— **单列 `key/value`**、**无 `privacy` 列**、**禁存任何余额**（DL3）。⚠️ **费率键不在此表权威**（真源 = `commission_policy.fee_rate_bp`，§5.20 #3）：若历史键存在，**保留但标注「不参与计费」**（不得删键，`commission.spec` §4.4）。」
  > 〔**v0.6 加注 · 原文不删**〕逐字：「**① 本条逐列 DDL = 权威** … **② `value` 的类型域 = `jsonb`（任意 jsonb）** … `0017` 现实现附加 `CONSTRAINT app_config_value_is_container CHECK (jsonb_typeof(value) IN ('object','array'))` ⇒ 属**收窄** … **若将来需要标量型键**（数字 / 字符串），**必须新开 `DL` 规则**并**由新迁移**放宽，**不得就地改 `0017`**（`DL7`）。**③ `DL3`（禁存余额）在本表上的实际强制手段 = 应用层 + 审查，DB 层不兜底** … 唯一守卫 = **code review 硬项** … **④ 连带**：本表**不适用 `DL75` 三件套**（见 `DL156` 的豁免关闭集）；`app_config` 的 uid 列（`updated_by`）**不加 FK** … 本条落点补充 = 路由层写口 `POST /api/admin/settings` + code review 清单 + `DL3` 行内指针注。」

- **`data-layer.spec` DL156②**（`:482`）逐字（豁免理由 · **无键清单**）：
  > 「**② `app_config`（键值配置）** —— `key` ＝ **PK ＝ 天然幂等键**（写入幂等由 PK 唯一性 + 路由层 `ops:<admin_uid>:setting:<key>` 行为键承担…）；**无账本事件**（配置不产生分录）；**无 `create_key` / `ledger_event_keys`**；**无 `time_created`** … `time_updated` 保留且由 `BEFORE UPDATE` 触发器刷新」 + 「**(a) apply-time 反断言（必留）** … `0017` 现实现即此：`app_config` 另禁 `privacy`」 + 「**(b) 豁免须逐条登记、不得默认继承**」。

- **`data-layer.spec` DL3**（`:90`）逐字（禁存余额 · 无 DB 兜底）：
  > 「**业务表不得持有余额列** … **〔v0.6 加注〕**：本条的**实际强制手段 = 应用层 + 审查，DB 层不兜底** —— `0017` 已实测：`app_config` 上唯一的类型约束是容器型 `CHECK (jsonb_typeof(value) IN ('object','array'))`，它**挡不住** `{"balance":100}`（对象**也是**容器）… **若将来有人要加余额类列** —— 属**违反本条**，须**新开 `DL` 规则**并同步迁移」

- **`data-layer.spec` DL76①**（`:483`）逐字（可变性 + **允许 DELETE**）：
  > 「**① `app_config`（`0017`）= 可变** —— **键列 `key` 不可变**（PK 即身份；改键 = 删旧行 + 插新行），`value` / `updated_by` 可改，**`time_updated` 由 `BEFORE UPDATE` 触发器刷新** …；**允许 `DELETE`**（配置项废弃 = 删行，无状态位替代）—— 与 `DL79`「业务表禁 `DELETE`」**不冲突**」

- **`data-layer.spec` DL78**（`:485`）逐字（`updated_by` 不加 FK）：〔v0.6 加注〕「**「uid 列」的定义**收窄 = 不含 `app_config.updated_by`** —— 该列**不算**本条所指的「新表的 uid 列」⇒ **不加 FK 到 `users(uid)`**」。

- **`data-layer.spec` DL36**（`:329`）逐字（**`ops:` 幂等键 · 后台写**）：
  > 「**后台写路由一律带 `ops:` 幂等键**（R49 前缀表）与**操作人留痕**：`ops:<admin_uid>:<action>:<business_id>`。**无键的后台写请求 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`**。」

- **`data-layer.spec` §3.1 #12**（`:179`）逐字（保留 + 费率键不参与计费）：
  > 「| 12 | `app_config` | 懒 DDL 建出（0 行） | `app_config`（**0017** 正式落盘） | **保留，须由迁移建回** | 平台设置仍是后台需要的一块（`master-plan` §4 判「保留」）；⚠️ **费率真源自 P2 起是 `commission_policy.fee_rate_bp`**，`app_config` 的费率键**不再参与计费**（§5.20 #3） |」

- **`data-layer.spec` §4.1 #35 / #36**（`:276`/`:277`）逐字（目标态）：
  > 「| 35 | `GET` | `/api/admin/settings` | 保留（平台运维） | **采纳** | 数据源 = `app_config`…；**响应必须标注「费率不在本表」**（真源 = `commission_policy`，§5.20 #3） |」
  > 「| 36 | `POST` | `/api/admin/settings` | 保留（平台运维） | **修正** | 修正点：必须带 `ops:<admin_uid>:<action>:<key>` 幂等键（DL36）+ 审计留痕；**禁止**在本入口写费率键（费率走 `commission_policy` 插行，CR23/CR25） |」

- **`data-layer.spec` §10.1 #35 / #36**（`:667`/`:668`）逐字（★ **「白名单键」唯一出处**）：
  > 「| 35 | `GET /api/admin/settings` | **保留** | 读 `app_config`（DL71）；**费率键标注「不参与计费」** | **P3** |」
  > 「| 36 | `POST /api/admin/settings` | **重写（收窄）** | 只写 `app_config` 白名单键；**禁止**写费率/余额（DL33/DL3） | **P3** |」

- **`data-layer.spec` §12.1 #5**（`:820`）逐字（费率键处置已裁）：
  > 「| 5 | **`app_config` 是否保留费率类历史键**（真源 = `commission_policy`，§5.20 #3） | **保留键但不参与计费**（不得删键） | Zang | 后台 settings（P3） |」

- **`route-layer.spec` §1.1 #32 / #33**（`:299`/`:300`）逐字（写口形态 + 已落地）：
  > 「| 32 | `GET /api/admin/settings` **:724** | **【保留·改接】** | `app_config`（key/value，**无 privacy 列**）；**响应必须在 `message` 标注「费率不在本表」**（**不改 data 键集**） | … **批 2c 已落地**（`p4-b2c-admin-write.md §3.1 T04`） |」
  > 「| 33 | `POST /api/admin/settings` **:737** | **【保留·改接】** | `app_config` upsert（**补 `updated_by`**）；`ops:<admin_uid>:<action>:<key>` 键（**请求侧强校验、不落库**…）；**禁写费率键** | `DL36`（`data-layer.spec.md:326`）；CR23/CR25；**批 2c 已落地**（T08/T09/T11） |」

- **`route-layer.spec` §7-14**（`:1640`）逐字（`ops:` 键语义）：
  > 「**Zang §5.78 ②**：按 `DL36` 落为**请求侧强校验、不落库**（`ops:` 前缀；缺失 ⇒ `400`）」

- **`route-layer.spec` §1.4 F8**（`:380`）逐字（**已落地行为**）：
  > 「| F8 | **`GET /api/admin/settings`** 写→读回同值 | `POST`（带 `ops:` 键）⇒ 200（`app_config` 0→1）；读回 `data.siteName="p4b2c:siteA"`；缺 `ops:` 键 ⇒ **400 `LEDGER_IDEMPOTENCY_KEY_REQUIRED`**；带费率键 ⇒ **400 `FEE_RATE_KEY_NOT_IN_APP_CONFIG`** | `p4-b2c-admin-write.md §3.1 T08-T11` |」

- **`route-layer.spec` §7-16**（`:1642`）逐字（★ **键清单不存在 · 项⑧立项依据**）：
  > 「**登记（批 6 配置面规格）**：「**`app_config` 合法键清单 / 写入门禁**」（现在**无键名枚举** ⇒ **硬造即自拟**）⇒ 归**批 6 配置面**。」
  同条逐字引 `0017` 表注释：「⚠️ **费率键不在此表权威**（真源 = `commission_policy.fee_rate_bp`，§5.20 #3）：**若历史键存在 ⇒ 保留但标注「不参与计费」、不得删键**」（`backend-ts/migrations/0017_platform_config.sql:81`）。

- **`route-layer.spec` §7-23**（`:1649`）逐字（**不得硬造键名**）：
  > 「改「从平台配置取数」归**批 6 配置面**（真源键名待定、**不得从 `app_config` 硬造键名**）」

### 8.2 缺口

- **★ ⑧-缺1（合法键清单 = 三册零覆盖 · 本项核心）**：**三册无任何 `app_config` 键名枚举**。`DL71` 只给 **DDL**、不给键集；`DL156②` 只给**豁免理由**；`#36` 只说「只写 `app_config` **白名单键**」而**该白名单本身不存在**；`route §7-16` **逐字承认**「现在**无键名枚举** ⇒ **硬造即自拟**」。⇒ **项⑧ 的核心交付物（键清单 + 写入门禁）在规范面 = 完全空白**。
- **⑧-缺2（门禁机制）**：三册对 `app_config` 写入的**已冻结约束**只有两条：① `ops:` 键**请求侧强校验、不落库**（`DL36` / `route §7-14`）；② 「**禁写费率/余额**」（`data-layer #36` / `DL3`）。**无「白名单拒绝未知键」的机制条文**（当前 `0017` 只有容器型 CHECK，逐字「DB 层**不兜底**」）。
- **⑧-缺3（键的类型域 / 命名风格）**：`DL71 v0.6 加注②` 逐字「若将来需要**标量型键**（数字 / 字符串），**必须新开 `DL` 规则**并**由新迁移**放宽」 ⇒ **标量键（如数值型配置）当前不可写**；**键名风格/前缀**三册**未立条**。
- **⑧-缺4（读口键集）**：`GET /api/admin/settings`（#32）**响应键集未冻结**（只要求 `message` 标注「费率不在本表」且「不改 data 键集」）。

### 8.3 冲突与顺序雷

- **★ ⑧-冲1（费率键门禁方向 · 已裁 vs 已上线）**：同 ①-冲2 —— `route §7-16` **已定 = 删除黑名单（改「命名提示」非硬拒）**；**但** `data-layer §10.1 #36`（`:668`）仍写「**禁止**写费率/余额」、`route §1.1 #33`（`:300`）仍写「**禁写费率键**」、`§1.4 F8`（`:380`）实测 **`400 FEE_RATE_KEY_NOT_IN_APP_CONFIG`**、代码仍在（`admin-service.ts:89`/`:101`、`index.ts:1159`）⇒ **门禁「硬拒 vs 提示」两面并存**。
- **⑧-冲2（键的删除权 · 两册立场张力）**：`data-layer DL76①`（`:483`）逐字「**允许 `DELETE`**（配置项废弃 = 删行）」 **vs** `0017:81` 表注释（`route §7-16` 逐字引）「**不得删键**」（费率键）；`data-layer §12.1 #5`（`:820`）亦裁「**保留键但不参与计费**（不得删键）」 ⇒ **「配置项可删 / 费率键不可删」须在门禁里区分**（否则一刀切必违其一）。
- **⑧-冲3（门禁无 DB 兜底）**：`DL71 v0.6 加注③`（`:471`）逐字「唯一守卫 = **code review 硬项**」+ `DL3`（`:90`）逐字「DB 层不兜底」 ⇒ 若批 8 要「**写入门禁**」**为可判负的门**，**须自行在应用层立门**（三册未指定载体）。
- **★ ⑧-顺1（项⑧ = 地基 · 必须第一批）**：`master-plan §5.178 C` 逐字「① **`app_config` 管理 + 合法键清单/写入门禁**（**其它配置面的地基**；已登记为批 6 规格）」；且 `route §7-16` 与 `§7-23` **两处**都把「配置面规格/真源键名」**登记归批 6（= 本批 8）** ⇒ **项⑧ 未定，则项①（费率载体）与项③（保证金下限载体）无法落地**。

---

## §9 跨项冲突与顺序雷总表

| # | 冲突 / 顺序雷 | 出处（册 / 行号） | 影响项 | 三册是否已有裁定 |
|--:|---|---|---|---|
| **C-1** | **权限键闭集两套并存**：`DL106` 目标态（新增 `audit_ledger` / `manage_currency` / `manage_commission_policy`；删 `publish_tasks` / `publish_prizes`）**vs** 已 apply `0022` 的 11 键（含 `publish_tasks` / `publish_prizes`） | `data-layer.spec:611` vs `0022:50-62` + `route-layer.spec:2913`/`:3030` | ①③④⑤⑥⑦ | **无对「谁优先」的裁定**；仅有先例「新键不可行」（`route-layer.spec:3042`） |
| **C-2** | **顺序雷（已登记）**：收敛 `isAdminAddress` 第三真源**必须先 apply 权限种子**，否则当场锁死运营管理员 | `route-layer.spec` §6.5 `:1616` / §11.1 `:2916` | ⑥（及其它动权限面的项） | **已裁定**（Zang §5.78 ④）；**已遵守** |
| **C-3** | **费率键黑名单**：§7-16「删除黑名单、非硬拒」**vs** #33「禁写费率键」+ F8 实测 400 + 代码仍在 | `route-layer.spec:1642` / `:300` / `:380`；`admin-service.ts:89`、`index.ts:1159` | ①②⑧ | §7-16 已裁（删）；**但已上线行为未跟** |
| **C-4** | **审计面分裂**：两张审计表（`admin_ops_audit_log` + `admin_refund_audit_log`），是否合并**留给 P6 审计台立项时定** | `route-layer.spec` §7-53 `:1749` | ⑦ | **未裁**（明确留给本批） |
| **C-5** | **项名雷**：「上市保证金规则（`listing_deposit` / `hold_release` / `hold_forfeit`）」—— 后两者与保证金无涉，`hold_forfeit` 未启用 | `ledger.spec:323`/`:327`；`data-layer.spec:536`；`route-layer.spec:1648` | ③ | **已裁定**（Zang §5.81）；项名与裁定相反 |
| **C-6** | **账龄分档载体已废**：`R5` 以 `commission_payout.time_created` 为准 **vs** 「不建 `commission_payout` 表」 | `ledger.spec:111` vs `ledger.spec:1772` / `data-layer.spec:89` | ② | **未裁**（R5 未就地更正） |
| **C-7** | **注册点 68 约束**：项⑤ 两条 P6 新路径（takedown / arbitration）落地**必增注册点** | `route-layer.spec` §1.14 `:677`；`data-layer.spec:288`/`:679` | ⑤（及任何新路径项） | 基线已裁（68）；**「复用 vs 新路径」未裁** |
| **C-8** | **A1 无键面与新契约不符**：A1 现取「无键 `requireAdmin`」⇒ 闸退化 `can_access_admin` | `route-layer.spec` §7-52 `:1748`；`src/index.ts:1402` | ⑥⑦ | **已登记**（待下一轮 spec 收口） |
| **C-9** | **权限键语义重定义未落库**：`DL106` 要求 `manage_rewards`→「商品合规」、`review_tasks`→「纠纷仲裁」；`0022` 的 name 未改 | `data-layer.spec:611` vs `0022:50-62` | ⑤⑥ | **未裁**（键名同、语义差） |
| **C-10** | **`app_config` 键删除权**：`DL76①`「允许 DELETE」**vs** `0017:81`「不得删键」/`§12.1 #5` | `data-layer.spec:483` vs `route-layer.spec:1642`（引 `0017:81`） | ⑧①③ | 分场景已裁（费率键保留）；**门禁须区分** |
| **C-11** | **项⑧ 是地基**：项①（费率载体）与项③（保证金下限载体）**都依赖**项⑧ 的键清单/门禁 | `route-layer.spec:1642` / `:1649`；`master-plan §5.178 C` | ⑧→①③ | **已登记**（归批 6 = 本批） |
| **C-12** | **平台收入只进不出**：`platform_withdraw` 未获批准 ⇒ 后台**不得**提供「提取平台收入」按钮 | `ledger.spec` §13.3 R103 `:847` | ③ | **已裁**（待 Kevin 是否需提取动作） |

> **★ C-1 对切片的直接约束**：`route-layer.spec §12.1.1`（`:3042`）已立先例 —— **批 8 只能在 `0022` 的 11 键内选键**（新键须「三真源 + 迁移面 4 处」同批改 ⇒ 本批禁改 `migrations/**` ⇒ 不可行）。**故：① 费率写口用 `manage_settings`；⑦ 审计台 / ① 若无键可用 ⇒ 须先请 Zang 裁「用哪个既有键」**（先例 = 退款面选 `manage_points`）。
## §10 未测项（`NOT_MEASURED` · 逐条写原因 · **禁填 0 / 空**）

> **口径**：本单为**严格只读规范盘点**，**零库连接、零 HTTP、零套件、零代码改动** ⇒ 凡涉库面/HTTP 面的终态读数**一律为转引**，**不据转引下「已实测」断言**。

| # | 未测项 | 原因 | 本单已给的最接近读数 |
|--:|---|---|---|
| **N-1** | 「`0022` / `0023` / `0024` **已 apply**」与 `schema_version` / 库内行数 / 表列数 / `txid 277` / 夹具 18 行 | 本单**零库连接**（派单硬口径：只读 spec，不连库） | **转引** `route-layer.spec` §11.1/§11.2/§12.13（`:2913`/`:2920`/`:3577`）与 `data-layer.spec` §20（`:1056`–`:1063`）**逐字** |
| **N-2** | `commission_policy` 现状行数（种子 1 + 夹具 18）与 `policy_id` 20–37 | 同上（零库连接） | **转引** `data-layer.spec` `DL152`（`:997`）逐字 |
| **N-3** | `docs/audit/p8-p6-recon.md`（**Kong 侦察单**产物）的内容 | 本单**开工时** `ls docs/audit/` 未见该文件；**收笔时现取** `git status --porcelain` ⇒ 该文件**已落盘为 untracked** ⇒ 但本单**未读、未交叉复核**（两单文件面不相交，派单明定） | **不适用**（本单未读、未引；只登记其**曾落盘**这一事实） |
| **N-4** | 前端 `frontend/src/pages/admin/**` 现状（页面/取数/键集） | **不属本单**（派单明确归 Kong 侦察单） | **不适用** |
| **N-5** | `docs/commission.spec.md` v0.2 的**权重矩阵数值 / 账龄分档算式** | **不在三册**（`ledger.spec §0.2` `:58` 明写归 P2 spec；`route-layer §0.1 I3` `:210` 只给指向） | **指向已给**（`commission.spec.md` v0.2：`CR*` / §5.3 / §6.2 / §13）；**本单未逐条引** |
| **N-6** | `0024` 的 `admin_refund_audit_log` **逐列是否含 `txid`**（决定能否与 `ledger_entry` 逐条对账） | 本单只读到 `route-layer.spec` §12.11.2（`:3293`）的**列名转引**，**未逐列复核**；且零库连接 | **转引** §12.11.2「**12 语义列 + 1 结构列（共 13 列）**」 |
| **N-7** | `ledger.spec §11.1 判据 5`（冻结归属守恒）的 **SQL 是否已补** | 三册只写「**待 P3/P4/P5 业务表落地后补 SQL**」（`:753`）；本单零库连接、零脚本 | **转引** `ledger.spec:753` / `DL4`（`data-layer.spec:91`） |
| **N-8** | 项④「自建单位审核闸」是否已有**代码实现** | **不属三册**；本单只读规范面（派单 = 规范盘点） | **规范面 = 零覆盖**（§4.2 ④-缺1）；**代码面未核** |
| **N-9** | `app_config` 现有键行（键名/值） | 零库连接 | **转引** `route-layer.spec §1.4 F8`（`:380`）的「`data.siteName="p4b2c:siteA"`」（批 2c 时点读数） |
| **N-10** | 三册 md5 / 行数 | **本单已实测**（§0.1） | 非未测项，列此备忘 |

---

## §11 现取方法与命令（可复算）

> 全部为**只读命令**；本单**未**做任何写库 / 写码 / 写 spec 操作。

| # | 面 | 命令（逐字） | 本单现取结果 |
|--:|---|---|---|
| 1 | 三册指纹 | `wc -l <f>` / `md5 -q <f>` | §0.1 表（3840 / 1070 / 2028；三 md5 逐条） |
| 2 | 注册点 | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | **68** |
| 3 | `index.ts` 行数 | `wc -l < backend-ts/src/index.ts` | **2060** |
| 4 | 权限键（三真源） | `grep -n 'permission_key' backend-ts/migrations/0022_admin_permission_seed.sql` | `:50`–`:62`（11 键） |
| 5 | 三键是否存在 | `grep -rn 'audit_ledger\|manage_currency\|manage_commission_policy' docs/*.spec.md backend-ts/src/ frontend/src/` | **仅 `data-layer.spec:611`/`:622`；代码面零命中** |
| 6 | 费率键黑名单 | `grep -rn 'FEE_RATE_KEY' docs/*.spec.md backend-ts/src/*.ts` | `route-layer.spec:1642`/`:300`/`:380`；`admin-service.ts:89`/`:101`；`index.ts:1159` |
| 7 | 八项条文定位 | `grep -n '<关键词>' docs/{route-layer,data-layer,ledger}.spec.md`（关键词：`fee_rate_bp` / `weights_bp` / `listing_deposit` / `hold_forfeit` / `hold_release` / 自建单位 / 审核 / 合规 / 审计台 / `app_config`） | 逐项见 §1–§8 各条行号 |
| 8 | 逐字引文 | `read_file(path, offset, limit)` | §1–§8 各条「逐字」块 |
| 9 | 迁移清单 | `ls backend-ts/migrations/` | `0001`–`0017` + `0019`–`0024`（**无 `0018`**） |

> **★ 行号漂移声明**：`backend-ts/src/index.ts` **正被并发单元改写**（`route-layer.spec §1.14` `:685` 逐字「**并发写者与「两次现取」**」：T1 = 1981 / T2 = 2047）；本单现取 = **2060 行 / 注册点 68** ⇒ **行号锚点随写者漂移 ⇒ 一律以现盘为准**（`route-layer.spec §0.2-9`「任何逐行断言前必须现取」）。

---

## §12 纪律自检

- **唯一写盘** = 本件 `docs/audit/p8-p6-spec-inventory.md`（**先落骨架后逐节回填**，共 6 次写入）。
- **未改**任何 `.spec.md`；**未建快照**（`docs/versions/**` 未动）；**未碰** `docs/seafood.master-plan.md`（只读）、`docs/qa/**`、`docs/audit/**` 既有件。
- **未** `git add` / `commit` / `push`；**未** `npm install`；**未碰 / 未打印** `.env*`。
- **未** `pkill -f` / `killall`；**未启停** 5787 / 5788。
- **未测项**（§10）**逐条写原因**，**无一处填 0 或空**。
- **逐字引文**均带**册 / 条款号 / 行号**；凡转引**逐条标注**（§0.4 / §10）。
- **本单未发明任何路径名 / 行号 / 数值 / 日期 / 规格值**；所有结论可回原文复核。

---

> **回执摘要（交 Zang 切片用）**：八项中 —— **① 费率配置 / ② 返佣权重矩阵 / ⑤ 商品·招工合规审核 / ⑦ 审计台 = 「部分覆盖」**（有相邻冻结条文，核心动作缺）；**④ 自建单位审核 / ⑧ `app_config` 合法键清单+写入门禁 = 「零覆盖」**（三册查无实据）；**③ 上市保证金规则 / ⑥ 用户与权限 = 「已冻结但与项名/现状冲突」**。
> **切片前必先裁的 4 件**：**C-1**（权限键闭集两套 · 影响 6 项）、**C-4**（审计面是否合并）、**C-5**（项③ 命名雷 · 不得复活已删语义）、**C-11**（项⑧ 为地基 ⇒ 第一批）。
