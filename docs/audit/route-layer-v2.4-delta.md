# delta 件 · `docs/route-layer.spec.md` **v2.3 → v2.4**（批 8 第 2 片（8②）契约冻结：费率配置 + 返佣权重矩阵（合片））

- **单号** = **JING-SPEC-B8-2**｜**角色** = **Jing（Specifier · 制度员）**｜**日期** = **2026-10-02**（CST / UTC+08:00）
- **依据** = 批 8 第 2 片（8②）派单 + **Zang 已裁**：`R-8-1`（只许在既有 11 权限键内选键）/ `R-8-6`（返佣行为验收只许 DB 直造 + 读库；**不得为验收新增路由**；运营后台读口 = **功能需求**、允许新增、须在本册冻结并登记注册点 68 → N）/ 「**真生效**」判据（P6 的 AC 原文：「**配置改动必须被业务层真实读取生效、非只在后台显示**」）/ `R-8-14`（`§18.5` 的锚点补版本基线声明）。
- **本单只写三个文件**：`docs/route-layer.spec.md`（**就地升 v2.4**）｜`docs/versions/route-layer.spec.v2.4.md`（**新建快照**）｜`docs/audit/route-layer-v2.4-delta.md`（**本件**）。
- **★ 姊妹册 `docs/data-layer.spec.md` = 本单判「无须动」** ⇒ **不升 v0.12 / 不建快照 / 不建 delta**（理由**逐字**见 **§D7**）。
- **硬口径遵守**：*只追加*（各册 `git diff --numstat` **删除列 = 0**）｜*未碰*：代码（`backend-ts/**` / `frontend/**` 只读）· `migrations/**` · `docs/seafood.master-plan.md` · `docs/qa/**` · `docs/audit/**` 既有件 · `docs/design/**` · `docs/ledger.spec.md` · **`docs/commission.spec.md`（真源册 · 只读）**｜*无 `git add/commit/push`* · *未 `npm install`* · *未碰/打印 `.env*`* · *未 `pkill -f` / `killall`* · *未启停 5787/5788*。

---

## §D0 报数（口径 · 命令 · 读数 · 全部本单现取）

| 项 | 命令（逐字） | 读数 |
|---|---|---|
| **只追加（删除列）** | `git diff --numstat docs/route-layer.spec.md` | **`337	0`** ⇒ **删除列 = 0** ✅ |
| **姊妹册零改动** | `git diff --numstat docs/data-layer.spec.md` | **无输出**（**该文件不在 diff 列表** ⇒ 未动）✅ |
| 行数（改前 → 改后） | `wc -l docs/route-layer.spec.md` | **4253 → 4589**（净增 **+336** 行 / **零删除**） |
| 字节（改前 → 改后） | `wc -c docs/route-layer.spec.md` | **910180 → 975847**（**改后 = 快照 `v2.4.md` 同值**） |
| md5（改前） | `md5 -q docs/route-layer.spec.md`（开工时） | **`8965216101d970173a5311a41a5dd688`**（**= 派单给定 `89652161…` 对锚逐字相符** ✅） |
| md5（改后 / 快照） | `md5 -q docs/route-layer.spec.md` / `md5 -q docs/versions/route-layer.spec.v2.4.md` | **`f518221361e36c5492df198abdae5c2d`（两值相同）** |
| **快照逐字节相同** | `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.4.md` | **退出码 0**（identical）✅ |
| **旧快照零改动** | `ls docs/versions/ \| grep -c '^route-layer.spec.v'` / `... '^data-layer.spec.v'` | **24**（**改前 23 + 本单新建 1**）/ **11**（**未动**）✅；`git status --porcelain` 现取 = **仅** ` M docs/route-layer.spec.md` + `?? docs/versions/route-layer.spec.v2.4.md`（**既有快照未出现在改动列表**）|
| 注册点（开工基线） | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | **68**（**本单现取**；`wc -l backend-ts/src/index.ts` = **2105**） |
| 真源册 | `wc -c docs/commission.spec.md` | **226740**（**只读 · 未改**） |

> **★ 口径声明**：以上全部为**本单现取**；**未转引**任何批次报告。**改后 md5 不内嵌进本册正文**（承本册既有惯例「指纹自证：本册不内嵌自身 md5，防自指」）。

---

## §D1 对照表（逐条 delta → 依据 → 落点 → 判据）

| # | delta（本单交付） | 依据（逐字） | 落点（本册） | 判据 / 可判负 |
|--:|---|---|---|---|
| **D1-①** | **读写口契约** | 派单 ①；`R-8-6` 逐字 | **§19.2**（(a) 写口 / (b) 读口 / (c) 取数 / (d) 形态 / (e) 功能需求 / (f) 键集不动） | 写口路径 / 闸 / 真写库点 / `ops:` 现取四项**逐字带锚**；读口**冻结 5 项**（路径 / 闸 / 注册点 / 形状 / `data` 键集） |
| **D1-②** | **新增 admin 读口注册点登记（68 → 69）** | **`R-8-6` 逐字**（「必须在本册冻结并登记注册点 68 → N」） | **§19.2(b)** + **`§7-70`** | 登记形态 = 「**68（本单现取）→ 69（落地后）**」；**登记值 69 属预期**（`NOT_MEASURED`，§19.7-2） |
| **D2-①** | **权限键映射（先现取逐字十一键，再映射）** | 派单 ②；**`R-8-1` 逐字** | **§19.3**（(a) 十一键三真源 / (b) 映射表） | **零新增键 / 零删除键**；映射表**无「停报」行**（读写两口 + 两页 = `manage_settings`，+ `dashboard_access` 进面板） |
| **D3-①** | **「真生效」四段判据入册** | 派单 ③；**「真生效」判据（P6 的 AC 原文）** | **§19.4**（(a) 模板 / (b) `fee_rate_bp` / (c) `weights_bp` / (d) 总判据 / (e) 执行面 / (f) 待给） | 四段 = ①后台写 → ②**库内落值（表/列）** → ③**业务读口取数（`文件:行`）** → ④**行为随之（改动前后两读数）**；**每段带判负**；**⑤ 段齐全负判**（只验「后台能存」⇒ 判负） |
| **D4-①** | **后台页数据契约与四语文案面** | 派单 ④ | **§19.5** + **`§7-71`** | 两页字段 = 现取 `CommissionPolicy` 8 键派生；**四语必须逐键齐**；**禁工程口径泄漏六类 + 正则判负 + 负对照** |
| **D5-①** | **`R-8-14` 基线声明（攒批项）** | **`R-8-14` 逐字** | **§19.6** + **补注块 ㊱** | **`§18.5` / `§18.1` 行锚 = v2.2 基线（4030 行）**；**逐条漂移对照**（`+12` / `+56` / 「不复现」）+ **可判负四断言** |
| **D6-①** | **`ops:` 幂等键缺口登记** | 本单现取发现（§19.1 末行） | **`§7-69`** + §19.2(a) + §19.5(f) + §19.8 `I-4` | 现取 = **无**（`grep -n 'ops:'` 命中 7 处、**无 `:1999` 区**；`resolveAdminOpsKey` 调用 5 处、**无 commission_policy**） |
| **D7-①** | **`data-layer.spec` 判「无须动」** | 本单判定 | **§D7**（本件） | 逐条理由 + **诚实边界** |
| **D8-①** | **变更记录 / 快照** | 派单硬口径 | **§8.1 表 v2.4 行** + **§8.26** + `docs/versions/route-layer.spec.v2.4.md` | `cmp` = 0（§D0） |

---

## §D2 只追加独立复核（机器判据 · 与 `git` 正交的第二条口径）

**（a）`difflib.SequenceMatcher`（`autojunk=False`）逐 opcode**：

```
对照 = docs/versions/route-layer.spec.v2.3.md（改前基线）  vs  docs/route-layer.spec.md（改后）
opcodes = {'equal': 6, 'insert': 6}
REPLACE / DELETE = 无（0 / 0）  ⇒  append-only OK
行数（split 口径）：4254 → 4590
```

**（b）六处插入位（逐条）**：

| # | 插入位（锚 = 既有行，**该行一字未改**） | 插入物 |
|--:|---|---|
| 1 | 顶部 v2.3 状态块 ⑦ 行之后（`> **v1.1 一页纸（历史，仍在册）**：见下（…）` 之前） | **顶部 v2.4 状态块**（状态行 + 修订入口 + 要点 ①–⑥） |
| 2 | **`§7 v2.2 追加表` 的 `7-68` 行之后**（`**★★ §7 追加补注块（v2.2 · …）**：` 之前） | **`§7 v2.4 追加表`**（表题 + 表头 + 分隔行 + **`7-69` / `7-70` / `7-71`** 三行） |
| 3 | **补注块 `㉟` 行之后** | **补注块 `㊱`**（`§18.5` / `§18.1` 行锚的版本基线） |
| 4 | **§8.1 表 `v2.3` 行之后** | **§8.1 表 `v2.4` 行** |
| 5 | **`§8.25.6` 段之后**（`## §9 ★★ 批 4 施工清单` 之前） | **`§8.26`（新节）** |
| 6 | **文件末行之后（EOF）** | **`§19`（新节 · §19.0–§19.9）** |

**（c）负对照（门自证 · 写死）**：把上表任一处插入**改成「改写既有行」**（如把 `7-68` 行改字）⇒ `git diff --numstat` **删除列必 ≠ 0**、`difflib` **必出 `replace`/`delete`** ⇒ **门转红**（**本单已实测「改一字即红」的等价情形**：过程内对**本单元自身新增行**的两次修订（`§8.26.6` 的 `N` → `4589`）仍落在**同一插入块内** ⇒ `numstat` 仍 `337/0`、`difflib` 仍 `6 equal / 6 insert`，**证「新增块内自洽修改不触及既有行」**）。

---

## §D3 十一权限键（逐字 · 三真源 · 本单现取）与映射

**真源 A** = `backend-ts/src/database.ts:11-23`（`ALL_ADMIN_PERMISSIONS`，**11 键**）｜**真源 B** = `backend-ts/migrations/0022_admin_permission_seed.sql:50-61`（**11 行种子**；apply-time 自检 `:112-132`：`count(*) <> 11 ⇒ RAISE` + 缺键 / 多键各自 `RAISE`）｜**真源 C** = `frontend/src/admin-utils.js:40-52`（**11 键**）：

```
dashboard_access · manage_tasks · publish_tasks · manage_rewards · publish_prizes
read_users · manage_users · manage_points · manage_permissions · manage_settings · review_tasks
```

| 口 / 面 | → 既有键 | 现取锚 |
|---|---|---|
| 写口 `POST /api/admin/commission_policy` | **`manage_settings`** | `backend-ts/src/index.ts:1999`（注册）/ `:2000`（闸） |
| 新增读口 `GET /api/admin/commission_policy` | **`manage_settings`** | 先例 = `GET` + `POST /api/admin/settings` 同闸（`:1127-1128` / `:1156-1157`） |
| 费率页 / 权重矩阵页 | **`manage_settings`** + `dashboard_access` | `frontend/src/App.jsx:243`（同族先例） |

> **`R-8-1` 履约**：**零新增键 / 零删除键**；**无「停报」行**（11 键内 `manage_settings` 语义 = 「系统设置」= 平台配置写 / 读，与本片「平台经济参数配置」一致）。

---

## §D4 「真生效」四段判据（细目 · 见本册 §19.4 正式条文）

| 项 | ①后台写 | ②库内落值（**表 / 列**） | ③业务读口取数（**`文件:行`**） | ④行为随之（**改动前 / 改动后**） |
|---|---|---|---|---|
| **`fee_rate_bp`** | `POST /api/admin/commission_policy`（闸 `manage_settings`） | **表 `commission_policy` / 列 `fee_rate_bp`（`integer`，CHECK `BETWEEN 100 AND 500`）**〔`0007:84-99`，`:92`〕 | `src/commission.ts:201` `getCommissionPolicy`（`:207-215` 的 `SELECT … WHERE effective_from <= COALESCE($1::timestamptz, now()) ORDER BY effective_from DESC LIMIT 1`）；DB 同核 = `migrations/0013_job.sql:292` | **`fee = (gross × fee_rate_bp + 5000) / 10000`**（`src/commission.ts:391-393`）⇒ **下一笔 `job_post_event(op='settle')` 的 `job_fee` 金额随之变** |
| **`weights_bp`** | **同一写口**（body 含 `levels` + `weights_bp`） | **表 `commission_policy` / 列 `weights_bp`（`smallint[]`）+ 列 `levels`**〔`0007:93-95`〕 | `src/commission.ts:432` `splitPool(pool, weights)`（**最大余数法**，`Σx_L == P` 构造保证）；DB 同核 = `migrations/0013_job.sql:250,336-360` | **`commission` 各层分配额 `x_L`** + 分录 `weight_bp`（`src/commission.ts:634`）**随之变**；`Σx_L == fee` 与 `-2` 池守恒（`0007:317`，`LD032`）**仍绿** |

**逐项判负（写死 · 见本册 §19.4(b)/(c) 的「判负」块）**：
- `fee_rate_bp`：**(i)** 同一 `gross`、改前后两次结算 `job_fee` 相等 ⇒ **判负**；**(ii)** `POST` 200 但现行 `fee_rate_bp` 未变 ⇒ **判负**。
- `weights_bp`：**(i)** 同一 `fee`、改前后 `commission` 各层 `x_L` 逐层相等 ⇒ **判负**；**(ii)** `Σx_L != fee` 或 `-2` 池不守恒（`LD032`）⇒ **判负**。
- **总判据**：**只给 ①② / 只给「后台 200」⇒ 判负**（**封堵「只验后台能存」**）；③ 段**必须**给业务侧锚（**后台读口 ≠ 业务读口**）；④ 段**必须**给两读数；**每段必带判负**；**负对照必转红**。
- **`R-8-6` 执行面**：实跑**只许 DB 直造 + 读库**（`INSERT INTO commission_policy …`；`SELECT … FROM ledger_entry WHERE event_root_key = 'biz:job:settle:<job_id>'`）；**不得新增路由**；**不得**以 `GET /api/admin/commission_policy` 承载验收读数。

> **★ 数值一律未发明**：`fee_rate_bp = 100` / `weights_bp = {3000,2000,1500,1000,800,600,500,300,200,100}` / `levels = 10` = **转引现取读数**（`data-layer.spec` §17.2 `DL152`；`docs/data-layer.spec.md:114`），**已标来源**；**本单不写入任何新数值**（**待 Kevin** 者照旧）。

---

## §D5 后台页数据契约与四语文案面（细目）

**（a）字段（唯一来源 = 新增读口 `data`）：`CommissionPolicy` 8 键**（`backend-ts/src/commission.ts:122-131` 现取）：`policy_id` / `fee_rate_bp` / `levels` / `weights_bp` / `effective_from` / `created_by` / `time_created` / `weights_sum_bp`。

- **费率页**用：`fee_rate_bp`（展示换算 `fee_rate_bp / 100` %，**bp = 唯一存储真源**）/ `effective_from` / `created_by` / `time_created` / `policy_id` / `weights_sum_bp`（只展示）。
- **权重矩阵页**用：`levels`（行数）/ `weights_bp[1..levels]`（每行权重，**原序**）/ `weights_sum_bp`（Σ 校验，上限 **10000**，`src/commission.ts:188`）。
- **★ 非读口字段（页面派生、不得当存储值）**：归一化分母 `W`（各层 `Σ_{L≤M} w_L`，`M = min(levels, chain_depth)`；`src/commission.ts:660`）。
- **★ 前端必须同判**：`weights_bp[1] > 0`（`src/commission.ts:191`）/ `Σ ≤ 10000`（`:188`）/ `Σ = 0` 拒（`:190`）/ `fee_rate_bp ∈ [100,500]`（`:175`）—— **防提交必被拒的值**。

**（b）四语文案面**：语言面 = `frontend/src/locales/{zh,en,hk,vn}.json`（**四文件顶层键数均 = 103**，命名空间清单逐字相同）；命名空间**承既有 `admin*` 先例**（11 个：`admin_panel` / `adminNav` / `adminLayout` / `adminCommon` / `adminTasks` / `adminRewards` / `adminPermissions` / `adminPoints` / `adminShards` / `adminSettings` / `adminUsers`）⇒ **本片新增命名空间 = `adminFeeRate` / `adminWeightMatrix`**；**键名清单 = 待实现单按约定落（本单不发明）**；**四语逐键齐（缺任一语 ⇒ 判负）**。

**（c）禁工程口径泄漏六类（用户可见文案 · 可判负）**：

| # | 禁项 | 例 |
|--:|---|---|
| ① | 本册章节号 / 条号 | `§19.2` · `§7-16` · `R-8-1` |
| ② | HTTP 状态码 | `400` · `403` · `500` |
| ③ | 接口路径 / 方法 | `/api/admin/commission_policy` · `POST` |
| ④ | 内部批次名 / 单号 | `8②` · `P6` · `B8` · `JING-SPEC-B8-2` |
| ⑤ | 机读码 / 裸 i18n 键 | `POLICY_SHAPE_INVALID` · `adminFeeRate.title` |
| ⑥ | 表名 / 列名 / 函数名 | `commission_policy` · `weights_bp` · `job_settle_plan` |

- **判负形态**：四语 locale 的 `adminFeeRate*` / `adminWeightMatrix*` **键值正则扫描**（命中任一类 ⇒ **判负**）；**负对照** = 把一条文案改成 `"费率（§19.2）"` ⇒ **扫描必须转红**。
- **豁免面（写死）**：日志 / 调试 / **非本地化客户端**（= R107 的 `message` 面）**不受本条约束**（承本册 §3.3 条款 9′ / §15.5）。
- **★ 文案「值」= 产品 / 文案决策 ⇒ 本单不写**（登记 `I-2`）。

---

## §D6 `R-8-14` 基线声明（细目 · 见本册 §19.6 / 补注块 ㊱）

**（a）声明**：**`§18.5` 与 `§18.1` 的全部 `:NNNN` 行锚及「现取命令」读数的基线 = `docs/versions/route-layer.spec.v2.2.md`（4030 行）**；两节**未声明基线** ⇒ 本单补（**两节正文一字未改**）。

**（b）漂移对照（本单现取 · 两档亲读）**：

| # | 锚 / 命令 | v2.2（4030 行） | 现行 v2.3（4253 行） | 漂移 |
|--:|---|---|---|---|
| ① | `:1798`（§7 表 `7-63` 行） | 命中（`\| **7-63（v2.2 新增）** \| …`） | **`:1810`** 同文 | **+12** |
| ② | `sed -n '3042p'` | **空行**（两侧 `:3041` = `**C · 审计面真值（…）**`、`:3043` = `\| 面 \| 读数（本册现取） \|`） | **`:3042` = 正文行**（`- **★ 26 个 IO 出口统一走分类器**（转引 …`）⇒ **「空行」读数不复现**；对应空行 = **`:3098`** | **不复现**（对应位 **+56**） |
| ③ | `§12.1.1` 节头 `:3080` | 命中（`#### 12.1.1 权限闸候选：…`） | **`:3136`** 同文 | **+56** |
| ④ | `§12.1.1` 内容行 `:3096` | 命中（`- **若 Zang 认为应改为新键** ⇒ …`） | **`:3152`** 同文 | **+56** |
| ⑤ | `:3922`（§17.2(a) 闭集注） | 命中（`> **★ 闭集（写死）**：**恰好 11 键…`） | **`:3978`** 同文 | **+56** |
| ⑥ | `:4030`（§17.8 末行） | 命中（`\| **`§12.1.1:3042`**（新权限键须 4 处同批改） \| …`） | **`:4086`** 同文 | **+56** |
| ⑦ | `grep -n '§12.1.1:3042'`（§18.1 现取，恰三处） | **`1798` / `3922` / `4030`** | **`1810` / `3978` / `4086`** | **+12 / +56 / +56** |

**（c）三条结论（写死）**：**(i)** §18.5 / §18.1 行锚 = **v2.2 基线**（两节均未声明）；**(ii)** 漂移**不均匀**（`+12` vs `+56`）⇒ **不得按统一 `+Δ` 推算**（原因 = v2.3 在 `:1798 → :3080` 之间另有插入：§7 v2.3 追加表 4 行 + §8.1 表 1 行 + §8.25 新节）；**(iii)** **同一命令的语义读数会变**（`sed -n '3042p'`：v2.2 空行 / v2.3 正文行）⇒ 正是 §18.6(a)2「真源版本须写明」的后果。

**（d）可判负四断言**（见本册 §19.6(c)）：v2.2 档 `3042p` = **空**；v2.3 档 `3042p` = **非空**；`grep -n '§12.1.1:3042'` = **恰三处且 = `1810` / `3978` / `4086`**；**负对照** = 把任一 v2.3 读数列改成 `+1` ⇒ **必转红**。

**（e）加严（承 §18.6 并追加）**：**凡引 `sed -n '<行>p'` 的读数 ⇒ 必须同时给「命令 + 版本 + 期望输出（空 / 非空）」三件**。

---

## §D7 ★ 为什么本单**不动** `docs/data-layer.spec.md`（**逐字理由 · 判无对象需追加**）

> **结论（写死）**：**本单判「无须动」** ⇒ **不升 v0.12、不建快照、不建 delta**（**不为对称而造件**）。**理由逐条（全部带现取 / 转引锚）**：

| # | 理由 | 依据（锚） |
|--:|---|---|
| ① | **本片零 DDL**：表 `commission_policy` 与其**全部列**（`policy_id` / `fee_rate_bp` / `levels` / `weights_bp` / `effective_from` / `created_by` / `time_created`）、**全部约束**、**两个触发器**均**已在既有迁移 `0007` 内**；**无新建表、无新增列、无新增索引、不改已 apply 迁移** | `backend-ts/migrations/0007_referral_and_commission_policy.sql:81-112`（表 + 4 约束 + append-only + weights_guard） |
| ② | **读口读的「真源」已在数据层条文内**：`DL2` 逐字「邀请关系与佣金政策的**真源 = `referral` / `commission_policy`**」；`DL70` ① 逐字「③**「当前费率/权重」读 `commission_policy` 的 `policy(now())`（CR23）**」⇒ 本片读口**无新真源、无新语义** | `docs/data-layer.spec.md`（`DL2` 行；`DL70` 行） |
| ③ | **索引纪律本单已承接，无需在数据层追加**：`DL70` 末句逐字「**并明确：不为这些读口新增索引**（`DL74`）」⇒ 本册 §19.2(b) 已写死「**不得为读口新增索引**」并注明承 `DL70` / `DL74` 口径 | `docs/data-layer.spec.md`（`DL70` 行） |
| ④ | **政策表回归判据本单只转引、未改**：`DL152`（`max(effective_from)` 行的 `fee_rate_bp` / `levels` / `weights_bp` **必须等于预期组合** + **夹具禁令**）＝ 本单 §19.4 的**现取数值来源**；**判据本身一字未改** | `docs/data-layer.spec.md` §17.2 `DL152`（`:995-999` 区）；`docs/data-layer.spec.md:114` |
| ⑤ | **不可变性归属已定且与写口语义一致**：`DL76` 逐字把 `commission_policy` 列入「**不可变（append-only 触发器）**」族；写口 = **INSERT-only / 永不 `UPDATE`**（CR8）⇒ **两者相容、无新规则** | `docs/data-layer.spec.md`（`DL76` 行）；`src/commission.ts:236-238` |
| ⑥ | **本片不碰 `app_config` 面**：`data-layer.spec` §21（合法键清单）/ §22（`AG1`–`AG4` / `R-8-9`）管的是 **`app_config` 键面**；本片费率**真源 = `commission_policy`**、**永不读 `app_config`**（本册 §7-16 读取侧纪律）⇒ **零交集** | 本册 §7-16；`docs/data-layer.spec.md` §21 / §22 |
| ⑦ | **★ 诚实边界（写死）**：该判定 = **本单判断、未经第三方复核**（登记本册 §19.7-7）；**若 Zang 认为「管理面读口」须在数据层登记**（如新增一条 `DL` 或 `B8R*`），⇒ **另开 `data-layer` 追加单**（**本单不擅自升 v0.12**） | 本册 §19.7-7 |

---

## §D8 未测项 / 自曝 / 登记（与主册 §19.7 / §19.8 / §8.26.3 逐条同源）

- **未测（7 项）**：读口实现面 / 注册点 69 实取 / 四段判据实跑 / 现库费率与权重现取复核 / 页面本体与 i18n 键落键 / `ops:` 修复 / 本件 §D7 判定的第三方复核 —— **逐项原因见主册 §19.7**（**无 0 / 无空 / 无占位**）。
- **自曝（5 条）**：① 「就地加注 vs 删除列 = 0」冲突处置（取机器判据优先）；② 派单路径 `docs/audit/commission.spec.md` **现取不存在**（实际 = `docs/commission.spec.md`）；③ `R-8-14` 的实质 = `§18.5` 自身缺基线、且其「错引位置」列亦为 v2.2 读数；④ 唯一新增路径 = **既有路径换 verb**（`POST` → `GET` 同名路径）；⑤ §19.4 判据**未实跑**。**逐条见主册 §8.26.3**。
- **实施登记（8 条）**：`I-1`（`data` 形态 A/B 选型）· `I-2`（四语文案值 + 键清单）· `I-3`（读口落地 / 68 → 69）· `I-4`（`ops:` 补齐）· `I-5`（两页实现）· `I-6`（四段判据实跑）· `I-7`（禁泄漏扫描门）· `I-8`（漂移对照表在实现单落盘后重取）。**逐条见主册 §19.8**。
- **主册 §7 登记（3 条）**：`§7-69`（`ops:` 缺口）· `§7-70`（新增读口 + 注册点）· `§7-71`（四语文案面 + 禁泄漏）。**逐条见主册 §7 v2.4 追加表**。

---

## §D9 未触碰清单（逐条 · 与主册 §8.26.1 同源）

- **只碰**：`docs/route-layer.spec.md`（就地升 v2.4）· `docs/versions/route-layer.spec.v2.4.md`（**新建**）· `docs/audit/route-layer-v2.4-delta.md`（**新建 = 本件**）。
- **未碰**：**代码**（`backend-ts/**` / `frontend/**` —— **只读**：`grep` / `sed -n` / `wc` / `ls`）· **`migrations/**`** · `docs/seafood.master-plan.md` · `docs/qa/**` · `docs/audit/**`（**既有件**）· `docs/design/**` · `docs/ledger.spec.md` · **`docs/commission.spec.md`（真源册 · 只读 · 未改一字）** · `docs/data-layer.spec.md`（**判定无须动**，见 §D7）· `docs/versions/route-layer.spec.v0.1–v2.3.md`（**二十三个旧快照一字未动**）· `docs/versions/data-layer.spec.v0.1–v0.11.md`（**十一个**，未动）· `.env*`（**未碰、未打印**）· `vercel.json`。
- **未执行**：`git add` / `git commit` / `git push`｜`npm install`｜`pkill -f` / `killall`｜**未启停 5787 / 5788**｜**未跑任何前端套件 / 门 / HTTP / 库连接**。
- **原始输出**：本单**无新原始输出产物**（若将来有 ⇒ 用 `.json` / `.txt`，**不用 `.log`**）。
